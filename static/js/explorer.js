/* Benchmark explorer: pick a question, reveal its answer, see the oracle or estimated representations of the imagined state.
   The representation tabs cycle on their own; clicking a tab shows it, and hovering or focusing the panel holds the cycle. */
(function () {
  const data = window.EXAMPLES;
  if (!data) return;
  const $ = id => document.getElementById(id);
  const TABS = [['rgb', 'Endpoint RGB'], ['topdown', 'Top-down'], ['text', 'Text'], ['video', 'Video'], ['depth', 'Depth'],
                ['normals', 'Normals'], ['panorama', 'Panorama']];
  const KEY = { normals: 'surface_normals' };
  const DWELL_DEFAULT = 2800;                       // ms per tab, not counting the time a video is playing
  const AFTER_MANUAL = 3000;                        // a tab picked by hand stays at least this long
  const NOTE = { oracle: '(oracle, rendered from Oracle 3D)',
                 'est:Viewpoint Imagination': '(rendered from Estimated 3D by HY-World 2.0)',
                 'est:Cross-view Integration': '(SEVA view, MoGe-2 depth)' };
  let cur = 0, tab = 'rgb', src = 'oracle', revealed = false;
  // oracle has every representation; estimated has what the world model produced for that setting
  const has = k => src === 'oracle' || !!(data.examples[cur].est || {})[KEY[k] || k];
  const step = d => { const i = TABS.findIndex(x => x[0] === tab);
    for (let j = 1; j <= TABS.length; j++) { const k = TABS[(i + d * j + TABS.length * j) % TABS.length][0]; if (has(k)) return k; } return tab; };

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
      ? `<video src="${src}" controls muted playsinline preload="metadata"${auto ? ' autoplay' : ' loop'}></video>`
      : `<img src="${src}" alt="${label}" loading="lazy">`;
    return `<figure class="${cls || ''}">${media}${label ? `<figcaption>${label}</figcaption>` : ''}</figure>`;
  }

  // tabs are built once and only re-flagged, so a hover never lands on a freshly replaced button
  const tabBar = $('ex-tabs');
  TABS.forEach(([k, label]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ex-tab'; b.dataset.rep = k; b.setAttribute('role', 'tab');
    b.textContent = label;
    b.addEventListener('click', () => pick(k));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      pick(step(e.key === 'ArrowRight' ? 1 : -1)); tabBar.querySelector(`[data-rep="${tab}"]`).focus();
    });
    tabBar.appendChild(b);
  });

  let manualAt = 0;
  function pick(k) { if (!has(k)) return; manualAt = Date.now(); show(k); schedule(); }

  function show(k, force) {
    if (!has(k)) return;
    if (k === tab && !force && $('ex-panel').childElementCount) return;
    tab = k;
    tabBar.querySelectorAll('.ex-tab').forEach(b => {
      const on = b.dataset.rep === tab, ok = has(b.dataset.rep);
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; b.disabled = !ok;
      b.title = ok ? '' : 'Not estimated in this setting';
    });
    renderPanel();
  }

  // oracle / estimated switch
  const srcBar = $('ex-src');
  function setSrc(s) {
    src = s;
    srcBar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === src)));
    $('ex-src-note').textContent = src === 'oracle' ? NOTE.oracle : NOTE['est:' + data.examples[cur].setting];
    show(has(tab) ? tab : 'rgb', true);
  }
  srcBar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { setSrc(b.dataset.src); schedule(); }));

  function renderPanel() {
    const ex = data.examples[cur], p = $('ex-panel');
    if (src === 'est') {
      const r = ex.est[KEY[tab] || tab];
      if (tab === 'text') p.innerHTML = `<pre>${r.text.replace(/</g, '&lt;')}</pre>`;
      else p.innerHTML = r.src.map(s => fig(s, tab === 'rgb' ? 'Estimated RGB' : '', tab === 'panorama' ? 'pano' : '', true)).join('');
    } else if (tab === 'rgb') {
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
    // a video plays through once before its tab's dwell starts
    const v = tab === 'video' ? $('ex-panel').querySelector('video') : null;
    if (v) {
      v.onplaying = v.onended = schedule;
      if (!v.paused && !v.ended) return;
    }
    timer = setTimeout(() => {
      show(step(1));
      schedule();
    }, Math.max(DWELL_DEFAULT, manualAt + AFTER_MANUAL - Date.now()));
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
    tab = 'rgb';
    setSrc(src);                                    // keeps the oracle/estimated choice, refreshes note and tabs
    schedule();
  }
  $('ex-reveal').addEventListener('click', () => { revealed = !revealed; renderOptions(); });
  select(0);
})();
