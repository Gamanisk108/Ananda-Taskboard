/* =============================================================
   Ananda Taskboard — COMMUNITY TRANSLATIONS · feature surfaces (TR)
   (a) Settings → Help Us landing  (b) Improve-translations contributor
   (c) Translation review (poll graph). Web + phone, all states.
   Built entirely on TRB chrome + the base/feature CSS — custom selects,
   line-art only, mono numbers, the .segbar-derived poll bars.
   ============================================================= */
(function () {
  const B = window.TRB, I = B.I, esc = B.esc, csel = B.csel, av = B.av, PEOPLE = B.PEOPLE;

  /* ---- languages (all LTR: en source + 12 targets incl. CJK + Indic) ---- */
  const LANGS = ['English (source)', 'Italiano', 'Español', 'Français', 'Deutsch', 'Português', '中文', 'हिन्दी', 'বাংলা', 'தமிழ்', 'తెలుగు', 'ગુજરાતી'];
  const langPicker = (val, open, lead) => csel(val, LANGS.filter(l => l !== 'English (source)'), { inline: true, open, lead: lead || `<span class="pi" style="color:var(--hu-ink)">${I.languages}</span>` });

  /* =============================================================  (a) HELP US LANDING  */
  function settingsModal(pane, opt) {
    opt = opt || {};
    const navItem = (icon, label, key) => `<button class="sn ${opt.active === key ? 'on' : ''}">${I[icon]}<span>${label}</span>${key === 'helpus' ? '<span class="nd"></span>' : ''}</button>`;
    // §2 ruling + D47: Settings is member-visible with role-filtered sections.
    // Members: Account · Notifications · Events & Holidays · Help Us. Org admins add Task statuses.
    const admin = opt.role !== 'member';
    const nav = `<div class="set-nav">
      ${navItem('user', 'Account', 'account')}
      ${navItem('bell', 'Notifications', 'notif')}
      ${admin ? navItem('listChk', 'Task statuses', 'statuses') : ''}
      ${navItem('calendar', 'Events &amp; Holidays', 'calendar')}
      ${navItem('heart', 'Help Us', 'helpus')}
    </div>`;
    return `<div class="modal" style="max-width:760px">
      ${B.modalHead('Settings', 'Manage your account, the board, and ways to help')}
      <div class="modal-body" style="padding:0"><div class="set-shell">${nav}<div class="set-pane">${pane}</div></div></div>
    </div>`;
  }
  const HU_LOTUS = I.lotus.replace('width="16" height="16"', 'width="30" height="30"').replace('class="lotus"', '');
  // §2 design ask: the panes that absorb the account-menu's language/theme/notification items
  const paneHead = (t, sub) => `<div class="hu-head"><h3>${t}</h3><div class="sub">${sub}</div></div>`;
  const toggleRow = (label, on, hint) => `<label class="an-toggle"><span class="an-tg ${on ? 'on' : ''}"><span class="an-tg-knob"></span></span><span class="an-tg-tx"><span class="an-tg-lbl">${label}</span>${hint ? `<span class="an-tg-hint">${hint}</span>` : ''}</span></label>`;
  function accountPane(view) {
    if (view === 'password') {
      // change-password sub-view: back to Account, three fields, D39-aligned action row
      return `<button class="set-back">${I.arrowLeft} Account</button>
      ${paneHead('Change password', 'Choose something only you would know.')}
      <div class="field"><label>Current password</label><input type="password" value="••••••••••" /></div>
      <div class="field"><label>New password</label><input type="password" placeholder="At least 8 characters" /></div>
      <div class="field"><label>Confirm new password</label><input type="password" placeholder="Type it again" /></div>
      <div class="set-actions"><button class="btn btn-secondary">Cancel</button><button class="btn btn-primary">${I.check} Update password</button></div>`;
    }
    return paneHead('Account', 'Your profile and how the board looks for you.')
      + `<div class="field"><label>Name</label><input type="text" value="Admin Ada" /></div>
      <div class="field"><label>Email</label><div class="static-val">admin@ananda.test</div><div class="hint">Sign-in email can\u2019t be changed here.</div></div>
      <div class="field"><label>Language</label>${B.csel('English', ['English', 'Italiano', 'Español', 'Français', 'Deutsch', 'Português', '中文', 'हिन्दी'], {})}</div>
      <div class="field"><label>Theme</label><div class="an-seg" style="max-width:200px"><button class="an-seg-opt on">Light</button><button class="an-seg-opt">Dark</button></div></div>
      <div class="set-divider"></div>
      <button class="btn btn-secondary">Change password</button>`;
  }
  // Task statuses pane — faithful reproduction of the canonical status manager
  // (Ananda Taskboard.html #statusList), updated to the FIVE-status rule (Review 2nd-to-last)
  function statusesPane() {
    const STS = [
      { n: 'To Do', c: '#6b7280' }, { n: 'In Progress', c: '#2c64a8' }, { n: 'Delayed', c: '#bb3b28' },
      { n: 'Review', c: '#7a5aa6' }, { n: 'Done', c: '#3f7d54', complete: true },
    ];
    return paneHead('Task statuses', 'Kanban columns — apply to all projects.')
      + `<div class="st-hint">Drag to reorder. Default statuses can\u2019t be deleted; <strong>Done</strong> always marks tasks complete.</div>
      <div class="st-list">${STS.map(s => `<div class="sub-row" draggable="true"><span class="drag-handle" title="Drag to reorder">⠿</span><button type="button" class="swatch-btn" style="background:${s.c}"></button><input value="${s.n}" />${s.complete ? '<span class="pill st-complete">Task Complete</span>' : ''}</div>`).join('')}</div>
      <div class="sub-add"><button type="button" class="swatch-btn" style="background:#a23e6e"></button><input placeholder="New status name…" /><button class="btn btn-secondary">Add status</button></div>`;
  }
  // Events & Holidays pane — two in-pane tabs. Add-form on top, list below.
  // Admin-set items are LOCKED for members; every member can add PERSONAL items only they see (D47).
  function calendarPane(tab, role) {
    tab = tab || 'events'; const admin = role !== 'member';
    const tabs = `<div class="an-seg pane-tabs"><button class="an-seg-opt ${tab === 'events' ? 'on' : ''}">Events</button><button class="an-seg-opt ${tab === 'holidays' ? 'on' : ''}">Holidays</button></div>`;
    const acts = `<span class="lr-acts"><button class="btn btn-ghost">Edit</button><button class="btn btn-ghost lr-x">${I.x}</button></span>`;
    const lock = `<span class="lr-lock" title="Set by admins — only admins can change">${I.lock}</span>`;
    const evRow = (ic, t, sub, locked) => `<div class="listrow"><span>${ic} <strong>${t}</strong> · <span class="mutedtx">${sub}</span></span>${locked ? lock : acts}</div>`;
    const head = paneHead('Events & Holidays', 'Shown on the Weekly & Monthly calendars.') + tabs;

    if (tab === 'holidays') {
      const SETS = [
        ['US Federal holidays', "New Year's, MLK, Memorial Day, Juneteenth, July 4, Labor Day, Thanksgiving, Christmas…", true],
        ['US observances', "Mother's Day, Father's Day, Daylight Saving, Flag Day…", true],
        ['Christian / religious', 'Easter, Ash Wednesday, Pentecost, Trinity Sunday, Advent…', false],
        ['Hindu / yoga festivals', 'Diwali, Maha Shivaratri, Holi, Guru Purnima…', true],
        ['Italian holidays', 'Capodanno, Liberazione (Apr 25), Festa della Repubblica, Ferragosto, Ognissanti…', true],
        ['Ananda lineage days', "Yogananda's birthday, Founding of Ananda Village, Master's Mahasamadhi…", true],
      ];
      const team = admin
        ? SETS.map(([t, dsc, on]) => `<label class="holiday-set"><input type="checkbox" ${on ? 'checked' : ''}><span><span class="hs-t">${t}</span><span class="hs-d">${dsc}</span></span></label>`).join('')
          + `<div class="set-actions" style="justify-content:flex-start;max-width:none"><button class="btn btn-primary">Save</button></div>`
        : SETS.filter(s => s[2]).map(([t, dsc]) => `<div class="holiday-set static"><span class="hset-on">${I.check}</span><span><span class="hs-t">${t}</span><span class="hs-d">${dsc}</span></span></div>`).join('');
      return head
        + `<div class="ev-card"><div class="ec-t">Add a holiday <span class="mutedtx">(only you see it)</span></div>
          <div class="hol-addrow"><input placeholder="Holiday name…" /><input type="date" /><button class="btn btn-primary">Add</button></div></div>
        <div class="sec-label">Your holidays <span class="own-tag">only on your board</span></div>
        ${evRow('🪔', 'Guru\u2019s arrival day', 'Every year on 07-14', false)}
        <div class="set-divider"></div>
        <div class="sec-label">Team holiday sets ${admin ? '' : lock}</div>
        <div class="st-hint">${admin ? 'Enabled sets show for <strong>everyone</strong> in your organization. They never appear as tasks.' : 'Set by your admins for the whole organization — shown here so you know what\u2019s on the calendar.'}</div>
        ${team}`;
    }
    // Events tab — Add card on top, list below
    return head
      + `<div class="ev-card"><div class="ec-t">Add an event ${admin ? '' : '<span class="mutedtx">(only you see it)</span>'}</div>
        <div class="row2"><div class="field"><label>Title</label><input placeholder="Event title…" /></div><div class="field"><label>Start date</label><input type="date" /></div></div>
        <label class="m-chk ev-rep"><input type="checkbox" checked /> Repeats</label>
        <div class="ev-reppanel">
          <div class="row2"><div class="field"><label>Every</label><input type="number" min="1" value="1" style="max-width:100px" /></div><div class="field"><label>Unit</label>${B.csel('week(s)', ['day(s)', 'week(s)', 'month(s)', 'year(s)'], {})}</div></div>
          <div class="field" style="margin-top:10px"><label>Repeat on</label><div class="ev-wd">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => `<button type="button" class="btn ${i === 0 || i === 6 ? 'btn-primary' : 'btn-secondary'} wd">${d}</button>`).join('')}</div></div>
          <div class="row2" style="margin-top:10px"><div class="field"><label>Ends</label>${B.csel('After N times', ['Never', 'After N times', 'On date'], {})}</div><div class="field"><label>Times</label><input type="number" min="1" value="4" style="max-width:120px" /></div></div>
        </div>
        <div class="set-actions" style="justify-content:flex-start;max-width:none"><button class="btn btn-primary">Add event</button></div>
      </div>
      <div class="sec-label">Your events <span class="own-tag">only on your board</span></div>
      ${evRow('🧘', 'Personal sadhana day', 'Every month on the 21st', false)}
      <div class="set-divider"></div>
      <div class="sec-label">Team events ${admin ? '' : lock}</div>
      ${admin ? '<div class="st-hint">Visible to <strong>everyone</strong> in your organization.</div>' : '<div class="st-hint">Set by your admins — locked for members.</div>'}
      ${evRow('🎂', "Karuna's birthday", 'Every year on 06-09', !admin)}
      ${evRow('🔁', 'Hatha class', 'Sat &amp; Sun (weekly) from 2026-06-07, 4 wks', !admin)}`;
  }
  function notifPane(digestOff) {
    const on = !digestOff;
    return paneHead('Notifications', 'What Ananda Taskboard may send you, and when.')
      + `<div class="set-toggles">
        ${toggleRow('Daily digest', on, 'One push each morning with your tasks for the day.')}
        <div class="field ${on ? '' : 'disabled'}" style="margin:8px 0 14px 49px;max-width:200px"><label>Digest time</label>${B.csel('7:00 AM', ['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM'], {})}</div>
        ${toggleRow('Deadline reminders', true, 'When a task you\u2019re assigned to is due soon or overdue.')}
        ${toggleRow('Assignment changes', false, 'When someone assigns a task to you or takes one over.')}
      </div>
      <div class="note an-spread-note">${I.info} Notifications arrive through the web app itself — no app store needed. On a phone, add the board to your Home Screen and allow notifications when asked.</div>`;
  }
  function huCard(c) {
    const cta = c.soon
      ? `<button class="btn btn-secondary" disabled>${esc(c.cta)}</button>`
      : `<button class="btn btn-primary">${esc(c.cta)}</button>`;
    return `<div class="hu-card ${c.soon ? 'soon' : ''}">
      <div class="hu-ic">${I[c.icon]}</div>
      <div class="hu-tx">
        <div class="hu-t">${esc(c.t)}${c.soon ? '<span class="hu-chip">Coming soon</span>' : ''}</div>
        <div class="hu-b">${c.b}</div>
        ${c.meta ? `<div class="hu-meta">${c.meta}</div>` : ''}
      </div>
      <div class="hu-cta">${cta}</div>
    </div>`;
  }
  function huPane(variant, qpos) {
    qpos = qpos || 'between';
    const cards = [{
      icon: 'languages', t: 'Improve translations',
      b: 'Suggest clearer wording in your language — the community picks the best. Do as many or as few as you like.',
      meta: `<span class="mono">12</span>&nbsp;languages&nbsp;·&nbsp;<span class="mono">555</span>&nbsp;phrases`, cta: 'Translate',
    }];
    if (variant === 'multi') {
      cards.push(
        { icon: 'alert', t: 'Report a problem', b: 'Spotted something broken or confusing? Tell us where it happened and we\u2019ll take a look.', cta: 'Report' },
        { icon: 'sparkle', t: 'Suggest a feature', b: 'Have an idea that would make the board better for your community? We read every one.', cta: 'Suggest' },
        // D48: "Spread the word" deferred post-MVP (referral/email plumbing beyond MVP scope).
        // Flow code (TRF.webSpread / phoneSpread) + canvas section retained; re-enable by
        // restoring this card. Kept out of the live hub.
        // { icon: 'share', t: 'Spread the word', b: 'Invite another Ananda center or seva team to keep their work here too.', cta: 'Invite' },
      );
    }
    return `${huHead(qpos)}
      <div class="hu-stack">${cards.map(huCard).join('')}</div>`;
  }
  // lite quote — no box, no logo; just Fraunces-italic line + attribution
  const quoteLite = () => `<p class="an-quote-lite"><span class="qt">Many hands make a miracle.</span><span class="qw">Swami Kriyananda</span></p>`;
  function huHead(qpos) {
    const title = `<h3><span class="hu-heart">${B.I.heart}</span>Help Us</h3>`;
    const sub = `<div class="sub">Small ways to make Ananda Taskboard better for everyone. We\u2019ll add more here over time.</div>`;
    if (qpos === 'title') return `<div class="hu-head"><div class="hu-titlerow">${title}${quoteLite()}</div>${sub}</div>`;
    if (qpos === 'between') return `<div class="hu-head">${title}${quoteLite()}${sub}</div>`;
    return `<div class="hu-head">${title}${sub}${quoteLite()}</div>`; // 'below'
  }
  function webHelpUs(variant, qpos, role) {
    return B.webframe(`${B.appShell({ dim: true })}
      <div class="modal-backdrop">${settingsModal(huPane(variant, qpos), { active: 'helpus', role })}</div>`);
  }
  // §2: the new Settings panes (web)
  function webSettings(pane, role, opt) {
    const body = pane === 'account' ? accountPane(opt) : pane === 'statuses' ? statusesPane() : pane === 'calendar' ? calendarPane(opt, role) : notifPane(opt === 'digestOff');
    const active = pane === 'notif' ? 'notif' : pane;
    return B.webframe(`${B.appShell({ dim: true })}
      <div class="modal-backdrop">${settingsModal(body, { active, role })}</div>`);
  }

  /* =============================================================  (b) IMPROVE TRANSLATIONS  */
  // categories — untranslated-first; count = untranslated remaining (mono)
  // categories — map from the 42 real namespaces (build keeps namespace→category table).
  // count = phrases WITHOUT your suggestion (personal coverage, §1 ruling). 555 total.
  const CATS = [
    { key: 'tasks', name: 'Tasks & list', todo: 90 },
    { key: 'cal', name: 'Calendar', todo: 71 },
    { key: 'status', name: 'Status & board', todo: 0 },
    { key: 'team', name: 'Team & access', todo: 64 },
    { key: 'proj', name: 'Projects & trash', todo: 52 },
    { key: 'io', name: 'Import / Export', todo: 38 },
    { key: 'nav', name: 'Settings & navigation', todo: 57 },
    { key: 'account', name: 'Account & sign-in', todo: 44 },
    { key: 'other', name: 'Other & admin', todo: 79 },
  ];
  // every phrase already has a translation (§1): rows show Current wording always;
  // highlight = "no suggestion from YOU yet". {{placeholders}} render as chips (§6).
  // §6 FINAL (user): placeholders are INVISIBLE to members — display strips {{tokens}} entirely
  // ("Assigned to {{name}}" → "Assigned to"). Members translate only the visible text; the app
  // re-inserts the variable in its source-position slot. Token syntax lives at the API layer only.
  const renderVal = t => esc(t).replace(/\s*\{\{[^}]+\}\}\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  function strRow(r, st) {
    const untouched = !r.draft && !r.saved;
    const cls = ['tr-row', untouched ? 'untranslated' : '', (r.saved && !r.resave) ? 'saved' : '', r.error ? 'error' : '', r.simopen ? 'simopen' : ''].filter(Boolean).join(' ');
    const similar = r.sim ? (r.simopen
      ? `<div class="tr-variants"><div class="tv-h">Also covers ${r.sim.length === 1 ? 'this identical phrase' : 'these identical phrases'} (same text after trimming)</div>${r.sim.map(v => `<div class="v"><code>${esc(v)}</code></div>`).join('')}</div>`
      : `<div class="tr-similar"><button class="tr-simbtn">${I.copy}+${r.sim.length} similar</button></div>`) : '';
    let action;
    if (r.error) {
      action = `<div class="tr-err"><span class="msg">${I.alert} Couldn\u2019t save — check your connection.</span><button class="btn btn-secondary">${I.rotate} Retry</button></div>`;
    } else {
      // saved rows stay fully editable — a member can revise and re-save anytime (re-edit)
      const prev = r.resave && r.prev ? `<div class="tr-prev">Previously saved “${esc(r.prev)}” — editing</div>` : '';
      let btn;
      if (r.resave) btn = `<button class="btn btn-primary tr-save">${I.check} Update</button>`;
      else if (r.saved) btn = '';
      else btn = `<button class="btn btn-primary tr-save"${r.draft ? '' : ' disabled'}>${I.check} Save</button>`;
      if (r.saved && !r.resave) {
        // saved = locked in: no input field — static text + Saved ✓ + Edit (re-opens the field)
        action = `<div class="tr-inwrap"><div class="tr-field"><div class="tr-lbl">${st ? esc(st.native) : 'Your suggestion'}</div><div class="tr-minewrap"><span class="tr-mine">${esc(r.draft)}</span><span class="tr-savedwrap"><span class="tr-saved">${I.check} Saved</span><button class="btn btn-ghost tr-edit">${I.pen} Edit</button></span></div></div></div>`;
      } else {
        // textarea + button share ONE row so they're flush top AND bottom (D39); label above, hint below
        action = `<div class="tr-inwrap"><div class="tr-field"><div class="tr-lbl">${st ? esc(st.native) : 'Your suggestion'}</div><div class="tr-inputrow"><textarea class="tr-in" rows="1" placeholder="Type your concise translation…">${r.draft ? esc(r.draft) : ''}</textarea>${btn}</div>${prev}</div></div>`;
      }
    }
    return `<div class="${cls}">
      <div class="tr-en"><div class="tr-lbl">English source${r.cat ? ` <span class="tr-catref">${esc(r.cat)}</span>` : ''}</div><div class="tr-val">${renderVal(r.en)}</div>${similar}</div>
      <div class="tr-cur"><div class="tr-lbl">Current wording</div><div class="tr-val">${renderVal(r.cur)}</div></div>
      ${action}
    </div>`;
  }
  // search field (jump to any phrase across all categories) — the app's search vocabulary
  const searchBar = q => `<div class="help-search tr-search">${I.search}<input ${q ? `value="${esc(q)}"` : 'placeholder="Search phrases…"'} />${q ? `<button class="tr-search-x" title="Clear">${I.x}</button>` : ''}</div>`;
  // section accordion (reuses .help-sec); count badge = phrases without YOUR suggestion
  function catSection(c, openKey, rowsHtml) {
    const open = c.key === openKey;
    const badge = c.todo === 0
      ? `<span class="count zero mono" title="You\u2019ve suggested something for every phrase here">${I.check}</span>`
      : `<span class="count untr mono" title="${c.todo} phrases without your suggestion">${c.todo}</span>`;
    return `<div class="help-sec ${open ? 'open' : ''}">
      <button class="help-sec-head"><span class="chev">${I.chevRight}</span><span class="si">${I.listChk}</span><span class="sname">${esc(c.name)}</span>${badge}</button>
      ${open ? `<div class="tr-rows">${rowsHtml}</div>` : ''}
    </div>`;
  }
  const ES = { native: 'Español (your suggestion)' };
  function contributeBody(state) {
    // language + progress bar
    const langOpen = state === 'langopen';
    const lang = state === 'cjk' ? '中文' : state === 'indic' ? 'हिन्दी' : 'Español';
    const prog = state === 'done' ? { d: 555, t: 555 } : { d: 12, t: 555 };
    const pct = Math.round(prog.d / prog.t * 100);
    const bar = `<div class="tr-bar">
        <div class="tr-lang"><span class="lbl">Suggesting in</span>${langPicker(lang, langOpen)}</div>
        <div class="tr-prog"><span>You\u2019ve suggested</span><span class="ptrack"><i style="width:${pct}%"></i></span><b>${prog.d}</b>&nbsp;of&nbsp;<b>${prog.t}</b></div>
      </div>
      <div class="tr-srcnote">${I.info} Every phrase already has a translation — suggest anything you\u2019d say more naturally. Built-in interface text only; your board\u2019s own statuses and project names aren\u2019t included.</div>`;

    if (state === 'loading') {
      const sk = n => `<div class="tr-sk"><div class="ln s"></div><div class="ln l"></div><div class="ln m"></div></div>`;
      return bar + CATS.slice(0, 1).map(c => catSection(c, c.key, sk() + sk() + sk())).join('') + CATS.slice(1, 5).map(c => catSection(c, null)).join('');
    }
    if (state === 'done') {
      return bar + `<div class="tr-done">
        <img class="hh-img" src="assets/prayer-hands-alpha.png" alt="Praying hands" />
        <h3>You\u2019ve suggested something for every phrase</h3>
        <p>All <b class="mono">555</b> — thank you for lending your voice to the whole community. Your suggestions stay editable, and we\u2019ll let you know when new phrases arrive.</p>
        ${B.quote('The happiness of one’s own heart alone cannot satisfy the soul; one must try to include, as necessary to one’s own happiness, the happiness of others.', 'Paramhansa Yogananda')}
      </div>`;
    }
    if (state === 'search') {
      const q = 'done';
      const groups = [
        { name: 'Tasks & list', rows: [
          { en: 'Mark as done', cur: 'Marcar como completada', draft: 'Marcar como hecho' },
          { en: 'Mark all subtasks done', cur: 'Marcar todas las subtareas' },
        ] },
        { name: 'Status & board', rows: [
          { en: 'Move task to the “Done” column', cur: 'Mover a «Hecho»' },
          { en: 'Done', cur: 'Hecho' },
        ] },
        { name: 'Calendar', rows: [
          { en: 'All tasks done for today', cur: 'Todas las tareas de hoy listas' },
        ] },
      ];
      const total = groups.reduce((a, g) => a + g.rows.length, 0);
      const secs = groups.map(g => `<div class="help-sec open">
          <button class="help-sec-head"><span class="chev">${I.chevRight}</span><span class="si">${I.listChk}</span><span class="sname">${esc(g.name)}</span><span class="count mono">${g.rows.length}</span></button>
          <div class="tr-rows">${g.rows.map(r => strRow(r, ES)).join('')}</div>
        </div>`).join('');
      return bar + searchBar(q)
        + `<div class="tr-resultcount"><b class="mono">${total}</b> phrases match “${q}” across <b class="mono">${groups.length}</b> categories</div>`
        + secs;
    }
    // rows for the open "Tasks & list" section — phrases you haven't suggested sort first
    const rows = state === 'cjk'
      ? [
        { en: 'Move this task to the “Review” column so a second pair of eyes can check it before it’s marked done', cur: '将此任务移至“审核”栏，以便在标记完成前复核', draft: '将此任务移动到"审核"栏，以便在标记为完成之前由另一人复核' },
        { en: 'Add a deadline', cur: '添加截止日期' },
        { en: 'Due soon', cur: '快到期' },
      ]
      : state === 'indic'
        ? [
          { en: 'No tasks match these filters', cur: 'इन फ़िल्टर से कोई कार्य नहीं मिला', draft: 'इन फ़िल्टरों से कोई कार्य मेल नहीं खाता' },
          { en: 'Clear all filters', cur: 'सभी फ़िल्टर हटाएँ' },
        ]
        : [
          { en: 'Assigned to {{name}}', cur: 'Asignado a {{name}}' },
          { en: 'Mark as done', cur: 'Marcar como completada', draft: state === 'saved' ? 'Marcar como hecho' : state === 'resave' ? 'Marcar como completado' : '', saved: state === 'saved', resave: state === 'resave', prev: 'Marcar como hecho' },
          { en: 'Add link', cur: 'Añadir un enlace', sim: ['Add link…'], simopen: state === 'similar', draft: 'Añadir enlace' },
          { en: 'Assign to me', cur: 'Asignarme', error: state === 'error', draft: 'Asignármelo a mí' },
          { en: '{{n}} tasks due soon', cur: '{{n}} tareas vencen pronto' },
          { en: 'Overdue', cur: 'Atrasado' },
        ];
    const st = state === 'cjk' ? { native: '中文 (your suggestion)' } : state === 'indic' ? { native: 'हिन्दी (your suggestion)' } : ES;
    const rowsHtml = rows.map(r => strRow(r, st)).join('');
    const openCat = state === 'cjk' || state === 'indic' ? { key: 'tasks', name: 'Tasks & list', todo: rows.filter(r => !r.draft && !r.saved).length } : CATS[0];
    const acc = catSection(openCat, 'tasks', rowsHtml) + CATS.slice(1).map(c => catSection(c, null)).join('');
    return bar + searchBar('') + acc;
  }
  function webContribute(state) {
    return B.webframe(`${B.appShell({ dim: true })}
      <div class="modal-backdrop"><div class="modal has-foot" style="max-width:720px">
        ${B.modalHead('Improve translations', 'Suggest clearer wording in your language')}
        <div class="modal-body">${contributeBody(state)}</div>
        <div class="help-foot"><span style="font-size:12.5px;color:var(--muted);display:flex;align-items:center;gap:7px">${I.check} Each phrase saves on its own — leave any time.</span><button class="btn btn-secondary" style="margin-left:auto">Done</button></div>
      </div></div>`);
  }

  /* =============================================================  (c) TRANSLATION REVIEW (poll graph)  */
  // one poll card; data: {key,en,variants:[{txt,n,people,live}],liveText,approved,detailOpen,total}
  function pollCard(d) {
    const maxN = Math.max(...d.variants.map(v => v.n));
    const total = d.variants.reduce((a, v) => a + v.n, 0);
    const bars = d.variants.map(v => {
      const lead = v.n === maxN && !d.variants.some(x => x.live);
      const cls = ['poll-bar', v.live ? 'live' : '', (lead && !v.live) ? 'lead' : '', v.phBad ? 'phbad' : ''].filter(Boolean).join(' ');
      const flag = v.matches ? `<span class="pb-flag match">matches current</span>` : v.phBad ? `<span class="pb-flag bad">${I.alert} placeholder broken</span>` : '';
      return `<button class="${cls}" ${v.phBad ? 'disabled title="Can’t go live — a {{placeholder}} is missing or altered"' : ''}>
        <span class="pb-txt"><span class="tick">${I.check}</span>${renderVal(v.txt)}${flag}</span>
        <span class="pb-track"><span class="pb-fill" style="width:${Math.max(8, Math.round(v.n / maxN * 100))}%"></span></span>
        <span class="pb-approve">${v.live || v.phBad ? '' : `${I.check} Make live`}</span>
        <span class="pb-n">${v.n}<span class="ppl">${v.n === 1 ? 'person' : 'people'}</span></span>
      </button>`;
    }).join('');
    const detail = d.detailOpen ? `<div class="poll-detail">
      ${d.variants.map(v => `<div class="grp-h">${esc(v.txt)} · ${v.n}</div>` + v.people.map(p => `<div class="sub-row">${av(PEOPLE[p], 24)}<span class="who" title="${esc(PEOPLE[p].name)}">${esc(PEOPLE[p].name)}</span><span class="said ${v.live ? 'win' : ''}">${esc(v.txt)}</span></div>`).join('')).join('')}
    </div>` : '';
    const liveNow = d.liveText
      ? `<div class="poll-live-now"><span class="chip-live">${I.check} Live</span><span class="lv-txt">${esc(d.liveText)}</span></div>`
      : `<div class="poll-live-now"><span style="font-size:12px;color:var(--faint)">No approved wording yet — showing the bundled default.</span></div>`;
    return `<div class="poll-card ${d.detailOpen ? 'detailopen' : ''}">
      ${d.approved ? `<div class="poll-approved">${I.check}<span><b>${esc(d.approved)}</b> is now the live wording for everyone in this language.</span></div>` : ''}
      <div class="poll-top">
        <div class="pt-tx"><div class="poll-key">key · ${esc(d.key)}</div><div class="poll-en">${renderVal(d.en)}</div>${liveNow}</div>
        <div class="pt-n"><b>${total}</b>${total === 1 ? 'reply' : 'replies'}</div>
      </div>
      <div class="poll-bars">${bars}</div>
      ${d.more ? `<button class="poll-more">${I.chevDown} Show all ${d.more.total} wordings · ${d.more.replies} more replies</button>` : ''}
      ${d.ownOpen
        ? `<div class="poll-own open"><div class="tr-lbl">Your own wording</div><div class="tr-inputrow"><textarea class="tr-in" rows="1" placeholder="Type the wording that should go live…"></textarea><button class="btn btn-primary">${I.check} Make live</button></div></div>`
        : `<button class="poll-own-btn">${I.pen} Or enter your own wording…</button>`}
      <div class="poll-foot">
        <button class="poll-exp">${I.chevRight} ${d.detailOpen ? 'Hide' : 'See'} who suggested what</button>
        ${d.liveText ? '<button class="btn btn-danger clear">Clear override</button>' : ''}
      </div>
      ${detail}
    </div>`;
  }
  function reviewBody(state) {
    const lang = state === 'cjk' ? '中文' : 'Español';
    const bar = `<div class="rv-bar">
        <div class="rv-lang"><span class="lbl">Reviewing</span>${langPicker(lang, false, `<span class="pi" style="color:var(--hu-ink)">${I.languages}</span>`)}</div>
        <div class="rv-count"><b>18</b> phrases have suggestions</div>
      </div>`;
    if (state === 'loading') {
      const sk = `<div class="poll-card"><div class="tr-sk" style="border:none;padding:0;margin:0"><div class="ln m"></div><div class="ln l"></div><div class="ln l"></div><div class="ln s"></div></div></div>`;
      return bar + sk + sk;
    }
    if (state === 'empty') {
      return bar + `<div class="rv-empty"><div class="ei">${I.languages}</div><h3>Nothing waiting for review</h3><p>When members suggest wording in this language, their suggestions will appear here as a poll for you to approve.</p></div>`;
    }
    if (state === 'many') {
      return bar + pollCard({
        key: 'task.markDone', en: 'Mark as done',
        more: { total: 12, replies: 14 },
        variants: [
          { txt: 'Marcar como hecho', n: 52, people: ['lila', 'gita', 'priya', 'diego'] },
          { txt: 'Marcar como completado', n: 31, people: ['arjuna', 'omar'] },
          { txt: 'Dar por terminado', n: 18, people: ['mara'] },
          { txt: 'Marcar como lista', n: 9, people: ['priya'] },
          { txt: 'Completar tarea', n: 7, people: ['diego'] },
        ],
      });
    }
    if (state === 'cjk') {
      return bar + pollCard({
        key: 'task.moveReview',
        en: 'Move this task to “Review” so a second pair of eyes can check it before it’s done',
        variants: [
          { txt: '将此任务移到"审核"，以便在完成前由他人复核', n: 9, people: ['lila', 'gita', 'priya'] },
          { txt: '把任务移动到"审核"栏再确认一次', n: 6, people: ['arjuna', 'omar'] },
          { txt: '移至审核，待复核后完成', n: 2, people: ['mara'] },
        ],
      }) + pollCard({
        key: 'filter.none', en: 'No tasks match these filters',
        variants: [{ txt: '没有符合这些筛选条件的任务', n: 11, people: ['lila', 'gita'] }, { txt: '无匹配的任务', n: 4, people: ['omar'] }],
      });
    }
    // default list — a many-variant poll (one leading), an existing-override poll, a 2-variant near-tie
    const cards = [];
    if (state === 'approved') {
      cards.push(pollCard({
        key: 'task.markDone', en: 'Mark as done', approved: 'Marcar como hecho',
        liveText: 'Marcar como hecho',
        variants: [
          { txt: 'Marcar como hecho', n: 14, people: ['lila', 'gita', 'priya', 'diego'], live: true },
          { txt: 'Marcar como completado', n: 9, people: ['arjuna', 'omar'] },
          { txt: 'Dar por terminado', n: 3, people: ['mara'] },
        ],
      }));
    } else {
      cards.push(pollCard({
        key: 'task.markDone', en: 'Mark as done',
        detailOpen: state === 'detail',
        variants: [
          { txt: 'Marcar como hecho', n: 14, people: ['lila', 'gita', 'priya', 'diego'] },
          { txt: 'Marcar como completado', n: 9, people: ['arjuna', 'omar'] },
          { txt: 'Dar por terminado', n: 3, people: ['mara'] },
        ],
      }));
    }
    cards.push(pollCard({
      key: 'filter.clear', en: 'Clear all filters', liveText: 'Borrar filtros',
      ownOpen: state === 'own',
      variants: [
        { txt: 'Borrar filtros', n: 8, people: ['lila', 'gita'], live: true },
        { txt: 'Quitar todos los filtros', n: 12, people: ['arjuna', 'omar', 'priya'] },
        { txt: 'Limpiar filtros', n: 5, people: ['mara', 'diego'] },
      ],
    }));
    cards.push(pollCard({
      key: 'btn.dueSoon', en: '{{n}} tasks due soon',
      variants: [
        { txt: 'tareas vencen pronto', n: 7, people: ['lila'], matches: true },
        { txt: 'tareas que vencen pronto', n: 6, people: ['omar'] },
      ],
    }));
    return bar + cards.join('');
  }
  function webReview(state) {
    if (state === 'confirm') {
      return B.webframe(`${B.appShell({ dim: true })}
        <div class="modal-backdrop" style="align-items:center"><div class="confirm-card">
          <div class="cf-ic">${I.globe}</div>
          <h3>Make this the live wording?</h3>
          <p>This becomes what <b>everyone using Español</b> sees from now on — no redeploy. You can change the winner or clear it later.</p>
          <div class="cf-quote"><span class="lang">Español · “Mark as done”</span>Marcar como hecho</div>
          <div class="modal-foot"><button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">${I.check} Make it live</button></div>
        </div></div>`);
    }
    return B.webframe(`${B.appShell({ dim: true })}
      <div class="modal-backdrop"><div class="modal" style="max-width:760px">
        ${B.modalHead('Translation review', 'Community suggestions · approve a winner that goes live instantly')}
        <div class="modal-body">${reviewBody(state)}</div>
      </div></div>`);
  }

  /* =============================================================  MOBILE  */
  // Settings list route → Help Us row carries the what's-new dot
  function phoneSettingsList() {
    const row = (icon, label, dot) => `<button class="sl-row">${I[icon].replace('width="16" height="16"', 'width="19" height="19" class="lead"')}<span class="sl-nm">${label}</span>${dot ? '<span class="sl-nd"></span>' : ''}<span class="chev">${I.chevRight}</span></button>`;
    return B.phone(`${B.fsHead('Settings', true)}<div class="m-scroll set-list">
      ${row('user', 'Account')}
      ${row('bell', 'Notifications')}
      ${row('listChk', 'Task statuses')}
      ${row('calendar', 'Events & Holidays')}
      ${row('heart', 'Help Us', true)}
    </div>`);
  }
  function phoneHelpUs(variant) {
    return B.phone(`${B.fsHead('Help Us', true)}<div class="m-scroll">
      <div class="hu-head"><h3><span class="hu-heart">${B.I.heart}</span>Help Us</h3><p class="an-quote-lite"><span class="qt">Many hands make a miracle.</span><span class="qw">Swami Kriyananda</span></p><div class="sub">Small ways to make Ananda Taskboard better for everyone.</div></div>
      <div class="hu-stack">${huPaneCards(variant)}</div>
    </div>`);
  }
  function huPaneCards(variant) {
    const tmp = document.createElement('div');
    tmp.innerHTML = huPane(variant);
    return tmp.querySelector('.hu-stack').innerHTML;
  }
  function phoneContribute(state) {
    if (state === 'langopen') {
      const sheet = `<div class="m-sheet-scrim"></div><div class="m-sheet"><div class="grab"><i></i></div>
        <div class="sh-head"><h2>Choose a language</h2><button class="x">${I.x}</button></div>
        <div class="sh-body">${LANGS.filter(l => l !== 'English (source)').map((l, i) => `<button class="crow" style="display:flex;align-items:center;gap:10px;width:100%;padding:11px;border:none;border-bottom:1px solid var(--border);background:transparent;text-align:left">${i === 1 ? `<span style="color:var(--hu-ink)">${I.check}</span>` : '<span style="width:16px"></span>'}<span style="flex:1;font-size:15px;font-weight:${i === 1 ? '700' : '500'}">${l}</span></button>`).join('')}</div></div>`;
      return B.phone(`${B.fsHead('Improve translations', true)}<div style="flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column"><div class="m-scroll">${contributeBody('populated')}</div>${sheet}</div>`);
    }
    return B.phone(`${B.fsHead('Improve translations', true)}<div class="m-scroll">${contributeBody(state)}</div>`);
  }
  function phoneReview(state) {
    if (state === 'detail') {
      const sheet = `<div class="m-sheet-scrim"></div><div class="m-sheet"><div class="grab"><i></i></div>
        <div class="sh-head"><h2>Who suggested “Marcar como hecho”</h2><button class="x">${I.x}</button></div>
        <div class="sh-body"><div class="poll-detail" style="border:none;padding:0;margin:0">
          ${['lila', 'gita', 'priya', 'diego'].map(p => `<div class="sub-row">${av(PEOPLE[p], 24)}<span class="who" title="${esc(PEOPLE[p].name)}">${esc(PEOPLE[p].name)}</span><span class="said win">Marcar como hecho</span></div>`).join('')}
        </div></div></div>`;
      return B.phone(`${B.fsHead('Translation review', true)}<div style="flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column"><div class="m-scroll">${reviewBody('populated')}</div>${sheet}</div>`);
    }
    return B.phone(`${B.fsHead('Translation review', true)}<div class="m-scroll">${reviewBody(state)}</div>`);
  }

  window.TR = { webHelpUs, webContribute, webReview, webSettings, phoneSettingsList, phoneHelpUs, phoneContribute, phoneReview };
})();
