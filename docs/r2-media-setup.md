# Media uploads (Cloudflare R2) — turn-on checklist

Task / subtask / bug-report media attachments are built and deployed, but **stay
dormant until these are set** (the API returns `503 "File uploads aren't
configured"` and the UI shows that error). Nothing else in the app is affected.

## 1. Render env vars (Dashboard → the web service → Environment)

| Key | Value |
|---|---|
| `R2_ENDPOINT_URL` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (the **S3 API** endpoint — NOT the public `*.r2.dev` URL) |
| `R2_ACCESS_KEY_ID` | the Ananda Connect R2 token's Access Key ID (account-wide token → works for this bucket) |
| `R2_SECRET_ACCESS_KEY` | that token's Secret Access Key |
| `R2_BUCKET` | `taskboard-media` |

Optional caps (defaults shown): `ATTACH_MAX_PER_TARGET=5`,
`ATTACH_MAX_IMAGE_BYTES=2097152` (2 MB), `ATTACH_MAX_DOC_BYTES=5242880` (5 MB),
`ATTACH_MAX_VIDEO_BYTES=26214400` (25 MB).

Save → Render redeploys automatically.

## 2. Bucket CORS (R2 → `taskboard-media` → Settings → CORS Policy)

The browser uploads straight to R2 via a presigned `PUT`, so the bucket must allow
it from the app origins:

```json
[
  {
    "AllowedOrigins": [
      "https://ananda-taskboard.onrender.com",
      "http://localhost:8009",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

(Files are *served* via a 302 redirect that an `<img>`/`<video>` tag follows, so
GET reads don't strictly need CORS — but leaving GET in is harmless.)

## 3. Keep the bucket PRIVATE

Do **not** enable public access. The app serves files through an authenticated,
short-lived signed link (`/api/attachments/<id>/file?t=…`, 1-hour expiry) that the
permission-gated list endpoint hands out — so task media stays as gated as the
task itself.

## 4. Verify

After the redeploy: open a task → **Attachments** → **Add media** → drag an image
in. It should upload, appear in the list, and open via its link. Same on subtasks
and Report a problem.

## Notes
- Images are compressed client-side (resize ≤1600px + JPEG) before upload; docs
  and short video upload as-is, size-capped.
- Bug-report attachments auto-purge after 90 days (with the daily job), matching
  the old screenshot retention. Task/subtask media lives as long as the task.
- 10 GB R2 free tier is shared across all buckets in the account (incl. Connect).
