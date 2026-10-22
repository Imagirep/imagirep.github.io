/* Charts for the ImagiRep page (plain SVG, redrawn on resize, every chart has a table view). */
window.Charts = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const R = () => window.RESULTS;
  const REP_LABEL = { observed: 'Observed view(s)', rgb: 'Endpoint RGB', topdown: 'Top-down', text: 'Text', video: 'Video',
    depth: 'Depth', normals: 'Normals', panorama: 'Panorama', oracle_selection: 'Oracle selection', per_type_best: 'Per-type best' };
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const repColor = r => css('--rep-' + r) || css('--muted');
  const tip = document.getElementById('tooltip');

  function s(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, attrs, parent, html) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function hover(el, html) {
    el.addEventListener('pointerenter', () => { tip.innerHTML = html; tip.hidden = false; });
    el.addEventListener('pointermove', e => {
      const w = tip.offsetWidth, x = Math.min(e.clientX + 14, innerWidth - w - 8);
      tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px';
    });
    el.addEventListener('pointerleave', () => { tip.hidden = true; });
    el.setAttribute('tabindex', '0');
    el.addEventListener('focus', () => { const b = el.getBoundingClientRect(); tip.innerHTML = html; tip.hidden = false; tip.style.left = b.right + 8 + 'px'; tip.style.top = b.top + 'px'; });
    el.addEventListener('blur', () => { tip.hidden = true; });
  }
  function seg(parent, options, value, onChange, label) {
    const g = h('div', { class: 'seg', role: 'group', 'aria-label': label }, parent);
    options.forEach(([v, t]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(v === value) }, g, t);
      b.addEventListener('click', () => { g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); onChange(v); });
    });
    return g;
  }
  function frame(host, title, sub) {
    host.innerHTML = '';
    const head = h('div', { class: 'viz-head' }, host);
    const t = h('div', {}, head);
    h('div', { class: 'viz-title' }, t, title);
    if (sub) h('div', { class: 'viz-sub' }, t, sub);
    const controls = h('div', { class: 'viz-controls' }, head);
    const legend = h('div', { class: 'legend' }, host);
    const plot = h('div', { class: 'plot' }, host);
    const tbtn = h('button', { class: 'table-toggle', type: 'button', 'aria-expanded': 'false' }, host, 'Show table');
    const tbl = h('div', { hidden: '' }, host);
    tbtn.addEventListener('click', () => { const open = tbl.hidden; tbl.hidden = !open; tbtn.textContent = open ? 'Hide table' : 'Show table'; tbtn.setAttribute('aria-expanded', String(open)); });
    return { controls, legend, plot, tbl };
  }
  function table(host, head, rows, bestCols) {
    host.innerHTML = '';
    const t = h('table', { class: 'dtable' }, host);
    const tr = h('tr', {}, h('thead', {}, t)); head.forEach(c => h('th', { scope: 'col' }, tr, c));
    const tb = h('tbody', {}, t);
    rows.forEach(r => {
      const row = h('tr', {}, tb);
      const nums = r.slice(1).filter(v => typeof v === 'number');
      const best = bestCols ? Math.max(...bestCols.map(i => r[i])) : null;
      r.forEach((v, i) => h(i ? 'td' : 'th', i ? { class: bestCols && bestCols.includes(i) && v === best ? 'best' : '' } : { scope: 'row' }, row, typeof v === 'number' ? v.toFixed(1) : v));
    });
  }
  function legendItems(host, items) {
    host.innerHTML = items.map(([c, t, kind]) => `<span><i class="${kind || ''}" style="--c:${c}"></i>${t}</span>`).join('');
  }
  // shorter row labels on narrow plots
  const short = (t, W) => W >= 520 ? t : t.replace('Nearest-obstacle', 'Nearest-obst.').replace('Object-relative', 'Obj.-relative').replace(' Direction', ' Dir.');
  const responsive = (host, draw) => { let w = 0; const ro = new ResizeObserver(() => { const nw = host.clientWidth; if (Math.abs(nw - w) > 4) { w = nw; draw(); } }); ro.observe(host); return draw; };

  /* ---------- 1a. input conditions (dot plot) ---------- */
  function inputs(host) {
    const f = frame(host, 'Accuracy by input', 'Question only, observed view(s), and with the oracle endpoint RGB');
    const d = R().input_conditions; const rows = Object.entries(d.rows);
    const marks = [['Question only', css('--muted'), 'ring'], ['Observed view(s)', repColor('observed')], ['+ Oracle endpoint RGB', repColor('rgb')]];
    legendItems(f.legend, [...marks.map(([t, c, k]) => [c, t, k]), [css('--axis'), 'Random (25%)', 'line']]);
    table(f.tbl, ['Model · setting', ...d.columns], rows.map(([k, v]) => [k, ...v]));
    const draw = () => {
      f.plot.innerHTML = '';
      const W = Math.max(300, f.plot.clientWidth), L = Math.min(210, W * 0.42), Rm = 30, rowH = 46, top = 8, H = top + rows.length * rowH + 26;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Dot plot of accuracy by input condition' }, f.plot);
      const x = v => L + (v - 20) / 80 * (W - L - Rm);
      const grid = s('g', { class: 'grid' }, svg);
      [20, 40, 60, 80, 100].forEach(v => { s('line', { x1: x(v), x2: x(v), y1: top, y2: H - 22 }, grid); s('text', { x: x(v), y: H - 6, 'text-anchor': 'middle', class: 't-muted' }, svg, v); });
      s('line', { x1: x(25), x2: x(25), y1: top, y2: H - 22, stroke: css('--axis'), 'stroke-width': 2 }, svg);
      rows.forEach(([name, v], i) => {
        const y = top + i * rowH + rowH / 2;
        const [model, setting] = name.split(' · ');
        s('text', { x: L - 12, y: y - 3, 'text-anchor': 'end', class: 't-strong' }, svg, model);
        s('text', { x: L - 12, y: y + 13, 'text-anchor': 'end', class: 't-muted' }, svg, setting);
        s('line', { x1: x(v[1]), x2: x(v[3]), y1: y, y2: y, stroke: css('--line'), 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
        [[1, 'ring'], [2, ''], [3, '']].forEach(([j, kind]) => {
          const g = s('g', { class: 'heat-cell' }, svg);
          const c = marks[j - 1][1];
          s('circle', { cx: x(v[j]), cy: y, r: 12, fill: 'transparent' }, g);
          s('circle', { cx: x(v[j]), cy: y, r: kind ? 5 : 6, fill: kind ? css('--surface') : c, stroke: kind ? c : css('--surface'), 'stroke-width': 2 }, g);
          hover(g, `<b>${name}</b><br>${marks[j - 1][0]}: <b>${v[j].toFixed(1)}%</b>`);
        });
        s('text', { x: x(v[3]) + 10, y: y + 4, class: 't-strong' }, svg, v[3].toFixed(1));
      });
    };
    responsive(f.plot, draw)();
  }

  /* ---------- 1b. per question type: observed -> + oracle RGB ---------- */
  function perType(host) {
    let model = 'gpt';
    const f = frame(host, 'Effect of oracle endpoint RGB by question type', 'Observed view(s) → + oracle endpoint RGB');
    seg(f.controls, [['gpt', 'GPT-6.1-sol'], ['gemini', 'Gemini 3.7 Flash']], model, v => { model = v; draw(); }, 'Model');
    legendItems(f.legend, [[repColor('observed'), 'Observed view(s)'], [repColor('rgb'), '+ Oracle endpoint RGB']]);
    const draw = () => {
      const d = R(); const rows = [];
      ['vi', 'cv'].forEach(st => d.types[st].forEach((t, i) => { if (t !== 'All') rows.push([st, t, d.oracle[model][st][i][0], d.oracle[model][st][i][1]]); }));
      table(f.tbl, ['Setting · type', 'Observed', '+ Oracle RGB', 'Change'], rows.map(r => [(r[0] === 'vi' ? 'VI · ' : 'CV · ') + r[1], r[2], r[3], +(r[3] - r[2]).toFixed(1)]));
      f.plot.innerHTML = '';
      const W = Math.max(300, f.plot.clientWidth), L = Math.min(190, W * 0.4), Rm = 46, rowH = 26, top = 22, gap = 18;
      const H = top + rows.length * rowH + gap + 26;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Change in accuracy per question type' }, f.plot);
      const x = v => L + (v - 30) / 70 * (W - L - Rm);
      const grid = s('g', { class: 'grid' }, svg);
      [30, 50, 70, 90].forEach(v => { s('line', { x1: x(v), x2: x(v), y1: 6, y2: H - 22 }, grid); s('text', { x: x(v), y: H - 6, 'text-anchor': 'middle', class: 't-muted' }, svg, v); });
      let y = top;
      rows.forEach((r, i) => {
        if (i > 0 && r[0] !== rows[i - 1][0]) y += gap;
        if (i === 0 || r[0] !== rows[i - 1][0]) s('text', { x: 0, y: y - 10, class: 't-muted', 'font-size': 11 }, svg, r[0] === 'vi' ? 'VIEWPOINT IMAGINATION' : 'CROSS-VIEW INTEGRATION');
        const cy = y + rowH / 2 - 4, down = r[3] < r[2];
        s('text', { x: L - 10, y: cy + 4, 'text-anchor': 'end', class: down ? 't-strong' : '' }, svg, short(r[1], W));
        s('line', { x1: x(r[2]), x2: x(r[3]), y1: cy, y2: cy, stroke: down ? css('--ink-2') : css('--line'), 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
        const g = s('g', {}, svg);
        s('rect', { x: L, y: cy - rowH / 2, width: W - L, height: rowH, fill: 'transparent' }, g);
        s('circle', { cx: x(r[2]), cy, r: 5.5, fill: repColor('observed'), stroke: css('--surface'), 'stroke-width': 2 }, g);
        s('circle', { cx: x(r[3]), cy, r: 6, fill: repColor('rgb'), stroke: css('--surface'), 'stroke-width': 2 }, g);
        const dlt = r[3] - r[2];
        s('text', { x: Math.max(x(r[2]), x(r[3])) + 11, y: cy + 4, class: down ? 't-muted' : 't-strong' }, svg, (dlt >= 0 ? '+' : '−') + Math.abs(dlt).toFixed(1));
        hover(g, `<b>${r[1]}</b> (${r[0] === 'vi' ? 'Viewpoint Imagination' : 'Cross-view Integration'})<br>Observed: <b>${r[2].toFixed(1)}%</b><br>+ Oracle RGB: <b>${r[3].toFixed(1)}%</b>`);
        y += rowH;
      });
    };
    responsive(f.plot, draw)();
  }

  /* ---------- 2. heatmap: question type x representation ---------- */
  function heat(host) {
    let model = 'gpt', setting = 'vi';
    const f = frame(host, 'Recovery score with each additional oracle representation', 'Correct with endpoint RGB alone or with endpoint RGB + the representation. Best per row outlined.');
    seg(f.controls, [['gpt', 'GPT-6.1-sol'], ['gemini', 'Gemini 3.7 Flash']], model, v => { model = v; draw(); }, 'Model');
    seg(f.controls, [['vi', 'Viewpoint Imagination'], ['cv', 'Cross-view Integration']], setting, v => { setting = v; draw(); }, 'Setting');
    const reps = ['topdown', 'text', 'video', 'depth', 'normals', 'panorama'];
    const draw = () => {
      const d = R(), M = d.oracle[model][setting], types = d.types[setting];
      f.legend.innerHTML = '<span>Low</span>' + [1, 2, 3, 4, 5, 6].map(i => `<span><i style="--c:var(--seq-${i})"></i></span>`).join('') + '<span>High</span><span class="muted">&nbsp;&middot; columns: </span>' +
        reps.map(r => `<span><i style="--c:${repColor(r)}"></i>${REP_LABEL[r]}</span>`).join('');
      table(f.tbl, ['Question type', 'Observed', '+ RGB', ...reps.map(r => REP_LABEL[r]), 'Oracle sel.'], M.map((row, i) => [types[i], ...row]), [3, 4, 5, 6, 7, 8]);
      f.plot.innerHTML = '';
      const W = Math.max(660, f.plot.clientWidth), narrow = W < 620;   // scrolls sideways on phones
      const L = narrow ? 112 : 190, refW = narrow ? 44 : 64, cellW = (W - L - refW * 3 - 16) / 6, cellH = narrow ? 34 : 38, top = 44;
      const H = top + types.length * cellH + 8;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Heatmap of recovery scores' }, f.plot);
      if (W > f.plot.clientWidth) { svg.style.width = W + 'px'; svg.style.maxWidth = 'none'; }
      const cols = [['observed', 'Obs.', refW], ['rgb', '+ RGB', refW], ...reps.map(r => [r, REP_LABEL[r], cellW]), ['oracle_selection', narrow ? 'Oracle' : 'Oracle sel.', refW]];
      let xs = [L]; cols.forEach(([, , w], i) => xs.push(xs[i] + w + (i === 1 || i === 7 ? 8 : 0)));
      cols.forEach(([k, label, w], j) => {
        const cx = xs[j] + w / 2;
        if (reps.includes(k)) s('rect', { x: xs[j] + 3, y: top - 12, width: w - 6, height: 4, rx: 2, fill: repColor(k) }, svg);
        const words = narrow && label.length > 7 ? [label.slice(0, 4) + '.'] : [label];
        s('text', { x: cx, y: top - 20, 'text-anchor': 'middle', class: 't-muted', 'font-size': narrow ? 10 : 11.5 }, svg, words[0]);
      });
      const lo = 30, hi = 100;
      const bucket = v => Math.max(0, Math.min(6, Math.floor((v - lo) / (hi - lo) * 7)));
      types.forEach((t, i) => {
        const y = top + i * cellH, row = M[i], best = Math.max(...row.slice(2, 8));
        s('text', { x: L - 10, y: y + cellH / 2 + 4, 'text-anchor': 'end', class: t === 'All' ? 't-strong' : '', 'font-size': narrow ? 11 : 12 }, svg, narrow ? t.replace('Direction', 'Dir.').replace('Object-relative', 'Obj.-relative') : t);
        cols.forEach(([k, label, w], j) => {
          const v = row[j], g = s('g', { class: 'heat-cell' + (j >= 2 && j <= 7 && v === best ? ' best' : '') }, svg);
          const isRef = j < 2 || j === 8;
          const b = bucket(v);
          s('rect', { x: xs[j], y, width: w, height: cellH, rx: 5, fill: isRef ? css('--band') : css('--seq-' + b) }, g);
          if (j >= 2 && j <= 7 && v === best) s('rect', { class: 'ring', x: xs[j] + 2, y: y + 2, width: w - 4, height: cellH - 4, rx: 4 }, g);
          const fill = isRef ? css('--band') : css('--seq-' + b);
          const hex = fill.replace('#', ''), lum = hex.length === 6 ? [0, 2, 4].map(k => parseInt(hex.substr(k, 2), 16) / 255)
            .map(c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)).reduce((a, c, k) => a + c * [0.2126, 0.7152, 0.0722][k], 0) : 1;
          s('text', { x: xs[j] + w / 2, y: y + cellH / 2 + 4, 'text-anchor': 'middle', style: `fill:${lum < 0.28 ? '#fff' : '#111'}`, 'font-weight': t === 'All' || (j >= 2 && j <= 7 && v === best) ? 700 : 400, 'font-size': narrow ? 10.5 : 12 }, g, v.toFixed(1));
          const dRgb = j >= 2 ? ` (${(v - row[1] >= 0 ? '+' : '')}${(v - row[1]).toFixed(1)} vs RGB)` : '';
          hover(g, `<b>${t}</b> &middot; ${label}<br><b>${v.toFixed(1)}%</b>${dRgb}`);
        });
      });
    };
    responsive(f.plot, draw)();
  }

  /* shared horizontal dot plot: rows of {label, strong, points:[{v, color, name, ring}]}, optional reference lines */
  function dotRows(plot, rows, opt) {
    plot.innerHTML = '';
    const W = Math.max(300, plot.clientWidth), L = Math.min(opt.left || 170, W * 0.42), Rm = 44, rowH = opt.rowH || 30, top = opt.top || 10;
    const H = top + rows.length * rowH + 26 + (opt.gapAfter ? 12 : 0);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opt.aria }, plot);
    const [lo, hi] = opt.domain, x = v => L + (v - lo) / (hi - lo) * (W - L - Rm);
    const grid = s('g', { class: 'grid' }, svg);
    for (let v = lo; v <= hi + 1e-9; v += opt.step) { s('line', { x1: x(v), x2: x(v), y1: top - 4, y2: H - 22 }, grid); s('text', { x: x(v), y: H - 6, 'text-anchor': 'middle', class: 't-muted' }, svg, v); }
    (opt.refs || []).forEach(([t, v, c]) => {
      s('line', { x1: x(v), x2: x(v), y1: top - 4, y2: H - 22, stroke: c, 'stroke-width': 2 }, svg);
    });
    let y = top;
    rows.forEach((r, i) => {
      if (opt.gapAfter && i === opt.gapAfter) y += 12;
      const cy = y + rowH / 2;
      s('text', { x: L - 10, y: cy + 4, 'text-anchor': 'end', class: r.strong ? 't-strong' : '' }, svg, short(r.label, W));
      const vs = r.points.map(p => p.v);
      if (vs.length > 1) s('line', { x1: x(Math.min(...vs)), x2: x(Math.max(...vs)), y1: cy, y2: cy, stroke: css('--line'), 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
      const g = s('g', {}, svg);
      s('rect', { x: L, y: cy - rowH / 2, width: W - L, height: rowH, fill: 'transparent' }, g);
      r.points.forEach(p => s('circle', { cx: x(p.v), cy, r: p.big ? 7 : 5.5, fill: p.ring ? css('--surface') : p.color, stroke: p.ring ? p.color : css('--surface'), 'stroke-width': 2 }, g));
      const top1 = r.points.reduce((a, b) => (b.v > a.v ? b : a));
      s('text', { x: x(Math.max(...vs)) + 11, y: cy + 4, class: 't-strong', 'font-size': 11.5 }, svg, (r.labelPoint || top1).v.toFixed(1));
      hover(g, `<b>${r.label}</b><br>` + r.points.map(p => `${p.name}: <b>${p.v.toFixed(1)}%</b>`).join('<br>'));
      y += rowH;
    });
  }

  /* ---------- 3. estimated representations ---------- */
  function estimated(host) {
    let setting = 'vi';
    const f = frame(host, 'With estimated representations (GPT-6.1-sol)', 'Overall score; vertical lines mark the observed view(s) and estimated RGB alone');
    seg(f.controls, [['vi', 'Viewpoint Imagination'], ['cv', 'Cross-view Integration']], setting, v => { setting = v; draw(); }, 'Setting');
    const draw = () => {
      const d = R().estimated;
      if (setting === 'vi') {
        const all = d.vi[d.vi.length - 1];
        table(f.tbl, ['Question type', 'Observed', '+ Est. RGB', 'Top-down', 'Text', 'Video', 'Depth', 'Normals', 'Panorama', 'Per-type best'], d.vi.map((r, i) => [R().types.vi[i], ...r]), [3, 4, 5, 6, 7, 8]);
        legendItems(f.legend, [[repColor('observed'), 'Observed view(s) 57.2', 'line'], [repColor('rgb'), 'Estimated RGB alone 54.7', 'line']]);
        const rows = ['topdown', 'text', 'video', 'depth', 'normals', 'panorama'].map((k, i) => ({ label: '+ ' + REP_LABEL[k], points: [{ v: all[2 + i], color: repColor(k), name: REP_LABEL[k] }] }));
        rows.push({ label: 'Best per question type', strong: true, points: [{ v: all[8], color: css('--ink'), name: 'Per-type best', big: true }] });
        dotRows(f.plot, rows, { domain: [50, 70], step: 5, aria: 'Estimated representations, Viewpoint Imagination', refs: [['Observed', all[0], repColor('observed')], ['Estimated RGB', all[1], repColor('rgb')]], left: 190 });
      } else {
        const all = d.cv[d.cv.length - 1];
        table(f.tbl, ['Question type', 'Observed', '+ Est. RGB', '+ Est. depth'], d.cv.map((r, i) => [R().types.cv[i], ...r]));
        legendItems(f.legend, [[repColor('observed'), 'Observed view(s)'], [repColor('rgb'), '+ Estimated RGB'], [repColor('depth'), '+ Estimated depth']]);
        const rows = d.cv.map((r, i) => ({ label: R().types.cv[i] === 'All' ? 'Overall' : R().types.cv[i], strong: i === d.cv.length - 1,
          points: [{ v: r[0], color: repColor('observed'), name: 'Observed' }, { v: r[1], color: repColor('rgb'), name: '+ Est. RGB' }, { v: r[2], color: repColor('depth'), name: '+ Est. depth', big: true }], labelPoint: { v: r[2] } }));
        dotRows(f.plot, rows, { domain: [50, 100], step: 10, aria: 'Estimated representations, Cross-view Integration', gapAfter: 3, rowH: 34 });
      }
    };
    responsive(f.plot, draw)();
  }

  /* ---------- 4. GEARS vs. baselines (dot plot) ---------- */
  function methods(host) {
    let setting = 'vi';
    const f = frame(host, 'Comparison with spatial imagination methods', 'Accuracy (%), GPT-6.1-sol as the final reasoner');
    seg(f.controls, [['vi', 'Viewpoint Imagination'], ['cv', 'Cross-view Integration']], setting, v => { setting = v; draw(); }, 'Setting');
    const cols = () => [['MindJourney', css('--axis'), true], ['AVIC', css('--muted'), false], ['GEARS', repColor('rgb'), false]];
    const draw = () => {
      const d = R(), M = d.methods[setting], types = d.types[setting];
      legendItems(f.legend, cols().map(([t, c, ring]) => [c, t, ring ? 'ring' : '']));
      table(f.tbl, ['Question type', ...d.methods.columns], M.map((r, i) => [types[i], ...r]), [1, 2, 3]);
      const rows = types.map((t, i) => ({ label: t === 'All' ? 'Overall' : t, strong: t === 'All',
        points: cols().map(([name, c, ring], j) => ({ v: M[i][j], color: c, name, ring, big: j === 2 })), labelPoint: { v: M[i][2] } }));
      dotRows(f.plot, rows, { domain: [40, 100], step: 10, aria: 'Methods comparison', gapAfter: types.length - 1, left: 180 });
    };
    responsive(f.plot, draw)();
  }

  /* ---------- 5. ablation (dot plot) ---------- */
  function ablation(host) {
    const f = frame(host, 'Ablation of the two stages', 'Overall accuracy (%), GPT-6.1-sol');
    const d = R().ablation;
    const C = () => [[css('--axis'), 'No gate', true], [css('--muted'), '+Gating'], [repColor('topdown'), '+Routing'], [repColor('rgb'), 'Gating+Routing (GEARS)']];
    legendItems(f.legend, C().map(([c, t, ring]) => [c, t, ring ? 'ring' : '']));
    table(f.tbl, ['Setting', ...d.columns], [['Viewpoint Imagination', ...d.vi], ['Cross-view Integration', ...d.cv]], [1, 2, 3, 4]);
    const draw = () => {
      const rows = [['Viewpoint Imagination', d.vi], ['Cross-view Integration', d.cv]].map(([name, v]) => ({ label: name,
        points: C().map(([c, t, ring], j) => ({ v: v[j], color: c, name: t, ring, big: j === 3 })), labelPoint: { v: v[3] } }));
      dotRows(f.plot, rows, { domain: [50, 80], step: 10, aria: 'Ablation', rowH: 44, left: 160 });
    };
    responsive(f.plot, draw)();
  }

  return { inputs, perType, heat, estimated, methods, ablation };
})();
