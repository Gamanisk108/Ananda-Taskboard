/* =============================================================
   Ananda Taskboard — HELP / ONBOARDING · SUBTASK EDITOR · NO-DATE LIST
   window.HELP.* return HTML strings. Web (app context) + phone.
   Temple-of-Light tokens. Honors the 12 hard UI rules: line-art icons
   only (no emoji-as-icon), custom select carets, pills, confirmations,
   one-line header, circular close X clear of the #id pill, etc.
   Status pipeline is the 5-step set incl. PURPLE "Review" (renamed
   from "Ready for Review"), order: To Do · In Progress · Delayed ·
   Review · Done.
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
    lock: P('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    mail: P('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.6 7.2l8.4 5.8 8.4-5.8"/>'),
    arrowLeft: P('<path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    users: P('<circle cx="9" cy="8" r="3.2"/><path d="M2.8 19c.7-3.1 3.2-4.8 6.2-4.8s5.5 1.7 6.2 4.8"/><path d="M16.5 5.2a3 3 0 0 1 0 5.7"/><path d="M18 14.4c1.9.6 3.3 2.1 3.7 4.3"/>'),
    grid: P('<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>'),
    shield: P('<path d="M12 3l7 2.5v5.2c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V5.5z"/>'),
    clock: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.4V12l3 1.8"/>'),
    more: P('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    moon: P('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
    trash: P('<path d="M4 7h16"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7"/>'),
    refresh: P('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 4v4h-4"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 20v-4h4"/>'),
    layout: P('<rect x="3.5" y="4" width="17" height="16" rx="2.2"/><path d="M3.5 9h17"/><path d="M9 9v11"/>'),
    folderOpen: P('<path d="M4 8.5V6a1.6 1.6 0 0 1 1.6-1.6h3.2L11 6.6h6.4A1.6 1.6 0 0 1 19 8.2v.3"/><path d="M3.3 11.2A1.4 1.4 0 0 1 4.6 10h15.1a1.4 1.4 0 0 1 1.35 1.8l-1.7 6.1A1.6 1.6 0 0 1 17.8 19H5.1a1.6 1.6 0 0 1-1.55-1.2z"/>'),
    target: P('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1"/>'),
    listChk: P('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.6 6l1.1 1.1L6.8 5"/><path d="M3.6 12l1.1 1.1L6.8 11"/><path d="M3.6 18l1.1 1.1L6.8 17"/>'),
    user: P('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.7-3.6 3.7-5.6 7-5.6s6.3 2 7 5.6"/>'),
    compass: P('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-1.8 5.2-5.2 1.8 1.8-5.2z"/>'),
    calendarOff: P('<path d="M8.25 3v4.1"/><path d="M15.75 3v4.1"/><rect x="3" y="5.25" width="18" height="16.5" rx="1.9"/><path d="M3 10.5h18"/><path d="M9 13.5l6 6"/><path d="M15 13.5l-6 6"/>'),
    calendar: P('<rect x="3.5" y="5" width="17" height="15.5" rx="2.3"/><path d="M3.5 9.5h17"/><path d="M8 3.5v3M16 3.5v3"/>'),
    star: P('<path d="M12 4l2.3 4.9 5.2.6-3.9 3.5 1.1 5.2L12 15.9 7.2 18.7l1.1-5.2L4.4 9.9l5.2-.6z"/>'),
    mega: P('<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9.2a4 4 0 0 1 0 5.6"/>'),
    approvals: P('<circle cx="12" cy="12" r="9"/><path d="M8.2 12.3l2.5 2.5 5.1-5.6"/>'),
    share: P('<circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="5.5" r="2.4"/><circle cx="17" cy="18.5" r="2.4"/><path d="M8.1 10.9l6.8-4M8.1 13.1l6.8 4"/>'),
    link: P('<path d="M10 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0L6.5 13a3.5 3.5 0 0 0 5 5l1-1"/>'),
    copy: P('<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5"/>'),
    exportI: P('<path d="M12 4v10.5"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
    importI: P('<path d="M12 15.5V5"/><path d="M7.5 9L12 4.5 16.5 9"/><path d="M5 19.5h14"/>'),
    gear: P('<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5l1.2 2.1 2.4-.5 .3 2.4 2.1 1.2-1.1 2.2 1.1 2.2-2.1 1.2-.3 2.4-2.4-.5L12 20.5l-1.2-2.1-2.4.5-.3-2.4L6 13.8l1.1-2.2L6 9.4l2.1-1.2.3-2.4 2.4.5z"/>'),
    archive: P('<rect x="3.5" y="4.5" width="17" height="4" rx="1.2"/><path d="M5 8.5v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9"/><path d="M10 12h4"/>'),
    bell: P('<path d="M18 9a6 6 0 0 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>'),
    eye: P('<path d="M2.5 12s3.6-6.6 9.5-6.6S21.5 12 21.5 12 17.9 18.6 12 18.6 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.9"/>'),
    globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18"/>'),
    logout: P('<path d="M15 12H4"/><path d="M11 8l4 4-4 4"/><path d="M9 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9"/>'),
    userPlus: P('<circle cx="9" cy="8" r="3.4"/><path d="M3.2 19c.7-3.2 3.1-5 5.8-5s4.4 1 5.4 2.6"/><path d="M18 8v6M21 11h-6"/>'),
    pen: P('<path d="M14 5.5l4.5 4.5"/><path d="M4 20l1-4L16 5a2 2 0 0 1 3 3L8 19z"/>'),
    info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5"/><path d="M12 7.8h.01"/>'),
  };

  /* ---- priority icons (verbatim shapes from the desktop app) ---- */
  const PRIO = {
    Highest: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,11 7,6 12,11" stroke="var(--danger)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="2,7 7,2 12,7" stroke="var(--danger)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    High: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,9 7,4 12,9" stroke="#c2762a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    Medium: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="3,5 11,5" stroke="var(--warn)" stroke-width="2" fill="none" stroke-linecap="round"/><polyline points="3,9 11,9" stroke="var(--warn)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    Low: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,5 7,10 12,5" stroke="#5a86c2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    Lowest: '<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,3 7,8 12,3" stroke="#5a86c2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="2,7 7,12 12,7" stroke="#5a86c2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* ---- people ---- */
  const PEOPLE = {
    lena:   { name: 'Lead Lena', init: 'LL', color: '#1e3a6e' },
    arjuna: { name: 'Arjuna',    init: 'AR', color: '#2c5499' },
    lila:   { name: 'Lila Devi', init: 'LD', color: '#3f7d54' },
    mara:   { name: 'Mara',      init: 'MA', color: '#b4452f' },
    gita:   { name: 'Gita',      init: 'GI', color: '#c8762f' },
    omar:   { name: 'Omar',      init: 'OM', color: '#7a5aa6' },
  };
  const av = (p, sz) => `<span class="av" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * 0.4)}px;background:${p.color}">${p.init}</span>`;

  /* ---- 5-status pipeline (purple Review 2nd-to-last) ---- */
  const STATUS = {
    todo:    { name: 'To Do',       color: '#6b7280' },
    doing:   { name: 'In Progress', color: '#2c64a8' },
    delayed: { name: 'Delayed',     color: '#bb3b28' },
    review:  { name: 'Review',      color: '#7a5aa6' },
    done:    { name: 'Done',        color: '#3f7d54' },
  };
  const SORDER = ['todo', 'doing', 'delayed', 'review', 'done'];
  const stPill = k => `<span class="pill" style="background:color-mix(in srgb,${STATUS[k].color} 16%,var(--surface));color:${STATUS[k].color};border:1px solid color-mix(in srgb,${STATUS[k].color} 26%,transparent)"><span class="dot" style="background:${STATUS[k].color}"></span>${STATUS[k].name}</span>`;
  const stSelect = sel => `<select>${SORDER.map(k => `<option ${k === sel ? 'selected' : ''}>${STATUS[k].name}</option>`).join('')}</select>`;

  // Priority control — styled like every other select (thin tan border, caret) but opens
  // our custom popover (never a native dropdown). PRIO holds the icon SVGs.
  const PRIO_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
  const prioPop = sel => `<div class="cs-pop prio-pop">${PRIO_ORDER.map(p => `<div class="cs-opt ${p === sel ? 'sel' : ''}"><span class="pi">${PRIO[p]}</span>${p}${p === sel ? `<span class="cs-check">${I.check}</span>` : ''}</div>`).join('')}</div>`;
  const prioCtl = (sel, open) => `<div class="cs-wrap ${open ? 'open' : ''}"><button type="button" class="ctl-select"><span class="pi">${PRIO[sel]}</span><span class="ctl-lbl">${sel}</span><span class="ctl-caret">${I.chevDown}</span></button>${open ? prioPop(sel) : ''}</div>`;

  // Generic custom select — the house dropdown (bordered control + caret that opens a
  // custom popover). Used everywhere a native <select> would otherwise appear, so there
  // are NO browser dropdowns anywhere in the app.
  function csel(value, options, opts) {
    opts = opts || {};
    const lead = opts.lead || '';
    const pop = opts.open ? `<div class="cs-pop">${options.map(o => `<div class="cs-opt ${o === value ? 'sel' : ''}">${esc(o)}${o === value ? `<span class="cs-check">${I.check}</span>` : ''}</div>`).join('')}</div>` : '';
    return `<div class="cs-wrap ${opts.inline ? 'inline' : ''} ${opts.open ? 'open' : ''}"><button type="button" class="ctl-select ${opts.muted ? 'muted' : ''}">${lead}<span class="ctl-lbl">${esc(value)}</span><span class="ctl-caret">${I.chevDown}</span></button>${pop}</div>`;
  }
  const STATUS_NAMES = SORDER.map(k => STATUS[k].name);
  const ADD_OPTS = [...Object.values(PEOPLE).map(p => p.name), 'Group: Seva', 'Group: Kitchen'];
  const changeToSel = () => csel('Change to…', STATUS_NAMES, { inline: true, muted: true });

  // Assignees — the app's Task-Popup control: avatar/name chips (✕ to remove) + a
  // "+ Add person or group…" select. Shared by the Task Popup and the Subtask editor
  // so they are identical.
  const mChip = id => `<span class="m-chip"><span class="av" style="background:${PEOPLE[id].color}">${PEOPLE[id].init}</span>${esc(PEOPLE[id].name)}<button class="x" title="Remove">✕</button></span>`;
  const assigneeField = ids => `<div class="m-chips">${ids.map(mChip).join('')}${csel('+ Add person or group…', ADD_OPTS, { inline: true, muted: true })}</div>`;

  // Links — a list of individual link rows (icon · URL input · ✕ remove) + "Add link".
  // Replaces the old free-text box so links stay tidy and removable. Shared everywhere.
  const linkRow = u => `<div class="link-row"><span class="link-ic">${I.link}</span><input class="link-url" value="${u ? esc(u) : ''}" placeholder="https://…" /><button type="button" class="link-rm" title="Remove link">${I.x}</button></div>`;
  const linksField = (urls = []) => `<div class="links-list">${urls.map(linkRow).join('')}<button type="button" class="btn btn-secondary link-add">${I.plus} Add link</button></div>`;

  /* =============================================================  WEB CHROME  */
  function userMenu(dot) {
    const item = (icon, label, opt) => `<button class="um-item ${opt && opt.danger ? 'danger' : ''}">${I[icon]}<span class="um-name">${label}</span>${opt && opt.dot ? '<span class="um-dot"></span>' : ''}${opt && opt.tag ? `<span class="um-tag">${opt.tag}</span>` : ''}</button>`;
    return `<div class="menu um" style="top:calc(100% + 7px);right:0">
      <div class="m-head">Admin Ada · admin@ananda.test</div>
      ${item('help', 'Help &amp; FAQ', { dot })}
      <div class="m-div"></div>
      ${item('gear', 'Settings')}
      ${item('clock', 'History')}
      ${item('archive', 'Archive')}
      ${item('refresh', 'Restore points')}
      ${item('trash', 'Trash')}
      <div class="m-div"></div>
      ${item('bell', 'Turn on notifications')}
      ${item('eye', 'Preview as Viewer')}
      ${item('userPlus', 'Preview as new Member')}
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
        <img class="mark" src="${MARK}" alt="" />
        <div class="brand-txt"><div class="name">Ananda <b>Taskboard</b></div><div class="tagline">Love &amp; Blessings from Ananda Los Angeles</div></div>
        <button class="theme-btn" title="Toggle theme">${I.moon}</button>
      </div>
      <div class="spacer"></div>
      <div class="actions">
        ${ghost('approvals', 'Approvals')}
        ${ghost('users', 'Team')}
        ${ghost('grid', 'Projects')}
        <span class="sep"></span>
        <button class="newtask">${I.plus}<span>New task</span></button>
        <div class="user-wrap" style="position:relative">
          <div class="user ${opt.userMenu ? 'open' : ''}">${opt.newDot ? '<span class="wn-dot"></span>' : ''}<span class="avatar av">AD</span><span>Admin Ada</span><span class="caret">▾</span></div>
          ${opt.userMenu ? userMenu(opt.newDot) : ''}
        </div>
      </div>
    </div>`;
  }

  function tabrail() {
    return `<div class="tabrail">
        <span class="ptab on" style="border-color:#6b7280;background:color-mix(in srgb,#6b7280 14%,var(--surface))">🌐 Global Overview <span class="count">20</span></span>
        <span class="ptab" style="border-color:var(--border)">🪔 Karuna Devi <span class="count">8</span></span>
        <span class="ptab" style="border-color:var(--border)">🌸 Sunday Service <span class="count">7</span></span>
        <span class="ptab" style="border-color:var(--border)">⚡ Alliance Electric <span class="count">5</span></span>
      </div>`;
  }
  function viewbar(active) {
    const VIEWS = [['list', 'List'], ['board', 'Board'], ['weekly', 'Weekly'], ['monthly', 'Monthly']];
    const seg = VIEWS.map(([k, l]) => k === active ? `<b>${l}</b>` : `<span>${l}</span>`).join('');
    const sbtn = (icon, label) => `<button class="btn btn-secondary vbtn" title="${label}">${I[icon]}<span class="lbl">${label}</span></button>`;
    return `<div class="shell-viewbar">
      <div class="seg-mini">${seg}</div>
      <div class="vb-right">
        ${sbtn('share', 'Share view')}
        ${sbtn('copy', 'Copy summary')}
        ${sbtn('exportI', 'Export')}
        ${sbtn('importI', 'Import')}
      </div>
    </div>`;
  }

  /* ---- overdue / due-soon alert badges (red ! · amber clock) ---- */
  const BADGE_OD = '<svg width="15" height="15" viewBox="0 0 24 24" style="flex:none" title="Overdue"><circle cx="12" cy="12" r="10" fill="var(--danger)"/><path d="M12 7v6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="16.4" r="1.4" fill="#fff"/></svg>';
  const BADGE_SOON = '<svg width="15" height="15" viewBox="0 0 24 24" style="flex:none" title="Due soon"><circle cx="12" cy="12" r="10" fill="var(--ring-soon)"/><path d="M12 7.6V12l2.8 1.7" fill="none" stroke="#3a2d10" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---- the real List view: filter bar + dense table ---- */
  const LIST = [
    { n: 'Confirm caterer for retreat', p: 'Sunday Service', pc: '#3f7d54', s: 'Kitchen', sc: '#2f7d74', who: ['lila'], pr: 'High', st: 'doing', due: 'Jun 9', d: '' },
    { n: 'Rewire altar lighting', p: 'Alliance Electric', pc: '#a23e6e', s: 'Lighting', sc: '#7a5aa6', who: ['omar', 'mara'], pr: 'Highest', st: 'delayed', due: 'Jun 2', d: 'od', rec: 'weekly' },
    { n: 'Print Sunday programs', p: 'Karuna Devi', pc: '#c8762f', s: 'Design', sc: '#2c5499', who: ['lena'], pr: 'Medium', st: 'review', due: 'Jun 6', d: 'soon' },
    { n: 'Design spring flyer', p: 'Karuna Devi', pc: '#c8762f', s: 'Design', sc: '#2c5499', who: ['lena', 'arjuna'], pr: 'High', st: 'doing', due: 'Jun 14', d: '' },
    { n: 'Order replacement candles', p: 'Karuna Devi', pc: '#c8762f', s: 'Kitchen', sc: '#2f7d74', who: ['gita'], pr: 'Low', st: 'done', due: 'May 31', d: '' },
    { n: 'Tune harmonium', p: 'Sunday Service', pc: '#3f7d54', s: 'Music', sc: '#c9a24b', who: [], pr: 'Medium', st: 'todo', due: 'Jun 12', d: '' },
  ];
  const flt = (label, active, cnt) => `<button class="flt ${active ? 'active' : ''}"><span>${label}</span>${cnt ? `<span class="cnt">${cnt}</span>` : ''}<span class="cv">${I.chevDown}</span></button>`;
  function filterBar() {
    return `<div class="fltbar">
      <div class="fsearch">${I.search}<input placeholder="Search tasks…" /></div>
      ${flt('Any assignee')}
      ${flt('Any status')}
      ${flt('Any priority')}
      ${flt('Any deadline')}
      ${flt('Any recurrence')}
    </div>`;
  }
  function listTable() {
    const COLS = ['Task', 'Project', 'Sub-project', 'Assignees', 'Status', 'Deadline', 'Recurs'];
    const head = COLS.map((c, i) => `<th class="${i === 0 ? 'c-task' : ''} ${i === 0 ? 'sorted' : ''}"><span class="th-in">${c}${i < 6 && i !== 3 ? `<span class="arrow">${i === 0 ? '▲' : ''}</span>` : ''}</span></th>`).join('');
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
    return `${tabrail()}
      ${viewbar('list')}
      ${filterBar()}
      <div class="shell-summary">
        <span class="ss"><b>20</b> Tasks</span>
        <span class="ss od"><b>2</b> Overdue</span>
        <span class="ss soon"><b>1</b> Due soon</span>
        ${stmt('todo', 7)}${stmt('doing', 6)}${stmt('delayed', 2)}${stmt('review', 3)}${stmt('done', 2)}
      </div>
      ${listTable()}`;
  }

  function appShell(opt) {
    opt = opt || {};
    return `<div class="appshell ${opt.dim ? 'dim' : ''}">${topbar(opt)}${shellBack()}</div>`;
  }
  const modalHead = (title, sub) => `<div class="modal-head"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="x">${I.x}</button></div>`;

  /* =============================================================  HELP "?" AFFORDANCE  */
  /* =============================================================  HELP IN THE ACCOUNT MENU  */
  function webHelpButtonShell() {
    return `<div class="webframe"><div class="appshell">${topbar({ newDot: true, userMenu: true })}${shellBack()}</div></div>`;
  }
  function webHelpButtonDetail() {
    const state = (lbl, demo) => `<div class="dc-state"><span class="lbl">${lbl}</span><div class="demo">${demo}</div></div>`;
    const pill = dot => `<span class="user" style="display:inline-flex">${dot ? '<span class="wn-dot"></span>' : ''}<span class="avatar av" style="background:var(--primary)">AD</span><span>Admin Ada</span><span class="caret">▾</span></span>`;
    const row = dot => `<span class="um-item" style="display:inline-flex;width:200px;border:1px solid var(--border);border-radius:8px;background:var(--surface)">${I.help}<span class="um-name">Help &amp; FAQ</span>${dot ? '<span class="um-dot"></span>' : ''}</span>`;
    return `<div class="detail-card">
      <div class="dc-cap">Help lives in the account menu · states</div>
      <div class="dc-states">
        ${state('User pill', pill(false))}
        ${state('Unseen features', pill(true))}
        ${state('Menu item', row(false))}
        ${state('Item, unseen', row(true))}
      </div>
    </div>`;
  }

  /* =============================================================  WELCOME CARD  */
  const welcomeInner = () => `<div class="wc">
    <div class="wc-head">
      <div class="wc-badge">${I.compass}</div>
      <h2>Welcome to Ananda Taskboard</h2>
      <p class="intro">A quiet, shared place to track the community's work. Here's the lay of the land.</p>
    </div>
    <div class="wc-bullets">
      <div class="wc-bullet"><span class="ic">${I.grid}</span><span class="bt">Open a <b>Project tab</b> to focus on one area's tasks.</span></div>
      <div class="wc-bullet"><span class="ic">${I.layout}</span><span class="bt">Switch between <b>List, Board, Weekly &amp; Monthly</b> views.</span></div>
      <div class="wc-bullet"><span class="ic">${I.plus}</span><span class="bt">Add work with the <span class="pillkey">${I.plus}New task</span> button, top-right.</span></div>
    </div>
    <div class="wc-helper"><span>Need a hand later? Find <b>${I.help}&nbsp;Help</b> anytime in your account menu, top-right.</span></div>
    <div class="wc-foot">
      <button class="btn btn-primary">Got it</button>
    </div>
  </div>`;
  function webWelcome() {
    return `<div class="webframe">${appShell({ dim: true })}
      <div class="modal-backdrop" style="align-items:center">${welcomeInner()}</div></div>`;
  }

  /* =============================================================  HELP CONTENT  */
  const SECTIONS = [
    { key: 'views', name: 'Getting around', icon: 'compass', arts: [
      { t: 'Switch between List, Board, Weekly & Monthly', b: ['Use the view switch under the project tabs. <b>List</b> is a dense sortable table, <b>Board</b> a Kanban of the five statuses, and <b>Weekly</b>/<b>Monthly</b> place tasks on a calendar by their dates.'] },
      { t: 'Open and filter a project tab', b: ['Each colored pill is a project; tap one to scope the board to it, then narrow with the Assignee, Status and Priority filters. A <b>Clear</b> button appears whenever a filter is active.'] },
      { t: 'Read the summary strip', b: ['The dense row above the list totals your tasks, then flags <b>Overdue</b> (red) and <b>Due soon</b> (amber), followed by a count per status.'] },
      { t: 'Find a task quickly', b: ['Type in the search box to filter the current view by title, or open a task and copy its share link from the <b>#id</b> pill.'] },
    ]},
    { key: 'tasks', name: 'Everyday tasks', icon: 'listChk', arts: [
      { t: 'Create a task', b: ['Press <b>+ New task</b>, give it a name, pick a project and sub-project, then set status, people and dates. Everything but the name is optional.'] },
      { t: 'Assign people and groups', b: ['Add individuals or whole groups in <b>Assignees</b>. People without access to the task\u2019s sub-project show a muted <b>no access</b> tag.'] },
      { t: 'Set a deadline, start date & times', b: ['Dates place a task on the calendar. Times are optional — but if you set one you must set <b>both</b> a start and end time, or neither.'] },
      { t: 'Break a task into subtasks', b: ['Open a task and use the <b>Subtasks</b> section. Each subtask is a mini-task with its own people, dates and status — tap a row to edit its details in place.'], new: true },
    ]},
    { key: 'account', name: 'Your account', icon: 'user', arts: [
      { t: 'Change your password', b: ['Open the user menu (top-right) and choose Settings to update your password at any time.'] },
      { t: 'Switch language', b: ['Ananda Taskboard speaks 13 languages. Pick yours from <b>Language</b> in the user menu; the whole interface follows.'] },
      { t: 'Turn on notifications', b: ['Enable <b>Turn on notifications</b> in the user menu to be told when a task you\u2019re on changes or a deadline nears.'] },
    ]},
    { key: 'admin', name: 'For admins', icon: 'shield', admin: true, arts: [
      { t: 'Manage projects & sub-projects', b: ['Create, recolor and reorder projects; changes auto-save. The default sub-project can\u2019t be renamed or deleted.'] },
      { t: 'Invite & manage your team', b: ['Invite people by email or add them directly with a temporary password, then set each person\u2019s role and access.'] },
      { t: 'Roles, Access & grants', b: ['<b>Role</b> sets what someone can do (Viewer / Member / Admin); <b>Access</b> and grants set what they can see. The two are independent.'] },
      { t: 'Review & approve tasks', b: ['New tasks wait in <b>Approvals</b> until an admin approves them. Tap a name to open it, or approve several at once.'] },
      { t: 'Restore from Trash', b: ['Deleted projects, sub-projects and tasks rest in Trash. Expand a row to see what would come back, then Restore.'] },
      { t: 'Settings & statuses', b: ['Drag to reorder statuses and add your own. Default statuses can\u2019t be deleted, and <b>Done</b> always marks a task complete.'] },
      { t: 'View History', b: ['Step day-by-day through what changed, with a one-year retention window.'] },
      { t: 'Restore points', b: ['Roll the whole board back to an earlier saved snapshot — a confirmation explains exactly what will change.'] },
      { t: 'Holidays & observances', b: ['Choose which holiday sets appear as quiet calendar context — US federal, observances, Christian, Hindu/yoga festivals and Ananda lineage days.'], new: true },
    ]},
    { key: 'faq', name: 'Common questions', icon: 'help', arts: [
      { t: 'Why can\u2019t I see a task?', b: ['Visibility follows your <b>Access</b> and the grants an admin set. If a task lives outside your scope it simply won\u2019t appear — ask an admin to grant the project or sub-project.'] },
      { t: 'What does \u201cReview\u201d mean?', b: ['<b>Review</b> (purple) is the status just before Done — work that\u2019s finished and waiting on a second pair of eyes.'] },
      { t: 'Who can edit a subtask?', b: ['Anyone assigned to a subtask — or in a group assigned to it — can edit it, even without edit rights on the parent task.'] },
      { t: 'Can I undo a delete?', b: ['Yes. Deleted items go to Trash and can be restored; admins can also roll back to a Restore point.'] },
      { t: 'What are \u201cdue soon\u201d and \u201coverdue\u201d?', b: ['<b>Due soon</b> (amber) flags a deadline within a couple of days; <b>overdue</b> (red) flags one already passed.'] },
    ]},
  ];
  const WHATSNEW = [
    { t: 'Break a task into subtasks', date: 'Jun 6', sec: 'tasks' },
    { t: 'Holidays & observances', date: 'Jun 6', sec: 'admin', admin: true },
    { t: '\u201cReview\u201d status (was \u201cReady for Review\u201d)', date: 'Jun 5', sec: 'faq' },
  ];
  const chipNew = () => `<span class="help-chip help-chip-new">New</span>`;
  const chipAdmin = () => `<span class="help-chip help-chip-admin" title="Admin only">${I.lock} Admin</span>`;

  function helpSection(sec, openKey, openArt) {
    const isOpen = sec.key === openKey;
    const arts = sec.arts.map((a, i) => {
      const aOpen = isOpen && i === openArt;
      const chips = a.new ? chipNew() : '';
      const body = a.b.map(p => `<p>${p}</p>`).join('') + (sec.admin ? `<p class="admin-only">${I.lock} Available to admins only.</p>` : '');
      return `<div class="help-art ${aOpen ? 'open' : ''}">
        <button class="help-art-head"><span class="atitle">${esc(a.t)}${chips}</span><span class="chev">${I.chevRight}</span></button>
        ${aOpen ? `<div class="help-art-body">${body}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="help-sec ${isOpen ? 'open' : ''}">
      <button class="help-sec-head"><span class="chev">${I.chevRight}</span><span class="si">${I[sec.icon]}</span><span class="sname">${sec.name}</span><span class="count">${sec.arts.length}</span></button>
      ${isOpen ? `<div class="help-arts">${arts}</div>` : ''}
    </div>`;
  }
  function whatsNewBlock() {
    return `<div class="whatsnew">
      <div class="wn-head">${I.sparkle}<span>What's new</span></div>
      ${WHATSNEW.map(w => `<div class="wn-art"><span class="wt">${esc(w.t)} ${chipNew()}</span><span class="wdate">${w.date}</span></div>`).join('')}
    </div>`;
  }
  function helpFooter() {
    return `<div class="help-foot">
      <button class="lnk">${I.refresh} Show welcome again</button>
      <button class="lnk contact">${I.mail} Contact us</button>
    </div>`;
  }
  // search results — typing "admin" surfaces every admin ticket (category conveys admin-only)
  const RESULTS = [
    { t: 'Manage projects & sub-projects', sec: 'For admins', body: 'Create, recolor and reorder projects; changes auto-save. The default sub-project can\u2019t be renamed or deleted.' },
    { t: 'Invite & manage your team', sec: 'For admins', body: 'Invite people by email or add them directly with a temporary password, then set each person\u2019s role and access.' },
    { t: 'Roles, Access & grants', sec: 'For admins', body: 'Role sets what someone can do (Viewer / Member / Admin); Access and grants set what they can see. The two are independent.' },
    { t: 'Review & approve tasks', sec: 'For admins', body: 'New tasks wait in Approvals until an admin approves them. Tap a name to open it, or approve several at once.' },
    { t: 'Restore from Trash', sec: 'For admins', body: 'Deleted projects, sub-projects and tasks rest in Trash. Expand a row to see what would come back, then Restore.' },
  ];
  const resultRows = () => RESULTS.map((r, i) => {
    const open = i === 0;
    return `<div class="help-result ${open ? 'open' : ''}">
      <button class="hr-head"><span class="rt">${esc(r.t)}</span><span class="rc">${r.sec}</span><span class="chev">${I.chevRight}</span></button>
      ${open ? `<div class="help-result-body"><p>${r.body}</p><p class="admin-only">${I.lock} Available to admins only.</p></div>` : ''}
    </div>`;
  }).join('');

  function helpBody(state) {
    if (state === 'search') {
      return `<div class="help-search">${I.search}<input value="admin" /></div>
        <div class="help-results">${resultRows()}</div>`;
    }
    if (state === 'empty') {
      return `<div class="help-search">${I.search}<input value="payroll" /></div>
        <div class="help-empty"><div class="ei">${I.search}</div><div class="et">No help found for \u201cpayroll\u201d</div><div class="es">Try a different word, or reach us with Contact below.</div></div>`;
    }
    // landing / section / article
    const openKey = state === 'section' ? 'tasks' : state === 'article' ? 'tasks' : null;
    const openArt = state === 'article' ? 3 : -1;
    return `<div class="help-search">${I.search}<input placeholder="Search help…" /></div>
      ${whatsNewBlock()}
      ${SECTIONS.map(s => helpSection(s, openKey, openArt)).join('')}`;
  }
  function webHelpCenter(state) {
    return `<div class="webframe">${appShell({ dim: true, newDot: state === 'landing' })}
      <div class="modal-backdrop"><div class="modal has-foot" style="max-width:640px">
        ${modalHead('Help &amp; FAQ', 'Search, or browse by topic')}
        <div class="modal-body">${helpBody(state)}</div>
        ${helpFooter()}
      </div></div></div>`;
  }

  /* =============================================================  SUBTASK EDITOR  */
  // compact subtask rows (inside the task modal, below the form)
  // status is the app's custom pill + custom popover (never a native <select>)
  const stPop = stat => `<div class="cs-pop st-pop">${SORDER.map(k => `<div class="cs-opt ${k === stat ? 'sel' : ''}"><span class="dot" style="background:${STATUS[k].color}"></span>${STATUS[k].name}${k === stat ? `<span class="cs-check">${I.check}</span>` : ''}</div>`).join('')}</div>`;
  const stPillBtn = (stat, open) => `<button type="button" class="status-pill" style="--sc:${STATUS[stat].color}"><span class="dot" style="background:${STATUS[stat].color}"></span>${STATUS[stat].name}<span class="caret">▾</span></button>${open ? stPop(stat) : ''}`;
  function subRow(title, who, stat, grp, prio, open) {
    let avsInner = '';
    if (grp) {
      avsInner = `<span class="grp" title="Group: Seva">\u25c7</span>`;
    } else if (who && who.length) {
      avsInner = who.slice(0, 3).map(id => av(PEOPLE[id], 22)).join('') + (who.length > 3 ? `<span class="more">+${who.length - 3}</span>` : '');
    }
    return `<div class="st-row">
      <span class="st-prio" title="Priority: ${prio}">${PRIO[prio]}</span>
      <span class="st-open"><span class="st-title">${esc(title)}</span></span>
      <span class="st-avs">${avsInner}</span>
      <span class="st-stat ${open ? 'open' : ''}">${stPillBtn(stat, open)}</span>
      <button class="st-del" title="Delete subtask">${I.trash}</button>
    </div>`;
  }
  function segBar(c) {
    const total = (c.todo || 0) + (c.doing || 0) + (c.delayed || 0) + (c.review || 0) + (c.done || 0) || 1;
    const seg = (n, k) => n ? `<span style="width:${n / total * 100}%;background:${STATUS[k].color}"></span>` : '';
    return `<div class="segbar"><div class="segbar-track">${seg(c.doing, 'doing')}${seg(c.delayed, 'delayed')}${seg(c.review, 'review')}${seg(c.done, 'done')}</div><span class="segbar-n">${c.done || 0}/${total}</span></div>`;
  }
  function subtaskSection() {
    return `<div class="m-section"><div class="sub-head">
        <h3>Subtasks (4)</h3>
        <span class="sub-counts" title="Subtasks by status">
          <span class="c"><span class="dot" style="background:${STATUS.done.color}"></span>2</span>
          <span class="c"><span class="dot" style="background:${STATUS.review.color}"></span>1</span>
          <span class="c"><span class="dot" style="background:${STATUS.todo.color}"></span>1</span>
        </span>
        <span class="sub-prog">${segBar({ todo: 1, review: 1, done: 2 })}</span>
      </div>
      <div class="st-rows">
        ${subRow('Draft headline & body copy', ['lila'], 'done', false, 'High', true)}
        ${subRow('Gather retreat photos', null, 'done', true, 'Medium')}
        ${subRow('Lay out A4 master', ['lena'], 'review', false, 'High')}
        ${subRow('Send proof to printer', null, 'todo', false, 'Low')}
      </div>
      <div class="st-add"><input placeholder="Add a subtask…" /><button class="btn btn-secondary">Add</button></div>
    </div>`;
  }
  // a compact parent-task form header (so the subtask section reads "below the form")
  function taskTitleHead(name, id) {
    return `<div class="modal-head">
      <div style="display:flex;align-items:center;gap:9px;flex:1;min-width:0">
        <input class="title-input" value="${esc(name)}" />
        <button class="btn-ghost icon-btn title-pen" title="Edit name">${I.pen}</button>
        <span class="id-pill">#${id}</span>
      </div>
      <button class="btn btn-secondary head-share" title="Copy task link">${I.share} Share</button>
      <button class="btn-ghost icon-btn" aria-label="Close">${I.x}</button>
    </div>`;
  }
  // the full Task Popup form body (faithful to the app), with the Subtasks section below
  function taskModalBody() {
    return `<div class="created-line">Created May 22, 2026</div>
      <div class="m-field"><span class="pill" style="background:color-mix(in srgb,var(--warn) 16%,var(--surface));color:var(--warn);border:1px solid color-mix(in srgb,var(--warn) 32%,transparent)">Pending approval</span></div>
      <div class="m-row2">
        <div class="m-field"><label>Project</label>${csel('Karuna Devi', ['Karuna Devi', 'Sunday Service', 'Alliance Electric'])}</div>
        <div class="m-field"><label>Sub-project</label>${csel('Design', ['Design', 'Marketing', 'Kitchen'])}</div>
      </div>
      <div class="m-row2">
        <div class="m-field"><label>Status (applied immediately)</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${stPill('doing')}${changeToSel()}</div></div>
        <div class="m-field"><label>Priority</label>${prioCtl('High')}</div>
      </div>
      <div class="m-field"><label>Assignees</label>${assigneeField(['lena', 'arjuna'])}</div>
      <div class="m-row2">
        <div class="m-field"><label>Details</label><textarea rows="3">Spring retreat flyer — A4, double-sided.</textarea></div>
        <div class="m-field"><label>Requirements</label><textarea rows="3">Approved headline + retreat photos.</textarea></div>
      </div>
      <div class="m-row2">
        <div class="m-field"><label>Start date <button type="button" class="info-btn">${I.info}</button></label><input type="date" value="2026-05-22" /></div>
        <div class="m-field"><label>Deadline</label><input type="date" value="2026-06-14" /></div>
      </div>
      <div class="m-row2">
        <div class="m-field"><label>Start time <button type="button" class="info-btn">${I.info}</button></label><input type="time" /></div>
        <div class="m-field"><label>End time</label><input type="time" /></div>
      </div>
      <div class="m-field"><label>Links</label>${linksField(['https://drive.ananda.org/spring-flyer', 'https://figma.com/file/retreat-2026'])}</div>
      <div class="m-field" style="margin-bottom:10px"><label class="m-chk"><input type="checkbox" /> <span>Repeats</span></label></div>
      <div class="m-field">
        <label class="m-chk"><input type="checkbox" /> <span>Monitor — notify admins when this task is moved</span></label>
        <label class="m-chk" style="margin-top:10px"><input type="checkbox" /> <span>Auto-complete — mark Done automatically after the deadline (mundane one-off tasks)</span></label>
      </div>
      <div class="modal-foot">
        <button class="btn btn-danger" style="margin-right:auto">${I.trash} Delete</button>
        <button class="btn btn-secondary">Cancel</button>
        <button class="btn btn-primary">Save</button>
      </div>
      ${subtaskSection()}
      <div class="m-section"><h3>Comments (2)</h3>
        <div class="m-comment"><div class="ch"><strong>Mara</strong><span class="mono" style="color:var(--faint)">Jun 2</span></div><div style="margin-top:3px">First draft is in the Drive folder — feedback welcome.</div></div>
        <div class="m-comment"><div class="ch"><strong>Ada</strong><span class="mono" style="color:var(--faint)">Jun 3</span></div><div style="margin-top:3px">Looks great. Can we make the date line bigger?</div></div>
        <div style="display:flex;gap:8px;margin-top:8px"><input placeholder="Add a comment…" /><button class="btn btn-secondary">Post</button></div>
      </div>`;
  }
  function webSubtaskList() {
    return `<div class="webframe">${appShell({ dim: true })}
      <div class="modal-backdrop"><div class="modal taskpop" style="max-width:720px">
        ${taskTitleHead('Design spring flyer', 142)}
        <div class="modal-body">${taskModalBody()}</div>
      </div></div></div>`;
  }

  // slide-in subtask detail panel
  function assigneeCollapsed() {
    return `<div class="ap-collapsed">
      <span class="ap-chip">${av(PEOPLE.lena, 20)} Lead Lena</span>
      <button class="ap-edit">Edit</button>
    </div>`;
  }
  function assigneeExpanded() {
    const row = (id, on, noacc) => `<label class="ap-row ${noacc ? 'noacc' : ''}"><input type="checkbox" ${on ? 'checked' : ''} ${noacc ? 'disabled' : ''}/>${av(PEOPLE[id], 24)}<span class="nm">${esc(PEOPLE[id].name)}</span>${noacc ? `<span class="ap-noacc">no access</span>` : ''}</label>`;
    return `<div class="ap-expanded">
      <div class="ap-srch">${I.search}<input placeholder="Search people…" /></div>
      <div class="ap-groups"><span class="gl">Assign a group</span>
        <button class="ap-gbtn"><span class="di">\u25c7</span> Seva</button>
        <button class="ap-gbtn"><span class="di">\u25c7</span> Kitchen</button>
      </div>
      <div class="ap-list">
        ${row('lena', true)}
        ${row('lila', false)}
        ${row('arjuna', false)}
        ${row('gita', false, true)}
      </div>
    </div>`;
  }
  function sdHead() {
    return `<div class="modal-head sd-head">
      <div class="sd-crumb">
        <button class="sd-back">${I.arrowLeft} Back</button>
        <span class="cr">Design spring flyer <span class="id-pill">#142</span></span>
        <span class="sep">${I.chevRight}</span>
        <span class="cur">Lay out A4 master <span class="id-pill">#142.2</span></span>
      </div>
      <button class="btn btn-secondary head-share" title="Copy sub-task link">${I.share} Share</button>
      <button class="btn-ghost icon-btn" aria-label="Close">${I.x}</button>
    </div>`;
  }
  function subtaskDetail(state) {
    const timeErr = state === 'timeerror';
    return `<div class="field"><label>Sub-task name</label><input value="Lay out A4 master" /></div>
      <div class="row2">
        <div class="field"><label>Status (applied immediately)</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${stPill('review')}${changeToSel()}</div></div>
        <div class="field"><label>Priority</label>${prioCtl('High', state === 'default')}</div>
      </div>
      <div class="field"><label>Assignees</label>${assigneeField(['lena'])}</div>
      <div class="row2">
        <div class="field"><label>Details</label><textarea rows="3" placeholder="What needs doing…">Final A4 layout, print-ready bleed.</textarea></div>
        <div class="field"><label>Requirements</label><textarea rows="3" placeholder="Definition of ‘complete’…">Matches the approved headline draft.</textarea></div>
      </div>
      <div class="row2">
        <div class="field"><label>Start date</label><input type="date" value="2026-06-04" /></div>
        <div class="field"><label>Deadline</label><input type="date" value="2026-06-08" /></div>
      </div>
      <div class="row2">
        <div class="field ${timeErr ? 'in-error' : ''}" style="margin-bottom:6px"><label>Start time</label><input type="time" value="${timeErr ? '13:00' : ''}" /></div>
        <div class="field ${timeErr ? 'in-error' : ''}" style="margin-bottom:6px"><label>End time</label><input type="time" value="" /></div>
      </div>
      ${timeErr ? `<div class="time-error">${I.clock} Set both a start and end time, or neither.</div>` : ''}
      <div class="field"><label>Links</label>${linksField(['https://drive.ananda.org/a4-master'])}</div>
      <div class="sd-foot">
        <button class="btn btn-danger sd-del" style="margin-right:auto">${I.trash} Delete</button>
        <button class="btn btn-primary">Save</button>
      </div>`;
  }
  function webSubtaskDetail(state) {
    return `<div class="webframe">${appShell({ dim: true })}
      <div class="modal-backdrop"><div class="modal taskpop" style="max-width:720px">
        ${sdHead()}
        <div class="modal-body">${subtaskDetail(state)}</div>
      </div></div></div>`;
  }

  /* =============================================================  CALENDAR + UNSCHEDULED  */
  // Monthly — faithful .month grid; today = Tue Jun 9 2026
  const M_DAYS = {
    2:  { badges: [['#a23e6e', 1]], flag: 'od' },
    6:  { badges: [['#c8762f', 1]] },
    9:  { badges: [['#3f7d54', 1], ['#c8762f', 1]] },
    11: { badges: [['#2c5499', 1]], flag: 'soon' },
    12: { badges: [['#3f7d54', 2]] },
    14: { ev: [{ t: 'Flag Day', holiday: true }] },
    17: { badges: [['#7a5aa6', 1]] },
    19: { ev: [{ t: 'Juneteenth', holiday: true }] },
    21: { badges: [['#2f7d74', 1]] },
    24: { badges: [['#c8762f', 1]] },
  };
  function monthGrid() {
    const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let cells = dows.map(x => `<div class="dow">${x}</div>`).join('');
    const startDay = 1, dim = 30, total = 35, today = 9; // Jun 1 2026 = Monday
    for (let i = 0; i < total; i++) {
      const day = i - startDay + 1;
      if (day < 1 || day > dim) { const dn = day < 1 ? 31 + day : day - dim; cells += `<div class="mcell dim"><div class="dh"><span class="day-num">${dn}</span></div></div>`; continue; }
      const info = M_DAYS[day] || {};
      const isToday = day === today;
      const cls = isToday ? 'today' : info.flag === 'od' ? 'has-overdue' : info.flag === 'soon' ? 'has-soon' : day < today ? 'past' : 'future';
      const flag = info.flag === 'od' ? `<span class="cal-flag">${BADGE_OD}</span>` : info.flag === 'soon' ? `<span class="cal-flag">${BADGE_SOON}</span>` : '';
      const ev = (info.ev || []).map(e => `<div class="mev${e.holiday ? ' holiday' : ''}">${e.holiday ? I.star : I.mega}<span>${esc(e.t)}</span></div>`).join('');
      const badges = (info.badges || []).map(([c, n]) => `<span class="badge" style="background:${c}">${n}</span>`).join('');
      cells += `<div class="mcell ${cls}">
        <div class="dh"><span class="day-num">${day}</span>${isToday ? `<span class="today-tag">Today</span>` : ''}${flag}</div>
        ${ev}${badges ? `<div class="badges">${badges}</div>` : ''}
      </div>`;
    }
    return `<div class="month">${cells}</div>`;
  }
  // Weekly — faithful .wk; week Jun 7–13, today Tue 9 (index 2)
  const W_HEAD = [
    { dow: 'Sun', d: '7', cls: 'past' },
    { dow: 'Mon', d: '8', cls: 'past' },
    { dow: 'Tue', d: '9', cls: 'today' },
    { dow: 'Wed', d: '10', cls: 'future', ev: 'Choir rehearsal' },
    { dow: 'Thu', d: '11', cls: 'future' },
    { dow: 'Fri', d: '12', cls: 'future' },
    { dow: 'Sat', d: '13', cls: 'future' },
  ];
  const W_BARS = [
    { name: 'Rewire altar lighting', col: '#a23e6e', cs: 0, ce: 1, r: 1, who: 'OM', ring: 'od' },
    { name: 'Confirm caterer', col: '#3f7d54', cs: 2, ce: 2, r: 1, who: 'LD' },
    { name: 'Print Sunday programs', col: '#2c5499', cs: 3, ce: 3, r: 1, who: 'LL', ring: 'soon' },
    { name: 'Garden seva', col: '#2f7d74', cs: 5, ce: 6, r: 1, who: 'AR' },
    { name: 'Newsletter layout', col: '#7a5aa6', cs: 2, ce: 4, r: 2, who: 'LL' },
    { name: 'Tune harmonium', col: '#c9a24b', cs: 5, ce: 5, r: 2, who: '' },
  ];
  function weekGrid() {
    const head = W_HEAD.map(h => `<div class="wk-hcell ${h.cls}"><div class="hrow"><span class="dow">${h.dow}</span>${h.cls === 'today' ? `<span class="today-tag">Today</span>` : ''}<span class="dnum">Jun ${h.d}</span></div>${h.ev ? `<div class="ev">${I.mega}<span>${esc(h.ev)}</span></div>` : ''}</div>`).join('');
    const cols = W_HEAD.map((h, i) => `<div class="wk-col ${h.cls}" style="grid-column:${i + 1};grid-row:1/-1"></div>`).join('');
    const bars = W_BARS.map(b => `<div class="wk-bar ${b.ring || ''}" style="grid-column:${b.cs + 1}/${b.ce + 2};grid-row:${b.r};background:${b.col}"><span class="tt">${b.ring === 'od' ? BADGE_OD : b.ring === 'soon' ? BADGE_SOON : ''}<span class="tn">${esc(b.name)}</span></span>${b.who ? `<span class="mini">${b.who}</span>` : ''}</div>`).join('');
    const thl = `<div class="wk-today-hl" style="left:calc(100%/7*2);width:calc(100%/7)"></div>`;
    return `<div class="wk"><div class="wk-head">${head}</div><div class="wk-body" style="grid-template-rows:repeat(2,32px)">${cols}${bars}</div>${thl}</div>`;
  }
  function calHead(view) {
    return `<div class="cal-head">
      <div class="nav"><button class="btn btn-secondary icon-btn">${I.chevLeft}</button><button class="btn btn-secondary">This ${view === 'weekly' ? 'week' : 'month'}</button><button class="btn btn-secondary icon-btn">${I.chevRight}</button></div>
      <h2>${view === 'weekly' ? 'Jun 7 – 13, 2026' : 'June 2026'}</h2>
      <button class="unsched-btn">${I.calendarOff} Unscheduled Tasks <span class="cnt">4</span></button>
    </div>`;
  }
  function webNoDateCal(view) {
    return `<div class="webframe"><div class="appshell">${topbar({})}
      ${tabrail()}
      ${viewbar(view)}
      <div class="cal-wrap">${calHead(view)}${view === 'weekly' ? weekGrid() : monthGrid()}</div>
    </div></div>`;
  }
  // ---- Unscheduled list (the app's standard compact task row) ----
  const UNSCHED = [
    { p: 'High',   proj: 'Karuna Devi',    pc: '#c8762f', sub: 'Library',     sc: '#2f7d74', who: ['lila'],          s: 'todo',   t: 'Re-bind the songbooks' },
    { p: 'Medium', proj: 'Karuna Devi',    pc: '#c8762f', sub: 'Library',     sc: '#2f7d74', who: ['arjuna'],        s: 'doing',  t: 'Catalogue the library shelf' },
    { p: 'Low',    proj: 'Sunday Service', pc: '#3f7d54', sub: 'Hospitality', sc: '#a23e6e', who: ['mara', 'gita'],  s: 'todo',   t: 'Sort the donations closet' },
    { p: 'Medium', proj: 'Karuna Devi',    pc: '#c8762f', sub: 'Outreach',    sc: '#2c5499', who: ['lena'],          s: 'review', t: 'Draft the volunteer thank-yous' },
  ];
  // one compact row; `time` shows only when a task actually has a time set (unscheduled tasks have none)
  function taskRow(r) {
    const avs = r.who.map(id => av(PEOPLE[id], 20)).join('');
    return `<div class="dl-card">
      <span class="dl-l">
        <span class="dl-prio" title="Priority: ${r.p}">${PRIO[r.p]}</span>
        <span class="dl-name">${esc(r.t)}</span>
        <span class="proj-pill" style="--pc:${r.pc}">${esc(r.proj)}</span>
        <span class="proj-pill" style="--pc:${r.sc}">${esc(r.sub)}</span>
        ${r.time ? `<span class="dl-time mono">${r.time}</span>` : ''}
        <span class="dl-avs">${avs}</span>
      </span>
      ${stPill(r.s)}
    </div>`;
  }
  function unschedRows() { return UNSCHED.map(taskRow).join(''); }
  // sortable column table + filter bar (List-view methodology), minus Deadline/Recurrence
  function unschedTable() {
    const COLS = ['Task', 'Project', 'Sub-project', 'Assignees', 'Status'];
    const head = COLS.map((c, i) => `<th class="${i === 0 ? 'c-task sorted' : ''}"><span class="th-in">${c}${i !== 3 ? `<span class="arrow">${i === 0 ? '▲' : ''}</span>` : ''}</span></th>`).join('');
    const rows = UNSCHED.map(t => {
      const who = `<span class="avstack hov">${t.who.map(id => `<span class="av" title="${esc(PEOPLE[id].name)}" style="background:${PEOPLE[id].color}">${PEOPLE[id].init}</span>`).join('')}</span>`;
      return `<tr>
        <td class="c-task"><div class="task-cell"><span class="prio" title="Priority: ${t.p}">${PRIO[t.p]}</span><span class="task-name">${esc(t.t)}</span></div></td>
        <td><span class="proj-pill" style="--pc:${t.pc}"><span class="pp-nm">${esc(t.proj)}</span></span></td>
        <td><span class="proj-pill" style="--pc:${t.sc}"><span class="pp-nm">${esc(t.sub)}</span></span></td>
        <td><div class="who">${who}</div></td>
        <td><span class="status-pill" style="--sc:${STATUS[t.s].color}"><span class="dot" style="background:${STATUS[t.s].color}"></span>${STATUS[t.s].name}<span class="caret">▾</span></span></td>
      </tr>`;
    }).join('');
    return `<div class="board-list" style="padding:0"><table class="lst"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function unschedFilterBar() {
    return `<div class="fltbar in-modal">
      <div class="fsearch">${I.search}<input placeholder="Search tasks…" /></div>
      ${flt('Any assignee')}${flt('Any project')}${flt('Any status')}
    </div>`;
  }
  function webNoDateModal() {
    return `<div class="webframe"><div class="appshell dim">${topbar({})}${tabrail()}${viewbar('monthly')}
        <div class="cal-wrap">${calHead('monthly')}${monthGrid()}</div></div>
      <div class="modal-backdrop"><div class="modal" style="max-width:760px">
        ${modalHead('Unscheduled tasks (4)', 'Tasks with no start date or deadline · sortable &amp; filterable')}
        <div class="modal-body">
          ${unschedFilterBar()}
          ${unschedTable()}
        </div>
      </div></div></div>`;
  }

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
  const mShellBody = () => `<div class="m-scroll" style="gap:9px;display:flex;flex-direction:column">${'<div style="height:62px;border-radius:11px;background:var(--surface);border:1px solid var(--border);opacity:.7"></div>'.repeat(5)}</div>`;
  const fsHead = (title, back) => `<div class="m-fs-head"><button class="x">${back ? I.arrowLeft : I.x}</button><span class="ttl">${title}</span></div>`;

  /* ---- mobile welcome ---- */
  function phoneWelcome() {
    return phone(`${mAppbar({ newDot: true })}<div style="flex:1;position:relative">${mShellBody()}
      <div style="position:absolute;inset:0;background:rgba(13,21,38,.45);z-index:5"></div>
      <div style="position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;padding:16px">${welcomeInner()}</div>
    </div>`);
  }

  /* ---- mobile help center (full-screen route) ---- */
  function phoneHelpCenter(state) {
    const body = state === 'search'
      ? `<div class="m-help-search">${I.search}<input value="admin" /></div>
         <div class="help-results">${resultRows()}</div>`
      : `<div class="m-help-search">${I.search}<input placeholder="Search help…" /></div>
         ${whatsNewBlock()}
         ${SECTIONS.map(s => helpSection(s, state === 'section' ? 'tasks' : null, state === 'section' ? 3 : -1)).join('')}`;
    return phone(`${fsHead('Help & FAQ')}<div class="m-scroll" style="padding-bottom:8px">${body}</div>${helpFooter()}`);
  }

  /* ---- mobile subtask list (task sheet) ---- */
  function mSubRow(title, who, stat, grp, prio) {
    let avsInner = '';
    if (grp) avsInner = `<span class="grp" title="Group: Seva">\u25c7</span>`;
    else if (who) avsInner = who.slice(0, 3).map(id => av(PEOPLE[id], 22)).join('');
    return `<div class="m-st-row">
      <span class="st-prio" title="Priority: ${prio}">${PRIO[prio]}</span>
      <span class="st-open"><span class="st-title">${esc(title)}</span></span>
      <span class="st-avs">${avsInner}</span>
      <span class="st-stat">${stPillBtn(stat)}</span>
      <button class="st-del" title="Delete">${I.trash}</button>
    </div>`;
  }
  function phoneSubtaskList() {
    return phone(`${fsHead('Edit task · #142', true)}<div class="m-scroll">
      <div class="sec-label" style="margin-top:0">Parent task</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px"><span class="proj-pill" style="--pc:#c8762f">Karuna Devi</span><span class="proj-pill" style="--pc:#a23e6e">Design</span>${stPill('doing')}</div>
      <div style="font-family:var(--f-display);font-weight:600;font-size:18px;margin-bottom:14px">Design spring flyer</div>
      <div class="sub-head" style="margin-bottom:10px"><h3>Subtasks (4)</h3><span class="sub-prog" style="margin-left:auto;width:118px">${segBar({ todo: 1, review: 1, done: 2 })}</span></div>
      ${mSubRow('Draft headline & body copy', ['lila'], 'done', false, 'High')}
      ${mSubRow('Gather retreat photos', null, 'done', true, 'Medium')}
      ${mSubRow('Lay out A4 master', ['lena'], 'review', false, 'High')}
      ${mSubRow('Send proof to printer', null, 'todo', false, 'Low')}
      <div class="st-add" style="margin-top:10px"><input placeholder="Add a subtask…" /><button class="btn btn-secondary">Add</button></div>
    </div>`);
  }

  /* ---- mobile subtask detail ---- */
  function phoneSubtaskDetail(state) {
    const timeErr = state === 'timeerror';
    return phone(`<div class="m-fs-head sd-head-m"><div class="sd-head-top"><button class="sd-back">${I.arrowLeft} Back</button><div class="sd-head-actions"><button class="btn btn-secondary head-share" title="Copy sub-task link">${I.share} Share</button><button class="x">${I.x}</button></div></div><div class="sd-crumb-m"><span class="cr">Design spring flyer <span class="id-pill">#142</span> ${I.chevRight}</span><span class="cur">Lay out A4 master <span class="id-pill">#142.2</span></span></div></div>
      <div class="m-scroll">
        <div class="field"><label>Sub-task name</label><input value="Lay out A4 master" /></div>
        <div class="field"><label>Status (applied immediately)</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${stPill('review')}${changeToSel()}</div></div>
        <div class="field"><label>Priority</label>${prioCtl('High')}</div>
        <div class="field"><label>Assignees</label>${assigneeField(['lena'])}</div>
        <div class="field"><label>Details</label><textarea rows="3">Final A4 layout, print-ready bleed.</textarea></div>
        <div class="field"><label>Requirements</label><textarea rows="2">Matches the approved headline draft.</textarea></div>
        <div class="field"><label>Start date</label><input type="date" value="2026-06-04" /></div>
        <div class="field"><label>Deadline</label><input type="date" value="2026-06-08" /></div>
        <div class="field ${timeErr ? 'in-error' : ''}" style="margin-bottom:6px"><label>Start time</label><input type="time" value="${timeErr ? '13:00' : ''}" /></div>
        <div class="field ${timeErr ? 'in-error' : ''}"><label>End time</label><input type="time" value="" /></div>
        ${timeErr ? `<div class="time-error" style="margin-bottom:8px">${I.clock} Set both a start and end time, or neither.</div>` : ''}
        <div class="field"><label>Links</label>${linksField(['https://drive.ananda.org/a4-master'])}</div>
        <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:8px">
          <button class="btn btn-danger" style="margin-right:auto">${I.trash} Delete</button>
          <button class="btn btn-primary">Save</button>
        </div>
      </div>`);
  }

  /* ---- mobile no-date ---- */
  function phoneNoDate(view) {
    const seg = `<div class="seg-mini" style="margin-bottom:12px;width:100%;justify-content:center;display:flex">${view === 'weekly' ? '<span>List</span><span>Board</span><b>Weekly</b><span>Monthly</span>' : '<span>List</span><span>Board</span><span>Weekly</span><b>Monthly</b>'}</div>`;
    const head = `<div class="cal-head" style="margin-bottom:10px">
      <div class="nav"><button class="btn btn-secondary icon-btn">${I.chevLeft}</button><button class="btn btn-secondary icon-btn">${I.chevRight}</button></div>
      <h2 style="font-size:17px">${view === 'weekly' ? 'Jun 7 – 13' : 'June 2026'}</h2>
      <button class="unsched-btn" style="margin-left:auto;width:100%;justify-content:center;margin-top:2px">${I.calendarOff} Unscheduled Tasks <span class="cnt">4</span></button>
    </div>`;
    return phone(`${mAppbar({})}<div class="m-scroll">${seg}${head}${view === 'weekly' ? weekGrid() : monthGrid()}</div>`);
  }
  // mobile Unscheduled — the app's compact .crow list (Trash/Approvals aesthetic), no date
  function mCRow(r) {
    const avs = r.who.map(id => `<span class="av" style="background:${PEOPLE[id].color}">${PEOPLE[id].init}</span>`).join('');
    return `<div class="crow">
      <div class="cmid">
        <div class="cnm"><span class="prio" title="Priority: ${r.p}">${PRIO[r.p]}</span>${esc(r.t)}</div>
        <div class="csub2"><span class="proj-pill" style="--pc:${r.pc}">${esc(r.proj)}</span><span class="gc-sep">/</span><span>${esc(r.sub)}</span></div>
      </div>
      <span class="avstack">${avs}</span>
      ${stPill(r.s)}
    </div>`;
  }
  const mFltSel = label => `<button class="cs-trigger flt-sel"><span class="cs-lbl">${label}</span><span class="cs-cv">${I.chevDown}</span></button>`;
  function phoneNoDateModal() {
    const seg = `<div class="seg-mini" style="margin-bottom:12px;width:100%;justify-content:center;display:flex"><span>List</span><span>Board</span><span>Weekly</span><b>Monthly</b></div>`;
    const head = `<div class="cal-head" style="margin-bottom:10px">
      <div class="nav"><button class="btn btn-secondary icon-btn">${I.chevLeft}</button><button class="btn btn-secondary icon-btn">${I.chevRight}</button></div>
      <h2 style="font-size:17px">June 2026</h2>
      <button class="unsched-btn" style="margin-left:auto;width:100%;justify-content:center;margin-top:2px">${I.calendarOff} Unscheduled Tasks <span class="cnt">4</span></button>
    </div>`;
    const bg = `<div class="m-scroll">${seg}${head}${monthGrid()}</div>`;
    const sheet = `<div class="m-sheet-scrim"></div>
      <div class="m-sheet">
        <div class="grab"><i></i></div>
        <div class="sh-head"><h2>Unscheduled tasks (4)</h2><button class="x">${I.x}</button></div>
        <div class="sh-body">
          <div class="flt-row">${mFltSel('A–Z')}${mFltSel('Any assignee')}${mFltSel('Any project')}${mFltSel('Any status')}</div>
          <div class="clist">${UNSCHED.map(mCRow).join('')}</div>
        </div>
      </div>`;
    return phone(`${mAppbar({})}<div style="flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column">${bg}${sheet}</div>`);
  }

  window.HELP = {
    webHelpButtonShell, webHelpButtonDetail, webWelcome, webHelpCenter,
    webSubtaskList, webSubtaskDetail, webNoDateCal, webNoDateModal,
    phoneWelcome, phoneHelpCenter, phoneSubtaskList, phoneSubtaskDetail, phoneNoDate, phoneNoDateModal,
  };
})();
