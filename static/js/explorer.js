/* Benchmark explorer: pick a question, reveal its answer, see the representations of the imagined state.
   The representation tabs cycle on their own; hovering a tab shows it, and hovering or focusing the panel holds the cycle. */
(function () {
  const data = window.EXAMPLES;
  if (!data) return;
  const $ = id => document.getElementById(id);
  const TABS = [['rgb', 'Endpoint RGB'], ['topdown', 'Top-down'], ['text', 'Text'], ['video', 'Video'], ['depth', 'Depth'],
                ['normals', 'Normals'], ['panorama', 'Panorama']];
  const KEY = { normals: 'surface_normals' };
  const DWELL = { video: 5000 };                    // ms per tab; video gets longer so a few frames play
  const DWELL_DEFAULT = 2800;
  let cur = 0, tab = 'rgb', revealed = false;

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

  function fig(src, label, cls, auto) {
    const isVid = /\.mp4$/.test(src);
    const media = isVid
      ? `<video src="${src}" controls muted loop playsinline preload="metadata"${auto ? ' autoplay' : ''}></video>`
      : `<img src="${src}" alt="${label}" loading="lazy">`;
    return `<figure class="${cls || ''}">${media}${label ? `<figcaption>${label}</figcaption>` : ''}</figure>`;
  }

  // tabs are built once and only re-flagged, so a hover never lands on a freshly replaced button
  const tabBar = $('ex-tabs');
  TABS.forEach(([k, label]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ex-tab'; b.dataset.rep = k; b.setAttribute('role', 'tab');
    b.textContent = label;
    b.addEventListener('click', () => show(k));
    b.addEventListener('mouseenter', () => show(k));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = TABS.findIndex(x => x[0] === tab), n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
      show(TABS[n][0]); tabBar.querySelector(`[data-rep="${tab}"]`).focus();
    });
    tabBar.appendChild(b);
  });

  function show(k) {
    if (k === tab && $('ex-panel').childElementCount) return;
    tab = k;
    tabBar.querySelectorAll('.ex-tab').forEach(b => {
      const on = b.dataset.rep === tab;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
    renderPanel();
  }

  function renderPanel() {
    const ex = data.examples[cur], p = $('ex-panel');
    if (tab === 'rgb') {
      p.innerHTML = ex.endpoint.map(e => fig(e.src, e.label)).join('');
    } else {
      const r = ex.reps[KEY[tab] || tab];
      if (tab === 'text') p.innerHTML = `<pre>${r.text.replace(/</g, '&lt;')}</pre>`;
      else p.innerHTML = r.src.map(src => fig(src, '', tab === 'panorama' ? 'pano' : '', true)).join('');
    }
  }

  // auto-cycle: runs only while the panel is on screen, the page is visible, and nobody is pointing at or focused in it
  const box = document.querySelector('.ex-imagined');
  let onScreen = false, held = false, timer = null;
  const running = () => onScreen && !held && !document.hidden;
  function schedule() {
    clearTimeout(timer);
    if (!running()) return;
    timer = setTimeout(() => {
      const i = TABS.findIndex(x => x[0] === tab);
      show(TABS[(i + 1) % TABS.length][0]);
      schedule();
    }, DWELL[tab] || DWELL_DEFAULT);
  }
  const hold = v => { held = v; schedule(); };
  box.addEventListener('mouseenter', () => hold(true));
  box.addEventListener('mouseleave', () => hold(box.contains(document.activeElement)));
  box.addEventListener('focusin', () => hold(true));
  box.addEventListener('focusout', e => { if (!box.contains(e.relatedTarget)) hold(box.matches(':hover')); });
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; schedule(); }, { threshold: 0.35 }).observe(box);

  function renderOptions() {
    const ex = data.examples[cur], o = $('ex-options'); o.innerHTML = '';
    Object.entries(ex.options).forEach(([k, v]) => {
      const d = document.createElement('div');
      d.className = 'ex-opt' + (revealed && k === ex.gold ? ' gold' : '');
      d.innerHTML = `<b>${k}</b><span>${v}</span>`;
      o.appendChild(d);
    });
    $('ex-verdict').textContent = revealed ? `The answer is ${ex.gold}.` : '';
    $('ex-reveal').textContent = revealed ? 'Hide answer' : 'Reveal answer';
    $('ex-reveal').setAttribute('aria-expanded', String(revealed));
  }

  function select(i) {
    cur = i; revealed = false;
    const ex = data.examples[i];
    picker.querySelectorAll('.ex-pick').forEach((b, j) => b.setAttribute('aria-selected', String(j === i)));
    $('ex-setting').textContent = ex.setting;
    $('ex-type').textContent = ex.type;
    $('ex-question').textContent = ex.question;
    $('ex-observed').innerHTML = ex.observed.map(o => fig(o.src, o.label)).join('');
    renderOptions();
    $('ex-panel').innerHTML = '';
    show('rgb');
    schedule();
  }
  $('ex-reveal').addEventListener('click', () => { revealed = !revealed; renderOptions(); });
  select(0);
})();
