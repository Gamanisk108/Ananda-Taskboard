/* =============================================================
   Ananda Taskboard — MULTI-TENANCY & INVITATIONS screen builders
   window.MT.* return HTML strings. Org switcher · Platform overview ·
   Team→Invite section · Accept invitation. Web (app context) + phone.
   Copy short + label-driven (translates cleanly into 13 languages).
   ============================================================= */
(function () {
  const MARK = 'assets/ananda-mark.png';
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  /* ---- lucide-style icons (viewBox 0 0 24, stroke 1.7) ---- */
  const P = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I = {
    check: P('<path d="M20 6L9 17l-5-5"/>'),
    checkThin: P('<path d="M20 6L9 17l-5-5"/>'),
    chevDown: P('<path d="M6 9l6 6 6-6"/>'),
    chevRight: P('<path d="M9 6l6 6-6 6"/>'),
    chevLeft: P('<path d="M15 6l-6 6 6 6"/>'),
    mail: P('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.6 7.2l8.4 5.8 8.4-5.8"/>'),
    clock: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.4V12l3 1.8"/>'),
    users: P('<circle cx="9" cy="8" r="3.2"/><path d="M2.8 19c.7-3.1 3.2-4.8 6.2-4.8s5.5 1.7 6.2 4.8"/><path d="M16.5 5.2a3 3 0 0 1 0 5.7"/><path d="M18 14.4c1.9.6 3.3 2.1 3.7 4.3"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    shield: P('<path d="M12 3l7 2.5v5.2c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V5.5z"/>'),
    grid: P('<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>'),
    layers: P('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3.5 12L12 17l8.5-5"/>'),
    listChk: P('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L7 5"/><path d="M3.5 12l1.2 1.2L7 11"/><path d="M3.5 18l1.2 1.2L7 17"/>'),
    globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18"/>'),
    search: P('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    more: P('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    logout: P('<path d="M15 12H4"/><path d="M11 8l4 4-4 4"/><path d="M9 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9"/>'),
    sun: P('<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>'),
    moon: P('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
    arrowLeft: P('<path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>'),
    eye: P('<path d="M2.5 12s3.6-6.6 9.5-6.6S21.5 12 21.5 12 17.9 18.6 12 18.6 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.9"/>'),
    pin: P('<path d="M12 21s6.5-5.4 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.6 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
    send: P('<path d="M21.5 3.5L11 14"/><path d="M21.5 3.5l-6.7 17-3.8-7.7-7.7-3.8 18.2-5.5z"/>'),
    building: P('<path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M16 8h2a2 2 0 0 1 2 2v11"/><path d="M3 21h18"/><path d="M8.5 7h3M8.5 11h3M8.5 15h3"/>'),
    sparkle: P('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    userPlus: P('<circle cx="9" cy="8" r="3.4"/><path d="M3.2 19c.7-3.2 3.1-5 5.8-5s4.4 1 5.4 2.6"/><path d="M18 8v6M21 11h-6"/>'),
  };

  /* ---- people (avatar colors from the brand palette) ---- */
  const PEOPLE = {
    ada:    { name: 'Ada',       init: 'AD', color: '#1e3a6e', email: 'admin@ananda.test' },
    mara:   { name: 'Mara',      init: 'MA', color: '#b4452f', email: 'mara@ananda.test' },
    lila:   { name: 'Lila Devi', init: 'LD', color: '#3f7d54', email: 'lila@ananda.test' },
    lakshmi:{ name: 'Lakshmi',   init: 'LK', color: '#a23e6e', email: 'lakshmi@ananda.test' },
    arjuna: { name: 'Arjuna',    init: 'AR', color: '#2c5499', email: 'arjuna@ananda.test' },
    omar:   { name: 'Omar',      init: 'OM', color: '#7a5aa6', email: 'omar@ananda.test' },
    gita:   { name: 'Gita',      init: 'GI', color: '#c8762f', email: 'gita@ananda.test' },
    tara:   { name: 'Tara',      init: 'TA', color: '#2f7d74', email: 'tara@ananda.test' },
  };
  const av = (p, sz) => `<span class="av" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz*0.4)}px;background:${p.color}">${p.init}</span>`;

  /* ---- organizations the signed-in superuser/admin can reach ---- */
  const ORGS = [
    { id: 'la',  name: 'Ananda Los Angeles', glyph: 'LA', color: '#1e3a6e', loc: 'Los Angeles, USA', role: 'Admin' },
    { id: 'pdx', name: 'Ananda Portland',    glyph: 'PD', color: '#2f7d74', loc: 'Portland, USA',    role: 'Member' },
    { id: 'sea', name: 'Ananda Seattle',     glyph: 'SE', color: '#7a5aa6', loc: 'Seattle, USA',     role: 'Member' },
  ];
  const orgGlyph = (o, cls) => `<span class="org-glyph ${cls || ''}" style="background:${o.color}">${o.glyph}</span>`;
  const rolePill = r => `<span class="pill ${r === 'Admin' ? 'role-admin' : ''}">${r}</span>`;
  const tierPill = t => t === '—' ? `<span class="pill" style="opacity:.6">—</span>` : `<span class="pill tier">${t}</span>`;

  /* =============================================================  WEB CHROME  */
  function topbar(active, openSwitcher, superuser) {
    if (superuser === undefined) superuser = true;
    const o = ORGS.find(x => x.id === active) || ORGS[0];
    const ghost = (icon, label) => `<button class="ghost" title="${label}">${I[icon]}</button>`;
    const switcherMenu = !openSwitcher ? '' : `
      <div class="menu" style="top:calc(100% + 7px);left:0">
        <div class="m-head">Your organizations</div>
        ${ORGS.map(org => `
          <div class="o-item ${org.id === active ? 'sel' : ''}">
            ${orgGlyph(org)}
            <div class="o-body">
              <div class="o-name">${esc(org.name)} ${rolePill(org.role)}</div>
              <div class="o-sub">${esc(org.loc)}</div>
            </div>
            ${org.id === active ? `<span class="o-check">${I.check}</span>` : ''}
          </div>`).join('')}
        <div class="m-div"></div>
        ${superuser ? `<button class="m-act">${I.building} <span>Platform overview</span></button>` : ''}
        <button class="m-act muted">${I.userPlus} <span>Create a new organization</span></button>
      </div>`;
    return `<div class="topbar">
      <div class="brand">
        <img class="mark" src="${MARK}" alt="" />
        <div class="name">Ananda <b>Taskboard</b></div>
      </div>
      <button class="theme-btn" title="Toggle theme">${I.moon}</button>
      <div style="position:relative">
        <div class="orgswitch ${openSwitcher ? 'open' : ''}">
          ${orgGlyph(o)}
          <div class="org-meta">
            <span class="org-lab">Organization</span>
            <span class="org-name">${esc(o.name)}</span>
          </div>
          <span class="caret">${I.chevDown}</span>
        </div>
        ${switcherMenu}
      </div>
      <div class="spacer"></div>
      <div class="actions">
        ${ghost('shield', 'Approvals')}
        ${ghost('users', 'Team')}
        ${ghost('clock', 'History')}
        ${ghost('grid', 'Projects')}
        <span class="sep"></span>
        <button class="newtask">${I.plus}<span>New task</span></button>
        <div class="user"><span class="avatar av">AD</span><span>Admin Ada</span><span class="caret">▾</span></div>
      </div>
    </div>`;
  }

  function shellBack(active) {
    const stPill = (label, c) => `<span class="pill" style="background:color-mix(in srgb,${c} 16%,var(--surface));color:${c};border:1px solid color-mix(in srgb,${c} 26%,transparent)">${label}</span>`;
    const row = (tn, pc, pn, st, sc, dt, dcls) => `<div class="shell-row">
      <span class="tn">${tn}</span>
      <span class="pr"><span class="dot" style="background:${pc}"></span>${pn}</span>
      ${stPill(st, sc)}
      <span class="dt ${dcls || ''}">${dt}</span></div>`;
    return `<div class="tabrail">
        <span class="ptab on" style="border-color:#6b7280;background:color-mix(in srgb,#6b7280 14%,var(--surface))">🌐 Global Overview <span class="count">20</span></span>
        <span class="ptab" style="border-color:var(--border)">🪔 Karuna Devi <span class="count">8</span></span>
        <span class="ptab" style="border-color:var(--border)">🌸 Sunday Service <span class="count">7</span></span>
        <span class="ptab" style="border-color:var(--border)">⚡ Alliance Electric <span class="count">5</span></span>
      </div>
      <div class="shell-viewbar"><div class="seg-mini"><b>List</b><span>Board</span><span>Weekly</span><span>Monthly</span></div></div>
      <div class="shell-summary">
        <span class="ss"><b>20</b> Tasks</span>
        <span class="ss od"><b>2</b> Overdue</span>
        <span class="ss soon"><b>1</b> Due soon</span>
        <span class="ss"><span class="dot" style="background:#6b7280"></span><b>7</b></span>
        <span class="ss"><span class="dot" style="background:#2c64a8"></span><b>6</b></span>
        <span class="ss"><span class="dot" style="background:#3f7d54"></span><b>5</b></span>
      </div>
      <div class="shell-list">
        ${row('Confirm caterer for retreat', '#3f7d54', 'Sunday Service', 'In Progress', '#2c64a8', 'Jun 9')}
        ${row('Rewire altar lighting', '#a23e6e', 'Alliance Electric', 'Delayed', '#bb3b28', 'Jun 2', 'od')}
        ${row('Print Sunday programs', '#c8762f', 'Karuna Devi', 'To Do', '#6b7280', 'Jun 6', 'soon')}
        ${row('Order replacement candles', '#c8762f', 'Karuna Devi', 'Done', '#3f7d54', 'May 31')}
        ${row('Tune harmonium', '#3f7d54', 'Sunday Service', 'To Do', '#6b7280', 'Jun 12')}
      </div>`;
  }

  function appShell(active, opt) {
    opt = opt || {};
    return `<div class="appshell ${opt.dim ? 'dim' : ''}">
      ${topbar(active, opt.openSwitcher)}
      ${shellBack(active)}
    </div>`;
  }

  /* =============================================================  ORG SWITCHER  */
  function webOrgSwitcher(superuser) {
    return `<div class="webframe"><div class="appshell">
      ${topbar('la', true, superuser)}
      ${shellBack('la')}
    </div></div>`;
  }

  /* =============================================================  PLATFORM OVERVIEW  */
  // Each org: stats (projects/sub-projects/tasks/members) + admin contacts +
  // member roster (Member · Email · Role · Tier). METADATA ONLY — never task contents.
  const PLATFORM_ORGS = [
    { o: ORGS[0], stats: [6, 14, 128, 22], admins: ['ada', 'mara'],
      roster: [['ada', 'Admin', '—'], ['mara', 'Member', 'Lead'], ['lila', 'Member', 'Coordinator'], ['arjuna', 'Member', 'Volunteer']] },
    { o: ORGS[1], stats: [3, 7, 54, 11], admins: ['omar'],
      roster: [['omar', 'Admin', '—'], ['gita', 'Member', 'Coordinator'], ['tara', 'Member', 'Volunteer']] },
    { o: { id: 'atx', name: 'Ananda Austin', glyph: 'AU', color: '#a9824e', loc: 'Austin, USA', role: '—' }, pending: true,
      stats: [0, 0, 0, 1], admins: ['lakshmi'], roster: [['lakshmi', 'Admin', '—']] },
  ];

  function orgCard(po, open) {
    const o = po.o;
    const labs = ['Projects', 'Sub-projects', 'Tasks', 'Members'];
    const stats = po.stats.map((n, i) => `<div class="s"><span class="n">${n}</span><span class="l">${labs[i]}</span></div>`).join('');
    const admins = po.admins.map(id => `<span class="who">${av(PEOPLE[id], 18)} ${esc(PEOPLE[id].name)}</span>`).join('');
    const rows = po.roster.map(([id, role, tier]) => `
      <tr>
        <td><span class="nm">${av(PEOPLE[id], 24)} ${esc(PEOPLE[id].name)}</span></td>
        <td class="email">${PEOPLE[id].email}</td>
        <td>${rolePill(role)}</td>
        <td>${tierPill(tier)}</td>
      </tr>`).join('');
    return `<div class="org-card ${po.pending ? 'pending' : ''}">
      <div class="oc-head">
        ${orgGlyph(o, 'oc-glyph')}
        <div class="oc-tt">
          <div class="oc-name">${esc(o.name)} ${po.pending ? `<span class="tag-pending">Pending verification</span>` : ''}</div>
          <div class="oc-loc">${I.pin} ${esc(o.loc)}</div>
        </div>
      </div>
      <div class="oc-stats">${stats}</div>
      <div class="oc-roster ${open ? 'open' : ''}">
        <div class="oc-actions">
          <div class="oc-admins-inline"><span class="lbl">Admins</span>${admins}</div>
          <button class="oc-roster-toggle"><span class="cap">Member roster <span class="meta-note">${I.shield} Metadata only</span></span><span class="chev">${I.chevRight}</span></button>
        </div>
        ${open ? `<div class="oc-roster-body">
          <table class="tbl"><thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Tier</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>` : ''}
      </div>
    </div>`;
  }

  function webPlatform() {
    const totalOrgs = PLATFORM_ORGS.length;
    const sum = i => PLATFORM_ORGS.reduce((a, p) => a + p.stats[i], 0);
    return `<div class="webframe">
      ${appShell('la', { dim: true })}
      <div class="modal-backdrop">
        <div class="modal" style="max-width:760px">
          <div class="modal-head">
            <div>
              <h2>Platform overview</h2>
              <div class="sub">Every organization on Ananda Taskboard · superuser only</div>
            </div>
            <button class="x">${I.x}</button>
          </div>
          <div class="modal-body">
            <div class="po-summary">
              <div class="po-stat"><span class="n">${totalOrgs}</span><span class="l">Organizations</span></div>
              <span class="dot" style="background:var(--border-strong)"></span>
              <div class="po-stat"><span class="n">${sum(0)}</span><span class="l">Projects</span></div>
              <div class="po-stat"><span class="n">${sum(2)}</span><span class="l">Tasks</span></div>
              <div class="po-stat"><span class="n">${sum(3)}</span><span class="l">Members</span></div>
            </div>
            ${PLATFORM_ORGS.map((po, i) => orgCard(po, i === 0)).join('')}
          </div>
        </div>
      </div>
    </div>`;
  }

  /* =============================================================  TEAM → INVITE SECTION  */
  const PENDING = [
    { email: 'ravi@ananda.test',   role: 'Member', tier: 'Volunteer',   sent: 'sent 2 days ago' },
    { email: 'priya@ananda.test',  role: 'Member', tier: 'Coordinator', sent: 'sent 5 days ago' },
    { email: 'daniel@ananda.test', role: 'Admin',  tier: '—',           sent: 'sent yesterday' },
  ];

  function webInvite() {
    const pending = PENDING.map(p => `
      <div class="pi-row">
        <span class="pi-email"><span class="ic">${I.mail}</span><span class="addr">${p.email}</span><span class="sent">${p.sent}</span></span>
        ${rolePill(p.role)}
        ${tierPill(p.tier)}
        <button class="revoke">Revoke</button>
      </div>`).join('');
    return `<div class="webframe">
      ${appShell('la', { dim: true })}
      <div class="modal-backdrop">
        <div class="modal" style="max-width:680px">
          <div class="modal-head">
            <div><h2>Team &amp; Permissions</h2><div class="sub">Invite people, then set their role, tier &amp; access</div></div>
            <button class="x">${I.x}</button>
          </div>
          <div class="modal-body">
            <div class="sec-label">Invite someone</div>
            <div class="card invite-card" style="margin-bottom:18px">
              <div class="ic-grid">
                <div class="field" style="margin:0"><label>Email</label><input type="email" placeholder="name@ananda.test" /></div>
                <div class="field" style="margin:0"><label>Role</label><select><option>Member</option><option>Admin</option></select></div>
              </div>
              <div class="field" style="margin:14px 0 0"><label>Tier <span style="color:var(--faint);font-weight:500;text-transform:none;letter-spacing:0">— what they can see</span></label>
                <select>
                  <option>Volunteer — sees only assigned tasks</option>
                  <option selected>Coordinator — sees all tasks in their sub-project</option>
                  <option>Lead — sees all tasks in their project</option>
                </select>
              </div>
              <div class="ic-foot">
                <button class="btn btn-primary">${I.send} Send invitation</button>
                <span class="success-line" style="margin:0">${I.check} Invitation sent to ravi@ananda.test</span>
              </div>
              <div class="hint" style="margin-top:10px">Tier sets a member's visibility scope. <b>Disabled for Admins</b> — they see everything.</div>
            </div>

            <div class="sec-label">Pending invitations <span class="pending-dot" style="margin-left:4px"></span></div>
            <div class="card pending-list" style="margin-bottom:18px">${pending}</div>

            <div class="sec-label">Add member directly</div>
            <div class="card sunk" style="padding:13px 15px;margin-bottom:18px">
              <div class="note" style="margin:0">Already have someone's details? Add them with a temporary password and share it directly — no email round-trip.</div>
            </div>

            <div class="sec-label">Members <span style="color:var(--faint);font-weight:600">· 9 people</span></div>
            <table class="tbl"><thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Tier</th></tr></thead>
              <tbody>
                <tr><td><span class="nm">${av(PEOPLE.ada, 24)} Ada</span></td><td class="email">${PEOPLE.ada.email}</td><td>${rolePill('Admin')}</td><td>${tierPill('—')}</td></tr>
                <tr><td><span class="nm">${av(PEOPLE.mara, 24)} Mara</span></td><td class="email">${PEOPLE.mara.email}</td><td>${rolePill('Member')}</td><td>${tierPill('Lead')}</td></tr>
                <tr><td><span class="nm">${av(PEOPLE.lila, 24)} Lila Devi</span></td><td class="email">${PEOPLE.lila.email}</td><td>${rolePill('Member')}</td><td>${tierPill('Coordinator')}</td></tr>
              </tbody></table>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* =============================================================  ACCEPT INVITATION (auth card)  */
  const INV_ORG = ORGS[0];
  const invBanner = (role, email) => `<div class="inv-banner">
      ${orgGlyph(INV_ORG)}
      <div class="ib-body">
        <div class="ib-org">${esc(INV_ORG.name)}</div>
        <div class="ib-meta">${rolePill(role)} <span>${email}</span></div>
      </div>
    </div>`;
  const brandRow = `<div class="brandrow"><img class="mark" src="${MARK}" alt="" /><div class="brandcol"><span class="nm">Ananda <b>Taskboard</b></span><span class="bytag">brought to you by Ananda Los Angeles</span></div></div>`;
  const peek = `<button class="peek" tabindex="-1" aria-label="Show password">${I.eye}</button>`;

  const ACCEPT = {
    existing: () => brandRow
      + `<h1>Join ${esc(INV_ORG.name)}</h1>`
      + `<p class="lede">You've been invited to join this team's taskboard.</p>`
      + invBanner('Coordinator', 'lila@ananda.test')
      + `<button class="btn-auth">Join ${esc(INV_ORG.name)}</button>`
      + `<div class="callout">Signed in as <b>lila@ananda.test</b>. Joining adds this org to your account — you can switch any time.</div>`,

    newperson: () => brandRow
      + `<h1>Join ${esc(INV_ORG.name)}</h1>`
      + `<p class="lede">Set up your account to accept the invitation.</p>`
      + invBanner('Coordinator', 'lila@ananda.test')
      + `<div class="afield"><label>Your name</label><input type="text" placeholder="Lila Devi" /></div>`
      + `<div class="afield"><label>Password</label><div class="inwrap"><input type="password" placeholder="••••••••" />${peek}</div><div class="hint">Use at least 8 characters.</div></div>`
      + `<div class="afield"><label>Confirm password</label><div class="inwrap"><input type="password" placeholder="••••••••" />${peek}</div></div>`
      + `<button class="btn-auth">Join ${esc(INV_ORG.name)}</button>`,

    welcome: () => brandRow
      + `<div class="glyphbadge ok">${I.check}</div>`
      + `<h1>Welcome to ${esc(INV_ORG.name)}</h1>`
      + `<p class="lede">You're in. Sign in to start working with your team.</p>`
      + `<button class="btn-auth">Go to taskboard</button>`,

    invalid: () => brandRow
      + `<div class="glyphbadge warn">${I.clock}</div>`
      + `<h1>Invitation not valid</h1>`
      + `<p class="lede">This invitation link has expired or already been used. Ask your team admin to send a new one.</p>`
      + `<div class="linkline"><button class="linkbtn">${I.arrowLeft} Back to sign in</button></div>`,
  };
  const acceptStates = Object.keys(ACCEPT);

  function webAccept(state) {
    return `<div class="webframe authwrap"><div class="authcard">${ACCEPT[state]()}</div>
      <div class="footnote">Internal team taskboard</div></div>`;
  }

  /* =============================================================  PHONE CHROME  */
  const STATUS = `<div class="statusbar"><span class="mono">9:41</span><span class="sb-r">`
    + `<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="4" width="3" height="8" rx="1"/><rect x="10" y="1.5" width="3" height="10.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1" opacity=".35"/></svg>`
    + `<svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2C5.5 2 2.8 3.2 1 5l1.6 1.6C4 5.2 6.1 4.3 8.5 4.3s4.5.9 5.9 2.3L16 5C14.2 3.2 11.5 2 8.5 2z"/><path d="M8.5 7.2c-1.3 0-2.5.5-3.4 1.4L8.5 12l3.4-3.4C11 7.7 9.8 7.2 8.5 7.2z"/></svg>`
    + `<svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke="currentColor" stroke-opacity=".4"/><rect x="3" y="3" width="16" height="7" rx="1.5" fill="currentColor"/><rect x="23.5" y="4.5" width="2" height="4" rx="1" fill="currentColor" fill-opacity=".4"/></svg>`
    + `</span></div>`;

  const phone = (inner, theme) => `<div class="phone"${theme ? ` data-theme="${theme}"` : ''}>${STATUS}<div class="pbody">${inner}</div><div class="homebar"></div></div>`;

  function mAppbar(active) {
    const o = ORGS.find(x => x.id === active) || ORGS[0];
    return `<div class="m-appbar">
      ${orgGlyph(o)}
      <div class="ab-tt">
        <div class="ab-org">${esc(o.name)} <span class="caret">${I.chevDown}</span></div>
        <div class="ab-sub">Ananda Taskboard</div>
      </div>
      <button class="ic" aria-label="Search">${I.search}</button>
      <button class="ic primary" aria-label="New task">${I.plus}</button>
      <button class="ic" aria-label="More">${I.more}</button>
    </div>`;
  }
  function mShellBody() {
    return `<div class="m-scroll" style="gap:9px;display:flex;flex-direction:column">
      ${'<div style="height:64px;border-radius:11px;background:var(--surface);border:1px solid var(--border);opacity:.7"></div>'.repeat(5)}
    </div>`;
  }

  /* ---- mobile org switcher: appbar shows active org; tap → bottom sheet ---- */
  function phoneOrgSwitcher(superuser) {
    if (superuser === undefined) superuser = true;
    const rows = ORGS.map(o => `
      <div class="m-orgrow ${o.id === 'la' ? 'sel' : ''}">
        ${orgGlyph(o)}
        <div class="ob"><div class="on">${esc(o.name)} ${rolePill(o.role)}</div><div class="os">${esc(o.loc)}</div></div>
        ${o.id === 'la' ? `<span class="o-check">${I.check}</span>` : ''}
      </div>`).join('');
    const su = !superuser ? '' : `
          <div class="m-div" style="height:1px;background:var(--border);margin:8px 6px"></div>
          <button class="m-act" style="display:flex;align-items:center;gap:10px;padding:11px 10px;border-radius:9px;color:var(--dome);font-weight:600;width:100%;text-align:left">${I.building}<span>Platform overview</span></button>`;
    const sheet = `
      <div class="m-sheet-scrim"></div>
      <div class="m-sheet">
        <div class="grab"><i></i></div>
        <div class="sh-head"><h2>Switch organization</h2><button class="x">${I.x}</button></div>
        <div class="sh-body">
          ${rows}${su}
        </div>
      </div>`;
    return phone(`${mAppbar('la')}${mShellBody()}${sheet}`);
  }

  /* ---- mobile platform overview: list of orgs that expand to roster ---- */
  function phonePlatform() {
    const memberCard = (id, role, tier) => `
      <div class="m-stack" style="padding:11px 12px;margin-bottom:9px">
        <div class="lv" style="border:none;padding:0 0 7px"><span style="display:flex;align-items:center;gap:8px;font-weight:600">${av(PEOPLE[id], 26)} ${esc(PEOPLE[id].name)}</span></div>
        <div class="lv"><span class="k">Email</span><span class="v" style="font-family:var(--f-mono);font-size:11.5px;color:var(--muted)">${PEOPLE[id].email}</span></div>
        <div class="lv"><span class="k">Role</span><span class="v">${rolePill(role)}</span></div>
        <div class="lv"><span class="k">Tier</span><span class="v">${tierPill(tier)}</span></div>
      </div>`;
    const item = (po, open) => {
      const o = po.o;
      const labs = ['Projects', 'Sub-projects', 'Tasks', 'Members'];
      const statbar = `<div class="m-acc-statbar">${po.stats.map((n, i) => `<span class="st"><b>${n}</b><span>${labs[i].toLowerCase()}</span></span>`).join('<span class="sep">·</span>')}</div>`;
      const admins = po.admins.map(a => `<span style="display:inline-flex;align-items:center;gap:6px;font-weight:600">${av(PEOPLE[a], 20)} ${esc(PEOPLE[a].name)}</span>`).join('');
      const body = !open ? '' : `<div class="m-acc-body">
        <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-bottom:12px"><span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--faint)">Admins</span>${admins}</div>
        <div class="rl-cap" style="font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin:0 0 8px;display:flex;align-items:center;gap:7px">Member roster <span class="meta-note">${I.shield} Metadata only</span></div>
        ${po.roster.map(r => memberCard(r[0], r[1], r[2])).join('')}
      </div>`;
      return `<div class="m-acc ${open ? 'open' : ''}">
        <button class="m-acc-head">
          ${orgGlyph(o)}
          <div class="ob">
            <div class="on">${esc(o.name)}${po.pending ? `<span class="tag-pending">Pending</span>` : ''}</div>
            <div class="os">${I.pin}${esc(o.loc)}</div>
          </div>
          <span class="chev">${I.chevRight}</span>
        </button>
        ${statbar}
        ${body}
      </div>`;
    };
    const body = `
      <div class="m-fs-head"><button class="x">${I.x}</button><span class="ttl">Platform overview</span></div>
      <div class="m-scroll">
        <div class="note" style="margin-bottom:14px">${PLATFORM_ORGS.length} organizations · superuser only. Tap an org to expand its roster. <b>Metadata only</b> — never task contents.</div>
        ${PLATFORM_ORGS.map((po, i) => item(po, i === 0)).join('')}
      </div>`;
    return phone(body);
  }

  /* ---- mobile invite section ---- */
  function phoneInvite() {
    const pending = PENDING.map(p => `
      <div class="m-pi">
        <div class="top"><span class="em"><span style="color:var(--faint);display:grid;place-items:center;width:20px">${I.mail}</span><span class="addr">${p.email}</span></span><button class="revoke">Revoke</button></div>
        <div class="bottom">${rolePill(p.role)} ${tierPill(p.tier)} <span style="font-size:10.5px;color:var(--faint);margin-left:auto">${p.sent}</span></div>
      </div>`).join('');
    const body = `
      <div class="m-fs-head"><button class="x">${I.arrowLeft}</button><span class="ttl">Invite to team</span></div>
      <div class="m-scroll">
        <div class="sec-label" style="margin-top:0">Invite someone</div>
        <div class="field"><label>Email</label><input type="email" placeholder="name@ananda.test" /></div>
        <div class="field"><label>Role</label><select><option>Member</option><option>Admin</option></select></div>
        <div class="field"><label>Tier <span style="color:var(--faint);font-weight:500;text-transform:none;letter-spacing:0">— what they can see</span></label><select><option>Volunteer — sees only assigned tasks</option><option selected>Coordinator — sees all tasks in their sub-project</option><option>Lead — sees all tasks in their project</option></select><div class="hint">Disabled for Admins — they see everything.</div></div>
        <button class="btn-full btn-primary" style="border-radius:var(--r-ctl);display:inline-flex;align-items:center;justify-content:center;gap:7px;color:var(--primary-ink)">${I.send} Send invitation</button>
        <div class="success-line" style="margin-top:11px">${I.check} Invitation sent to ravi@ananda.test</div>
        <div class="sec-label">Pending invitations</div>
        ${pending}
      </div>`;
    return phone(body);
  }

  /* ---- mobile accept invitation ---- */
  function phoneAccept(state) {
    return phone(`<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:18px 18px 30px;overflow-y:auto"><div class="authcard">${ACCEPT[state]()}</div></div>`);
  }

  window.MT = {
    acceptStates,
    webOrgSwitcher, webPlatform, webInvite, webAccept,
    phoneOrgSwitcher, phonePlatform, phoneInvite, phoneAccept,
  };
})();
