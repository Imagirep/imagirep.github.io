/* Animated teaser: timeline over [data-step] elements, scene video, hover focus by question group. */
(function () {
  const root = document.getElementById('teaser');
  if (!root) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const video = root.querySelector('.tz-scene-video');
  const POP = ['126', '127', '128', '129', '135', '136', '137', '138', '117'];
  POP.forEach(id => root.querySelectorAll('.tz-' + id).forEach(el => el.classList.add('tz-pop')));

  // seconds at which each step appears
  const T = { 1: 0.25, 2: 0.75, 3: 1.75, 4: 2.9, 5: 3.25, 5.2: 3.55, 5.4: 3.85, 6: 4.35, 6.2: 4.65, 6.3: 4.85, 6.4: 5.05,
              6.5: 5.35, 6.7: 5.7, 7: 6.05, 7.2: 6.35 };
  const SCENE_START = 6.35, SCENE_LEN = 2.85, RATE = 1.4;   // 4 s clip at 1.4x
  const tOf = s => (s in T ? T[s] : s >= 7.8 && s < 9.3 ? SCENE_START + SCENE_LEN + (s - 7.85) * 0.95 : SCENE_START + SCENE_LEN + 1.55);
  let timers = [];

  root.querySelectorAll('path.tz-box, path.tz-arrow').forEach(p => p.style.setProperty('--len', Math.ceil(p.getTotalLength() + 2)));

  function clear() { timers.forEach(clearTimeout); timers = []; }
  function showAll() {
    root.querySelectorAll('[data-step]').forEach(el => el.classList.add('on'));
    root.classList.add('scene-done', 'done');
  }
  function play() {
    clear();
    root.classList.remove('done', 'scene-done', 'focus');
    root.classList.add('anim');
    const els = [...root.querySelectorAll('[data-step]')];
    els.forEach(el => el.classList.remove('on'));
    if (video) { try { video.pause(); video.currentTime = 0; } catch (e) {} }
    // let the browser apply the hidden state before scheduling
    requestAnimationFrame(() => requestAnimationFrame(() => {
      els.forEach(el => {
        const s = parseFloat(el.dataset.step);
        timers.push(setTimeout(() => el.classList.add('on'), tOf(s) * 1000));
      });
      timers.push(setTimeout(() => {
        if (!video) return root.classList.add('scene-done');
        video.playbackRate = RATE;
        const p = video.play();
        if (p && p.catch) p.catch(() => root.classList.add('scene-done'));
      }, SCENE_START * 1000 + 150));
      timers.push(setTimeout(() => root.classList.add('scene-done'), (SCENE_START + SCENE_LEN + 0.6) * 1000));
      timers.push(setTimeout(() => root.classList.add('done'), (tOf(9.4) + 0.6) * 1000));
    }));
  }
  if (video) video.addEventListener('ended', () => root.classList.add('scene-done'));

  // hover / tap focus on a question group
  function focus(q) {
    if (!root.classList.contains('done')) return;
    root.classList.toggle('focus', !!q);
    root.querySelectorAll('[data-q]').forEach(el => el.classList.toggle('hit', el.dataset.q === q));
  }
  root.addEventListener('pointerover', e => { const t = e.target.closest('[data-q]'); focus(t ? t.dataset.q : null); });
  root.addEventListener('pointerleave', () => focus(null));
  root.querySelector('.tz-replay').addEventListener('click', play);

  if (reduce) { root.classList.add('anim'); showAll(); return; }
  // start when the teaser is visible and fonts are ready
  let started = false;
  const start = () => { if (!started) { started = true; play(); } };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); (document.fonts ? document.fonts.ready : Promise.resolve()).then(start); } }, { threshold: 0.25 });
  root.classList.add('anim');
  io.observe(root);
})();
