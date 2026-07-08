# Plan 01 — Move Web-Push sends off the request thread

**Rank:** 1 of 5 · **Effort:** Small (~1–2 h incl. tests) · **Risk:** Low

## The problem
Every task move, new assignment, and @-mention comment sends Web Push
notifications **synchronously inside the HTTP request**. `pywebpush.webpush()`
is a blocking outbound HTTPS call to Google/Mozilla/Apple push services
(~100–500 ms each, worse on cold TLS), and the helpers loop over ALL matching
`PushSubscription` rows serially. On Render free tier the whole app runs on
gunicorn `--workers 2 --threads 4` (render.yaml `startCommand`) — 8 request
slots total. One member moving a task in an org with, say, 5 admins × 2
devices holds a slot for 1–5 s; a push-service brownout (timeouts, not 404s)
can hold it for the full socket timeout. The user sees a slow "move" that has
nothing to do with the move itself.

## Evidence
- `backend/tasks/views.py:44-63` — `_notify_admins_moved`: serial
  `send_web_push(sub, payload)` loop over every admin subscription, called
  from the status-move action at `backend/tasks/views.py:260`.
- `backend/tasks/views.py:66-84` — `_notify_mentioned` (called at `:295`
  inside comment creation).
- `backend/tasks/views.py:86-110` — `_notify_assigned` (called at `:210`
  perform_create and `:225` perform_update).
- `backend/notifications/push.py:12-36` — `send_web_push` wraps blocking
  `pywebpush.webpush()`; no timeout parameter is passed (pywebpush/requests
  default = no timeout → a hung push service can hold the thread
  indefinitely).
- `render.yaml` — `--workers 2 --threads 4` (8 slots).
- Contrast: `backend/notifications/daily.py:108-126` also loops sends but runs
  from a cron-triggered endpoint, not a user-facing write — acceptable there,
  but it benefits from the same helper for free.

## Exact change plan
1. **Add a tiny dispatcher** in `backend/notifications/push.py`:
   ```python
   from concurrent.futures import ThreadPoolExecutor
   _push_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="webpush")

   def send_web_push_async(subscription, payload: dict) -> None:
       """Fire-and-forget: queue one push onto the shared pool."""
       _push_pool.submit(send_web_push, subscription, payload)
   ```
   No Celery/Redis — the free tier has no worker dyno; a module-level
   ThreadPoolExecutor is the correct weight here. Daemon threads are fine:
   a lost push on process shutdown is acceptable (push is best-effort by
   design — every caller already swallows exceptions).
2. **Add a timeout to the blocking call** in `send_web_push`
   (`backend/notifications/push.py:21`): `webpush(..., timeout=10)` —
   pywebpush forwards kwargs to `requests.post`, so `timeout=10` caps the
   worst case. Verify the installed pywebpush version accepts `timeout`
   (it has since 1.10; check `backend/requirements.txt`) — if not, pass
   `requests_session` with a mounted timeout adapter instead.
3. **Switch the three request-path helpers** in `backend/tasks/views.py`
   (lines 61, 80, 106) from `send_web_push(sub, payload)` to
   `send_web_push_async(sub, payload)`. Import once at the top of each helper
   (they already do local imports — keep that pattern).
4. **Important subtlety — subscription pruning:** `send_web_push` calls
   `subscription.delete()` on 404/410 from a pool thread. Django DB access
   from a non-request thread is fine (each thread gets its own connection),
   but connections must be closed: wrap the pool task —
   ```python
   def _run(sub, payload):
       try:
           send_web_push(sub, payload)
       finally:
           from django.db import connection
           connection.close()
   ```
   and submit `_run`. Without this, Neon connections leak from pool threads.
5. **Leave `daily.py` synchronous** (it counts successes at `:126` and runs
   off the request path) — do NOT change its call sites.

## Verification
1. `cd backend && ./venv/Scripts/python.exe -m pytest -q` — full suite green.
   `notifications/test_extra.py:78` monkeypatches `notifications.push.send_web_push`;
   confirm the async path still routes through that symbol (submit the module
   attr lookup lazily: `_push_pool.submit(lambda: _run(sub, payload))` or look
   up `send_web_push` inside `_run`) so existing tests still observe sends —
   OR update the test to monkeypatch `send_web_push_async`. Add one new test:
   mention-notify returns before pushes complete (monkeypatch a slow
   `send_web_push` with `time.sleep(0.5)`, assert the view responds in <0.5 s).
2. Manual: local run, subscribe a browser to push (VAPID dev keys), move a
   task, confirm the push still arrives and the PATCH response is instant.
3. Deploy → live smoke: move a task on
   https://ananda-taskboard.onrender.com/ with DevTools Network open; PATCH
   `/api/tasks/...` should return in <400 ms (previously spiky).

## Risks & abort conditions
- **Risk:** thread-pool + Neon connection leak → symptoms: Neon "too many
  connections". Mitigated by step 4's `connection.close()`. **Abort/rollback**
  if Neon connection count climbs post-deploy (Render logs / Neon dashboard):
  revert the three call sites to the sync function (one-line each).
- **Risk:** pywebpush version rejects `timeout` kwarg → step 2 fallback.
- **Do NOT** introduce Celery/RQ/Redis here — over-engineering for free tier;
  abort any drift in that direction.
- No frontend change → the deploy-dist gotcha does not apply to this plan.
