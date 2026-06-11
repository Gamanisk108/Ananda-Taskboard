/* =============================================================
   Rulings 2026-06-11 — web List-view variants for Q2 (APR-4) ·
   RULED state (D50 = A + C). Runs inside web-board.html?v=a|c|d.
   Builds the REAL faux board (window.TRB, verbatim) then applies
   one surgical transform.
   ============================================================= */
(function () {
  const TRB = window.TRB;
  const T = (html, fn) => { const d = document.createElement('div'); d.innerHTML = html; fn(d); return d.innerHTML; };
  const v = new URLSearchParams(location.search).get('v') || 'a';

  /* ---- member chrome: signed in as Mara; Approvals is admin-only ---- */
  function memberize(d) {
    const ap = d.querySelector('.tbtn[title="Approvals"]'); if (ap) ap.remove();
    const av = d.querySelector('.user .avatar');
    if (av) {
      av.textContent = 'MA';
      av.style.background = TRB.PEOPLE.mara.color;
      av.nextElementSibling.textContent = 'Mara';
    }
    const mh = d.querySelector('.m-head'); if (mh) mh.textContent = 'Mara · mara@ananda.test';
  }

  /* ---- Mara's pending NEW task — mirrors the approvals sample ---- */
  const mara = TRB.PEOPLE.mara;
  const PEND_ROW = `<tr class="pending">
    <td class="c-task"><div class="task-cell"><span class="prio" title="Priority: Highest">${TRB.PRIO.Highest}</span><span class="task-name">Print A2 banner</span></div></td>
    <td><span class="proj-pill" style="--pc:#c8762f"><span class="pp-nm">Karuna Devi</span></span></td>
    <td><span class="proj-pill" style="--pc:#2c5499"><span class="pp-nm">Design</span></span></td>
    <td><div class="who"><span class="chip"><span class="av" style="background:${mara.color}">${mara.init}</span>Mara</span></div></td>
    <td><span class="pill-pending">Pending approval</span></td>
    <td><span class="cell-date">Jun 18</span></td>
    <td><span class="recurs none">—</span></td>
  </tr>`;

  /* ---- C destination: the "Waiting for approval" dialog ----
     Approvals-list methodology: sort + kind selects, Requested column
     (NEW / EDIT), edits expand the old → new diff. Rows open the
     read-only task popup (which carries the same pill). */
  function pendingModal() {
    const chip = (k, l) => `<span class="rq-chip ${k}">${l}</span>`;
    const who = ids => `<div class="who">${ids.map(id => `<span class="chip"><span class="av" style="background:${TRB.PEOPLE[id].color}">${TRB.PEOPLE[id].init}</span>${TRB.esc(TRB.PEOPLE[id].name)}</span>`).join('')}</div>`;
    return `<div class="modal-backdrop"><div class="modal" style="max-width:840px">
      ${TRB.modalHead('Waiting for approval', 'Only you can see these — an admin approves them onto the board.')}
      <div class="modal-body">
        <div style="display:flex;gap:8px;margin-bottom:13px">${TRB.csel('Newest first', [])}${TRB.csel('All kinds', [])}</div>
        <div class="board-list" style="padding:0;overflow:visible"><table class="lst">
          <thead><tr><th class="c-task"><span class="th-in">Task</span></th><th><span class="th-in">Project</span></th><th><span class="th-in">Sub-project</span></th><th><span class="th-in">Assignees</span></th><th><span class="th-in">Requested</span></th><th class="sorted"><span class="th-in">Submitted<span class="arrow">▼</span></span></th></tr></thead>
          <tbody>
            <tr>
              <td class="c-task"><div class="task-cell"><span class="prio" title="Priority: High">${TRB.PRIO.High}</span><span class="task-name">Design spring flyer</span></div></td>
              <td><span class="proj-pill" style="--pc:#c8762f"><span class="pp-nm">Karuna Devi</span></span></td>
              <td><span class="proj-pill" style="--pc:#2c5499"><span class="pp-nm">Design</span></span></td>
              <td>${who(['lena', 'arjuna'])}</td>
              <td>${chip('edit', 'Edit · 2 changes')}</td>
              <td><span class="cell-date">Jun 11</span></td>
            </tr>
            <tr class="rq-diffrow"><td></td><td colspan="5">Deadline&nbsp;&nbsp;Jun 14 <span class="arr">→</span> Jun 21&nbsp;&nbsp;·&nbsp;&nbsp;Assignees&nbsp;&nbsp;+ Omar</td></tr>
            <tr>
              <td class="c-task"><div class="task-cell"><span class="prio" title="Priority: Highest">${TRB.PRIO.Highest}</span><span class="task-name">Print A2 banner</span></div></td>
              <td><span class="proj-pill" style="--pc:#c8762f"><span class="pp-nm">Karuna Devi</span></span></td>
              <td><span class="proj-pill" style="--pc:#2c5499"><span class="pp-nm">Design</span></span></td>
              <td>${who(['mara'])}</td>
              <td>${chip('new', 'New task')}</td>
              <td><span class="cell-date">Jun 10</span></td>
            </tr>
          </tbody>
        </table></div>
        <div class="rq-note">Open a task to view it read-only — it carries the same “Pending approval” pill until an admin approves.</div>
      </div>
    </div></div>`;
  }

  function build() {
    let html = TRB.appShell({ userMenu: v === 'c', dim: v === 'd' });
    return T(html, d => {
      memberize(d);

      if (v === 'a' || v === 'c') {
        /* A · in place — NEW task sorted where it belongs, pending pill in
           the Status column; the pending EDIT keeps its approved values +
           a small "Edit pending" pill after the name; summary chip = 2. */
        const rows = [...d.querySelectorAll('.lst tbody tr')];
        const anchor = rows.find(r => (r.querySelector('.task-name') || {}).textContent === 'Print Sunday programs');
        anchor.insertAdjacentHTML('beforebegin', PEND_ROW);
        const flyer = rows.find(r => (r.querySelector('.task-name') || {}).textContent === 'Design spring flyer');
        flyer.querySelector('.task-name').insertAdjacentHTML('afterend', '<span class="pill-pending sm">Edit pending</span>');
        d.querySelector('.shell-summary .ss.soon')
          .insertAdjacentHTML('afterend', '<span class="ss pend"><b>2</b> Pending approval</span>');
      }

      if (v === 'c') {
        /* C · the account-menu entry (member menu, role-filtered) */
        const menu = d.querySelector('.menu.um');
        [...menu.querySelectorAll('.um-item')].forEach(it => {
          const t = it.textContent.trim();
          if (['History', 'Archive', 'Restore points', 'Trash', 'Preview as Viewer'].includes(t)) it.remove();
        });
        menu.querySelector('.m-head').insertAdjacentHTML('afterend',
          `<button class="um-item">${TRB.I.approvals}<span class="um-name" style="flex:1;text-align:left">Pending approval</span><span class="um-badge">2</span></button><div class="m-div"></div>`);
      }

      if (v === 'd') {
        /* C destination · the dialog over the dimmed board */
        d.querySelector('.appshell').insertAdjacentHTML('afterend', pendingModal());
      }
    });
  }

  document.body.innerHTML = TRB.webframe(build());
})();
