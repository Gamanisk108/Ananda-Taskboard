/* =============================================================
   Ananda Taskboard — COMMUNITY TRANSLATIONS · shared chrome (TRB)
   Faithful reuse of the real app vocabulary (topbar, account menu,
   the REAL List view as the faux board behind dialogs, the .modal
   shell, custom selects, phone status bar / app bar / full-screen
   route / bottom sheet). Mirrors help-screens.js so the new surfaces
   sit in identical chrome. window.TRB.* return HTML strings.
   ============================================================= */
(function () {
  const MARK = 'assets/ananda-mark.png';
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  /* ---- lucide-style icons (viewBox 24, stroke 1.7, round caps) ---- */
  const P = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I = {
    help: P('<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.6 2.4-2.6 4"/><path d="M12 17.3h.01"/>'),
    check: P('<path d="M20 6L9 17l-5-5"/>'),
    chevDown: P('<path d="M6 9l6 6 6-6"/>'),
    chevRight: P('<path d="M9 6l6 6-6 6"/>'),
    chevLeft: P('<path d="M15 6l-6 6 6 6"/>'),
    x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    search: P('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    sparkle: P('<path d="M12 3l1.6 5L18.5 9l-4.9 1L12 15l-1.6-5L5.5 9l4.9-1z"/><path d="M18.5 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
    mail: P('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.6 7.2l8.4 5.8 8.4-5.8"/>'),
    arrowLeft: P('<path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    users: P('<circle cx="9" cy="8" r="3.2"/><path d="M2.8 19c.7-3.1 3.2-4.8 6.2-4.8s5.5 1.7 6.2 4.8"/><path d="M16.5 5.2a3 3 0 0 1 0 5.7"/><path d="M18 14.4c1.9.6 3.3 2.1 3.7 4.3"/>'),
    grid: P('<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>'),
    clock: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.4V12l3 1.8"/>'),
    moon: P('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
    trash: P('<path d="M4 7h16"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7"/>'),
    refresh: P('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 4v4h-4"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 20v-4h4"/>'),
    archive: P('<rect x="3.5" y="4.5" width="17" height="4" rx="1.2"/><path d="M5 8.5v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9"/><path d="M10 12h4"/>'),
    bell: P('<path d="M18 9a6 6 0 0 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>'),
    eye: P('<path d="M2.5 12s3.6-6.6 9.5-6.6S21.5 12 21.5 12 17.9 18.6 12 18.6 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.9"/>'),
    globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18"/>'),
    logout: P('<path d="M15 12H4"/><path d="M11 8l4 4-4 4"/><path d="M9 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9"/>'),
    userPlus: P('<circle cx="9" cy="8" r="3.4"/><path d="M3.2 19c.7-3.2 3.1-5 5.8-5s4.4 1 5.4 2.6"/><path d="M18 8v6M21 11h-6"/>'),
    gear: P('<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5l1.2 2.1 2.4-.5 .3 2.4 2.1 1.2-1.1 2.2 1.1 2.2-2.1 1.2-.3 2.4-2.4-.5L12 20.5l-1.2-2.1-2.4.5-.3-2.4L6 13.8l1.1-2.2L6 9.4l2.1-1.2.3-2.4 2.4.5z"/>'),
    user: P('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.7-3.6 3.7-5.6 7-5.6s6.3 2 7 5.6"/>'),
    languages: P('<path d="M3.5 5.5h8"/><path d="M7.5 5.5V4"/><path d="M9.6 5.5c-.5 3.4-2.8 6.2-6.1 7.6"/><path d="M5 9.2c.7 2 2.4 3.6 4.6 4.4"/><path d="M12.5 20l3.8-9 3.8 9"/><path d="M13.8 17h5"/>'),
    heart: P('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z"/>'),
    lotus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-4.4 0-8-2.6-8-5.8 1.6 0 3 .5 4.1 1.3"/><path d="M12 20c4.4 0 8-2.6 8-5.8-1.6 0-3 .5-4.1 1.3"/><path d="M12 20c-2.4 0-4.4-2.6-4.4-5.8 0-3 1.8-5.6 4.4-7.2 2.6 1.6 4.4 4.2 4.4 7.2 0 3.2-2 5.8-4.4 5.8z"/><path d="M7.9 12.1C6.6 11.4 5.1 11.2 3.6 11.6c.4 1.3 1.4 2.4 2.7 3.1"/><path d="M16.1 12.1c1.3-.7 2.8-.9 4.3-.5-.4 1.3-1.4 2.4-2.7 3.1"/></svg>',
    info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5"/><path d="M12 7.8h.01"/>'),
    alert: P('<path d="M12 4.5L2.8 20h18.4z"/><path d="M12 10v4"/><path d="M12 17h.01"/>'),
    inbox: P('<path d="M3.5 12.5h4l1.5 2.5h6l1.5-2.5h4"/><path d="M5.2 6.5l-1.7 6v5a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-5l-1.7-6a1.5 1.5 0 0 0-1.45-1.1H6.65A1.5 1.5 0 0 0 5.2 6.5z"/>'),
    rotate: P('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4.5V10h-5.5"/>'),
    approvals: P('<circle cx="12" cy="12" r="9"/><path d="M8.2 12.3l2.5 2.5 5.1-5.6"/>'),
    compass: P('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-1.8 5.2-5.2 1.8 1.8-5.2z"/>'),
    listChk: P('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.6 6l1.1 1.1L6.8 5"/><path d="M3.6 12l1.1 1.1L6.8 11"/><path d="M3.6 18l1.1 1.1L6.8 17"/>'),
    more: P('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    share: P('<circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="5.5" r="2.4"/><circle cx="17" cy="18.5" r="2.4"/><path d="M8.1 10.9l6.8-4M8.1 13.1l6.8 4"/>'),
    copy: P('<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5"/>'),
    exportI: P('<path d="M12 4v10.5"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
    importI: P('<path d="M12 15.5V5"/><path d="M7.5 9L12 4.5 16.5 9"/><path d="M5 19.5h14"/>'),
    pen: P('<path d="M14 5.5l4.5 4.5"/><path d="M4 20l1-4L16 5a2 2 0 0 1 3 3L8 19z"/>'),
    send: P('<path d="M21 4L11 14"/><path d="M21 4l-6.5 17-3.5-7.5L3.5 10z"/>'),
    paperclip: P('<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.5 17a1.6 1.6 0 0 1-2.3-2.3l7.6-7.6"/>'),
    link: P('<path d="M9.5 14.5l5-5"/><path d="M8 11.5l-2 2a3.2 3.2 0 0 0 4.5 4.5l2-2"/><path d="M16 12.5l2-2A3.2 3.2 0 0 0 13.5 6l-2 2"/>'),
    chat: P('<path d="M20 5.5H4a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 4 16.5h3V20l4-3.5h9A1.5 1.5 0 0 0 21.5 15V7A1.5 1.5 0 0 0 20 5.5z"/>'),
    image: P('<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><circle cx="9" cy="10" r="1.8"/><path d="M5 18l4.5-4.5 3 3L16 12l4 4"/>'),
    heartHands: P('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.51 4.04 3 5.5l7 7z"/><path d="M12 5L9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/><path d="M18 15l-2-2"/><path d="M15 18l-2-2"/>'),
    prayerHands: P('<path d="M12 3.2v17.6"/><path d="M12 4.6C9.4 7.4 7.8 10.4 7.2 13.6c-.5 2.6.2 5 1.9 6.9"/><path d="M9.1 20.5H12"/><path d="M12 4.6c2.6 2.8 4.2 5.8 4.8 9 .5 2.6-.2 5-1.9 6.9"/><path d="M14.9 20.5H12"/>'),
    calendar: P('<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 9.5h17"/><path d="M8 3.5v3M16 3.5v3"/>'),
    lock: P('<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8.2 11V8.2a3.8 3.8 0 0 1 7.6 0V11"/>'),
  };

  /* ---- people (submitters in the poll detail) ---- */
  const PEOPLE = {
    lena:   { name: 'Lead Lena', init: 'LL', color: '#1e3a6e' },
    arjuna: { name: 'Arjuna',    init: 'AR', color: '#2c5499' },
    lila:   { name: 'Lila Devi', init: 'LD', color: '#3f7d54' },
    mara:   { name: 'Mara',      init: 'MA', color: '#b4452f' },
    gita:   { name: 'Gita',      init: 'GI', color: '#c8762f' },
    omar:   { name: 'Omar',      init: 'OM', color: '#7a5aa6' },
    priya:  { name: 'Priya',     init: 'PR', color: '#2f7d74' },
    diego:  { name: 'Diego',     init: 'DI', color: '#a23e6e' },
  };
  const av = (p, sz) => `<span class="av" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * 0.4)}px;background:${p.color}">${p.init}</span>`;

  /* ---- 5-status pipeline (purple Review 2nd-to-last) — for the faux List view ---- */
  const STATUS = {
    todo:    { name: 'To Do',       color: '#6b7280' },
    doing:   { name: 'In Progress', color: '#2c64a8' },
    delayed: { name: 'Delayed',     color: '#bb3b28' },
    review:  { name: 'Review',      color: '#7a5aa6' },
    done:    { name: 'Done',        color: '#3f7d54' },
  };

  const PRIO = {
    Highest: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,11 7,6 12,11" stroke="var(--danger)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="2,7 7,2 12,7" stroke="var(--danger)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    High: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,9 7,4 12,9" stroke="#c2762a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    Medium: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="3,5 11,5" stroke="var(--warn)" stroke-width="2" fill="none" stroke-linecap="round"/><polyline points="3,9 11,9" stroke="var(--warn)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    Low: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,5 7,10 12,5" stroke="#5a86c2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* ---- generic custom select (the house dropdown — never a native <select>) ---- */
  function csel(value, options, opts) {
    opts = opts || {};
    const lead = opts.lead || '';
    const pop = opts.open ? `<div class="cs-pop">${options.map(o => `<div class="cs-opt ${o === value ? 'sel' : ''}">${lead && o === value ? '' : ''}${esc(o)}${o === value ? `<span class="cs-check">${I.check}</span>` : ''}</div>`).join('')}</div>` : '';
    return `<div class="cs-wrap ${opts.inline ? 'inline' : ''} ${opts.open ? 'open' : ''}"><button type="button" class="ctl-select ${opts.muted ? 'muted' : ''}">${lead}<span class="ctl-lbl">${esc(value)}</span><span class="ctl-caret">${I.chevDown}</span></button>${pop}</div>`;
  }

  /* =============================================================  WEB CHROME  */
  function userMenu(active) {
    const item = (icon, label, opt) => `<button class="um-item ${opt && opt.danger ? 'danger' : ''} ${opt && opt.active ? 'active' : ''}" style="${opt && opt.active ? 'background:var(--primary-weak)' : ''}">${I[icon]}<span class="um-name" style="flex:1;text-align:left">${label}</span>${opt && opt.dot ? '<span class="um-dot"></span>' : ''}</button>`;
    return `<div class="menu um" style="top:calc(100% + 7px);right:0;min-width:264px">
      <div class="m-head">Admin Ada · admin@ananda.test</div>
      ${item('help', 'Help &amp; FAQ', { dot: true })}
      <div class="m-div"></div>
      ${item('gear', 'Settings', { active: active === 'settings' })}
      ${item('clock', 'History')}
      ${item('archive', 'Archive')}
      ${item('refresh', 'Restore points')}
      ${item('trash', 'Trash')}
      <div class="m-div"></div>
      ${item('bell', 'Turn on notifications')}
      ${item('eye', 'Preview as Viewer')}
      ${item('globe', 'Language')}
      <div class="m-div"></div>
      ${item('logout', 'Log out', { danger: true })}
    </div>`;
  }
  function topbar(opt) {
    opt = opt || {};
    const ghost = (icon, label) => `<button class="btn btn-ghost tbtn" title="${label}">${I[icon]}<span class="lbl">${label}</span></button>`;
    return `<div class="topbar">
      <div class="brand">
        <img class="mark" src="${MARK}" alt="" style="width:42px;height:42px" />
        <div class="brand-txt"><div class="name">Ananda <b>Taskboard</b></div><div class="tagline" style="font-family:var(--f-display);font-style:italic;font-size:10.5px;color:var(--gold-deep)">Love &amp; Blessings from Ananda Los Angeles</div></div>
        <button class="theme-btn" title="Toggle theme">${I.moon}</button>
      </div>
      <div class="spacer" style="flex:1"></div>
      <div class="actions" style="display:flex;align-items:center;gap:6px">
        ${ghost('approvals', 'Approvals')}
        ${ghost('users', 'Team')}
        ${ghost('grid', 'Projects')}
        <span class="sep" style="width:1px;height:22px;background:var(--border);margin:0 2px"></span>
        <button class="newtask btn btn-primary">${I.plus}<span>New task</span></button>
        <div class="user-wrap" style="position:relative">
          <div class="user ${opt.userMenu ? 'open' : ''}">${opt.newDot ? '<span class="wn-dot"></span>' : ''}<span class="avatar av" style="width:24px;height:24px;font-size:10px;background:var(--primary)">AD</span><span>Admin Ada</span><span class="caret">▾</span></div>
          ${opt.userMenu ? userMenu(opt.active) : ''}
        </div>
      </div>
    </div>`;
  }
  function tabrail() {
    return `<div class="tabrail" style="background:var(--surface);border-bottom:1px solid var(--border);padding:9px 16px;display:flex;gap:6px;flex-wrap:wrap">
        <span class="ptab on" style="display:inline-flex;align-items:center;gap:7px;border:1px solid #6b7280;background:color-mix(in srgb,#6b7280 14%,var(--surface));border-radius:var(--r-pill);padding:5px 13px;font-size:13.5px;font-weight:600">🌐 Global Overview <span class="count mono" style="font-size:11px;color:var(--muted)">20</span></span>
        <span class="ptab" style="display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:var(--r-pill);padding:5px 13px;font-size:13.5px;font-weight:500">🪔 Karuna Devi <span class="count mono" style="font-size:11px;color:var(--faint)">8</span></span>
        <span class="ptab" style="display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:var(--r-pill);padding:5px 13px;font-size:13.5px;font-weight:500">🌸 Sunday Service <span class="count mono" style="font-size:11px;color:var(--faint)">7</span></span>
        <span class="ptab" style="display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:var(--r-pill);padding:5px 13px;font-size:13.5px;font-weight:500">⚡ Alliance Electric <span class="count mono" style="font-size:11px;color:var(--faint)">5</span></span>
      </div>`;
  }
  function viewbar() {
    const VIEWS = [['List', 1], ['Board', 0], ['Weekly', 0], ['Monthly', 0]];
    const seg = VIEWS.map(([l, on]) => on ? `<b>${l}</b>` : `<span>${l}</span>`).join('');
    const sbtn = (icon, label) => `<button class="btn btn-secondary vbtn" title="${label}">${I[icon]}<span class="lbl">${label}</span></button>`;
    return `<div class="shell-viewbar" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 18px">
      <div class="seg-mini">${seg}</div>
      <div class="vb-right" style="display:flex;gap:6px">${sbtn('share', 'Share view')}${sbtn('copy', 'Copy summary')}${sbtn('exportI', 'Export')}${sbtn('importI', 'Import')}</div>
    </div>`;
  }
  const flt = (label) => `<button class="flt"><span>${label}</span><span class="cv">${I.chevDown}</span></button>`;
  function filterBar() {
    return `<div class="fltbar">
      <div class="fsearch">${I.search}<input placeholder="Search tasks…" /></div>
      ${flt('Any assignee')}${flt('Any status')}${flt('Any priority')}${flt('Any deadline')}${flt('Any recurrence')}
    </div>`;
  }
  const BADGE_OD = '<svg width="15" height="15" viewBox="0 0 24 24" style="flex:none"><circle cx="12" cy="12" r="10" fill="var(--danger)"/><path d="M12 7v6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="16.4" r="1.4" fill="#fff"/></svg>';
  const BADGE_SOON = '<svg width="15" height="15" viewBox="0 0 24 24" style="flex:none"><circle cx="12" cy="12" r="10" fill="var(--ring-soon)"/><path d="M12 7.6V12l2.8 1.7" fill="none" stroke="#3a2d10" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const LIST = [
    { n: 'Confirm caterer for retreat', p: 'Sunday Service', pc: '#3f7d54', s: 'Kitchen', sc: '#2f7d74', who: ['lila'], pr: 'High', st: 'doing', due: 'Jun 9', d: '' },
    { n: 'Rewire altar lighting', p: 'Alliance Electric', pc: '#a23e6e', s: 'Lighting', sc: '#7a5aa6', who: ['omar', 'mara'], pr: 'Highest', st: 'delayed', due: 'Jun 2', d: 'od', rec: 'weekly' },
    { n: 'Print Sunday programs', p: 'Karuna Devi', pc: '#c8762f', s: 'Design', sc: '#2c5499', who: ['lena'], pr: 'Medium', st: 'review', due: 'Jun 6', d: 'soon' },
    { n: 'Design spring flyer', p: 'Karuna Devi', pc: '#c8762f', s: 'Design', sc: '#2c5499', who: ['lena', 'arjuna'], pr: 'High', st: 'doing', due: 'Jun 14', d: '' },
    { n: 'Order replacement candles', p: 'Karuna Devi', pc: '#c8762f', s: 'Kitchen', sc: '#2f7d74', who: ['gita'], pr: 'Low', st: 'done', due: 'May 31', d: '' },
    { n: 'Tune harmonium', p: 'Sunday Service', pc: '#3f7d54', s: 'Music', sc: '#c9a24b', who: [], pr: 'Medium', st: 'todo', due: 'Jun 12', d: '' },
  ];
  function listTable() {
    const COLS = ['Task', 'Project', 'Sub-project', 'Assignees', 'Status', 'Deadline', 'Recurs'];
    const head = COLS.map((c, i) => `<th class="${i === 0 ? 'c-task sorted' : ''}"><span class="th-in">${c}${i === 0 ? '<span class="arrow">▲</span>' : ''}</span></th>`).join('');
    const rows = LIST.map(t => {
      const rcls = [t.st === 'done' ? 'done' : '', t.d === 'od' ? 'overdue' : '', t.d === 'soon' ? 'due-soon' : ''].filter(Boolean).join(' ');
      const badge = t.d === 'od' ? BADGE_OD : t.d === 'soon' ? BADGE_SOON : '';
      const who = t.who.length
        ? t.who.map(id => `<span class="chip"><span class="av" style="background:${PEOPLE[id].color}">${PEOPLE[id].init}</span>${esc(PEOPLE[id].name)}</span>`).join('')
        : '<span class="none">—</span>';
      return `<tr class="${rcls}">
        <td class="c-task"><div class="task-cell"><span class="prio" title="Priority: ${t.pr}">${PRIO[t.pr]}</span><span class="task-name">${esc(t.n)}</span>${badge}</div></td>
        <td><span class="proj-pill" style="--pc:${t.pc}"><span class="pp-nm">${esc(t.p)}</span></span></td>
        <td><span class="proj-pill" style="--pc:${t.sc}"><span class="pp-nm">${esc(t.s)}</span></span></td>
        <td><div class="who">${who}</div></td>
        <td><span class="status-pill" style="--sc:${STATUS[t.st].color}"><span class="dot" style="background:${STATUS[t.st].color}"></span>${STATUS[t.st].name}<span class="caret">▾</span></span></td>
        <td><span class="cell-date ${t.d}">${t.due}</span></td>
        <td>${t.rec ? `<span class="recurs"><span class="rc">↻</span>${t.rec}</span>` : `<span class="recurs none">—</span>`}</td>
      </tr>`;
    }).join('');
    return `<div class="board-list"><table class="lst"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function shellBack() {
    const stmt = (k, n) => `<span class="ss"><span class="dot" style="background:${STATUS[k].color}"></span><b>${n}</b></span>`;
    return `${tabrail()}${viewbar()}${filterBar()}
      <div class="shell-summary">
        <span class="ss"><b>20</b> Tasks</span>
        <span class="ss od"><b>2</b> Overdue</span>
        <span class="ss soon"><b>1</b> Due soon</span>
        ${stmt('todo', 7)}${stmt('doing', 6)}${stmt('delayed', 2)}${stmt('review', 3)}${stmt('done', 2)}
      </div>${listTable()}`;
  }
  function appShell(opt) {
    opt = opt || {};
    return `<div class="appshell ${opt.dim ? 'dim' : ''}">${topbar(opt)}${shellBack()}</div>`;
  }
  const modalHead = (title, sub) => `<div class="modal-head"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="x">${I.x}</button></div>`;
  const webframe = inner => `<div class="webframe">${inner}</div>`;

  /* =============================================================  PHONE CHROME  */
  const STATUSBAR = `<div class="statusbar"><span class="mono">9:41</span><span class="sb-r">`
    + `<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="4" width="3" height="8" rx="1"/><rect x="10" y="1.5" width="3" height="10.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1" opacity=".35"/></svg>`
    + `<svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2C5.5 2 2.8 3.2 1 5l1.6 1.6C4 5.2 6.1 4.3 8.5 4.3s4.5.9 5.9 2.3L16 5C14.2 3.2 11.5 2 8.5 2z"/><path d="M8.5 7.2c-1.3 0-2.5.5-3.4 1.4L8.5 12l3.4-3.4C11 7.7 9.8 7.2 8.5 7.2z"/></svg>`
    + `<svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke="currentColor" stroke-opacity=".4"/><rect x="3" y="3" width="16" height="7" rx="1.5" fill="currentColor"/><rect x="23.5" y="4.5" width="2" height="4" rx="1" fill="currentColor" fill-opacity=".4"/></svg>`
    + `</span></div>`;
  const phone = (inner, theme) => `<div class="phone"${theme ? ` data-theme="${theme}"` : ''}>${STATUSBAR}<div class="pbody">${inner}</div><div class="homebar"></div></div>`;
  function mAppbar(opt) {
    opt = opt || {};
    return `<div class="m-appbar">
      <img class="mark" src="${MARK}" alt="" />
      <div class="ab-tt"><div class="ab-org">Karuna Devi</div><div class="ab-sub">Ananda Taskboard</div></div>
      <button class="ic primary" aria-label="New task">${I.plus}</button>
      <button class="ic" aria-label="More">${opt.newDot ? '<span class="wn-dot" style="top:6px;right:6px"></span>' : ''}${I.more}</button>
    </div>`;
  }
  const fsHead = (title, back, extra) => `<div class="m-fs-head"><button class="x">${back ? I.arrowLeft : I.x}</button><span class="ttl">${title}</span>${extra || ''}</div>`;

  /* ---- Ananda quote — brand-voice flourish (Fraunces italic, like the tagline). D40. No icon. ---- */
  const quote = (text, who) => `<figure class="an-quote"><blockquote class="an-qt">${esc(text)}</blockquote><figcaption class="an-qw">${esc(who)}</figcaption></figure>`;

  window.TRB = { esc, I, P, PEOPLE, av, STATUS, PRIO, csel, userMenu, topbar, shellBack, appShell, modalHead, webframe, phone, mAppbar, fsHead, quote };
})();
