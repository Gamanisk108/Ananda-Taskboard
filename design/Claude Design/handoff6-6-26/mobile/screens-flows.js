/* =============================================================
   Ananda Taskboard — MOBILE screen builders (part 2): flows
   Filters · Search · Task detail · New task · Team · Projects ·
   Trash · Approvals · Nav drawer · Day sheet · Alt nav pattern.
   Depends on window.M (screens-views.js).
   ============================================================= */
(function () {
  const M = window.M;
  const { PEOPLE, PROJECTS, SUBS, STATUS, STATUS_ORDER, TASKS, taskFlags, fmtDate, esc, svg, av, avStack, whoChips, statusPill, flagFor, statusbar, appbar, chips, subchips, summary, viewbar, listScreen, boardScreen } = M;

  const chk = on => `<span class="bx ${on?'on':''}">${svg('check')}</span>`;
  const toggle = on => `<span class="toggle ${on?'on':''}"><i></i></span>`;
  const LI = {
    user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c.7-3.5 3.7-5.5 7-5.5s6.3 2 7 5.5"/></svg>',
    eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.6l1.6 1.8H19.5A1.5 1.5 0 0 1 21 9.3v8.7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/></svg>',
    folderStack:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h3.8l1.2 1.2H19"/><path d="M4 9.2h4.4l1.2 1.2H20"/><path d="M3 13A1.5 1.5 0 0 1 4.5 11.5h5l1.4 1.4H19.5A1.5 1.5 0 0 1 21 14.4v5.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z"/></svg>',
    building:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 21v-9h4a1 1 0 0 1 1 1v8"/><path d="M3 21h18"/><path d="M8 9h3M8 13h3M8 17h3"/></svg>',
    key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="4"/><path d="M12 12h9l-2 2.5M17 12v3"/></svg>',
  };
  const ROLE_HELP = { title:"Role", sub:"What each role can do", rows:[
    [LI.user,"Member","Assignment-based access — sees tasks they're assigned or granted."],
    [LI.eye,"Viewer","View-only — can read tasks and add comments, but cannot edit."],
    [LI.key,"Admin","Full access — manages team, projects, settings."],
  ]};
  const VA_HELP = { title:"Access", sub:"What each level shows", rows:[
    [LI.user,"Tasks Only","Only the tasks they're assigned. Best for contractors or one-off helpers."],
    [LI.folder,"Sub-Project Only","Every task in their Sub-project(s). Best for one workstream."],
    [LI.folderStack,"Full Project","The whole Project + any new Sub-projects added later. Best for project leads."],
    [LI.building,"Organization","Every task across the entire organization. Best for senior staff."],
  ]};
  const I_INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.01"/></svg>';
  let _helpSeq = 0;
  window._helpRegistry = window._helpRegistry || {};
  const lblInfo = help => { const k='h'+(++_helpSeq); window._helpRegistry[k]=help; return `<button type="button" class="lbl-info" data-help="${k}">${I_INFO_SVG}</button>`; };
  /* custom single-select (replaces native <select> popups) — brand-styled, rounded */
  let _csSeq = 0;
  window._csRegistry = window._csRegistry || {};
  function csSelect(options, current, cls){
    const id='cs'+(++_csSeq);
    window._csRegistry[id]={options,current};
    return `<button type="button" class="cs-trigger ${cls||''}" data-cs="${id}"><span class="cs-lbl">${esc(current)}</span><svg class="cs-cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>`;
  }
  if(!window._csWired){
    window._csWired = true;
    let _csPopOpen=null;
    function _csClose(){ if(_csPopOpen){_csPopOpen.remove();_csPopOpen=null;} document.removeEventListener('mousedown', _csOut, true); }
    function _csOut(e){ if(_csPopOpen && !_csPopOpen.contains(e.target) && e.target!==_csPopOpen._anchor && !_csPopOpen._anchor.contains(e.target)){ _csClose(); } }
    document.addEventListener('click', e=>{
      const trigger = e.target.closest('.cs-trigger'); if(!trigger) return;
      e.preventDefault(); e.stopPropagation();
      const id = trigger.dataset.cs; const reg = window._csRegistry[id]; if(!reg) return;
      if(_csPopOpen && _csPopOpen._anchor===trigger){ _csClose(); return; }
      _csClose();
      const pop = document.createElement('div'); pop.className='cs-pop'; pop._anchor=trigger;
      pop.innerHTML = reg.options.map(o=>`<div class="cs-opt ${o===reg.current?'sel':''}" data-v="${(o+'').replace(/"/g,'&quot;')}">${esc(o)}<svg class="cs-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-11"/></svg></div>`).join('');
      const phone = trigger.closest('.phone') || document.body;
      const tr = trigger.getBoundingClientRect();
      const pr = phone.getBoundingClientRect();
      pop.style.position='absolute';
      pop.style.top = (tr.bottom - pr.top + 4) + 'px';
      pop.style.left = (tr.left - pr.left) + 'px';
      pop.style.minWidth = Math.max(tr.width, 140) + 'px';
      phone.appendChild(pop);
      _csPopOpen = pop;
      pop.querySelectorAll('.cs-opt').forEach(o=>{
        o.onmousedown = ev=>ev.stopPropagation();
        o.onclick = ev=>{ ev.stopPropagation();
          const v = o.dataset.v.replace(/&quot;/g,'"');
          reg.current = v;
          trigger.querySelector('.cs-lbl').textContent = v;
          pop.querySelectorAll('.cs-opt').forEach(x=>x.classList.toggle('sel', x.dataset.v.replace(/&quot;/g,'"')===v));
          _csClose();
        };
      });
      setTimeout(()=>document.addEventListener('mousedown', _csOut, true), 0);
    }, true);
  }
  /* checkbox bulk-action wiring (Trash + Approvals) — pure delegation, no observer */
  function bulkRefresh(phone){
    const ids = phone.querySelector('#trAll') ? ['#trAll',[{sel:'#trEmpty',w:'Delete'},{sel:'#trRestoreAll',w:'Restore'}]]
              : phone.querySelector('#apAll') ? ['#apAll',[{sel:'#apRejectAll',w:'Reject'},{sel:'#apApproveAll',w:'Approve'}]] : null;
    if(!ids) return;
    const allBox = phone.querySelector(ids[0]);
    const chks = [...phone.querySelectorAll('.crow .ck-row input[type="checkbox"]')];
    const n = chks.filter(c=>c.checked).length;
    ids[1].forEach(({sel,w})=>{ const btn=phone.querySelector(sel); if(!btn)return;
      const want = n===0; if(btn.disabled!==want) btn.disabled = want;
      const html = n? `${w} <span class="bb-cnt">${n}</span>` : w;
      if(btn.innerHTML!==html) btn.innerHTML = html;
    });
    if(allBox){ const ac=n>0&&n===chks.length, ind=n>0&&n<chks.length;
      if(allBox.checked!==ac) allBox.checked=ac; if(allBox.indeterminate!==ind) allBox.indeterminate=ind; }
  }
  if(!window._bulkWired){
    window._bulkWired = true;
    document.addEventListener('change', e=>{
      const t = e.target; if(!t || t.type!=='checkbox') return;
      const phone = t.closest('.phone'); if(!phone) return;
      if(!phone.querySelector('#trAll') && !phone.querySelector('#apAll')) return;
      if(t.closest('.sel-all')){ /* select all */
        const chks=[...phone.querySelectorAll('.crow .ck-row input[type="checkbox"]')];
        chks.forEach(c=>c.checked=t.checked);
      }
      bulkRefresh(phone);
    }, true);
    /* initialize disabled state when phones appear — single shot after load */
    setTimeout(()=>{ document.querySelectorAll('.phone').forEach(bulkRefresh); }, 800);
    setTimeout(()=>{ document.querySelectorAll('.phone').forEach(bulkRefresh); }, 2000);
  }
  if(!window._helpWired){
    window._helpWired = true;
    document.addEventListener('click', e=>{
      const btn = e.target.closest('.lbl-info');
      if(btn){ e.preventDefault(); e.stopPropagation();
        const phone = btn.closest('.phone'); if(!phone) return;
        phone.querySelectorAll('.info-overlay').forEach(o=>o.remove());
        const h = window._helpRegistry[btn.dataset.help]; if(!h) return;
        const overlay = document.createElement('div'); overlay.className = 'info-overlay';
        overlay.innerHTML = `<div class="info-scrim"></div><div class="info-card"><div class="info-h"><span>${h.title}</span><button class="info-x" type="button" aria-label="Close">✕</button></div>${h.sub?`<div class="info-sub">${h.sub}</div>`:''}<div class="info-body">${h.rows.map(r=>`<div class="info-row"><span class="info-ic">${r[0]}</span><div><div class="info-t">${r[1]}</div><div class="info-d">${r[2]}</div></div></div>`).join('')}</div></div>`;
        phone.appendChild(overlay);
        const close = ()=>overlay.remove();
        overlay.querySelector('.info-scrim').onclick = close;
        overlay.querySelector('.info-x').onclick = close;
      } else {
        document.querySelectorAll('.phone .info-overlay').forEach(o=>{ if(!e.target.closest('.info-card')) o.remove(); });
      }
    }, true);
  }

  /* line-art header icons (transparent stroke, current color) */
  const HEAD_ICONS = {
    trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M10 11v6M14 11v6"/></svg>',
    approvals:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11.5l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
    team:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5"/><circle cx="17" cy="7" r="2.4"/><path d="M15 14c2.5 0 4.5 1.2 5 3.2"/></svg>',
    projects:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.4H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>',
    person:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5"/></svg>',
  };

  /* ---------- full-screen header ---------- */
  function fsHead(title,opt){ opt=opt||{};
    let right = `<span style="width:6px"></span>`;
    if(opt.save) right = `<button class="save">Save</button>`;
    else if(opt.add) right = `<button class="addbtn" aria-label="${opt.add}">${svg('plus')}</button>`;
    const headIcon = opt.icon ? `<span class="fs-icn" aria-hidden="true">${HEAD_ICONS[opt.icon]||''}</span>` : '';
    return `<div class="fs-head">
      <button class="${opt.back?'back':'x'}">${svg(opt.back?'back':'x')}</button>
      <div class="ttlwrap">${headIcon}<span class="ttl">${esc(title)}</span>${opt.pen?`<button class="penbtn" aria-label="Edit name">${svg('pen')}</button>`:''}</div>
      ${opt.id?`<span class="id">#${opt.id}</span>`:''}
      ${right}
    </div>`; }

  /* ============================================================ OVERFLOW MENU (overlay on list, nav B) */
  function ofItem(icon,label,opt){ opt=opt||{};
    return `<a class="ofitem ${opt.primary?'primary':''}">${svg(icon)}<span>${label}</span>${opt.badge?`<span class="badge">${opt.badge}</span>`:''}</a>`; }
  function overflowOverlay(){
    return `<div class="ovl"><div class="scrim"></div>
      <div class="ofmenu">
        ${ofItem('plus','New task',{primary:true})}
        ${ofItem('share','Share view')}
        ${ofItem('copy','Copy summary')}
        ${ofItem('dl','Export')}
        <div class="ofsep"></div>
        ${ofItem('approvals','Approvals',{badge:3})}
        ${ofItem('team','Team')}
        ${ofItem('projects','Projects')}
        ${ofItem('trash','Trash')}
        <div class="ofsep"></div>
        ${ofItem('bell','Notification time')}
        ${ofItem('gear','Settings')}
        ${ofItem('moon','Switch to dark')}
        <div class="ofsep"></div>
        <div class="ofitem" style="gap:11px;cursor:default">
          <span class="av" style="width:30px;height:30px;border-radius:50%;background:var(--primary);color:#fff;display:grid;place-items:center;font-family:var(--f-mono);font-size:11px;font-weight:600;flex:none">AD</span>
          <div style="line-height:1.25;min-width:0"><div style="font-weight:600">Admin Ada</div><div style="font-size:12px;color:var(--muted);font-weight:400">ada@ananda.org</div></div>
        </div>
        ${ofItem('logout','Log out')}
      </div></div>`;
  }
  function overflowScreen(){ return M.listCompact()+overflowOverlay(); }
  function listBodyShort(){ let b=`<div class="body pad">`; TASKS.slice(0,4).forEach(t=>b+=cardMini(t)); return b+`</div>`; }
  function cardMini(t){ const fl=taskFlags(t),s=SUBS[t.sub],p=PROJECTS[s.proj],st=STATUS[t.status];
    const cls=[t.status==='done'?'done':'',fl.overdue?'overdue':'',fl.soon?'soon':''].filter(Boolean).join(' ');
    const dcls=fl.overdue?'od':fl.soon?'soon':(t.due?'':'none');
    return `<div class="tcard ${cls}"><div class="tc-top"><span class="tc-name">${esc(t.name)}</span>${flagFor(fl)}</div>
      <div class="tc-meta">${statusPill(st)}<span class="proj-pill sm" style="--pc:${p.color}"><span class="pp-nm">${esc(p.name)}</span></span><span class="proj-pill sm" style="--pc:${s.color}"><span class="pp-nm">${esc(s.name)}</span></span></div>
      <div class="tc-foot"><span class="left">${avStack(t.who,24)}</span><span class="dl cell-date ${dcls}">${dcls?svg('clock'):''}${fmtDate(t.due)}</span></div></div>`; }

  /* ============================================================ FILTERS sheet (overlay on list) */
  function filterSheet(){
    const sheet=`<div style="position:absolute;inset:0;z-index:30">
      <div style="position:absolute;inset:0;background:rgba(13,21,38,.45)"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:20px 20px 0 0;box-shadow:var(--shadow-pop);max-height:88%;display:flex;flex-direction:column">
        <div class="sheet-grab"><i></i></div>
        <div class="sheet-head" style="border-radius:20px 20px 0 0"><h2>Filters</h2><button class="reset-link">Reset</button><button class="x">${svg('x')}</button></div>
        <div style="padding:16px 16px 8px;overflow-y:auto">
          <div class="field"><label>Assignee</label><button class="pickrow">Mara <span class="msn">+2</span> <span class="chev">${svg('chevR')}</span></button></div>
          <div class="field"><label>Status</label><div class="ck-list">${[['todo',true],['doing',false],['delayed',false],['review',true],['done',false]].map(([k,on])=>`<label class="ck-opt"><span class="dot" style="background:${STATUS[k].color}"></span><span class="t">${STATUS[k].name}</span>${chk(on)}</label>`).join('')}</div></div>
          <div class="field"><label>Priority</label><div class="ck-list">${[['Highest',false],['High',true],['Medium',false],['Low',false],['Lowest',false]].map(([p,on])=>`<label class="ck-opt"><span class="prio">${M.PRIO_ICON[p]}</span><span class="t">${p}</span>${chk(on)}</label>`).join('')}</div></div>
          <div class="field"><label>Deadline</label><select><option>Any</option><option>Overdue</option><option>Due soon</option><option>Has deadline</option><option>No deadline</option></select></div>
          <div class="field"><label>Recurrence</label><select><option>Any</option><option>Recurring</option><option>One-off</option></select></div>
        </div>
        <div style="display:flex;gap:10px;padding:12px 16px 26px;border-top:1px solid var(--border)">
          <button style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-ctl);padding:12px 0;font-weight:600;color:var(--text)">Clear</button>
          <button style="flex:2;background:var(--primary);color:var(--primary-ink);border-radius:var(--r-ctl);padding:12px 0;font-weight:600">Show 7 tasks</button>
        </div>
      </div></div>`;
    return M.listCompact()+sheet; }

  /* ============================================================ SEARCH active */
  function searchScreen(){
    const sb=`<div class="searchbar"><div class="box">${svg('search')}<input value="spring" /></div><button class="cancel">Cancel</button></div>`;
    const scope=`<div class="scopebar"><span class="sl">Searching</span><div class="seg"><button class="on">This project</button><button>Everywhere</button></div></div>`;
    const ids=[1,5]; const byId=Object.fromEntries(TASKS.map(t=>[t.id,t]));
    byId[5]={id:5,name:"Order spring flowers",sub:"km",who:["mara"],status:"todo",due:"2026-06-10",priority:"Medium"};
    let body=`<div class="body"><div style="padding:12px 14px 4px;font-size:12px;color:var(--muted)">2 results in <strong style="color:var(--text)">Karuna Devi</strong></div>`;
    ids.forEach(id=>body+=M.compactRow(byId[id])); body+=`</div>`;
    return statusbar()+sb+scope+body; }

  /* ============================================================ TASK DETAIL (full screen) */
  function field(label,inner,help){ return `<div class="field"><label>${label}</label>${inner}${help?`<div class="note-help" style="margin-top:6px">${help}</div>`:''}</div>`; }
  function sel(opts){ return csSelect(opts, opts[0], 'cs-input'); }
  function statusSeg(active){ return `<div class="seg">${STATUS_ORDER.map(s=>`<button class="${s===active?'on':''}" style="${s===active?`color:${STATUS[s].color==='var(--doing)'?'var(--doing)':STATUS[s].color}`:''}">${STATUS[s].name.replace('In Progress','Doing')}</button>`).join('')}</div>`; }
  const STAT4=[['todo','To Do'],['doing','In Progress'],['delayed','Delayed'],['review','Review'],['done','Done']];
  function statusSelect(active){ return `<select>${STAT4.map(([k,l])=>`<option ${k===active?'selected':''}>${l}</option>`).join('')}</select>`; }
  function priorityBtn(p){ return `<button class="pbtn" title="Priority: ${p}"><span class="prico">${M.PRIO_ICON[p]||''}</span><span class="pl">${p}</span><span class="cv">${svg('chevD')}</span></button>`; }

  function taskDetail(){
    const t={id:1,name:"Design spring flyer",sub:"km",who:["mara"],status:"doing"};
    const chipsWho=`<div class="who" style="gap:7px"><span class="chip"><span class="av" style="background:${PEOPLE.mara.color}">MA</span>Mara</span>${sel(['+ Add person…'])}</div>`;
    const SUB=[{t:"Draft headline + body copy",w:"lila",s:"done",p:"High"},{t:"Gather retreat photos",w:"arjuna",s:"review",p:"Medium"},{t:"Lay out A4 master",w:"lila",s:"doing",p:"High"},{t:"Send proof to printer",w:"unassigned",s:"todo",p:"Low"}];
    const subAv=w=>{ if(w==='unassigned') return `<span class="sav un">+</span>`; const map={lila:{i:'LI',c:'#a23e6e'},arjuna:{i:'AR',c:'#4f7a3c'}}; const a=map[w]||{i:'??',c:'#888'}; return `<span class="sav" style="background:${a.c}">${a.i}</span>`; };
    let subtasks=''; SUB.forEach(r=>{ const col=STATUS[r.s].color;
      subtasks+=`<div class="subrow ${r.s==='done'?'done':''}"><span class="prio" title="Priority: ${r.p}">${M.PRIO_ICON[r.p]}</span><span class="t">${r.t}</span>${subAv(r.w)}<button class="ststag" style="background:color-mix(in srgb,${col} 16%,var(--surface));color:${col};border-color:color-mix(in srgb,${col} 28%,transparent)"><span class="dot" style="background:${col};width:6px;height:6px"></span>${STATUS[r.s].name}<span class="cv">▾</span></button><button class="del" aria-label="Delete subtask">${svg('x')}</button></div>`; });
    const body=`<div class="body pad">
      <div class="created-mp" style="text-align:right;margin:-2px 0 10px">Created May 18, 2026</div>
      <div style="margin-bottom:14px"><span class="pill" style="background:color-mix(in srgb,var(--warn) 16%,var(--surface));color:var(--warn);border:1px solid color-mix(in srgb,var(--warn) 32%,transparent)">Pending approval</span></div>
      <div class="field"><div class="row2"><div>${field('Project',sel(['Karuna Devi','Sunday Service','Alliance Electric']))}</div><div>${field('Sub-project',sel(['Marketing','Warehouse','General']))}</div></div></div>
      <div class="field"><div class="row2"><div>${field('Status',statusSelect('doing'))}</div><div>${field('Priority',priorityBtn('High'))}</div></div></div>
      ${field('Assignees',chipsWho)}
      ${field('Details','<textarea rows="3" placeholder="What needs doing…">Spring season flyer for the community hall — A4, double sided.</textarea>')}
      ${field('Requirements','<textarea rows="2" placeholder="Definition of \u2018complete\u2019…">Print-ready PDF approved by Mara.</textarea>')}
      <div class="field"><div class="row2"><div>${field('Start date','<input type="date" value="2026-05-30" />')}</div><div>${field('Deadline','<input type="date" value="2026-06-14" />')}</div></div></div>
      <div class="rowline"><div class="t">Repeats</div>${toggle(false)}</div>
      <div class="rowline"><div class="t">Monitor<div class="sub">Notify admins when this task is moved</div></div>${toggle(true)}</div>
      <div class="rowline" style="border-bottom:none"><div class="t">Auto-complete<div class="sub">Mark Done after the deadline</div></div>${toggle(false)}</div>
      <div class="hr"></div>
      <div class="sub-head" style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><h3 style="font-family:var(--f-ui);font-weight:700;font-size:16px;margin:0;flex:none">Subtasks</h3>${M.segBar({todo:1,doing:1,review:1,done:1})}</div>
      ${subtasks}
      <div style="display:flex;gap:8px;margin-top:12px"><input placeholder="Add a subtask…" /><button style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-ctl);padding:0 16px;font-weight:600;color:var(--text)">Add</button></div>
      <div class="hr"></div>
      <h3 style="font-family:var(--f-ui);font-weight:700;font-size:16px;margin:0 0 8px">Comments</h3>
      <div class="comment"><div class="ch"><strong>You</strong><span class="mono">2026-06-02</span></div><div class="bd">First draft is in the Drive folder — feedback welcome.</div></div>
      <div class="comment" style="border-bottom:none"><div class="ch"><strong>Lila</strong><span class="mono">2026-06-03</span></div><div class="bd">Looks great. Can we make the date line bigger?</div></div>
      <div style="display:flex;gap:8px;margin-top:10px"><input placeholder="Add a comment…" /><button style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-ctl);padding:0 16px;font-weight:600;color:var(--text)">Post</button></div>
      <button style="width:100%;margin-top:18px;background:var(--surface);border:1px solid color-mix(in srgb,var(--danger) 40%,transparent);color:var(--danger);border-radius:var(--r-ctl);padding:12px 0;font-weight:600">Delete task</button>
    </div>`;
    return statusbar()+fsHead('Design spring flyer',{back:true,id:1,save:true,pen:true})+body; }

  function newTask(){
    const body=`<div class="body pad">
      ${field('Task name','<input placeholder="New task name…" autofocus />')}
      <div class="field"><div class="row2"><div>${field('Project',sel(['Karuna Devi','Sunday Service','Alliance Electric']))}</div><div>${field('Sub-project',sel(['Marketing','Warehouse','General']))}</div></div></div>
      <div class="field"><div class="row2"><div>${field('Status',statusSelect('todo'))}</div><div>${field('Priority',priorityBtn('Medium'))}</div></div></div>
      ${field('Assignees','<div class="who">'+sel(['+ Add person or group…'])+'</div>')}
      ${field('Details','<textarea rows="3" placeholder="What needs doing…"></textarea>')}
      <div class="field"><div class="row2"><div>${field('Start date','<input type="date" />')}</div><div>${field('Deadline','<input type="date" />')}</div></div></div>
      <div class="rowline"><div class="t">Repeats</div>${toggle(false)}</div>
      <div class="rowline" style="border-bottom:none"><div class="t">Monitor<div class="sub">Notify admins on changes</div></div>${toggle(false)}</div>
      <button style="width:100%;margin-top:20px;background:var(--primary);color:var(--primary-ink);border-radius:var(--r-ctl);padding:14px 0;font-weight:600;font-size:15px">Create task</button>
    </div>`;
    return statusbar()+fsHead('New task',{back:false,save:false,icon:'plus'})+body; }

  /* ============================================================ TEAM */
  /* ---- member data + Team tabs (Members / Groups / Access) ---- */
  const MEMBERS=[
    {id:"ada",name:"Ada Devi",email:"admin@ananda.test",role:"Admin",status:"Active"},
    {id:"mara",name:"Mara",email:"mara@ananda.test",role:"Member",status:"Suspended"},
    {id:"lila",name:"Lila Devi",email:"lila@ananda.test",role:"Member",status:"Active"},
    {id:"omar",name:"Omar",email:"omar@ananda.test",role:"Member",status:"Active"},
    {id:"gita",name:"Gita",email:"gita@ananda.test",role:"Member",status:"Active"},
    {id:"nitai",name:"Nitai",email:"nitai@ananda.test",role:"Member",status:"Active"},
    {id:"arun",name:"Arun",email:"arun@ananda.test",role:"Member",status:"Active"},
    {id:"tara",name:"Tara",email:"tara@ananda.test",role:"Member",status:"Active"},
    {id:"devi",name:"Devi",email:"devi@ananda.test",role:"Member",status:"Active"},
  ];
  function teamTabs(active){ const tt=[['members','Members'],['groups','Groups'],['access','Access']];
    return `<div class="teamtabs"><div class="seg">${tt.map(([k,l])=>`<button class="${k===active?'on':''}">${l}</button>`).join('')}</div></div>`; }
  function settingsHolidays(){
    const sets=[
      ["US Federal holidays","New Year's, MLK, Memorial Day, Juneteenth, July 4, Labor Day, Thanksgiving, Christmas…",true],
      ["US observances","Mother's Day, Father's Day, Daylight Saving, Flag Day…",true],
      ["Christian / religious","Easter, Ash Wednesday, Pentecost, Trinity Sunday, Advent…",false],
      ["Hindu / yoga festivals","Diwali, Maha Shivaratri, Holi, Guru Purnima…",true],
      ["Ananda lineage days","Yogananda's birthday, Founding of Ananda Village, Master's Mahasamadhi…",true],
    ];
    const sect=(label,sub)=>`<div class="ss-row"><div class="ss-info"><span class="ss-l">${label}</span><span class="ss-s">${sub}</span></div><span class="ss-chev">${svg('chevR')}</span></div>`;
    const body=`<div class="body">
      <div class="ss-list">
        ${sect('Your password','Last changed 2 weeks ago')}
        ${sect('Daily push notification time','8:00 AM · America/Los_Angeles')}
        ${sect('Task statuses','5 columns · To Do, In Progress, Delayed, Review, Done')}
        ${sect('Calendar events','3 active · birthdays, classes, rehearsals')}
      </div>
      <div class="ss-focused">
        <div class="ss-fh"><span class="ss-fh-l">Holidays on the calendar</span><span class="ss-fh-tag">Admin only</span></div>
        <div class="note-help" style="margin:0 0 12px">Pick which holiday sets appear on everyone's <strong>Weekly</strong> &amp; <strong>Monthly</strong> calendars — shown as quiet, icon-less context. They never appear as tasks.</div>
        ${sets.map(([t,dsc,on])=>`<label class="holiday-set"><span class="hs-x">${chk(on)}</span><span class="hs-b"><span class="hs-t">${t}</span><span class="hs-d">${dsc}</span></span></label>`).join('')}
        <div class="note-help" style="margin:8px 0 0"><strong>Members</strong> worldwide see only the sets enabled here. More country packs can be added later.</div>
        <button class="primary-full" style="margin-top:14px">Save</button>
      </div>
    </div>`;
    return statusbar()+fsHead('Settings',{back:true,icon:'settings'})+body; }
  function newMemberEmpty(){
    const body=`<div class="body" style="display:flex;align-items:center;justify-content:center;padding:24px">
      <div class="empty-welcome"><div class="glyph"><img src="assets/ananda-empty.svg" alt=""></div><h2>You're all set up!</h2><p>An <strong>Admin</strong> hasn't added you to any projects yet. As soon as they add you — or assign you a task — your work will appear right here.</p></div>
    </div>`;
    return statusbar()+appbar()+body; }
  function memberRow(m){ const p=PEOPLE[m.id];
    return `<div class="lrow"><span class="av" style="background:${p.color}">${p.init}</span>
      <div class="info"><div class="t">${esc(m.name)}<span class="role-inline ${m.role==='Admin'?'admin':''}">${m.role}</span></div><div class="s">${esc(m.email)}</div></div>
      <span class="stat ${m.status==='Active'?'active':'susp'}">${m.status}</span>
      <span class="chev">${svg('chevR')}</span></div>`; }
  function teamScreen(){
    let list=`<div class="note-help" style="padding:12px 14px 6px;margin:0">9 people · 2 groups. Tap anyone to manage their <strong>Role</strong>, status, <strong>Access</strong>, and tasks.</div>`;
    MEMBERS.forEach(m=>list+=memberRow(m));
    return statusbar()+fsHead('Team',{back:true,add:'Add member',icon:'team'})+teamTabs('members')+`<div class="body">${list}</div>`; }
  function teamGroups(){
    const grp=(name,members)=>`<div class="gcard"><div class="ghead"><span class="gname">${name}</span><button class="gdel">Delete</button></div>${members.map(([n,on])=>`<label class="chk-row"><span>${n}</span>${chk(on)}</label>`).join('')}</div>`;
    const body=`<div class="body pad">
      <div style="display:flex;gap:9px;margin-bottom:14px"><input placeholder="New group name…" /><button class="addbtn-text">Add group</button></div>
      ${grp('Seva',[['Ada',true],['Lila Devi',true],['Mara',false]])}
      ${grp('Kitchen',[['Lakshmi',true],['Arjuna',false]])}
    </div>`;
    return statusbar()+fsHead('Team',{back:true,icon:'team'})+teamTabs('groups')+body; }
  const GRANTS=[
    {who:"Mara",proj:"Karuna Devi",projColor:"#c8762f",sub:"Marketing",level:"member"},
    {who:"Seva (group)",proj:"Sunday Service",projColor:"#2c64a8",sub:"all",level:"viewer"},
    {who:"Lila Devi",proj:"Karuna Devi",projColor:"#c8762f",sub:"Design",level:"member"},
    {who:"Arjuna",proj:"Sunday Service",projColor:"#2c64a8",sub:"Seva",level:"viewer"},
    {who:"Devi",proj:"Alliance Electric",projColor:"#7a5aa6",sub:"all",level:"member"},
    {who:"Omar",proj:"Karuna Devi",projColor:"#c8762f",sub:"all",level:"viewer"},
  ];
  function sortChip(active,asc){
    const labels={who:'Assignee',proj:'Project',sub:'Sub-project',level:'Role'};
    const arrow=asc?'↑':'↓';
    return `<button class="flt-chip on sort-chip" id="accSortChip"><span class="flt-cv-l">Sort:</span><span>${labels[active]}</span><span class="sort-dir">${arrow}</span><span class="flt-cv">${svg('chevD')}</span></button>`;
  }
  function sortPanel(active,asc){
    const opts=[['who','Assignee'],['proj','Project'],['sub','Sub-project'],['level','Role']];
    const body=opts.map(([k,l])=>`<label class="ck-opt sort-opt ${k===active?'on':''}"><span class="t">${l}</span><span class="sort-dir-pair"><span class="sd ${k===active&&asc?'on':''}">↑ A-Z</span><span class="sd ${k===active&&!asc?'on':''}">↓ Z-A</span></span></label>`).join('');
    const head=`<div class="ms-pop-head"><span class="ms-pop-t">Sort grants by</span></div>`;
    return `<div class="flt-dropdown">${head}<div class="ck-list">${body}</div></div>`;
  }
  function sortGrants(grants,key,asc){
    const lc=s=>(s||'').toLowerCase();
    const acc={who:g=>lc(g.who),proj:g=>lc(g.proj),sub:g=>g.sub==='all'?'~':lc(g.sub),level:g=>lc(g.level)};
    return [...grants].sort((a,b)=>{ const av=acc[key](a),bv=acc[key](b); return av<bv?(asc?-1:1):av>bv?(asc?1:-1):0; });
  }
  function grantsTable(grants,sortKey,sortAsc){
    const arrow=sortAsc?'↑':'↓';
    const th=(k,l,cls)=>`<th class="${k===sortKey?'on':''} ${cls||''}" data-sort="${k}">${l}${k===sortKey?` <span class="sind">${arrow}</span>`:''}</th>`;
    const head=`<thead><tr>${th('who','Who','col-who')}${th('proj','Project','col-proj')}${th('sub','Sub','col-sub')}${th('level','Role','col-role')}<th class="col-act"></th></tr></thead>`;
    const rows=grants.map(g=>`<tr><td class="who">${esc(g.who)}</td><td><span class="proj-pill sm" style="--pc:${g.projColor}"><span class="pp-nm">${esc(g.proj)}</span></span></td><td class="sub">${g.sub==='all'?'<em>all</em>':esc(g.sub)}</td><td><span class="lvl ${g.level}">${g.level}</span></td><td class="act"><button class="gr-x" aria-label="Revoke ${esc(g.who)}">${svg('x')}</button></td></tr>`).join('');
    return `<table class="grants-tbl">${head}<tbody>${rows}</tbody></table>`;
  }
  /* line-art glyphs reused in info popups (no emoji — ever; standard Lucide-style line art) */
  const ICN_KEY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2"/><path d="m16 7 3 3"/><path d="m19 4 2 2"/></svg>';
  const ICN_EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ICN_PLUS_CIRC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>';
  const ICN_GLOBE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13 13 0 0 1 0 18"/><path d="M12 3a13 13 0 0 0 0 18"/></svg>';
  const ICN_PEOPLE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5"/><circle cx="17" cy="7" r="2.4"/><path d="M15 14c2.5 0 4.5 1.2 5 3.2"/></svg>';
  const ICN_PENCIL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l4-1 12-12-3-3L4 17l-1 4z"/><path d="m14 6 3 3"/></svg>';

  const ICN_SCOPE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/></svg>';
  const GRANTS_HELP = { title:'Active grants', rows:[
    [ICN_SCOPE,'Scope','A grant gives someone access to a <strong>Project</strong>, <strong>Sub-project</strong>, or the whole <strong>Organization</strong>.'],
    [ICN_KEY,'Editing privileges','Grants do not determine editing privileges — those are set by the user\u2019s <strong>Role</strong> (<strong>Viewer</strong>, <strong>Member</strong>, or <strong>Admin</strong>). Roles are changed in the <strong>Members</strong> tab.'],
  ] };
  const GRANT_FORM_HELP = { title:'Grant access', rows:[
    [ICN_EYE,'Access first','How much someone sees is set by their <strong>Access</strong> on the <strong>Members</strong> tab.'],
    [ICN_PLUS_CIRC,'This adds scope','A grant just adds a <strong>Project</strong> or <strong>Sub-project</strong> to their existing scope at the chosen level.'],
    [ICN_PEOPLE,'Person or Group','Pick a single Person or an existing Group — the whole Group gets the grant.'],
  ] };
  function teamAccess(){
    const grantRow=(g)=>`<div class="grant-row"><div class="gr-l"><span class="gr-who">${esc(g.who)}</span><span class="gr-meta"><span class="proj-pill" style="--pc:${g.projColor}">${esc(g.proj)}</span><span class="gr-slash">/</span>${g.sub==='all'?`<em class="gr-all">all</em>`:`<span class="gr-sub">${esc(g.sub)}</span>`}</span></div><div class="gr-r"><span class="lvl ${g.level}">${g.level}</span><button class="gr-x" aria-label="Revoke">${svg('x')}</button></div></div>`;
    const picked=['Mara','Lila Devi'];
    const flt=accessFilter(picked);
    const sortKey='who', sortAsc=true;
    const form=`<div class="grant-form">
      <div class="section-title" style="display:flex;align-items:center;gap:1px">Grant access ${lblInfo(GRANT_FORM_HELP)}</div>
      <div class="field" style="margin-bottom:10px"><label>Give access to</label><div class="row2">${sel(['Person','Group'])}${sel(['Select…','Mara','Omar','Seva'])}</div></div>
      <div class="field" style="margin-bottom:10px"><label>To</label><div class="row2">${sel(['Sub-project','Whole project','Organization'])}${sel(['Select…','Karuna Devi / Marketing','Sunday Service'])}</div></div>
      <div class="field" style="margin-bottom:12px"><label>Role</label>${sel(['Member (can edit)','Viewer (read-only)'])}</div>
      <button class="primary-full">Grant access</button></div>`;
    const filtered=sortGrants(GRANTS.filter(g=>picked.some(p=>g.who.startsWith(p))),sortKey,sortAsc);
    const grants=`<div class="grants-head"><h3 class="section-title" style="margin:0;flex:none;display:inline-flex;align-items:center;gap:1px">Active grants <span class="gc-count">${filtered.length}<span class="muted-of"> of ${GRANTS.length}</span></span> ${lblInfo(GRANTS_HELP)}</h3></div>
      <div class="grants-filter-row"><span class="grants-flt-l">Filter</span>${flt.chip}</div>
      ${flt.dropdown}
      ${grantsTable(filtered,sortKey,sortAsc)}`;
    return statusbar()+fsHead('Team',{back:true,icon:'team'})+teamTabs('access')+`<div class="body"><div style="padding:12px 14px 0">${form}</div><div style="padding:18px 14px 22px">${grants}</div></div>`; }

  function teamAccessTable(){
    const grantRow=(g)=>`<div class="grant-row"><div class="gr-l"><span class="gr-who">${esc(g.who)}</span><span class="gr-meta"><span class="proj-pill" style="--pc:${g.projColor}">${esc(g.proj)}</span><span class="gr-slash">/</span>${g.sub==='all'?`<em class="gr-all">all</em>`:`<span class="gr-sub">${esc(g.sub)}</span>`}</span></div><div class="gr-r"><span class="lvl ${g.level}">${g.level}</span><button class="gr-x" aria-label="Revoke">${svg('x')}</button></div></div>`;
    const flt=accessFilter([]);
    const sortKey='who', sortAsc=true;
    const sorted=sortGrants(GRANTS,sortKey,sortAsc);
    const grants=`<div class="grants-head"><h3 class="section-title" style="margin:0;flex:none;display:inline-flex;align-items:center;gap:1px">Active grants <span class="gc-count">${GRANTS.length}</span> ${lblInfo(GRANTS_HELP)}</h3></div>
      <div class="grants-filter-row"><span class="grants-flt-l">Filter</span>${flt.chip}</div>
      ${grantsTable(sorted,sortKey,sortAsc)}`;
    return statusbar()+fsHead('Team',{back:true,icon:'team'})+teamTabs('access')+`<div class="body"><div style="padding:14px 14px 22px">${grants}</div></div>`; }

  function teamAccessFilter(){
    const grantRow=(g)=>`<div class="grant-row"><div class="gr-l"><span class="gr-who">${esc(g.who)}</span><span class="gr-meta"><span class="proj-pill" style="--pc:${g.projColor}">${esc(g.proj)}</span><span class="gr-slash">/</span>${g.sub==='all'?`<em class="gr-all">all</em>`:`<span class="gr-sub">${esc(g.sub)}</span>`}</span></div><div class="gr-r"><span class="lvl ${g.level}">${g.level}</span><button class="gr-x" aria-label="Revoke">${svg('x')}</button></div></div>`;
    const picked=['Seva','Mara'];
    const flt=accessFilter(picked);
    const sortKey='proj', sortAsc=true;
    const filtered=sortGrants(GRANTS.filter(g=>picked.some(p=>g.who.startsWith(p))),sortKey,sortAsc);
    const grants=`<div class="grants-head"><h3 class="section-title" style="margin:0;flex:none;display:inline-flex;align-items:center;gap:1px">Active grants <span class="gc-count">${filtered.length}<span class="muted-of"> of ${GRANTS.length}</span></span> ${lblInfo(GRANTS_HELP)}</h3></div>
      <div class="grants-filter-row"><span class="grants-flt-l">Filter</span>${flt.chip}</div>
      ${flt.dropdown}
      ${grantsTable(filtered,sortKey,sortAsc)}`;
    return statusbar()+fsHead('Team',{back:true,icon:'team'})+teamTabs('access')+`<div class="body"><div style="padding:14px 14px 22px">${grants}</div></div>`; }

  /* canonical multi-select filter chip (Groups at top · Clear when 1+) — mirrors web .ms */
  function msChip(opts){
    const picked = opts.picked||[];
    const flat = opts.sections.flatMap(s=>s.items);
    let lbl;
    if(picked.length===0){ lbl = `<span class="flt-ph">${esc(opts.placeholder)}</span>`; }
    else { const first = flat.find(i=>i.v===picked[0]); lbl = `<span>${esc(first?.label||picked[0])}</span>` + (picked.length>1?`<span class="flt-n">+${picked.length-1}</span>`:''); }
    const chip = `<button class="flt-chip ${picked.length?'on':''}" id="${opts.id}">${lbl}<span class="flt-cv">${svg('chevD')}</span></button>`;
    const list = opts.sections.map(s=>`${s.label?`<div class="ck-sec">${esc(s.label)}</div>`:''}${s.items.map(i=>`<label class="ck-opt"><span class="t">${esc(i.label)}</span>${chk(picked.includes(i.v))}</label>`).join('')}`).join('');
    const head = `<div class="ms-pop-head"><span class="ms-pop-t">${esc(opts.placeholder)}</span>${picked.length?`<button class="ms-clear">Clear</button>`:''}</div>`;
    const dropdown = `<div class="flt-dropdown">${head}<div class="ck-list">${list}</div></div>`;
    return { chip, dropdown };
  }
  function accessFilter(picked){
    return msChip({
      id:'accFltChip',
      placeholder:'Any person',
      sections:[
        { label:'Groups', items:[{v:'Seva',label:'Seva (group)'},{v:'Kitchen',label:'Kitchen (group)'}] },
        { label:'People', items:[{v:'Mara',label:'Mara'},{v:'Lila Devi',label:'Lila Devi'},{v:'Arjuna',label:'Arjuna'},{v:'Devi',label:'Devi'},{v:'Omar',label:'Omar'}] },
      ],
      picked,
    });
  }

  /* ============================================================ PROJECTS */
  function projectsScreen(){
    let list='';
    const meta={karuna:["3 sub-projects · 8 tasks"],sunday:["3 sub-projects · 7 tasks"],alliance:["3 sub-projects · 5 tasks"]};
    for(const [k,p] of Object.entries(PROJECTS)){
      list+=`<div class="lrow"><span class="av sq" style="background:color-mix(in srgb,${p.color} 22%,var(--surface));color:${p.color}">${p.emoji}</span>
        <div class="info"><div class="t">${esc(p.name)}</div><div class="s">${meta[k][0]}</div></div>
        <span class="dot" style="background:${p.color};width:12px;height:12px"></span>
        <span class="chev">${svg('chevR')}</span></div>`; }
    return statusbar()+fsHead('Projects',{back:true,add:'New project',icon:'projects'})+`<div class="body"><div class="sec-label" style="padding:14px 14px 8px">3 active projects</div>${list}</div>`; }

  /* ============================================================ TRASH */
  const ICN_TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M10 11v6M14 11v6"/></svg>';
  const ICN_APPR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11.5l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>';
  function trashScreen(){
    const items=[
      {name:"Send May invoices",sub:"ab",who:["ada"],status:"todo",prio:"Medium",days:28,proj:"alliance"},
      {name:"Old flyer draft",sub:"km",who:["mara"],status:"todo",prio:"Low",days:25,proj:"karuna"},
      {name:"Quarterly safety audit",sub:"as",who:["devi"],status:"todo",prio:"High",days:23,proj:"alliance"},
      {name:"Reorder candles",sub:"km",who:["lila"],status:"doing",prio:"Medium",days:18,proj:"karuna"},
      {name:"Hatha class flyer",sub:"sm",who:["mara","omar"],status:"review",prio:"Low",days:14,proj:"sunday"},
      {name:"Volunteer roster",sub:"sh",who:["seva"],status:"todo",prio:"High",days:9,proj:"sunday"},
      {name:"Old retreat photo set",sub:"km",who:["arun"],status:"done",prio:"Lowest",days:5,proj:"karuna"},
      {name:"Misc draft",sub:"kg",who:["ada"],status:"todo",prio:"Medium",days:2,proj:"karuna"},
    ];
    const n=items.length, soon=items.filter(t=>t.days<=7).length;
    const head=`<div class="bulkbar"><div class="bb-stat"><span class="bb-l">in trash</span>${soon?`<span class="bb-tag">${soon} expiring soon</span>`:''}</div><div class="bb-acts"><button class="bb-link" id="trRestoreAll" disabled>Restore</button><button class="bb-link danger" id="trEmpty" disabled>Delete</button></div></div>
      <div class="flt-row"><label class="ck-row sel-all"><input type="checkbox" id="trAll"><span class="bx">${svg('check')}</span><span class="sel-l">Select all</span></label>${csSelect(['Newest','Expiration','Priority','Name A–Z'],'Newest','flt-sel')}${csSelect(['All projects','Karuna Devi','Sunday Service','Alliance Electric'],'All projects','flt-sel')}</div>`;
    let rows=`<div class="clist">`;
    items.forEach((t,i)=>{ const s=SUBS[t.sub],p=PROJECTS[t.proj],st=STATUS[t.status];
      rows+=`<div class="crow"><label class="ck-row"><input type="checkbox" class="trChk"><span class="bx">${svg('check')}</span></label>
        <div class="cmid"><div class="cnm"><span class="prio" title="Priority: ${t.prio}">${M.PRIO_ICON[t.prio]||''}</span>${esc(t.name)}</div>
        <div class="csub2"><span class="proj-pill" style="--pc:${p.color}">${esc(p.name)}</span><span class="gc-sep">/</span><span>${esc(s.name)}</span><span class="csep">·</span><span class="csoft">${t.days}d left</span></div></div>
        ${avStack(t.who,22)}<button class="crow-act">Restore</button></div>`; });
    rows+=`</div>`;
    const bulkBar=`<div class="bulk-action" id="trBulk" hidden><span class="ba-n"><span id="trN">0</span> selected</span><div class="ba-acts"><button class="ba-secondary" id="trDel">Delete</button><button class="ba-primary" id="trRestoreSel">Restore</button></div></div>`;
    return statusbar()+fsHead('Trash',{back:true,icon:'trash'})+`<div class="body"><div style="padding:12px 14px 0">${head}${rows}</div></div>${bulkBar}`; }

  /* ============================================================ APPROVALS */
  function approvalsScreen(){
    const cards=[
      {name:"Design spring flyer",proj:"karuna",sub:"km",who:["mara"],status:"doing",prio:"High",by:"Mara",kind:"new"},
      {name:"Stock count — spring supplies",proj:"karuna",sub:"kw",who:["mara","ada"],status:"todo",prio:"Medium",by:"Ada",kind:"edit"},
      {name:"Wire community kitchen",proj:"alliance",sub:"af",who:["arun","devi"],status:"doing",prio:"High",by:"Arun",kind:"edit"},
      {name:"Print A2 banner",proj:"karuna",sub:"km",who:["mara"],status:"todo",prio:"Highest",by:"Mara",kind:"new"},
      {name:"Order extra chairs",proj:"sunday",sub:"sh",who:["lila"],status:"todo",prio:"Medium",by:"Lila",kind:"new"},
      {name:"Update billing terms",proj:"alliance",sub:"ab",who:["ada"],status:"review",prio:"Low",by:"Ada",kind:"edit"},
      {name:"Choir set list — Jun",proj:"sunday",sub:"sm",who:["gita","nitai"],status:"todo",prio:"Medium",by:"Gita",kind:"new"},
    ];
    const n=cards.length, news=cards.filter(c=>c.kind==='new').length, edits=cards.filter(c=>c.kind==='edit').length;
    const head=`<div class="bulkbar"><div class="bb-stat"><span class="bb-l">pending</span><span class="bb-tag">${news} new</span><span class="bb-tag">${edits} edits</span></div><div class="bb-acts"><button class="bb-link" id="apApproveAll" disabled>Approve</button><button class="bb-link danger" id="apRejectAll" disabled>Reject</button></div></div>
      <div class="flt-row"><label class="ck-row sel-all"><input type="checkbox" id="apAll"><span class="bx">${svg('check')}</span><span class="sel-l">Select all</span></label>${csSelect(['Oldest first','Newest first','Priority'],'Oldest first','flt-sel')}${csSelect(['All kinds','New tasks','Edits'],'All kinds','flt-sel')}</div>`;
    let rows=`<div class="clist">`;
    cards.forEach(c=>{ const p=PROJECTS[c.proj],s=SUBS[c.sub];
      rows+=`<div class="crow appr-row"><label class="ck-row"><input type="checkbox" class="apChk"><span class="bx">${svg('check')}</span></label>
        <div class="cmid"><div class="cnm"><span class="prio">${M.PRIO_ICON[c.prio]||''}</span><span class="appr-kind ${c.kind}">${c.kind==='new'?'NEW':'EDIT'}</span>${esc(c.name)}</div>
        <div class="csub2"><span class="proj-pill" style="--pc:${p.color}">${esc(p.name)}</span><span class="gc-sep">/</span><span>${esc(s.name)}</span><span class="csep">·</span><span class="csoft">by ${c.by}</span></div></div>
        <div class="appr-acts"><button class="ok-sm" title="Approve">${svg('check')}</button><button class="no-sm" title="Reject">${svg('x')}</button></div></div>`; });
    rows+=`</div>`;
    const bulkBar=`<div class="bulk-action" id="apBulk" hidden><span class="ba-n"><span id="apN">0</span> selected</span><div class="ba-acts"><button class="ba-secondary" id="apRejSel">Reject</button><button class="ba-primary" id="apAppSel">Approve</button></div></div>`;
    return statusbar()+fsHead('Approvals',{back:true,icon:'approvals'})+`<div class="body"><div style="padding:12px 14px 0">${head}${rows}</div></div>${bulkBar}`; }

  /* ============================================================ MONTHLY day sheet */
  function daySheet(){
    const ids=[8]; const byId=Object.fromEntries(TASKS.map(t=>[t.id,t]));
    const hols=(M.HOLIDAYS["2026-06-06"]||[]);
    const holHtml=hols.map(h=>`<div class="cal-event holiday">${M.ICN_STAR}<span>${esc(h)}</span></div>`).join('');
    const rows=ids.map(id=>M.compactRow(byId[id])).join('');
    const sheet=`<div style="position:absolute;inset:0;z-index:30">
      <div style="position:absolute;inset:0;background:rgba(13,21,38,.45)"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:20px 20px 0 0;box-shadow:var(--shadow-pop);display:flex;flex-direction:column;max-height:80%">
        <div class="sheet-grab"><i></i></div>
        <div class="sheet-head" style="border-radius:20px 20px 0 0"><h2>Friday, Jun 6</h2><button class="x">${svg('x')}</button></div>
        <div style="overflow-y:auto">${holHtml?`<div style="padding:11px 14px 2px">${holHtml}</div>`:''}<div class="sec-label" style="padding:12px 14px 4px">1 task due</div>${rows}</div>
      </div></div>`;
    return M.monthlyScreen()+sheet; }

  /* ============================================================ ALT NAV (variation B): top segmented + overflow, no bottom bar */
  function altNavScreen(){
    const ab=`<div class="appbar">
      <button class="ic" aria-label="Menu">${svg('menu')}</button>
      <div class="title"><img class="mark" src="assets/ananda-mark.png" alt=""><span class="nm">Global Overview</span></div>
      <button class="ic" aria-label="Search">${svg('search')}</button>
      <button class="ic" aria-label="More">${svg('plus')}</button>
    </div>`;
    const viewbar=`<div style="display:flex;align-items:center;gap:9px;padding:10px 12px;background:var(--canvas);border-bottom:1px solid var(--border)">
      <div class="seg" style="flex:1;background:var(--sunk)">
        <button class="on">List</button><button>Board</button><button>Weekly</button><button>Monthly</button>
      </div>
      <button class="ic" style="width:40px;height:40px;border-radius:var(--r-ctl);background:var(--surface);border:1px solid var(--border);display:grid;place-items:center">${svg('filter')}</button>
    </div>`;
    let body=`<div class="body pad">`; TASKS.slice(0,5).forEach(t=>body+=cardMini(t)); body+=`</div>`;
    return statusbar()+ab+chips('global')+viewbar+body; }

  function assigneePicker(){
    const row=(id,on)=>{const p=PEOPLE[id];return `<div class="pick-row ${on?'on':''}"><span class="av" style="background:${p.color}">${p.init}</span><div class="info"><div class="t">${p.name}${id==='ada'?' Devi':''}</div></div><span class="ck">${svg('check')}</span></div>`;};
    const indiv=['mara','omar','ada','nitai','lila','gita','arun','tara','devi'];
    const sheet=`<div style="position:absolute;inset:0;z-index:30">
      <div style="position:absolute;inset:0;background:rgba(13,21,38,.45)"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;top:60px;background:var(--surface);border-radius:20px 20px 0 0;box-shadow:var(--shadow-pop);display:flex;flex-direction:column">
        <div class="sheet-grab"><i></i></div>
        <div class="sheet-head" style="border-radius:20px 20px 0 0"><h2>Filter by assignee</h2><button class="x">${svg('x')}</button></div>
        <div class="searchbar"><div class="box">${svg('search')}<input placeholder="Search people & groups…" /></div></div>
        <div style="overflow-y:auto;flex:1">
          <div class="pick-row"><span class="av" style="background:var(--sunk);color:var(--muted)">${svg('team')}</span><div class="info"><div class="t">Anyone</div></div><span class="ck">${svg('check')}</span></div>
          <div class="pick-row"><span class="av" style="background:var(--sunk);color:var(--faint);font-family:var(--f-ui);font-size:16px">—</span><div class="info"><div class="t">Unassigned</div></div><span class="ck">${svg('check')}</span></div>
          <div class="sec-label" style="padding:14px 14px 6px">Groups</div>
          <div class="pick-row"><span class="av grp">◇</span><div class="info"><div class="t">Seva Team</div><div class="s">Rotating volunteers · 6 members</div></div><span class="ck">${svg('check')}</span></div>
          <div class="sec-label" style="padding:14px 14px 6px">Individuals</div>
          ${indiv.map(id=>row(id,id==='mara')).join('')}
        </div>
      </div></div>`;
    return M.listCompact()+sheet; }

  /* ============================================================ TEAM / PROJECT workflow screens */
  function personDetail(){
    const tasks=[1,3]; const byId=Object.fromEntries(TASKS.map(t=>[t.id,t]));
    const hdr=`<div class="profile"><span class="pav" style="background:${PEOPLE.mara.color}">MA</span>
      <div><div class="pname">Mara <button class="namepen" aria-label="Edit name">${svg('pen')}</button></div><div class="prole">Member · joined Apr 2025</div>
      <div class="pmail">${svg('mail')} mara@ananda.org</div></div></div>`;
    const access=`<div style="padding:14px 14px 0">
      <div class="row2" style="display:grid;grid-template-columns:1fr 1fr;gap:11px">
        <div><div class="sec-label" style="margin:0 0 8px">Role ${lblInfo(ROLE_HELP)}</div>${sel(['Viewer','Member','Admin'])}</div>
        <div><div class="sec-label" style="margin:0 0 8px">Status</div>${sel(['Active','Suspended'])}</div>
      </div>
      <button class="reset-pw" style="margin-top:12px">Reset password</button>
      <div style="margin-top:14px"><div class="sec-label" style="margin:0 0 8px">Access ${lblInfo(VA_HELP)}</div>${sel(['Tasks Only','Sub-Project Only','Full Project','Organization'])}</div>
      <div class="sec-label">Project access</div>
      <div class="chips2"><span class="chip2"><span class="dot" style="background:${PROJECTS.karuna.color}"></span>Karuna Devi</span><span class="chip2 add">+ Add</span></div></div>`;
    let at=`<div class="sec-label" style="padding:18px 14px 6px">Assigned tasks · 2</div>`;
    tasks.forEach(id=>at+=M.compactRow(byId[id]));
    const danger=`<div style="padding:18px 14px"><button class="danger-full">Remove from team</button></div>`;
    return statusbar()+fsHead('Mara',{back:true})+`<div class="body">${hdr}${access}${at}${danger}</div>`; }

  function addMember(){
    const body=`<div class="body pad">
      ${field('Name','<input placeholder="Full name" />')}
      ${field('Email','<input type="email" placeholder="name@ananda.test" />')}
      ${field('Role '+lblInfo(ROLE_HELP),sel(['Viewer','Member','Admin']))}
      ${field('Access '+lblInfo(VA_HELP),sel(['Tasks Only','Sub-Project Only','Full Project','Organization']))}
      <div class="field"><label>Add to projects <span style="color:var(--faint);font-weight:400">(optional)</span></label>
        <div class="ck-list"><div class="ck-sec">Karuna Devi</div><label class="ck-opt"><span class="t">Marketing</span>${chk(false)}</label><label class="ck-opt"><span class="t">Design</span>${chk(false)}</label><div class="ck-sec">Sunday Service</div><label class="ck-opt"><span class="t">Seva</span>${chk(false)}</label></div></div>
      ${field('Starting password','<input value="JaiGuru_108!" />')}
      <div class="note-help" style="margin:-4px 0 14px">Share the email + password with them directly. <strong>Admins</strong> see everything; <strong>Members</strong> see only what they’re assigned or granted.</div>
      <button class="primary-full">Add member</button>
    </div>`;
    return statusbar()+fsHead('Add member',{back:true,icon:'plus'})+body; }

  function projectDetail(){
    const p=PROJECTS.karuna;
    const subs=Object.entries(SUBS).filter(([k,s])=>s.proj==='karuna');
    const counts={km:4,kw:2,kg:2};
    const hdr=`<div class="profile"><span class="pav sq" style="background:color-mix(in srgb,${p.color} 22%,var(--surface));color:${p.color}">${p.emoji}</span>
      <div><div class="pname">Karuna Devi <button class="namepen" aria-label="Edit name">${svg('pen')}</button></div><div class="prole">3 sub-projects · 8 tasks · 5 members</div></div></div>`;
    let subList=`<div class="sec-label" style="padding:16px 14px 6px">Sub-projects</div>`;
    subs.forEach(([k,s])=>subList+=`<div class="lrow"><span class="dot" style="background:${s.color};width:14px;height:14px"></span><div class="info"><div class="t">${esc(s.name)}</div></div><span class="role">${counts[k]} tasks</span><span class="chev">${svg('chevR')}</span></div>`);
    subList+=`<div class="lrow"><span class="dot" style="background:var(--sunk);width:14px;height:14px"></span><div class="info"><div class="t" style="color:var(--muted)">Add sub-project…</div></div></div>`;
    const members=`<div class="sec-label" style="padding:16px 14px 8px">Members</div><div style="padding:0 14px 10px">${avStack(['mara','omar','ada','lila'],30)}</div>`;
    const danger=`<div style="padding:16px 14px"><button class="danger-full">Archive project</button></div>`;
    return statusbar()+fsHead('Karuna Devi',{back:true})+`<div class="body">${hdr}${subList}${members}${danger}</div>`; }

  function emojiPickerOverlay(){
    const cats=[
      ['Suggested','🎨 🙏 ⚡ 🌱 📚 🎵 🛠️ 🏠 🌸 🔔 ✨ 🪷'],
      ['Smileys','😀 😊 🙂 😇 🤗 😌 🥰 😎 🙏 🤝 💪 👏'],
      ['Objects','📌 📎 ✂️ 🔑 💡 📷 🎁 🛒 📦 🧰 🧹 🪑'],
      ['Nature','🌸 🌿 🍃 🌻 🌳 🔥 💧 ⛰️ 🌊 ☀️ 🌙 ⭐'],
      ['Symbols','❤️ ⭐ ✅ ⚠️ ♻️ 🔆 🎯 🚩 🔷 🔶 ⬛ ⬜'],
    ];
    const tabs=cats.map(([n],i)=>`<button class="${i===0?'on':''}">${n}</button>`).join('');
    let grid=''; cats.forEach(([n,em])=>{ grid+=`<div class="ep-cat">${n}</div>`; em.split(' ').forEach(e=>grid+=`<button class="ep-cell ${e==='🎨'?'on':''}">${e}</button>`); });
    return `<div style="position:absolute;inset:0;z-index:30">
      <div style="position:absolute;inset:0;background:rgba(13,21,38,.45)"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:20px 20px 0 0;box-shadow:var(--shadow-pop);display:flex;flex-direction:column;max-height:72%">
        <div class="sheet-grab"><i></i></div>
        <div class="sheet-head" style="border-radius:20px 20px 0 0;padding-bottom:10px"><h2>Choose an icon</h2><button class="x">${svg('x')}</button></div>
        <div class="searchbar"><div class="box">${svg('search')}<input placeholder="Search emoji…" /></div></div>
        <div class="ep-tabs">${tabs}</div>
        <div class="ep-grid">${grid}</div>
      </div></div>`; }
  function newProject(){
    const palette=['#c8762f','#2f7d74','#7a5aa6','#2563a8','#b4452f','#4f7a3c','#b7791f','#a23e6e'];
    const sw=`<div class="swatches">${palette.map((c,i)=>`<button class="sw ${i===0?'on':''}" style="background:${c}"></button>`).join('')}<button class="sw custom">+</button></div>`;
    const iconBtn=`<button class="pbtn"><span class="prico" style="font-size:19px;line-height:1">🎨</span><span class="pl">Choose an icon</span><span class="cv">${svg('chevD')}</span></button>`;
    const body=`<div class="body pad">
      ${field('Project name','<input placeholder="e.g. Community Garden" />')}
      <div class="field"><label>Color</label>${sw}</div>
      <div class="field"><label>Icon</label>${iconBtn}</div>
      ${field('First sub-project','<input value="General" />')}
      <button class="primary-full" style="margin-top:10px">Create project</button>
    </div>`;
    return statusbar()+fsHead('New project',{back:true,icon:'plus'})+body+emojiPickerOverlay(); }

  window.M = Object.assign(window.M, {
    overflowScreen, filterSheet, searchScreen, taskDetail, newTask,
    teamScreen, teamGroups, teamAccess, teamAccessTable, teamAccessFilter, settingsHolidays, newMemberEmpty, projectsScreen, trashScreen, approvalsScreen, daySheet, assigneePicker, altNavScreen, cardMini,
    personDetail, addMember, projectDetail, newProject,
  });
})();
