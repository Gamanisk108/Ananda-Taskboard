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
    const navItem = (icon, label, key) => `<button class="sn ${key === 'helpus' ? '' : ''} ${opt.active === key ? 'on' : ''}">${I[icon]}<span>${label}</span>${key === 'helpus' ? '<span class="nd"></span>' : ''}</button>`;
    const nav = `<div class="set-nav">
      ${navItem('user', 'Account', 'account')}
      ${navItem('bell', 'Notifications', 'notif')}
      ${navItem('listChk', 'Task statuses', 'statuses')}
      ${navItem('calendar', 'Calendar &amp; holidays', 'calendar')}
      ${navItem('heart', 'Help Us', 'helpus')}
    </div>`;
    return `<div class="modal" style="max-width:760px">
      ${B.modalHead('Settings', 'Manage your account, the board, and ways to help')}
      <div class="modal-body" style="padding:0"><div class="set-shell">${nav}<div class="set-pane">${pane}</div></div></div>
    </div>`;
  }
  const HU_LOTUS = I.lotus.replace('width="16" height="16"', 'width="30" height="30"').replace('class="lotus"', '');
  function huCard(c) {
    return `<div class="hu-card ${c.soon ? 'soon' : ''}">
      <div class="hu-ic">${I[c.icon]}</div>
      <div class="hu-tx">
        <div class="hu-t">${esc(c.t)}${c.soon ? '<span class="hu-chip">Coming soon</span>' : ''}</div>
        <div class="hu-b">${c.b}</div>
        ${c.meta ? `<div class="hu-meta">${c.meta}</div>` : ''}
      </div>
      <div class="hu-cta">${c.soon
        ? `<button class="btn btn-secondary" disabled>${esc(c.cta)}</button>`
        : `<button class="btn btn-primary">${esc(c.cta)} ${I.chevRight}</button>`}</div>
    </div>`;
  }
  function huPane(variant, qpos) {
    qpos = qpos || 'between';
    const cards = [{
      icon: 'languages', t: 'Improve translations',
      b: 'Suggest clearer wording in your language — the community picks the best. Do as many or as few as you like.',
      meta: `<span class="mono">12</span>&nbsp;languages&nbsp;·&nbsp;<span class="mono">240</span>&nbsp;phrases`, cta: 'Start translating',
    }];
    if (variant === 'multi') {
      cards.push(
        { icon: 'alert', t: 'Report a problem', b: 'Spotted something broken or confusing? Tell us where it happened and we\u2019ll take a look.', cta: 'Report' },
        { icon: 'sparkle', t: 'Suggest a feature', b: 'Have an idea that would make the board better for your community? We read every one.', cta: 'Suggest' },
        { icon: 'share', t: 'Spread the word', b: 'Invite another Ananda center or seva team to keep their work here too.', cta: 'Invite' },
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
  function webHelpUs(variant, qpos) {
    return B.webframe(`${B.appShell({ dim: true })}
      <div class="modal-backdrop">${settingsModal(huPane(variant, qpos), { active: 'helpus' })}</div>`);
  }

  /* =============================================================  (b) IMPROVE TRANSLATIONS  */
  // categories — untranslated-first; count = untranslated remaining (mono)
  const CATS = [
    { key: 'tasks', name: 'Tasks & list', untr: 6 },
    { key: 'cal', name: 'Calendar', untr: 4 },
    { key: 'status', name: 'Status & board', untr: 0 },
    { key: 'team', name: 'Team & access', untr: 9 },
    { key: 'proj', name: 'Projects & trash', untr: 3 },
    { key: 'io', name: 'Import / Export', untr: 5 },
    { key: 'nav', name: 'Settings & navigation', untr: 2 },
    { key: 'account', name: 'Account & sign-in', untr: 1 },
    { key: 'other', name: 'Other & admin', untr: 12 },
  ];
  // sample strings for the open "Tasks & list" section (untranslated first)
  function strRow(r, st) {
    const untr = !r.cur && !r.draft;
    const cls = ['tr-row', untr ? 'untranslated' : '', (r.saved && !r.resave) ? 'saved' : '', r.error ? 'error' : '', r.simopen ? 'simopen' : ''].filter(Boolean).join(' ');
    const similar = r.sim ? (r.simopen
      ? `<div class="tr-variants"><div class="tv-h">Also covers these near-identical phrases</div>${r.sim.map(v => `<div class="v"><code>${esc(v)}</code></div>`).join('')}</div>`
      : `<div class="tr-similar"><button class="tr-simbtn">${I.copy}+${r.sim.length} similar</button></div>`) : '';
    let action;
    if (r.error) {
      action = `<div class="tr-err"><span class="msg">${I.alert} Couldn\u2019t save — check your connection.</span><button class="btn btn-secondary">${I.rotate} Retry</button></div>`;
    } else {
      // saved rows stay fully editable — a member can revise and re-save anytime (re-edit)
      const prev = r.resave && r.prev ? `<div class="tr-prev">Previously saved “${esc(r.prev)}” — editing</div>` : '';
      let btn;
      if (r.resave) btn = `<button class="btn btn-primary tr-save">${I.check} Update</button>`;
      else if (r.saved) btn = `<span class="tr-savedwrap"><span class="tr-saved">${I.check} Saved</span><button class="btn btn-ghost tr-edit">${I.pen} Edit</button></span>`;
      else btn = `<button class="btn btn-primary tr-save"${r.draft ? '' : ' disabled'}>${I.check} Save</button>`;
      // textarea + button share ONE row so they're flush top AND bottom (D39); label above, hint below
      action = `<div class="tr-inwrap"><div class="tr-field"><div class="tr-lbl">${st ? esc(st.native) : 'Your suggestion'}</div><div class="tr-inputrow"><textarea class="tr-in" rows="1" placeholder="Type a clearer translation…">${r.draft ? esc(r.draft) : ''}</textarea>${btn}</div>${prev}</div></div>`;
    }
    return `<div class="${cls}">
      <div class="tr-en"><div class="tr-lbl">English source${r.cat ? ` <span class="tr-catref">${esc(r.cat)}</span>` : ''}</div><div class="tr-val">${esc(r.en)}</div>${similar}</div>
      <div class="tr-cur"><div class="tr-lbl">Current</div><div class="tr-val ${r.cur ? '' : 'none'}">${r.cur ? esc(r.cur) : '— untranslated'}</div></div>
      ${action}
    </div>`;
  }
  // search field (jump to any phrase across all categories) — the app's search vocabulary
  const searchBar = q => `<div class="help-search tr-search">${I.search}<input ${q ? `value="${esc(q)}"` : 'placeholder="Search phrases…"'} />${q ? `<button class="tr-search-x" title="Clear">${I.x}</button>` : ''}</div>`;
  // section accordion (reuses .help-sec); count badge = untranslated remaining
  function catSection(c, openKey, rowsHtml) {
    const open = c.key === openKey;
    const badge = c.untr === 0
      ? `<span class="count zero mono">${I.check}</span>`
      : `<span class="count untr mono">${c.untr}</span>`;
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
    const prog = state === 'done' ? { d: 240, t: 240 } : { d: 12, t: 240 };
    const pct = Math.round(prog.d / prog.t * 100);
    const bar = `<div class="tr-bar">
        <div class="tr-lang"><span class="lbl">Translating into</span>${langPicker(lang, langOpen)}</div>
        <div class="tr-prog"><span>Progress</span><span class="ptrack"><i style="width:${pct}%"></i></span><b>${prog.d}</b>&nbsp;of&nbsp;<b>${prog.t}</b></div>
      </div>
      <div class="tr-srcnote">${I.info} English is the source language — pick any target above. No need to finish; every phrase helps.</div>`;

    if (state === 'loading') {
      const sk = n => `<div class="tr-sk"><div class="ln s"></div><div class="ln l"></div><div class="ln m"></div></div>`;
      return bar + CATS.slice(0, 1).map(c => catSection(c, c.key, sk() + sk() + sk())).join('') + CATS.slice(1, 5).map(c => catSection(c, null)).join('');
    }
    if (state === 'done') {
      return bar + `<div class="tr-done">
        <span class="hh-ic">${B.I.heartHands.replace('width="16" height="16"', 'width="54" height="54"')}</span>
        <h3>You\u2019ve translated everything here</h3>
        <p>Thank you for helping the whole community read the board in their language. We\u2019ll let you know when there are new phrases to translate.</p>
        ${B.quote('The happiness of one’s own heart alone cannot satisfy the soul; one must try to include, as necessary to one’s own happiness, the happiness of others.', 'Paramhansa Yogananda')}
      </div>`;
    }
    if (state === 'search') {
      const q = 'done';
      const groups = [
        { name: 'Tasks & list', rows: [
          { en: 'Mark as done', cur: '', draft: 'Marcar como hecho' },
          { en: 'Mark all subtasks done', cur: '' },
        ] },
        { name: 'Status & board', rows: [
          { en: 'Move task to the “Done” column', cur: 'Mover a «Hecho»' },
          { en: 'Done', cur: 'Hecho' },
        ] },
        { name: 'Calendar', rows: [
          { en: 'All tasks done for today', cur: '' },
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
    // rows for the open "Tasks & list" section
    const rows = state === 'cjk'
      ? [
        { en: 'Move this task to the “Review” column so a second pair of eyes can check it before it’s marked done', cur: '', draft: '将此任务移动到"审核"栏，以便在标记为完成之前由另一人复核' },
        { en: 'Add a deadline', cur: '' },
        { en: 'Due soon', cur: '快到期' },
      ]
      : state === 'indic'
        ? [
          { en: 'No tasks match these filters', cur: '', draft: 'इन फ़िल्टरों से कोई कार्य मेल नहीं खाता' },
          { en: 'Clear all filters', cur: 'सभी फ़िल्टर हटाएँ' },
        ]
        : [
          { en: 'No tasks match these filters', cur: '' },
          { en: 'Mark as done', cur: '', draft: state === 'saved' ? 'Marcar como hecho' : state === 'resave' ? 'Marcar como completado' : '', saved: state === 'saved', resave: state === 'resave', prev: 'Marcar como hecho' },
          { en: 'Add link', cur: '', sim: ['Add a link', 'Add link…'], simopen: state === 'similar', draft: 'Añadir enlace' },
          { en: 'Assign to me', cur: '', error: state === 'error', draft: 'Asignármelo a mí' },
          { en: 'Due soon', cur: 'Pronto' },
          { en: 'Overdue', cur: 'Atrasado' },
        ];
    const st = state === 'cjk' ? { native: '中文 (your suggestion)' } : state === 'indic' ? { native: 'हिन्दी (your suggestion)' } : ES;
    const rowsHtml = rows.map(r => strRow(r, st)).join('');
    const openCat = state === 'cjk' || state === 'indic' ? { key: 'tasks', name: 'Tasks & list', untr: rows.filter(r => !r.cur).length } : CATS[0];
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
      const cls = ['poll-bar', v.live ? 'live' : '', (lead && !v.live) ? 'lead' : ''].filter(Boolean).join(' ');
      return `<button class="${cls}">
        <span class="pb-txt"><span class="tick">${I.check}</span>${esc(v.txt)}</span>
        <span class="pb-track"><span class="pb-fill" style="width:${Math.max(8, Math.round(v.n / maxN * 100))}%"></span></span>
        <span class="pb-approve">${v.live ? '' : `${I.check} Make live`}</span>
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
        <div class="pt-tx"><div class="poll-key">key · ${esc(d.key)}</div><div class="poll-en">${esc(d.en)}</div>${liveNow}</div>
        <div class="pt-n"><b>${total}</b>${total === 1 ? 'reply' : 'replies'}</div>
      </div>
      <div class="poll-bars">${bars}</div>
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
      return bar + `<div class="rv-empty"><div class="ei">${I.inbox}</div><h3>Nothing waiting for review</h3><p>When members suggest wording in this language, their suggestions will appear here as a poll for you to approve.</p></div>`;
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
      variants: [
        { txt: 'Borrar filtros', n: 8, people: ['lila', 'gita'], live: true },
        { txt: 'Quitar todos los filtros', n: 12, people: ['arjuna', 'omar', 'priya'] },
        { txt: 'Limpiar filtros', n: 5, people: ['mara', 'diego'] },
      ],
    }));
    cards.push(pollCard({
      key: 'btn.dueSoon', en: 'Due soon',
      variants: [{ txt: 'Pronto', n: 7, people: ['lila'] }, { txt: 'Vence pronto', n: 6, people: ['omar'] }],
    }));
    return bar + cards.join('');
  }
  function webReview(state) {
    if (state === 'confirm') {
      return B.webframe(`${B.appShell({ dim: true })}
        <div class="modal-backdrop" style="align-items:center"><div class="confirm-card">
          <div class="cf-ic">${I.globe}</div>
          <h3>Make this the live wording?</h3>
          <p>This replaces the current wording for <b>everyone using Español</b> right away — no redeploy. You can change the winner or clear it later.</p>
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
      ${row('calendar', 'Calendar & holidays')}
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

  window.TR = { webHelpUs, webContribute, webReview, phoneSettingsList, phoneHelpUs, phoneContribute, phoneReview };
})();
