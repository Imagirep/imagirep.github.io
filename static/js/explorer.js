/* Benchmark explorer: pick a question, answer it yourself, switch between representations of the imagined state. */
(function () {
  const data = window.EXAMPLES;
  if (!data) return;
  const $ = id => document.getElementById(id);
  const TABS = [['rgb', 'Endpoint RGB'], ['topdown', 'Top-down'], ['text', 'Text'], ['video', 'Video'], ['depth', 'Depth'],
                ['normals', 'Normals'], ['panorama', 'Panorama']];
  const KEY = { normals: 'surface_normals' };
  let cur = 0, tab = 'rgb', picked = null, revealed = false;

  $('ex-rule').textContent = `Examples: ${data.rule}.`;
  const picker = $('ex-picker');
  let lastSetting = '';
  data.examples.forEach((ex, i) => {
    if (ex.setting !== lastSetting) {
      const g = document.createElement('div'); g.className = 'ex-group'; g.textContent = ex.setting; picker.appendChild(g);
      lastSetting = ex.setting;
    }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ex-pick'; b.setAttribute('role', 'tab');
    b.innerHTML = `<span>${ex.type}</span>`;
    b.addEventListener('click', () => select(i));
    picker.appendChild(b);
  });

  function fig(src, label, cls) {
    const isVid = /\.mp4$/.test(src);
    const media = isVid
      ? `<video src="${src}" controls muted loop playsinline preload="metadata"></video>`
      : `<img src="${src}" alt="${label}" loading="lazy">`;
    return `<figure class="${cls || ''}">${media}${label ? `<figcaption>${label}</figcaption>` : ''}</figure>`;
  }

  function renderTabs() {
    const t = $('ex-tabs'); t.innerHTML = '';
    TABS.forEach(([k, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ex-tab'; b.dataset.rep = k; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(k === tab)); b.tabIndex = k === tab ? 0 : -1;
      b.textContent = label;
      b.addEventListener('click', () => { tab = k; renderTabs(); renderPanel(); });
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = TABS.findIndex(x => x[0] === tab), n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
        tab = TABS[n][0]; renderTabs(); renderPanel(); t.querySelector(`[data-rep="${tab}"]`).focus();
      });
      t.appendChild(b);
    });
  }

  function renderPanel() {
    const ex = data.examples[cur], p = $('ex-panel');
    let caption = '';
    if (tab === 'rgb') {
      p.innerHTML = ex.endpoint.map(e => fig(e.src, e.label)).join('');
      caption = 'The view at the imagined state: the endpoint after the movement (or, for look-back questions, the endpoint facing the start) in Viewpoint Imagination; the missing in-between view in Cross-view Integration.';
    } else {
      const r = ex.reps[KEY[tab] || tab];
      if (tab === 'text') p.innerHTML = `<pre>${r.text.replace(/</g, '&lt;')}</pre>`;
      else p.innerHTML = r.src.map(src => fig(src, '', tab === 'panorama' ? 'pano' : '')).join('');
      caption = (r.title ? r.title + '. ' : '') + (r.caption || '');
    }
    $('ex-caption').textContent = caption.trim();
  }

  function renderOptions() {
    const ex = data.examples[cur], o = $('ex-options'); o.innerHTML = '';
    Object.entries(ex.options).forEach(([k, v]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ex-opt';
      if (picked === k) b.classList.add('picked');
      if (revealed) { if (k === ex.gold) b.classList.add('gold'); else if (picked === k) b.classList.add('wrong'); }
      b.innerHTML = `<b>${k}</b><span>${v}</span>`;
      b.setAttribute('aria-pressed', String(picked === k));
      b.addEventListener('click', () => { if (revealed) return; picked = k; renderOptions(); });
      o.appendChild(b);
    });
    const v = $('ex-verdict');
    v.textContent = !revealed ? (picked ? `Your answer: ${picked}` : 'Choose an answer, then reveal.')
      : picked ? (picked === ex.gold ? 'Correct.' : `Not quite: the answer is ${ex.gold}.`) : `The answer is ${ex.gold}.`;
    $('ex-reveal').textContent = revealed ? 'Try again' : 'Reveal answer';
  }

  function select(i) {
    cur = i; picked = null; revealed = false;
    const ex = data.examples[i];
    picker.querySelectorAll('.ex-pick').forEach((b, j) => b.setAttribute('aria-selected', String(j === i)));
    $('ex-setting').textContent = ex.setting;
    $('ex-type').textContent = ex.type;
    $('ex-uid').textContent = ex.uid.replace(/^(ready100|last50|mvc131)__/, '');
    $('ex-question').textContent = ex.question;
    $('ex-observed').innerHTML = ex.observed.map(o => fig(o.src, o.label)).join('');
    renderOptions(); renderTabs(); renderPanel();
  }
  $('ex-reveal').addEventListener('click', () => { if (revealed) { revealed = false; picked = null; } else revealed = true; renderOptions(); });
  select(0);
})();
