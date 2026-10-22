/* Page glue: theme toggle, section highlighting, charts, GEARS flow animation, BibTeX copy. */
(function () {
  // theme
  const btn = document.querySelector('.theme-toggle');
  const dark = () => document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  btn.addEventListener('click', () => {
    const t = dark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('imagirep-theme', t); } catch (e) {}
    drawCharts();
  });

  // charts (redrawn on theme change so colours follow the tokens)
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

  // GEARS flow: step through the pipeline once it scrolls into view, then loop gently
  const flow = document.getElementById('flow');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (flow && !reduce) {
    const parts = [...flow.querySelectorAll('[data-k]')];
    const paths = [[1, 2, 3, 7], [1, 2, 3, 4, 5, 6, 7]];          // agree -> answer; disagree -> route
    let run = 0, timer = null;
    const lightUp = seq => {
      flow.classList.add('play');
      parts.forEach(p => p.classList.remove('lit'));
      seq.forEach((k, i) => timer = setTimeout(() => {
        const agree = seq === paths[0];
        parts.filter(p => {
          if (+p.dataset.k !== k) return false;
          if (k !== 7 || !p.closest('.fe')) return true;
          return agree ? p.classList.contains('yes') : !p.classList.contains('yes');   // the "yes" edge only on the agree path
        }).forEach(p => p.classList.add('lit'));
      }, 600 * i));
    };
    const loop = () => { lightUp(paths[run % 2]); run++; timer = setTimeout(loop, 600 * paths[(run - 1) % 2].length + 2200); };
    const fio = new IntersectionObserver(es => { if (es[0].isIntersecting) { fio.disconnect(); loop(); } }, { threshold: 0.5 });
    fio.observe(flow);
  }

  // BibTeX copy
  document.querySelector('.copy').addEventListener('click', e => {
    const t = document.getElementById('bibtex').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1500); }).catch(() => {});
  });
})();
