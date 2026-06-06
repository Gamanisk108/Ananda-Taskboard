/* =============================================================
   Ananda Taskboard — AUTH screen builders
   window.A.* return HTML strings. One card builder feeds both the
   web frame (card centered on the soft canvas) and the phone frame.
   Copy is short + label-driven (translates cleanly into 13 languages).
   ============================================================= */
(function () {
  const MARK = 'assets/ananda-mark.png';

  /* ---- icons ---- */
  const I = {
    envelope: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.6 7.2l8.4 5.8 8.4-5.8"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.4V12l3 1.8"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M12.5 5.5l-6.5 6.5 6.5 6.5"/><path d="M6 12h14"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.6-6.6 9.5-6.6S21.5 12 21.5 12 17.9 18.6 12 18.6 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.9"/></svg>',
  };

  const brandCol = (tag) => `<div class="brandrow"><img class="mark" src="${MARK}" alt="" /><div class="brandcol"><span class="nm">Ananda <b>Taskboard</b></span>${tag ? `<span class="bytag">brought to you by Ananda Los Angeles</span>` : ''}</div></div>`;
  const brand = brandCol(true);

  const peek = `<button type="button" class="peek" tabindex="-1" aria-label="Show password">${I.eye}</button>`;
  const field = (label, type, ph, opts = {}) => {
    const input = `<input type="${type}" placeholder="${ph}"${opts.val ? ` value="${opts.val}"` : ''}${opts.readonly ? ' readonly' : ''} />`;
    const body = opts.peek
      ? `<div class="inwrap">${input}${peek}</div>`
      : input;
    return `<div class="afield"><label>${label}</label>${body}${opts.hint ? `<div class="hint">${opts.hint}</div>` : ''}</div>`;
  };
  const backLink = `<div class="linkline"><button type="button" class="linkbtn">${I.back}Back to sign in</button></div>`;
  const signInLink = `<div class="linkline"><span class="pre">Already have an account?</span> <button type="button" class="linkbtn">Sign in</button></div>`;

  /* ---- the card, per state ---- */
  const CARD = {
    login: () => brand
      + `<p class="lede">Sign in to your team taskboard.</p>`
      + field('Email', 'email', 'name@ananda.test')
      + field('Password', 'password', '••••••••', { peek: true })
      + `<button type="button" class="btn-full btn-row">Sign in</button>`
      + `<div class="linkline"><button type="button" class="linkbtn">Forgot password?</button></div>`,

    request: () => brand
      + `<h1>Reset your password</h1>`
      + `<p class="lede">Enter your email and we'll send a link to set a new one.</p>`
      + field('Email', 'email', 'name@ananda.test')
      + `<button type="button" class="btn-full btn-row">Send reset link</button>`
      + backLink,

    check: () => brand
      + `<div class="glyphbadge">${I.envelope}</div>`
      + `<h1>Check your email</h1>`
      + `<p class="lede">If an account exists for <b>name@ananda.test</b>, we've sent a link to reset your password. It expires in 1 hour.</p>`
      + `<div class="callout">Still stuck? <b>Contact your team admin.</b></div>`
      + backLink,

    setnew: () => brand
      + `<h1>Choose a new password</h1>`
      + `<p class="lede">Pick something you'll remember — you'll use it to sign in.</p>`
      + field('New password', 'password', '••••••••', { peek: true, hint: 'Use at least 8 characters.' })
      + field('Confirm new password', 'password', '••••••••', { peek: true })
      + `<button type="button" class="btn-full btn-row">Update password</button>`,

    success: () => brand
      + `<div class="glyphbadge ok">${I.check}</div>`
      + `<h1>Password updated</h1>`
      + `<p class="lede">You can now sign in with your new password.</p>`
      + `<button type="button" class="btn-full btn-row">Sign in</button>`,

    expired: () => brand
      + `<div class="glyphbadge warn">${I.clock}</div>`
      + `<h1>This link has expired</h1>`
      + `<p class="lede">Reset links are valid for 1 hour. Request a new one to continue.</p>`
      + `<button type="button" class="btn-full btn-row">Request a new link</button>`
      + backLink,

    /* ---- sign-up flow (invite-based) ---- */
    signup: () => brand
      + `<h1>Create your account</h1>`
      + `<p class="lede">You've been invited to your team's taskboard.</p>`
      + field('Full name', 'text', 'Lila Devi')
      + field('Email', 'email', '', { val: 'lila@ananda.test', readonly: true, hint: 'From your invitation.' })
      + field('Password', 'password', '••••••••', { peek: true, hint: 'Use at least 8 characters.' })
      + `<button type="button" class="btn-full btn-row">Create account</button>`
      + signInLink,

    verify: () => brand
      + `<div class="glyphbadge">${I.envelope}</div>`
      + `<h1>Verify your email</h1>`
      + `<p class="lede">We've sent a verification link to <b>lila@ananda.test</b>. It expires in 24 hours.</p>`
      + `<div class="callout">Wrong address? <b>Contact your team admin.</b></div>`
      + backLink,

    welcome: () => brand
      + `<div class="glyphbadge ok">${I.check}</div>`
      + `<h1>You're all set</h1>`
      + `<p class="lede">Your account is ready.</p>`
      + `<button type="button" class="btn-full btn-row">Go to taskboard</button>`,

    inviteexpired: () => brand
      + `<div class="glyphbadge warn">${I.clock}</div>`
      + `<h1>This invite has expired</h1>`
      + `<p class="lede">Invites are valid for 7 days. Ask your team admin to send a new one.</p>`
      + backLink,
  };

  /* ---- iOS status bar ---- */
  const STATUS = `<div class="statusbar"><span class="mono">9:41</span><span class="sb-r">`
    + `<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="4" width="3" height="8" rx="1"/><rect x="10" y="1.5" width="3" height="10.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1" opacity=".35"/></svg>`
    + `<svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2C5.5 2 2.8 3.2 1 5l1.6 1.6C4 5.2 6.1 4.3 8.5 4.3s4.5.9 5.9 2.3L16 5C14.2 3.2 11.5 2 8.5 2z"/><path d="M8.5 7.2c-1.3 0-2.5.5-3.4 1.4L8.5 12l3.4-3.4C11 7.7 9.8 7.2 8.5 7.2z"/></svg>`
    + `<svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke="currentColor" stroke-opacity=".4"/><rect x="3" y="3" width="16" height="7" rx="1.5" fill="currentColor"/><rect x="23.5" y="4.5" width="2" height="4" rx="1" fill="currentColor" fill-opacity=".4"/></svg>`
    + `</span></div>`;

  /* ---- frames ---- */
  A_webFrame = (state) =>
    `<div class="webframe"><div class="authcard">${CARD[state]()}</div>`
    + `<div class="footnote">Internal team taskboard</div></div>`;

  A_phoneFrame = (state) =>
    `<div class="phone">${STATUS}<div class="pbody"><div class="authcard">${CARD[state]()}</div></div><div class="homebar"></div></div>`;

  /* ---- emails (web: full client; mobile: message card) ---- */
  const MAIL = {
    reset: {
      subject: 'Reset your Ananda Taskboard password',
      to: 'lila@ananda.test',
      body: `
    ${brandCol(false)}
    <p class="greet">Hi Lila,</p>
    <p>We have received a request to reset the password for your Ananda Taskboard account. Tap the button below to choose a new one.</p>
    <div class="mbtn-wrap"><a href="#" class="mbtn">Reset password</a></div>
    <p class="expire">${I.clock}This link expires in 1 hour.</p>
    <p class="fine">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    <p class="fine">Button not working? Paste this link into your browser:<br><span class="mlink">https://taskboard.ananda.test/reset?t=9f2c-7a1e-bb40</span></p>
    <div class="sign">— The Ananda Taskboard team<br><span class="tag">Love &amp; Blessings from Ananda Los Angeles</span></div>`,
    },
    invite: {
      subject: "You're invited to Ananda Taskboard",
      to: 'lila@ananda.test',
      body: `
    ${brandCol(false)}
    <p class="greet">Hi Lila,</p>
    <p>You've been invited to join your team on Ananda Taskboard. Tap the button below to set up your account.</p>
    <div class="mbtn-wrap"><a href="#" class="mbtn">Accept invite</a></div>
    <p class="expire">${I.clock}This invite expires in 7 days.</p>
    <p class="fine">If this wasn't meant for you, you can safely ignore this email.</p>
    <p class="fine">Button not working? Paste this link into your browser:<br><span class="mlink">https://taskboard.ananda.test/invite?t=3b8e-12af-c907</span></p>
    <div class="sign">— The Ananda Taskboard team<br><span class="tag">Love &amp; Blessings from Ananda Los Angeles</span></div>`,
    },
  };

  const mailWeb = (m) =>
    `<div class="mailframe"><div class="mailclient">`
    + `<div class="mailhead"><div class="subj">${m.subject}</div>`
    + `<div class="meta"><div class="mav"><img src="${MARK}" alt="" /></div>`
    + `<div class="mfrom">Ananda Taskboard <span class="addr">no-reply@ananda.test</span></div>`
    + `<div class="mto">to ${m.to}</div></div></div>`
    + `<div class="mailbody">${m.body}</div></div></div>`;

  const mailMobile = (m) =>
    `<div class="phone">${STATUS}<div class="pbody" style="padding:14px 14px 26px;justify-content:flex-start">`
    + `<div class="mailmsg"><div class="mhead"><div class="subj">${m.subject}</div>`
    + `<div class="meta"><div class="mav"><img src="${MARK}" alt="" /></div>`
    + `<div class="mfrom">Ananda Taskboard<span class="addr">no-reply@ananda.test</span></div></div></div>`
    + `<div class="mailbody" style="padding:20px 18px 24px">${m.body}</div></div>`
    + `</div><div class="homebar"></div></div>`;

  window.A = {
    states: Object.keys(CARD),
    webFrame: A_webFrame,
    phoneFrame: A_phoneFrame,
    emailWeb: () => mailWeb(MAIL.reset),
    emailMobile: () => mailMobile(MAIL.reset),
    inviteWeb: () => mailWeb(MAIL.invite),
    inviteMobile: () => mailMobile(MAIL.invite),
  };
})();
