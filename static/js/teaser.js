/* Teaser: parts appear step by step (in data-step order) once the figure is on screen; when the last part is in,
   the three clips switch from their first frame to the looping animation. */
(function () {
  const root = document.getElementById('teaser');
  if (!root) return;
  const GAP = 0.22;                                   // s between consecutive steps
  const parts = [...root.querySelectorAll('[data-step]')];
  const steps = [...new Set(parts.map(el => parseFloat(el.dataset.step)))].sort((a, b) => a - b);
  const at = new Map(steps.map((s, i) => [s, 0.2 + i * GAP]));

  root.querySelectorAll('path[data-step]').forEach(p => p.style.setProperty('--len', Math.ceil(p.getTotalLength() + 2)));
  root.classList.add('anim');                         // hide parts only once the script is running

  function startClips() {
    root.querySelectorAll('img[data-anim]').forEach(img => { img.src = img.dataset.anim; });
  }
  function play() {
    parts.forEach(el => setTimeout(() => el.classList.add('on'), at.get(parseFloat(el.dataset.step)) * 1000));
    setTimeout(startClips, (0.2 + steps.length * GAP + 0.5) * 1000);
  }
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    ready.then(() => requestAnimationFrame(() => requestAnimationFrame(play)));
  }, { threshold: 0.3 });
  io.observe(root);
})();
