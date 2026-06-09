/* =============================================================
   Ananda Taskboard — Multi-tenancy design-canvas helpers
   Loaded after design-canvas.jsx + mt-screens.js. Exposes Frame,
   SpecsCard, and Web/Mob/Note artboard helpers + theme wiring so the
   page only declares its <App/> sections.
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

function Frame({ html, theme, kind }) {
  return <div className={`atheme aframe ${kind || ''}`} {...(theme ? { 'data-theme': theme } : {})}
    dangerouslySetInnerHTML={{ __html: html }} />;
}

function SpecsCard({ title, sub, items, tip }) {
  return <div className="atheme"><div className="specs" dangerouslySetInnerHTML={{ __html:
    `<h3>${title}</h3><div class="sub">${sub}</div><ol>${items.map(i => `<li>${i}</li>`).join('')}</ol>`
    + (tip ? `<div class="tip">${tip}</div>` : '') }} /></div>;
}

// Web artboard: pass pre-built frame HTML
const Web = ({ id, label, html, theme, w = 1100, h = 720 }) =>
  <DCArtboard key={id} id={id} label={label} width={w} height={h}>
    <Frame html={html} theme={theme} />
  </DCArtboard>;

// Phone artboard: the builder already returns a .phone element; theme is
// baked into that element by the builder, so don't double-wrap with .atheme.
// For pinned-theme parity frames, inject data-theme onto the .phone root.
const Mob = ({ id, label, html, theme, w = 390, h = 844 }) => {
  const out = theme ? html.replace('class="phone"', `class="phone" data-theme="${theme}"`) : html;
  return <DCArtboard key={id} id={id} label={label} width={w} height={h}>
    <div className="aframe" dangerouslySetInnerHTML={{ __html: out }} />
  </DCArtboard>;
};

const Note = ({ id, label, ...p }) =>
  <DCArtboard key={id} id={id} label={label} width={400} height={720} style={{ height: 'auto' }}>
    <SpecsCard {...p} />
  </DCArtboard>;

// keyword chip shorthand for note copy
const k = '<span class="k">';

Object.assign(window, { Frame, SpecsCard, Web, Mob, Note, k });
