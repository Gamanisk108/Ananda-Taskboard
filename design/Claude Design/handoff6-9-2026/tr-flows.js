/* =============================================================
   Ananda Taskboard — HELP US FLOWS (TRF)
   Report a problem · Suggest a feature · Spread the word.
   Web (Settings dialog) + phone (full-screen route). Built on the
   real app chrome + form vocabulary (.field/.sec-label/.note,
   custom selects via TRB.csel, sticky footer per D30, aligned
   controls per D39). window.TRF.* return HTML strings.
   ============================================================= */
(function () {
  const B = window.TRB, I = B.I, esc = B.esc, csel = B.csel;

  /* ---- shared bits ---- */
  const fieldSel = (label, value, options, hint) =>
    `<div class="field"><label>${label}</label>${csel(value, options, { block: true })}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;

  const toggle = (label, on, hint) =>
    `<label class="an-toggle"><span class="an-tg ${on ? 'on' : ''}"><span class="an-tg-knob"></span></span><span class="an-tg-tx"><span class="an-tg-lbl">${label}</span>${hint ? `<span class="an-tg-hint">${hint}</span>` : ''}</span></label>`;

  // segmented radio (2–3 short options) — the house segmented control
  const seg = (options, sel) =>
    `<div class="an-seg">${options.map(o => `<button class="an-seg-opt ${o === sel ? 'on' : ''}">${esc(o)}</button>`).join('')}</div>`;

  const attach = (file) => file
    ? `<div class="an-attach has"><span class="an-att-thumb">${I.image}</span><span class="an-att-meta"><span class="an-att-nm" title="${esc(file)}">${esc(file)}</span><span class="an-att-sz mono">214 KB</span></span><button class="an-att-x" title="Remove">${I.x}</button></div>`
    : `<button class="an-attach"><span class="an-att-ic">${I.paperclip}</span><span class="an-att-tx">Attach a screenshot <span class="opt">(optional · we’ll shrink it — 1 MB max)</span></span></button>`;

  const copyrow = (url, copied) =>
    `<div class="an-copyrow"><span class="an-cr-ic">${I.link}</span><input class="an-cr-in" readonly value="${esc(url)}" /><button class="btn ${copied ? 'btn-secondary an-cr-done' : 'btn-primary'} an-cr-btn">${copied ? `${I.check} Copied` : `${I.copy} Copy`}</button></div>`;

  const shareRow = () => `<div class="an-share">
    ${[['copy', 'Copy link'], ['mail', 'Email'], ['chat', 'Message']].map(([ic, lbl]) =>
      `<button class="an-share-b"><span class="ic">${I[ic]}</span>${lbl}</button>`).join('')}
  </div>`;

  // sticky dialog footer (right-aligned actions) — D30
  const foot = (primary, opt) => `<div class="flow-foot">${opt && opt.left || ''}<div class="ff-r"><button class="btn btn-secondary" data-close>Cancel</button>${primary}</div></div>`;

  function flowModal(title, sub, body, footer, w) {
    return `<div class="modal has-foot flow-modal" style="max-width:${w || 560}px">
      ${B.modalHead(title, sub)}
      <div class="modal-body">${body}</div>
      ${footer}
    </div>`;
  }
  // success panel (shared) — line-art check, message, optional ref + quote
  function success(opt) {
    return `<div class="an-success">
      <div class="an-sx-ic">${I.check}</div>
      <h3>${esc(opt.title)}</h3>
      <p>${opt.body}</p>
      ${opt.ref ? `<div class="an-sx-ref">Reference <b class="mono">${esc(opt.ref)}</b></div>` : ''}
      ${opt.quote ? B.quote(opt.quote[0], opt.quote[1]) : ''}
    </div>`;
  }
  const doneFoot = `<div class="flow-foot"><div class="ff-r"><button class="btn btn-primary" data-close>Done</button></div></div>`;

  /* =============================================================  (1) REPORT A PROBLEM  */
  const WHERE = ['This page', 'Tasks & list', 'Calendar', 'Team & access', 'Projects', 'Import / Export', 'Account & sign-in', 'Something else'];
  function reportBody(state) {
    const filled = state === 'filled';
    return `<div class="flow-intro">${I.alert}<p>Tell us what went wrong and where — the more detail, the faster we can fix it.</p></div>
      <div class="field"><label>What happened?</label>
        <textarea class="fl-area" rows="3" placeholder="Describe what you expected, and what actually happened…">${filled ? 'When I drag a task to “Review”, the deadline turns red even though it isn’t overdue.' : ''}</textarea></div>
      ${fieldSel('Where did it happen?', filled ? 'Tasks & list' : 'This page', WHERE)}
      <div class="field"><label>How much does it block you?</label>${seg(['Minor', 'Slows me down', 'Blocks me'], filled ? 'Slows me down' : 'Minor')}</div>
      <div class="field"><label>Screenshot</label>${attach(filled ? 'review-deadline-bug.png' : null)}</div>
      <div class="an-techbox">${toggle('Include technical details', true, 'Your browser and the page you’re on — helps us reproduce it. No personal data.')}</div>`;
  }
  function webReport(state) {
    if (state === 'sent') return wrapModal(flowModal('Report a problem', null,
      success({ title: 'Report received', body: 'Thank you — we’ve logged this and the team will take a look. We may follow up by email if we need more detail.', ref: 'TB-0042' }), doneFoot));
    return wrapModal(flowModal('Report a problem', 'Tell us what went wrong — we’ll take a look',
      reportBody(state), foot(`<button class="btn btn-primary"${state === 'filled' ? '' : ' disabled'}>${I.send} Send report</button>`)));
  }

  /* =============================================================  (2) SUGGEST A FEATURE  */
  const AREA = ['Tasks & list', 'Calendar', 'Team & access', 'Projects', 'Notifications', 'Mobile app', 'Something else'];
  function featureBody(state) {
    const filled = state === 'filled';
    return `<div class="flow-intro">${I.sparkle}<p>Have an idea that would make the board better for your community? We read every one.</p></div>
      <div class="field"><label>Your idea in a few words</label>
        <input type="text" placeholder="e.g. Remind me the evening before a deadline" ${filled ? 'value="A gentle reminder the evening before a task is due"' : ''} /></div>
      <div class="field"><label>Tell us more <span class="lbl-opt">(optional)</span></label>
        <textarea class="fl-area" rows="3" placeholder="What would it do, and who would it help?">${filled ? 'Many sevaks check the board in the morning. An evening nudge would help us prepare for next-day pujas and classes.' : ''}</textarea></div>
      ${fieldSel('Which part of the board?', filled ? 'Notifications' : 'Tasks & list', AREA)}
      <div class="an-techbox">${toggle('Tell me when this ships', true, 'One notification if it ships — nothing else.')}</div>`;
  }
  function webFeature(state) {
    if (state === 'sent') return wrapModal(flowModal('Suggest a feature', null,
      success({ title: 'Idea received', body: 'Thank you — every suggestion is read by the team. If it ships, we’ll let you know.', quote: ['An idea offered in service blesses far more people than its author ever meets.', 'Paramhansa Yogananda'] }), doneFoot));
    return wrapModal(flowModal('Suggest a feature', 'We read every one',
      featureBody(state), foot(`<button class="btn btn-primary"${state === 'filled' ? '' : ' disabled'}>${I.send} Send idea</button>`)));
  }

  /* =============================================================  (3) SPREAD THE WORD  */
  /* =============================================================  (3) SPREAD THE WORD — new-center referral (§3 ruling) */
  function spreadBody(state) {
    const copied = state === 'copied';
    return `<div class="flow-intro">${I.share}<p>Know another Ananda center or seva team that would love this? Share the link — they set up their own board in a few minutes.</p></div>
      <div class="sec-label">Their board’s signup link</div>
      ${copyrow('https://taskboard.ananda.org/signup', copied)}
      ${shareRow()}
      <div class="an-or"><span>or send a note</span></div>
      <div class="field"><label>Their email</label><input type="email" placeholder="name@center.org" /></div>
      <div class="field"><label>Add a personal line <span class="lbl-opt">(optional)</span></label>
        <textarea class="fl-area" rows="2" placeholder="Joy! We run our seva on this — thought your team might like it too."></textarea></div>
      <button class="btn btn-primary fl-inline-send">${I.send} Send a hello</button>
      <div class="note an-spread-note">${I.info} They create their own board — separate from yours. Nothing here changes your team or who can join it.</div>`;
  }
  function webSpread(state) {
    if (state === 'sent') return wrapModal(flowModal('Spread the word', null,
      success({ title: 'Hello sent', body: 'We’ve emailed <b>seva@anandaseattle.org</b> a note with the signup link. They’ll set up their own board from there.', quote: ['Where people pull together in a common ideal, miracles happen.', 'Swami Kriyananda'] }), doneFoot));
    return wrapModal(flowModal('Spread the word', 'Share Ananda Taskboard with another center',
      spreadBody(state), `<div class="flow-foot"><div class="ff-r"><button class="btn btn-secondary" data-close>Close</button></div></div>`));
  }

  /* =============================================================  WEB WRAPPER  */
  function wrapModal(modal) {
    return B.webframe(`${B.appShell({ dim: true })}<div class="modal-backdrop">${modal}</div>`);
  }

  /* =============================================================  MOBILE  */
  function mScreen(title, body, footer) {
    return B.phone(`${B.fsHead(title, true)}<div class="m-scroll">${body}</div>${footer || ''}`);
  }
  const mFoot = (primary) => `<div class="m-flow-foot">${primary}</div>`;
  const mDoneFoot = `<div class="m-flow-foot"><button class="btn btn-primary btn-full" data-close>Done</button></div>`;
  function mSuccess(opt) {
    return `<div class="an-success m"><div class="an-sx-ic">${I.check}</div><h3>${esc(opt.title)}</h3><p>${opt.body}</p>${opt.ref ? `<div class="an-sx-ref">Reference <b class="mono">${esc(opt.ref)}</b></div>` : ''}${opt.quote ? B.quote(opt.quote[0], opt.quote[1]) : ''}</div>`;
  }
  function phoneReport(state) {
    if (state === 'sent') return mScreen('Report a problem', mSuccess({ title: 'Report received', body: 'Thank you — we’ve logged this and the team will take a look.', ref: 'TB-0042' }), mDoneFoot);
    return mScreen('Report a problem', reportBody(state), mFoot(`<button class="btn btn-primary btn-full"${state === 'filled' ? '' : ' disabled'}>${I.send} Send report</button>`));
  }
  function phoneFeature(state) {
    if (state === 'sent') return mScreen('Suggest a feature', mSuccess({ title: 'Idea received', body: 'Thank you — every suggestion is read by the team.', quote: ['An idea offered in service blesses far more people than its author ever meets.', 'Paramhansa Yogananda'] }), mDoneFoot);
    return mScreen('Suggest a feature', featureBody(state), mFoot(`<button class="btn btn-primary btn-full"${state === 'filled' ? '' : ' disabled'}>${I.send} Send idea</button>`));
  }
  function phoneSpread(state) {
    if (state === 'sent') return mScreen('Spread the word', mSuccess({ title: 'Hello sent', body: 'We’ve emailed <b>seva@anandaseattle.org</b> a note with the signup link.', quote: ['Where people pull together in a common ideal, miracles happen.', 'Swami Kriyananda'] }), mDoneFoot);
    return mScreen('Spread the word', spreadBody(state), `<div class="m-flow-foot"><button class="btn btn-secondary btn-full" data-close>Close</button></div>`);
  }

  window.TRF = { webReport, webFeature, webSpread, phoneReport, phoneFeature, phoneSpread };
})();
