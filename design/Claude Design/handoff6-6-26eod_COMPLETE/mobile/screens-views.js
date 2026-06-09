/* =============================================================
   Ananda Taskboard — MOBILE screen builders (part 1)
   Plain JS. Each builder returns the inner HTML of a .phone frame
   (statusbar + appbar + … + tabbar as direct children). The canvas
   wraps the string in <div class="phone" [data-theme]> via React.
   Exposes window.M with chrome helpers + the four view screens.
   ============================================================= */
(function () {
  /* ---------- data (subset of the real board) ---------- */
  const PEOPLE = {
    mara:{name:"Mara",init:"MA",color:"#c8762f"}, omar:{name:"Omar",init:"OM",color:"#2563a8"},
    ada:{name:"Ada",init:"AD",color:"#1e3a6e"}, nitai:{name:"Nitai",init:"NI",color:"#2f7d74"},
    lila:{name:"Lila",init:"LI",color:"#a23e6e"}, gita:{name:"Gita",init:"GI",color:"#7a5aa6"},
    arun:{name:"Arun",init:"AR",color:"#4f7a3c"}, tara:{name:"Tara",init:"TA",color:"#b7791f"},
    devi:{name:"Devi",init:"DE",color:"#3f8e8e"}, seva:{name:"Seva",init:"◇",color:"#1e3a6e",group:true},
  };
  const PROJECTS = {
    karuna:{name:"Karuna Devi",color:"#c8762f",emoji:"🎨"},
    sunday:{name:"Sunday Service",color:"#2f7d74",emoji:"🙏"},
    alliance:{name:"Alliance Electric",color:"#7a5aa6",emoji:"⚡"},
  };
  const SUBS = {
    km:{proj:"karuna",name:"Marketing",color:"#c8762f"}, kw:{proj:"karuna",name:"Warehouse",color:"#b4452f"},
    kg:{proj:"karuna",name:"General",color:"#6b7280"}, sg:{proj:"sunday",name:"General",color:"#2f7d74"},
    sm:{proj:"sunday",name:"Music",color:"#2563a8"}, sh:{proj:"sunday",name:"Hospitality",color:"#4f7a3c"},
    af:{proj:"alliance",name:"Field Ops",color:"#7a5aa6"}, ab:{proj:"alliance",name:"Billing",color:"#b7791f"},
    as:{proj:"alliance",name:"Safety",color:"#a23e6e"},
  };
  const STATUS = {
    todo:{name:"To Do",color:"var(--todo)"}, doing:{name:"In Progress",color:"var(--doing)"},
    delayed:{name:"Delayed",color:"var(--delayed)"}, review:{name:"Review",color:"var(--review)"}, done:{name:"Done",color:"var(--done)"},
  };
  const STATUS_ORDER = ["todo","doing","delayed","review","done"];
  // priority chevrons — ported verbatim from desktop PRIO_ICON
  const PRIO_ICON={
    Highest:'<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,11 7,6 12,11" stroke="var(--danger)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="2,7 7,2 12,7" stroke="var(--danger)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    High:'<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,9 7,4 12,9" stroke="#c2762a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    Medium:'<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="3,5 11,5" stroke="var(--warn)" stroke-width="2" fill="none" stroke-linecap="round"/><polyline points="3,9 11,9" stroke="var(--warn)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    Low:'<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,5 7,10 12,5" stroke="#5a86c2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    Lowest:'<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,3 7,8 12,3" stroke="#5a86c2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="2,7 7,12 12,7" stroke="#5a86c2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const prio = p => `<span class="prio" title="Priority: ${p||'Medium'}">${PRIO_ICON[p||'Medium']}</span>`;
  const TASKS = [
    {id:2, name:"Send newsletter", sub:"km", who:["omar"], status:"todo", due:"2026-06-02", priority:"High"},
    {id:14, name:"Replace breaker panel", sub:"af", who:["arun"], status:"delayed", due:"2026-06-02", priority:"Highest"},
    {id:3, name:"Stock count — spring supplies", sub:"kw", who:["mara","ada"], status:"todo", due:"2026-06-04", rec:"weekly", priority:"Medium"},
    {id:16, name:"Tune harmonium", sub:"sm", who:["gita"], status:"todo", due:"2026-06-04", priority:"Low"},
    {id:8, name:"Rehearse Sunday chants", sub:"sm", who:["gita","nitai"], status:"doing", due:"2026-06-06", rec:"weekly", priority:"Medium"},
    {id:1, name:"Design spring flyer", sub:"km", who:["mara"], status:"doing", due:"2026-06-14", monitor:true, priority:"High", created:"2026-05-18"},
    {id:19, name:"Plan summer retreat", sub:"kg", who:["mara","lila","omar"], status:"review", due:"2026-06-30", priority:"Medium"},
    {id:4, name:"Weekly service prep", sub:"sg", who:["seva"], status:"done", due:null, rec:"weekly", priority:"Lowest"},
  ];
  const TODAY = new Date(2026,5,3);
  const d = s => s ? new Date(s+"T00:00:00") : null;
  const daysTo = due => due ? Math.round((d(due)-TODAY)/86400000) : null;
  const taskFlags = t => { const dt=daysTo(t.due); const a=t.status!=="done";
    return { overdue:a&&dt!==null&&dt<0, soon:a&&dt!==null&&(dt===0||dt===1) }; };
  const fmtDate = s => s ? d(s).toLocaleDateString("en-US",{month:"short",day:"2-digit"}) : "—";
  const esc = s => (s+"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  /* Calendar marker icons — megaphone for Announcements, star for Holidays */
  const ICN_MEGA='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 0 0 2 2h2l8 5V4L7 9H5a2 2 0 0 0-2 2z"/><path d="M16.8 8.6a4 4 0 0 1 0 6.8"/></svg>';
  const ICN_STAR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 14.6 8.6 20.7 9.4 16.2 13.6 17.4 19.7 12 16.7 6.6 19.7 7.8 13.6 3.3 9.4 9.4 8.6 Z"/></svg>';

  /* auto holidays — quiet, icon-less context (US federal/observances, Christian, Hindu/yoga, Ananda lineage) */
  const HOLIDAYS = {
    "2026-06-05":["World Environment Day"],
    "2026-06-06":["Foundation of Ananda","Trinity Sunday"],
    "2026-06-07":["St. Columba"],
    "2026-06-14":["Flag Day"],
    "2026-06-19":["Juneteenth"],
    "2026-06-21":["Father's Day","Summer Solstice","World Music Day"],
  };
  function dayItems(isoStr, ev){ const out=[]; if(ev) out.push({holiday:false,text:ev}); (HOLIDAYS[isoStr]||[]).forEach(h=>out.push({holiday:true,text:h})); return out; }

  /* ---------- icons ---------- */
  const I = {
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    back:'<path d="M15 5l-7 7 7 7"/>',
    x:'<path d="M6 6l12 12M18 6L6 18"/>',
    chevR:'<path d="M9 5l7 7-7 7"/>',
    chevL:'<path d="M15 5l-7 7 7 7"/>',
    chevD:'<path d="M6 9l6 6 6-6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    list:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="3.6" cy="6" r="1.3"/><circle cx="3.6" cy="12" r="1.3"/><circle cx="3.6" cy="18" r="1.3"/>',
    board:'<rect x="3.5" y="4" width="5" height="16" rx="1.4"/><rect x="10" y="4" width="5" height="11" rx="1.4"/><rect x="16.5" y="4" width="4.5" height="14" rx="1.4"/>',
    week:'<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v3M16 3v3M8.5 14h7"/>',
    month:'<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/><circle cx="8" cy="13.5" r="1"/><circle cx="12" cy="13.5" r="1"/><circle cx="16" cy="13.5" r="1"/>',
    approvals:'<circle cx="12" cy="12" r="9"/><path d="M8.2 12.3l2.5 2.5 5.1-5.6"/>',
    team:'<circle cx="9" cy="8" r="3.2"/><path d="M2.8 19c.7-3.1 3.2-4.8 6.2-4.8s5.5 1.7 6.2 4.8"/><path d="M16.5 5.2a3 3 0 0 1 0 5.7"/><path d="M18 14.4c1.9.6 3.3 2.1 3.7 4.3"/>',
    trash:'<path d="M4 7h16M9.5 7V5.4A1.4 1.4 0 0 1 11 4h2a1.4 1.4 0 0 1 1.5 1.4V7M6.5 7l.9 12.1A1.8 1.8 0 0 0 9.2 21h5.6a1.8 1.8 0 0 0 1.8-1.9L17.5 7M10 11v6M14 11v6"/>',
    projects:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
    filter:'<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
    moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
    check:'<path d="M5 12.5l4 4 10-10"/>',
    share:'<circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="5.5" r="2.4"/><circle cx="17" cy="18.5" r="2.4"/><path d="M8.1 10.9l6.8-4M8.1 13.1l6.8 4"/>',
    bell:'<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M9.5 20a2.5 2.5 0 0 0 5 0"/>',
    copy:'<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5"/>',
    dl:'<path d="M12 4v10.5M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    kebab:'<circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    logout:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
    pen:'<path d="M14 5.5l4.5 4.5"/><path d="M4 20l1-4L16 5a2 2 0 0 1 3 3L8 19z"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/>',
  };
  const svg = (p,cls)=>`<svg viewBox="0 0 24 24" ${cls?`class="${cls}"`:""}>${I[p]}</svg>`;

  /* ---------- atoms ---------- */
  const av = (id,sz)=>{ const p=PEOPLE[id]; const s=sz||24;
    return `<span class="av" style="background:${p.color};width:${s}px;height:${s}px;font-size:${Math.round(s*0.4)}px">${p.group?'◇':p.init}</span>`; };
  function avStack(who,sz){ let h=`<span class="avstack">`; who.slice(0,3).forEach(id=>h+=av(id,sz));
    if(who.length>3) h+=`<span class="av" style="background:var(--faint);width:${sz||24}px;height:${sz||24}px;font-size:${Math.round((sz||24)*0.4)}px">+${who.length-3}</span>`;
    return h+`</span>`; }
  function whoChips(who){ let h=`<span class="who">`; who.forEach(id=>{const p=PEOPLE[id];
    h += p.group ? `<span class="chip group">◇ ${esc(p.name)}</span>`
      : `<span class="chip"><span class="av" style="background:${p.color}">${p.init}</span>${esc(p.name)}</span>`; });
    return h+`</span>`; }
  const statusPill = st => `<span class="pill status-pill" style="--sc:${st.color}"><span class="dot" style="background:${st.color}"></span>${esc(st.name)}</span>`;
  // overdue / due-soon icons — ported verbatim from the desktop board so the
  // two states read identically across web + mobile.
  const WARN_W='<svg class="bmk" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" style="fill:var(--danger)"/><path d="M12 6.3v7.3" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="17.7" r="1.5" fill="#fff"/></svg>';
  const CLK_W='<svg class="bmk" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" style="fill:var(--bar-soon)"/><circle cx="12" cy="12.3" r="5.1" fill="none" stroke="#3a2a00" stroke-width="1.7"/><path d="M12 9.4v3l1.9 1.2" fill="none" stroke="#3a2a00" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const flagFor = fl => fl.overdue?WARN_W:fl.soon?CLK_W:"";

  /* ============================================================ CHROME */
  const statusbar = () => `<div class="statusbar"><span class="mono">9:41</span><span class="sb-r">
    <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="4.5" y="5" width="3" height="7" rx="1"/><rect x="9" y="2.5" width="3" height="9.5" rx="1"/><rect x="13.5" y="0" width="3" height="12" rx="1"/></svg>
    <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2.6c2.2 0 4.2.8 5.7 2.2l1.4-1.5A10.3 10.3 0 0 0 8.5.5 10.3 10.3 0 0 0 1.4 3.3l1.4 1.5A8.2 8.2 0 0 1 8.5 2.6z" opacity=".9"/><path d="M8.5 6c1.2 0 2.3.5 3.1 1.2l1.4-1.5A7 7 0 0 0 8.5 4 7 7 0 0 0 4 5.7l1.4 1.5A4.6 4.6 0 0 1 8.5 6z" opacity=".9"/><circle cx="8.5" cy="10" r="1.8"/></svg>
    <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke="currentColor" stroke-opacity=".5"/><rect x="3" y="3" width="16" height="7" rx="1.5" fill="currentColor"/><rect x="23" y="4.5" width="2" height="4" rx="1" fill="currentColor" fill-opacity=".5"/></svg>
  </span></div>`;

  function appbar(opt){ opt=opt||{}; const p=opt.proj?PROJECTS[opt.proj]:null;
    const title = p ? `<span class="pemoji">${p.emoji}</span><span class="nm">${esc(p.name)}</span>`
                    : `<img class="mark" src="assets/ananda-mark.png" alt=""><span class="brandcol"><span class="nm">Ananda <b>Taskboard</b></span><span class="tagline">Love &amp; Blessings from Ananda LA</span></span>`;
    return `<div class="appbar">
      <div class="title">${title}</div>
      <button class="ic" aria-label="Search">${svg('search')}</button>
      <button class="ic primary" aria-label="New task">${svg('plus')}</button>
      <button class="ic kebab" aria-label="More"><svg viewBox="0 0 24 24">${I.kebab}</svg></button>
    </div>`; }

  // segmented view switcher + filter (nav B)
  function viewbar(active){ const items=[["list","List"],["board","Board"],["weekly","Weekly"],["monthly","Monthly"]];
    return `<div class="viewbar2"><div class="seg">${items.map(([k,l])=>`<button class="${k===active?'on':''}">${l}</button>`).join('')}</div>
      <button class="fbtn" aria-label="Filter">${svg('filter')}</button></div>`; }

  function chips(active){ let h=`<div class="chips">`;
    h += `<button class="chip-p ${active==='global'?'on':''}" style="--pc:var(--muted)"><span class="pemoji">🌐</span>Global <span class="count">20</span></button>`;
    const cn={karuna:8,sunday:7,alliance:5};
    for(const [k,p] of Object.entries(PROJECTS))
      h += `<button class="chip-p ${active===k?'on':''}" style="--pc:${p.color}"><span class="pemoji">${p.emoji}</span>${esc(p.name)} <span class="count">${cn[k]}</span></button>`;
    return h+`</div>`; }

  function subchips(proj,active){ const subs=Object.entries(SUBS).filter(([k,s])=>s.proj===proj);
    let h=`<div class="subchips"><button class="subchip ${active==='all'?'on':''}">All sub-projects</button>`;
    subs.forEach(([k,s])=>h+=`<button class="subchip ${active===k?'on':''}"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</button>`);
    return h+`</div>`; }

  const summary = () => `<div class="msum">
    <div class="it"><span class="n">20</span><span class="l">tasks</span></div>
    <div class="it alert"><span class="n">2</span><span class="l">overdue</span></div>
    <div class="it soon"><span class="n">2</span><span class="l">due soon</span></div>
    <div class="it" style="gap:12px">
      <span class="st"><span class="dot" style="background:var(--todo)"></span><span class="n">8</span></span>
      <span class="st"><span class="dot" style="background:var(--doing)"></span><span class="n">5</span></span>
      <span class="st"><span class="dot" style="background:var(--delayed)"></span><span class="n">2</span></span>
      <span class="st"><span class="dot" style="background:var(--review)"></span><span class="n">2</span></span>
      <span class="st"><span class="dot" style="background:var(--done)"></span><span class="n">3</span></span>
    </div></div>`;

  function bottomNav(active){ const items=[["list","List"],["board","Board"],["weekly","Weekly"],["monthly","Monthly"]];
    let h=`<div class="tabbar">`;
    items.forEach(([k,l])=>h+=`<button class="tb ${active===k?'on':''}">${svg(k==='list'?'list':k==='board'?'board':k==='weekly'?'week':'month')}<span class="lab">${l}</span></button>`);
    return h+`</div>`; }

  const fab = () => `<button class="fab" aria-label="New task">${svg('plus')}</button>`;

  /* ============================================================ LIST view */
  function taskCard(t){ const fl=taskFlags(t), s=SUBS[t.sub], p=PROJECTS[s.proj], st=STATUS[t.status];
    const cls=[t.status==='done'?'done':'',fl.overdue?'overdue':'',fl.soon?'soon':''].filter(Boolean).join(' ');
    const dcls=fl.overdue?'od':fl.soon?'soon':(t.due?'':'none');
    return `<div class="tcard ${cls}">
      <div class="tc-top">${prio(t.priority)}<span class="tc-name">${esc(t.name)}</span>${flagFor(fl)}${t.monitor?`<span class="monitor">◉</span>`:''}</div>
      <div class="tc-meta">${statusPill(st)}<span class="proj-pill sm" style="--pc:${p.color}"><span class="pp-nm">${esc(p.name)}</span></span><span class="proj-pill sm" style="--pc:${s.color}"><span class="pp-nm">${esc(s.name)}</span></span></div>
      <div class="tc-foot"><span class="left">${avStack(t.who,24)}${t.rec?`<span class="recurs"><span class="rc">↻</span>${esc(t.rec)}</span>`:''}</span>
        <span class="dl cell-date ${dcls}">${dcls?svg('clock'):''}${fmtDate(t.due)}</span></div>
    </div>`; }

  function listScreen(){ const list=TASKS;
    let body=`<div class="body pad">`; list.forEach(t=>body+=taskCard(t)); body+=`</div>`;
    return statusbar()+appbar()+chips('global')+viewbar('list')+summary()+body; }

  /* compact-row variant with day dividers */
  function compactRow(t,opt){ opt=opt||{}; const fl=taskFlags(t),s=SUBS[t.sub],p=PROJECTS[s.proj],st=STATUS[t.status];
    const dcls=fl.overdue?'od':fl.soon?'soon':(t.due?'':'none');
    const cls=[t.status==='done'?'done':'',fl.overdue?'overdue':'',fl.soon?'soon':''].filter(Boolean).join(' ');
    const meta = opt.agenda ? (t.time?`<span class="cell-time">${t.time}</span>`:'')
                            : `<span class="cell-date ${dcls}">${fmtDate(t.due)}</span>`;
    return `<div class="trow ${cls}" style="--sc:${st.color}">
      <span class="stbar"></span>
      <div class="mid"><div class="nm">${prio(t.priority)}${esc(t.name)}${flagFor(fl)}</div>
        <div class="sub2"><span class="proj-pill sm" style="--pc:${p.color}"><span class="pp-nm">${esc(p.name)}</span></span><span class="proj-pill sm" style="--pc:${s.color}"><span class="pp-nm">${esc(s.name)}</span></span>${meta}${t.rec?`<span class="recurs"><span class="rc">↻</span></span>`:''}</div></div>
      ${avStack(t.who,22)}
      <span class="chev">${svg('chevR')}</span></div>`; }
  function listCompact(){
    const groups=[["Overdue",[2,14]],["Today · Jun 3",[]],["Due soon",[3,16]],["This week",[8]],["Later",[1,19]],["Done",[4]]];
    const byId=Object.fromEntries(TASKS.map(t=>[t.id,t]));
    let body=`<div class="body">`;
    groups.forEach(([label,ids])=>{ if(!ids.length && label!=="Today · Jun 3") return;
      body+=`<div style="padding:0 14px"><div class="daydiv">${label}</div></div>`;
      if(!ids.length){ body+=`<div style="padding:2px 14px 10px;color:var(--faint);font-style:italic;font-size:12.5px">Nothing due today.</div>`; return; }
      ids.forEach(id=>{ const t=byId[id]; if(t) body+=compactRow(t); });
    });
    body+=`</div>`;
    return statusbar()+appbar()+chips('global')+viewbar('list')+summary()+body; }

  /* ============================================================ BOARD view */
  function segBar(c){ const tot=(c.todo||0)+(c.doing||0)+(c.delayed||0)+(c.review||0)+(c.done||0); if(!tot) return '';
    const seg=(n,col)=>n?`<span style="width:${n/tot*100}%;background:${col}"></span>`:'';
    return `<div class="segbar"><span class="trk">${seg(c.doing,'var(--doing)')}${seg(c.delayed,'var(--delayed)')}${seg(c.review,'var(--review)')}${seg(c.done,'var(--done)')}</span><span class="sn">${c.done||0}/${tot}</span></div>`; }
  function kCard(t){ const fl=taskFlags(t),s=SUBS[t.sub];
    const SUBC={"Design spring flyer":{todo:1,doing:1,review:1,done:1},"Plan summer retreat":{todo:5}};
    const dd=t.due?`<span class="cell-date ${fl.overdue?'od':fl.soon?'soon':''} mono" style="font-size:12px">${fmtDate(t.due)}</span>`:'';
    return `<div class="kcard ${fl.overdue?'overdue':fl.soon?'soon':''}"><div class="kt">${esc(t.name)}${flagFor(fl)}</div>
      <div class="km"><span class="left"><span class="proj-pill sm" style="--pc:${s.color}"><span class="pp-nm">${esc(s.name)}</span></span> ${dd}</span>${avStack(t.who,22)}</div>
      ${SUBC[t.name]?segBar(SUBC[t.name]):''}</div>`; }
  function boardScreen(){ const kc={todo:'var(--todo)',doing:'var(--doing)',delayed:'var(--delayed)',review:'var(--review)',done:'var(--done)'};
    let w=`<div class="kanwrap">`;
    STATUS_ORDER.forEach(s=>{ const items=TASKS.filter(t=>t.status===s);
      w+=`<div class="kancol"><div class="kanhead" style="--kc:${kc[s]}"><span class="lab"><span class="dot" style="background:${STATUS[s].color}"></span>${STATUS[s].name}</span><span class="n">${items.length}</span></div><div class="kanbody">`;
      if(!items.length) w+=`<div style="color:var(--faint);font-style:italic;font-size:12.5px;padding:8px;text-align:center">—</div>`;
      items.forEach(t=>w+=kCard(t)); w+=`</div></div>`; });
    w+=`</div>`;
    return statusbar()+appbar()+chips('global')+viewbar('board')+w; }

  /* ============================================================ WEEKLY · agenda (matches compact rows) */
  function weeklyScreen(){
    // timed tasks: display label + sort key (minutes from midnight)
    const T={ 14:{time:"8:00–10:00 AM",tmin:480}, 16:{time:"2:00–3:00 PM",tmin:840}, 8:{time:"6:00–7:30 PM",tmin:1080} };
    const days=[
      {dow:"Sunday",dnum:"Jun 1",iso:"2026-06-01",ids:[]},
      {dow:"Monday",dnum:"Jun 2",iso:"2026-06-02",ids:[14,2]},
      {dow:"Tuesday",dnum:"Jun 3",iso:"2026-06-03",today:true,ids:[]},
      {dow:"Wednesday",dnum:"Jun 4",iso:"2026-06-04",ids:[16,3]},
      {dow:"Thursday",dnum:"Jun 5",iso:"2026-06-05",ids:[]},
      {dow:"Friday",dnum:"Jun 6",iso:"2026-06-06",ev:"Choir rehearsal",ids:[8]},
      {dow:"Saturday",dnum:"Jun 7",iso:"2026-06-07",ids:[9],ev:"Birthday in 2 days"},
    ];
    const byId=Object.fromEntries(TASKS.map(t=>[t.id,{...t}]));
    byId[9]={id:9,name:"Prepare prasad",sub:"sh",who:["tara"],status:"todo",due:"2026-06-07",rec:"weekly",priority:"Medium"};
    let body=`<div class="body"><div class="cal-top"><h2>Jun 1 – 7, 2026</h2><div class="cal-nav"><button>${svg('chevL')}</button><button>${svg('chevR')}</button></div></div>`;
    days.forEach(day=>{
      const dItems=dayItems(day.iso, day.ev); const shown=dItems.slice(0,2); const moreN=dItems.length-shown.length;
      const dchips=shown.map(it=>`<span class="ev${it.holiday?' holiday':''}">${it.holiday?ICN_STAR:ICN_MEGA}<span>${esc(it.text)}</span></span>`).join('')+(moreN>0?`<span class="more">+${moreN} more</span>`:'');
      body+=`<div class="agdayhead ${day.today?'today':''}"><span class="dow">${day.dow}</span><span class="dnum">${day.dnum}</span>${day.today?'<span class="today-tag">Today</span>':''}${dItems.length?`<span class="dchips">${dchips}</span>`:''}</div>`;
      if(!day.ids.length){ body+=`<div class="agempty">${day.today?'Nothing scheduled today.':'No tasks'}</div>`; return; }
      // timed tasks first, chronological; untimed after
      const sorted=day.ids.map(id=>({id,tmin:T[id]?T[id].tmin:Infinity})).sort((a,b)=>a.tmin-b.tmin);
      sorted.forEach(({id})=>{ const t=byId[id]; t.time=T[id]?T[id].time:null; body+=compactRow(t,{agenda:true}); });
    });
    body+=`</div>`;
    return statusbar()+appbar()+chips('global')+viewbar('weekly')+body; }

  /* ============================================================ MONTHLY */
  function monthlyScreen(){
    // June 2026: starts Monday (Jun 1 = Mon). col index: Sun0..Sat6 → Jun1 at col1
    const dows=["S","M","T","W","T","F","S"];
    const data={ 1:{soon:false,dots:["#c8762f"]},2:{od:true,dots:["#c8762f","#7a5aa6"]},3:{today:true},
      4:{soon:true,dots:["#b4452f","#2563a8"]},5:{hol:true},6:{dots:["#2563a8","#4f7a3c"],hol:true},7:{dots:["#4f7a3c"],ev:true,hol:true},
      9:{dots:["#a23e6e"],ev:true},10:{dots:["#c8762f"]},12:{dots:["#7a5aa6"]},14:{dots:["#c8762f"],hol:true},16:{dots:["#b7791f"]},
      18:{dots:["#c8762f"]},19:{hol:true},20:{dots:["#a23e6e","#b7791f"]},21:{dots:["#2563a8"],ev:true,hol:true},30:{dots:["#6b7280","#2f7d74"]} };
    let cells=''; for(let i=0;i<35;i++){ const day=i-0; const dn=i; // Jun1 at index1 (col Mon=1)
      const num=i; // 0..34
      const realDay=num; // index 1 => day1
      if(num<1||num>30){ cells+=`<div class="mcell dim"></div>`; continue; }
      const o=data[num]||{}; let cls='';
      if(o.today)cls='today'; else if(o.od)cls='has-overdue'; else if(o.soon)cls='has-soon';
      let dots=''; if(o.dots){ dots=`<div class="mdots">`+o.dots.map(c=>`<span class="d" style="background:${c}"></span>`).join('')+`</div>`; }
      cells+=`<div class="mcell ${cls}"><span class="dn">${num}</span>${dots}${(o.ev||o.hol)?`<span class="micons">${o.ev?`<span class="mi-ev" title="Announcement">${ICN_MEGA}</span>`:''}${o.hol?`<span class="mi-hol" title="Holiday">${ICN_STAR}</span>`:''}</span>`:''}</div>`;
    }
    const body=`<div class="body"><div class="cal-top"><h2>June 2026</h2><div class="cal-nav"><button>${svg('chevL')}</button><button>${svg('chevR')}</button></div></div>
      <div class="mwrap"><div class="mdow">${dows.map(d=>`<span>${d}</span>`).join('')}</div><div class="month">${cells}</div></div></div>`;
    return statusbar()+appbar()+chips('global')+viewbar('monthly')+body; }

  window.M = Object.assign(window.M||{}, {
    PEOPLE, PROJECTS, SUBS, STATUS, STATUS_ORDER, TASKS, taskFlags, fmtDate, esc, svg, I, av, avStack, whoChips, statusPill, flagFor, segBar, prio, PRIO_ICON, HOLIDAYS, dayItems, ICN_MEGA, ICN_STAR,
    statusbar, appbar, chips, subchips, summary, bottomNav, fab, viewbar,
    listScreen, listCompact, compactRow, boardScreen, weeklyScreen, monthlyScreen,
  });
})();
