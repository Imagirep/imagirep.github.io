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

  // BibTeX copy
  document.querySelector('.copy').addEventListener('click', e => {
    const t = document.getElementById('bibtex').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1500); }).catch(() => {});
  });
})();
