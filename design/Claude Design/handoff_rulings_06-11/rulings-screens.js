/* =============================================================
   Rulings 2026-06-11 — variant builders (window.R) · RULED state.
   Every screen is the REAL mobile-module output (window.M) with a
   surgical DOM transform on top — fidelity is inherited, never
   re-drawn (RULE #0).
   Q1 ruled: sticky footer (Delete · Cancel · Save) + Share as a
   ghost icon in the fs-head. Q2 ruled: A + C combo.
   ============================================================= */
(function () {
  const M = window.M;
  const T = (html, fn) => { const d = document.createElement('div'); d.innerHTML = html; fn(d); return d.innerHTML; };

  const SHARE_ICON = `<button class="rul-share" aria-label="Share">${M.svg('share')}</button>`;
  const CHEV = `<span class="chev">${M.svg('chevR')}</span>`;

  /* ============================================================
     Q1 · RULED (D49) — sticky footer, Share moves into the head
     ============================================================ */

  /* Edit view: fs-head = back · title · pen · #id · share ICON (where Save
     was) — footer = Delete (left, red) · Cancel · Save. Body Delete gone. */
  function q1Final() {
    return T(M.taskDetail(), d => {
      d.querySelector('.fs-head .save').outerHTML = SHARE_ICON;
      const body = d.querySelector('.body');
      const btns = body.querySelectorAll(':scope > button');
      btns[btns.length - 1].remove(); /* the body-bottom Delete */
      body.insertAdjacentHTML('afterend',
        `<div class="rul-foot">
          <button class="rf-del">Delete</button>
          <span class="sp"></span>
          <button class="rf-sec">Cancel</button>
          <button class="rf-pri">Save</button>
        </div>`);
    });
  }

  /* Create view shares the same footer (the one-footer premise of the
     ruling): Cancel · Create task (D27). No Delete, no Share (nothing to
     share yet). The mock's body-end Create button goes away. */
  function q1FinalNew() {
    return T(M.newTask(), d => {
      const body = d.querySelector('.body');
      const btns = body.querySelectorAll(':scope > button');
      btns[btns.length - 1].remove(); /* the body-end "Create task" */
      body.insertAdjacentHTML('afterend',
        `<div class="rul-foot">
          <span class="sp"></span>
          <button class="rf-sec">Cancel</button>
          <button class="rf-pri">Create task</button>
        </div>`);
    });
  }

  /* ============================================================
     Q2 · RULED (D50) — A (in place) + C (menu → pending list)
     + D51 — statuses restored to the responsive List (right column)
     ============================================================ */

  /* D51 · every compact row gets its STATUS PILL back — right-aligned
     column: pill on top, avatars beneath. The chevron is dropped to pay
     for the width (rows stay tappable end-to-end). */
  const BY_NAME = {}; M.TASKS.forEach(t => { BY_NAME[t.name] = t; });
  function enhanceRows(d) {
    [...d.querySelectorAll('.trow')].forEach(row => {
      if (row.classList.contains('pending')) return; /* gets the pending pill instead */
      const t = BY_NAME[(row.querySelector('.nm') || {}).textContent?.trim()];
      if (!t) return;
      const av = row.querySelector('.avstack');
      const chev = row.querySelector('.chev'); if (chev) chev.remove();
      const right = document.createElement('div'); right.className = 'rcol';
      right.innerHTML = M.statusPill(M.STATUS[t.status]) + (av ? av.outerHTML : '');
      if (av) av.remove();
      row.appendChild(right);
    });
  }

  /* the base fix on its own — the selected compact List, statuses visible */
  function listStatuses() {
    return T(M.listCompact(), enhanceRows);
  }

  /* Mara's submitted-and-pending NEW task — mirrors the approvals sample. */
  const PENDING_T = { id: 21, name: 'Print A2 banner', sub: 'km', who: ['mara'], status: 'todo', due: '2026-06-18', priority: 'Highest' };

  /* pending row: gold rail + tint; the "Pending approval" pill takes the
     STATUS slot in the right column (so the date stays on line 2). */
  function pendingRow() {
    return T(M.compactRow(PENDING_T), d => {
      const r = d.querySelector('.trow');
      r.classList.add('pending');
      r.style.setProperty('--sc', 'var(--gold)');
      const av = r.querySelector('.avstack');
      const chev = r.querySelector('.chev'); if (chev) chev.remove();
      const right = document.createElement('div'); right.className = 'rcol';
      right.innerHTML = '<span class="pend-pill">Pending approval</span>' + (av ? av.outerHTML : '');
      if (av) av.remove();
      r.appendChild(right);
    });
  }

  /* A · board: the NEW task sits in place (Jun 18 → Later) with the gold
     rail + pill; "Design spring flyer" (her pending EDIT) keeps its last
     approved values + a small "Edit pending" pill after the date. */
  function q2PhoneInPlace() {
    return T(M.listCompact(), d => {
      const later = [...d.querySelectorAll('.daydiv')].find(x => x.textContent.trim() === 'Later');
      const flyer = later.parentElement.nextElementSibling; /* id 1 · Design spring flyer */
      flyer.insertAdjacentHTML('afterend', pendingRow());
      enhanceRows(d); /* D51 — statuses on every row */
      /* the pending EDIT marker stacks under the status pill in the right
         column (keeps line 2 to one line at 390px) */
      flyer.querySelector('.rcol .status-pill')
        .insertAdjacentHTML('afterend', '<span class="pend-pill">Edit pending</span>');
    });
  }

  /* C · the ⋯ overflow (member): "Pending approval · 2" sits where
     Approvals sits for admins; admin-only items removed; account = Mara. */
  function q2PhoneMenu() {
    return T(M.overflowScreen(), d => {
      enhanceRows(d); /* D51 on the list behind the overlay */
      const items = [...d.querySelectorAll('.ofmenu .ofitem')];
      const byText = t => items.find(i => i.textContent.trim().startsWith(t));
      const appr = byText('Approvals');
      appr.insertAdjacentHTML('beforebegin',
        `<a class="ofitem">${M.svg('approvals')}<span>Pending approval</span><span class="badge">2</span></a>`);
      appr.remove();
      const trash = byText('Trash'); if (trash) trash.remove();
      /* account row → Mara */
      const acct = d.querySelector('.ofmenu .ofitem[style*="cursor:default"]');
      const av = acct.querySelector('.av');
      av.textContent = 'MA'; av.style.background = M.PEOPLE.mara.color;
      const lines = acct.querySelectorAll('div div');
      lines[0].textContent = 'Mara'; lines[1].textContent = 'mara@ananda.org';
    });
  }

  /* C · destination: "Waiting for approval" full-screen route — the rows
     ARE the List compact row (ruled 06-11: match the List exactly): full
     width, gold band left, project + sub-project pills, and the right
     column = NEW/EDIT chip with the assignee(s) beneath. */
  function queueRow(t, opt) {
    return T(M.compactRow(t), d => {
      const r = d.querySelector('.trow');
      r.className = 'trow pending'; /* drop soon/overdue classes — queue rows are pending, period */
      r.style.setProperty('--sc', 'var(--gold)');
      const date = r.querySelector('.sub2 .cell-date');
      if (date) { date.className = 'cell-date'; date.textContent = 'sent ' + opt.sent; }
      const av = r.querySelector('.avstack');
      const chev = r.querySelector('.chev'); if (chev) chev.remove();
      const right = document.createElement('div'); right.className = 'rcol';
      right.innerHTML = `<span class="appr-kind ${opt.kind}">${opt.kind === 'new' ? 'NEW' : 'EDIT'}</span>` + (av ? av.outerHTML : '');
      if (av) av.remove();
      r.appendChild(right);
      if (opt.diff) r.querySelector('.mid').insertAdjacentHTML('beforeend', `<div class="rq-diff">${opt.diff}</div>`);
    });
  }
  function q2PhoneQueue() {
    return T(M.approvalsScreen(), d => {
      d.querySelector('.fs-head .ttl').textContent = 'Waiting for approval';
      d.querySelector('.bulkbar').outerHTML =
        '<div class="note-help" style="margin:0 0 10px">Only you can see these — an admin approves them onto the board.</div>';
      const sel = d.querySelector('.flt-row .sel-all'); if (sel) sel.remove();
      /* replace the inset .clist with full-width List rows (newest first) */
      d.querySelector('.clist').remove();
      const bulk = d.querySelector('#apBulk'); if (bulk) bulk.remove();
      const pad = d.querySelector('.body > div'); /* the padded head container */
      pad.insertAdjacentHTML('afterend',
        queueRow({ id: 101, name: 'Design spring flyer', sub: 'km', who: ['mara'], status: 'doing', due: '2026-06-11', priority: 'High' },
          { kind: 'edit', sent: 'Jun 11', diff: 'Deadline Jun 14 <span class="arr">→</span> Jun 21 · Assignees + Omar' })
        + queueRow(PENDING_T, { kind: 'new', sent: 'Jun 10' }));
    });
  }

  window.R = { q1Final, q1FinalNew, listStatuses, q2PhoneInPlace, q2PhoneMenu, q2PhoneQueue };
})();
