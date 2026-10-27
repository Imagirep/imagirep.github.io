/* Page glue: section highlighting, charts, BibTeX copy. */
(function () {
  // charts (redrawn when the system theme changes so colours follow the tokens)
  function drawCharts() {
    const C = window.Charts;
    C.inputs(document.getElementById('viz-inputs'));
    C.perType(document.getElementById('viz-pertype'));
    C.heat(document.getElementById('viz-heat'));
    C.estimated(document.getElementById('viz-est'));
    C.methods(document.getElementById('viz-methods'));
    C.ablation(document.getElementById('viz-ablation'));
  }
  drawCharts();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawCharts);

  // active section in the top bar
  const links = [...document.querySelectorAll('.toc a')];
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { links.forEach(a => a.classList.remove('active')); const a = map.get(e.target.id); if (a) a.classList.add('active'); }
  }), { rootMargin: '-40% 0px -55% 0px' });
  map.forEach((a, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  const hero = document.getElementById('top');   // no link: clears the highlight at the top of the page
  if (hero) io.observe(hero);

  // "soon" buttons do nothing yet
  document.querySelectorAll('[data-soon]').forEach(a => a.addEventListener('click', e => e.preventDefault()));

  // GEARS flow: the pipeline appears stage by stage (data-k order) the first time it scrolls into view
  const flow = document.getElementById('flow');
  if (flow) {
    const parts = [...flow.querySelectorAll('[data-k]')];
    flow.classList.add('anim');
    const fio = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      fio.disconnect();
      parts.forEach(p => setTimeout(() => p.classList.add('on'), 150 + (+p.dataset.k - 1) * 450));
    }, { threshold: 0.5 });
    fio.observe(flow);
  }

  // BibTeX copy
  document.querySelector('.copy').addEventListener('click', e => {
    const t = document.getElementById('bibtex').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1500); }).catch(() => {});
  });
})();
