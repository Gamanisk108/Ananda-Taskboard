/* =============================================================
   Ananda Taskboard — shared design-canvas helpers
   Loaded after design-canvas.jsx + auth-screens.js. Exposes Frame,
   SpecsCard, and the Web/Mob/Raw/Note artboard helpers + theme wiring
   so each page only has to declare its own <App/> sections.
   ============================================================= */

// theme toggle → flips html[data-mt]; pinned frames carry their own data-theme
(function initThemeToggle() {
  const seg = document.getElementById('themeSeg');
  if (!seg) return;
  seg.querySelectorAll('button').forEach(b => b.onclick = () => {
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    if (b.dataset.mt === 'dark') document.documentElement.setAttribute('data-mt', 'dark');
    else document.documentElement.removeAttribute('data-mt');
  });
})();

function Frame({ html, theme }) {
  return <div className="atheme aframe" {...(theme ? { 'data-theme': theme } : {})}
    dangerouslySetInnerHTML={{ __html: html }} />;
}

function SpecsCard({ title, sub, items, tip }) {
  return <div className="specs" dangerouslySetInnerHTML={{ __html:
    `<h3>${title}</h3><div class="sub">${sub}</div><ol>${items.map(i => `<li>${i}</li>`).join('')}</ol>`
    + (tip ? `<div class="tip">${tip}</div>` : '') }} />;
}

// helpers return real <DCArtboard> elements (so DCSection's type-walk finds them)
const Web = ({ id, label, state, theme, w = 1040, h = 660 }) =>
  <DCArtboard key={id} id={id} label={label} width={w} height={h}>
    <Frame html={window.A.webFrame(state)} theme={theme} />
  </DCArtboard>;

const Mob = ({ id, label, state, theme, w = 390, h = 844 }) =>
  <DCArtboard key={id} id={id} label={label} width={w} height={h}>
    <Frame html={window.A.phoneFrame(state)} theme={theme} />
  </DCArtboard>;

const Raw = ({ id, label, html, theme, w, h }) =>
  <DCArtboard key={id} id={id} label={label} width={w} height={h}>
    <Frame html={html} theme={theme} />
  </DCArtboard>;

const Note = ({ id, label, ...p }) =>
  <DCArtboard key={id} id={id} label={label} width={400} height={720} style={{ height: 'auto' }}>
    <SpecsCard {...p} />
  </DCArtboard>;

// keyword chip shorthand for note copy
const k = '<span class="k">';

Object.assign(window, { Frame, SpecsCard, Web, Mob, Raw, Note, k });
