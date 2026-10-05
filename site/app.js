(function () {
  const { makeMap, search, ALGOS } = window.Planner;
  const $ = (id) => document.getElementById(id);

  // ---------- Схема робота ----------
  const BLOCKS = {
    sensors:    { x: 10,  y: 30,  title: 'Датчики',          tag: 'лекция 9',
      info: 'Гироскоп, акселерометр, камера, датчик оптического потока под дроном. Сейчас дрон знает своё положение точно. Это упрощение, которое уберут лекции 9–15.' },
    estimation: { x: 185, y: 30,  title: 'Оценка состояния', tag: 'лекции 10–15',
      info: 'Собирает шумные показания датчиков в ответ на вопрос «где я и куда лечу». Байесовский фильтр, фильтр Калмана, частичный фильтр, SLAM.' },
    planner:    { x: 360, y: 30,  title: 'Планировщик',      tag: 'лекции 2–3', open: true,
      info: 'Ищет путь от старта к цели в обход препятствий. Сейчас это поиск по сетке: BFS, Dijkstra, жадный поиск, A*. В лекции 3 добавится RRT, поиск без сетки.' },
    trajectory: { x: 360, y: 150, title: 'Траектория',       tag: 'лекции 5–6',
      info: 'Превращает ломаную из клеток в плавную траекторию, которую дрон физически может пролететь. Сейчас дрон просто едет по ломаной.' },
    controller: { x: 185, y: 150, title: 'Регулятор',        tag: 'лекции 7–8',
      info: 'Сравнивает, где дрон должен быть и где он есть, и решает, какую тягу дать моторам. ПД-регулятор, LQR. Сейчас дрон слушается идеально.' },
    drone:      { x: 10,  y: 150, title: 'Дрон',             tag: 'лекция 4',
      info: 'Физика: масса, тяга четырёх моторов, гравитация, инерция. Сейчас дрон — точка без инерции. С лекции 4 он станет настоящим квадрокоптером.' },
  };
  const BW = 150, BH = 64;
  const ARROWS = [
    ['sensors', 'estimation'], ['estimation', 'planner'], ['planner', 'trajectory'],
    ['trajectory', 'controller'], ['controller', 'drone'], ['drone', 'sensors'],
  ];
  const svg = $('schema');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  function arrowPoints(a, b) {
    const A = BLOCKS[a], B = BLOCKS[b];
    if (A.y === B.y) { // горизонтальная
      const y = A.y + BH / 2;
      return A.x < B.x ? [A.x + BW, y, B.x - 6, y] : [A.x, y, B.x + BW + 6, y];
    }
    const x = A.x + BW / 2; // вертикальная
    return A.y < B.y ? [x, A.y + BH, x, B.y - 6] : [x, A.y, x, B.y + BH + 6];
  }

  function buildSchema() {
    const defs = el('defs', {}, svg);
    for (const [id, cls] of [['ah', 'arrowhead'], ['ah-on', 'arrowhead-active']]) {
      const m = el('marker', { id, viewBox: '0 0 10 10', refX: 4, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', class: cls }, m);
    }
    for (const [a, b] of ARROWS) {
      const [x1, y1, x2, y2] = arrowPoints(a, b);
      el('line', { x1, y1, x2, y2, class: 'arrow', id: `ar-${a}-${b}`, 'marker-end': 'url(#ah)' }, svg);
    }
    const mid = BLOCKS.drone.x + BW / 2;
    el('text', { x: mid + 8, y: 125, class: 'loop-label' }, svg).textContent = 'мир';
    el('text', { x: 260, y: 242, class: 'loop-label', 'text-anchor': 'middle' }, svg).textContent =
      'Лекции 16–23: обучение заменяет часть схемы нейросетью';
    for (const id in BLOCKS) {
      const b = BLOCKS[id];
      const g = el('g', { class: 'blk' + (b.open ? ' open' : ''), id: `blk-${id}`, tabindex: 0, role: 'button' }, svg);
      el('rect', { x: b.x, y: b.y, width: BW, height: BH, rx: 10 }, g);
      el('text', { x: b.x + BW / 2, y: b.y + 28, 'text-anchor': 'middle' }, g).textContent = b.title;
      el('text', { x: b.x + BW / 2, y: b.y + 47, 'text-anchor': 'middle', class: 'tag' }, g).textContent = b.tag;
      const pick = () => selectBlock(id);
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    }
  }

  function selectBlock(id) {
    for (const k in BLOCKS) $(`blk-${k}`).classList.toggle('selected', k === id);
    const b = BLOCKS[id];
    $('block-info').innerHTML = `<b>${b.title} · ${b.tag}</b>${b.info}`;
  }

  function setActive(blocks) {
    for (const k in BLOCKS) $(`blk-${k}`).classList.toggle('active', blocks.includes(k));
    for (const [a, b] of ARROWS) {
      const on = blocks.includes(a) && blocks.includes(b);
      const line = $(`ar-${a}-${b}`);
      line.classList.toggle('active', on);
      line.setAttribute('marker-end', on ? 'url(#ah-on)' : 'url(#ah)');
    }
  }

  // ---------- Мир ----------
  const canvas = $('world');
  const ctx = canvas.getContext('2d');
  let colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['wall', 'closed', 'open', 'path', 'goal', 'cell', 'line', 'ink', 'accent'])
      colors[k] = cs.getPropertyValue('--' + k).trim();
  }

  const state = {
    seed: 1, map: null, res: null, step: 0, phase: 'idle', flyDist: 0, last: 0,
  };
  const SEARCH_RATE = [15, 40, 90, 200, 600]; // клеток в секунду
  const FLY_RATE = [2, 4, 7, 11, 18];          // клеток в секунду

  const params = () => ({
    algo: $('algo').value,
    w: parseFloat($('w').value),
    density: parseFloat($('density').value),
    size: parseInt($('size').value, 10),
    speed: parseInt($('speed').value, 10),
  });

  function newMap() {
    const p = params();
    state.map = makeMap(p.size, p.density, state.seed);
    recompute();
  }

  function recompute() {
    const p = params();
    const { grid, start, goal } = state.map;
    state.res = search(grid, start, goal, p.algo, p.w);
    state.step = state.res.expanded.length;
    state.phase = 'idle';
    state.flyDist = 0;
    updateCompare();
    updateText();
    draw();
  }

  function updateCompare() {
    const p = params();
    const { grid, start, goal } = state.map;
    $('compare').innerHTML = ALGOS.map((a) => {
      const r = search(grid, start, goal, a, p.w);
      const name = a === 'A*' ? `A* (w = ${p.w})` : a;
      const len = r.path.length ? r.length.toFixed(2) : 'пути нет';
      return `<tr class="${a === p.algo ? 'current' : ''}"><td>${name}</td><td>${r.expanded.length}</td><td>${len}</td></tr>`;
    }).join('');
  }

  const ALGO_TEXT = {
    'BFS': 'BFS достаёт из очереди ту клетку, что попала туда раньше всех. Он расходится волной и не учитывает, что шаг по диагонали дороже прямого.',
    'Dijkstra': 'Dijkstra достаёт клетку с наименьшим пройденным путём g. Он расходится кругом и гарантирует кратчайший путь, но не знает, где цель.',
    'Greedy': 'Жадный поиск достаёт клетку, ближайшую к цели «на глаз» (h). Он рвётся к цели и мало проверяет, но путь может выйти длинным.',
    'A*': 'A* достаёт клетку с наименьшим g + w·h: пройденный путь плюс оценка до цели. При w = 1 путь кратчайший, а проверенных клеток меньше, чем у Dijkstra.',
  };

  function updateText() {
    const p = params();
    const r = state.res;
    let s = ALGO_TEXT[p.algo];
    if (p.algo === 'A*' && p.w !== 1)
      s += p.w > 1 ? ' Сейчас w > 1: оценка завышена, поиск быстрее, но кратчайший путь не гарантирован.'
        : ' Сейчас w < 1: оценка занижена, и при w = 0 A* превращается в Dijkstra.';
    $('explain').textContent = s;

    const phase = $('phase');
    const texts = {
      idle: r.path.length ? `проверено ${r.expanded.length} клеток · путь ${r.length.toFixed(2)}` : `проверено ${r.expanded.length} клеток · пути нет`,
      search: `ищу путь: шаг ${state.step} из ${r.expanded.length}`,
      fly: 'дрон летит по пути',
      done: r.path.length ? `долетел · путь ${r.length.toFixed(2)}` : 'пути нет: цель недостижима',
    };
    phase.textContent = texts[state.phase];
    phase.classList.toggle('on', state.phase === 'search' || state.phase === 'fly');
    setActive(state.phase === 'search' ? ['planner'] : state.phase === 'fly' ? ['trajectory', 'controller', 'drone'] : []);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // В сетке y растёт вверх (как в ноутбуке), на canvas — вниз.
  function cellXY(x, y, cs, n) { return [x * cs, (n - 1 - y) * cs]; }
  function center(x, y, cs, n) { return [(x + 0.5) * cs, (n - 0.5 - y) * cs]; }

  function draw() {
    if (!state.map) return;
    const W = canvas.clientWidth;
    const { grid, start, goal } = state.map;
    const n = grid.length, cs = W / n, r = state.res;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = colors.cell;
    ctx.fillRect(0, 0, W, W);

    const paint = (k, color) => {
      const [px, py] = cellXY(k % n, (k / n) | 0, cs, n);
      ctx.fillStyle = color;
      ctx.fillRect(px + 0.5, py + 0.5, cs - 1, cs - 1);
    };
    for (let i = 0; i < state.step; i++) paint(r.expanded[i], colors.closed);
    if (state.step > 0 && state.step < r.expanded.length)
      for (const k of r.frontiers[state.step - 1]) paint(k, colors.open);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (grid[y][x]) {
          const [px, py] = cellXY(x, y, cs, n);
          ctx.fillStyle = colors.wall;
          ctx.fillRect(px, py, cs, cs);
        }

    const searchDone = state.step >= r.expanded.length;
    if (searchDone && r.path.length > 1) {
      ctx.strokeStyle = colors.path;
      ctx.lineWidth = Math.max(2, cs * 0.18);
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      r.path.forEach(([x, y], i) => { const [cx, cy] = center(x, y, cs, n); i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy); });
      ctx.stroke();
    }

    const [sx, sy] = center(...start, cs, n);
    ctx.fillStyle = colors.path;
    ctx.beginPath(); ctx.arc(sx, sy, cs * 0.35, 0, Math.PI * 2); ctx.fill();
    drawStar(...center(...goal, cs, n), cs * 0.45);

    if (state.phase === 'fly' || state.phase === 'done' || state.phase === 'idle') {
      const pose = poseAt(state.phase === 'idle' ? 0 : state.flyDist);
      if (pose) drawDrone(...center(pose.x, pose.y, cs, n), -pose.heading, cs);
    }
  }

  function drawStar(cx, cy, R) {
    ctx.fillStyle = colors.goal;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.45 : R;
      const px = cx + rr * Math.cos(a), py = cy + rr * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  // Квадрокоптер сверху: крест из двух балок и четыре винта.
  function drawDrone(cx, cy, heading, cs) {
    const L = Math.max(cs * 0.55, 9);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heading);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = Math.max(2, L * 0.16);
    ctx.beginPath();
    ctx.moveTo(-L, -L); ctx.lineTo(L, L);
    ctx.moveTo(-L, L); ctx.lineTo(L, -L);
    ctx.stroke();
    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.85;
    for (const [px, py] of [[-L, -L], [L, L], [-L, L], [L, -L]]) {
      ctx.beginPath(); ctx.arc(px, py, L * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.ink;
    ctx.beginPath(); ctx.arc(L * 0.35, 0, L * 0.18, 0, Math.PI * 2); ctx.fill(); // «нос»
    ctx.restore();
  }

  // Положение дрона на расстоянии d вдоль пути.
  function poseAt(d) {
    const path = state.res.path;
    if (!path.length) return null;
    if (path.length === 1) return { x: path[0][0], y: path[0][1], heading: 0 };
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = path[i - 1], [x1, y1] = path[i];
      const seg = Math.hypot(x1 - x0, y1 - y0);
      const heading = Math.atan2(y1 - y0, x1 - x0);
      if (d <= seg || i === path.length - 1) {
        const t = Math.min(1, d / seg);
        return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, heading };
      }
      d -= seg;
    }
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - state.last) / 1000);
    state.last = now;
    const p = params();
    const r = state.res;
    if (state.phase === 'search') {
      state.acc = (state.acc || 0) + dt * SEARCH_RATE[p.speed - 1];
      const n = Math.floor(state.acc);
      state.acc -= n;
      state.step = Math.min(r.expanded.length, state.step + n);
      if (state.step >= r.expanded.length) state.phase = r.path.length ? 'fly' : 'done';
    } else if (state.phase === 'fly') {
      state.flyDist += dt * FLY_RATE[p.speed - 1];
      if (state.flyDist >= r.length) { state.flyDist = r.length; state.phase = 'done'; }
    }
    updateText();
    draw();
    if (state.phase === 'search' || state.phase === 'fly') requestAnimationFrame(tick);
  }

  function run() {
    recompute();
    state.step = 0;
    state.acc = 0;
    state.phase = 'search';
    state.last = performance.now();
    selectBlock('planner');
    requestAnimationFrame(tick);
  }

  // ---------- Управление ----------
  $('algo').innerHTML = ALGOS.map((a) => `<option${a === 'A*' ? ' selected' : ''}>${a}</option>`).join('');
  const outputs = {
    w: (v) => parseFloat(v).toFixed(1),
    density: (v) => Math.round(v * 100) + '%',
    speed: (v) => '×' + v,
  };
  for (const id in outputs) {
    const sync = () => { $(id + '-out').textContent = outputs[id]($(id).value); };
    $(id).addEventListener('input', sync);
    sync();
  }
  $('algo').addEventListener('change', recompute);
  $('w').addEventListener('input', recompute);
  $('density').addEventListener('input', newMap);
  $('size').addEventListener('change', newMap);
  $('run').addEventListener('click', run);
  $('new-map').addEventListener('click', () => { state.seed += 1; newMap(); });
  $('clear').addEventListener('click', () => {
    for (const row of state.map.grid) row.fill(0);
    recompute();
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const n = state.map.grid.length;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    const y = n - 1 - Math.floor(((e.clientY - rect.top) / rect.height) * n);
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const { start, goal, grid } = state.map;
    if ((x === start[0] && y === start[1]) || (x === goal[0] && y === goal[1])) return;
    grid[y][x] = grid[y][x] ? 0 : 1;
    recompute();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); draw(); });
  window.addEventListener('resize', resize);

  buildSchema();
  readColors();
  selectBlock('planner');
  newMap();
  resize();
})();
