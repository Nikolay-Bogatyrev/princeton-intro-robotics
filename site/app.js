(function () {
  const { makeMap, search, ALGOS, makeMap3d, search3d } = window.Planner;
  const { TERMS } = window.Terms;
  const $ = (id) => document.getElementById(id);
  const f2 = (v) => (+v).toFixed(2);
  // 1 клетка, 2 клетки, 5 клеток
  const cells = (n) => { const a = n % 10, b = n % 100; return `${n} ${a === 1 && b !== 11 ? 'клетка' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'клетки' : 'клеток'}`; };
  const t = (id, label) => `<button class="term" data-term="${id}">${label}</button>`;

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
    if (A.y === B.y) {
      const y = A.y + BH / 2;
      return A.x < B.x ? [A.x + BW, y, B.x - 6, y] : [A.x, y, B.x + BW + 6, y];
    }
    const x = A.x + BW / 2;
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
    el('text', { x: BLOCKS.drone.x + BW / 2 + 8, y: 125, class: 'loop-label' }, svg).textContent = 'мир';
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

  // ---------- Цвета ----------
  let colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['wall', 'closed', 'open', 'path', 'goal', 'cell', 'line', 'ink', 'accent', 'cur', 'muted',
      'c-BFS', 'c-Dijkstra', 'c-Greedy', 'c-A'])
      colors[k] = cs.getPropertyValue('--' + k).trim();
  }
  const algoColor = (a) => colors[a === 'A*' ? 'c-A' : 'c-' + a];

  // ---------- Плеер: ⏮ ◀ ▶ ▶| ⏭ и ползунок ----------
  class Player {
    constructor(host, { rate, onChange, onEnd, label }) {
      this.rate = rate; this.onChange = onChange; this.onEnd = onEnd; this.label = label;
      this.value = 0; this.max = 0; this.playing = false; this.acc = 0;
      host.innerHTML = `
        <button data-a="first" title="В начало">⏮</button>
        <button data-a="prev" title="Шаг назад">◀</button>
        <button data-a="play" class="primary play" title="Играть или пауза">▶</button>
        <button data-a="next" title="Шаг вперёд">▶|</button>
        <button data-a="last" title="В конец">⏭</button>
        <input type="range" min="0" value="0" aria-label="Шаг поиска">
        <span class="count"></span>`;
      this.range = host.querySelector('input');
      this.count = host.querySelector('.count');
      this.playBtn = host.querySelector('.play');
      host.addEventListener('click', (e) => {
        const a = e.target.closest('button')?.dataset.a;
        if (!a) return;
        if (a === 'play') return this.playing ? this.pause() : this.play();
        this.pause();
        if (a === 'first') this.set(0);
        if (a === 'prev') this.set(this.value - 1);
        if (a === 'next') this.set(this.value + 1);
        if (a === 'last') this.set(this.max);
      });
      this.range.addEventListener('input', () => { this.pause(); this.set(+this.range.value); });
    }
    setMax(m) { this.max = m; this.range.max = m; this.set(Math.min(this.value, m)); }
    set(v) {
      this.value = Math.max(0, Math.min(this.max, Math.round(v)));
      this.range.value = this.value;
      this.count.textContent = this.label ? this.label(this.value, this.max) : `шаг ${this.value} из ${this.max}`;
      this.onChange(this.value);
    }
    play() {
      if (this.value >= this.max) this.set(0);
      this.playing = true; this.acc = 0; this.playBtn.textContent = '⏸';
      let last = performance.now();
      const tick = (now) => {
        if (!this.playing) return;
        this.acc += Math.min(0.1, (now - last) / 1000) * this.rate();
        last = now;
        const n = Math.floor(this.acc);
        if (n) { this.acc -= n; this.set(this.value + n); }
        if (this.value >= this.max) { this.pause(); if (this.onEnd) this.onEnd(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    pause() { this.playing = false; this.playBtn.textContent = '▶'; }
  }

  const SEARCH_RATE = [8, 25, 60, 150, 500]; // клеток в секунду
  const FLY_RATE = [2, 4, 7, 11, 18];          // клеток в секунду

  // ---------- Состояние ----------
  const state = {
    seed: 5, map: null, res: null, step: 0, fly: null, clickMode: 'inspect', inspected: null,
    tab: 'step', all: null, map3: null, seed3: 1, res3: null,
  };
  const params = () => ({
    algo: $('algo').value,
    w: parseFloat($('w').value),
    density: parseFloat($('density').value),
    size: parseInt($('size').value, 10),
    speed: parseInt($('speed').value, 10),
  });

  // ---------- Рисование 2D ----------
  function fitCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth;
    if (!w) return 0;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr); }
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    return w;
  }
  // В сетке y растёт вверх, на canvas — вниз.
  const center = (x, y, cs, n) => [(x + 0.5) * cs, (n - 0.5 - y) * cs];

  function drawMap(canvas, map, res, step, opt = {}) {
    const W = fitCanvas(canvas);
    if (!W || !map) return;
    const ctx = canvas.getContext('2d');
    const { grid, start, goal } = map;
    const n = grid.length, cs = W / n;
    ctx.fillStyle = colors.cell;
    ctx.fillRect(0, 0, W, W);
    const paint = (k, color, inset = 0.5) => {
      const x = k % n, y = (k / n) | 0;
      ctx.fillStyle = color;
      ctx.fillRect(x * cs + inset, (n - 1 - y) * cs + inset, cs - 2 * inset, cs - 2 * inset);
    };
    if (res) {
      for (let i = 0; i < step; i++) paint(res.expanded[i], colors.closed);
      if (step > 0 && step < res.expanded.length) for (const k of res.frontiers[step - 1]) paint(k, colors.open);
      if (opt.current && step > 0 && step <= res.expanded.length) paint(res.expanded[step - 1], colors.cur);
    }
    ctx.fillStyle = colors.wall;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      if (grid[y][x]) ctx.fillRect(x * cs, (n - 1 - y) * cs, cs, cs);

    const line = (path, color, width, offset = 0, dash = null) => {
      if (path.length < 2) return;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = ctx.lineCap = 'round';
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      path.forEach(([x, y], i) => { const [cx, cy] = center(x, y, cs, n); i ? ctx.lineTo(cx + offset, cy + offset) : ctx.moveTo(cx + offset, cy + offset); });
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (res && step >= res.expanded.length) line(res.path, colors.path, Math.max(2, cs * 0.18));
    if (opt.paths) opt.paths.forEach((p, i) => line(p.path, p.color, Math.max(2, cs * 0.14), (i - 1.5) * cs * 0.12));
    if (opt.trace) line(opt.trace, colors.ink, Math.max(1.5, cs * 0.08), 0, [4, 4]);
    if (opt.inspected) {
      const [x, y] = opt.inspected;
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 2;
      ctx.strokeRect(x * cs + 1, (n - 1 - y) * cs + 1, cs - 2, cs - 2);
    }
    const [sx, sy] = center(...start, cs, n);
    ctx.fillStyle = colors.path;
    ctx.beginPath(); ctx.arc(sx, sy, cs * 0.35, 0, Math.PI * 2); ctx.fill();
    drawStar(ctx, ...center(...goal, cs, n), cs * 0.45);
    if (opt.drone) drawDrone(ctx, ...center(opt.drone.x, opt.drone.y, cs, n), -opt.drone.heading, cs);
  }

  function drawStar(ctx, cx, cy, R) {
    ctx.fillStyle = colors.goal;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.45 : R;
      i ? ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    ctx.closePath(); ctx.fill();
  }

  // Квадрокоптер сверху: крест из двух балок и четыре винта.
  function drawDrone(ctx, cx, cy, heading, cs) {
    const L = Math.max(cs * 0.55, 9);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(heading);
    ctx.strokeStyle = colors.ink; ctx.lineWidth = Math.max(2, L * 0.16);
    ctx.beginPath(); ctx.moveTo(-L, -L); ctx.lineTo(L, L); ctx.moveTo(-L, L); ctx.lineTo(L, -L); ctx.stroke();
    ctx.fillStyle = colors.accent; ctx.globalAlpha = 0.85;
    for (const [px, py] of [[-L, -L], [L, L], [-L, L], [L, -L]]) { ctx.beginPath(); ctx.arc(px, py, L * 0.45, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = colors.ink;
    ctx.beginPath(); ctx.arc(L * 0.35, 0, L * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function poseAt(path, d) {
    if (!path.length) return null;
    if (path.length === 1) return { x: path[0][0], y: path[0][1], heading: 0 };
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = path[i - 1], [x1, y1] = path[i];
      const seg = Math.hypot(x1 - x0, y1 - y0), heading = Math.atan2(y1 - y0, x1 - x0);
      if (d <= seg || i === path.length - 1) {
        const k = Math.min(1, d / seg);
        return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, heading };
      }
      d -= seg;
    }
  }

  // ---------- Вкладка «Пошагово» ----------
  const mainPlayer = new Player($('player-main'), {
    rate: () => SEARCH_RATE[params().speed - 1],
    onChange: (v) => { state.step = v; stopFly(); renderStep(); },
    onEnd: () => startFly(),
  });

  function startFly() {
    const r = state.res;
    if (!r.path.length) return;
    state.fly = { d: 0, on: true };
    let last = performance.now();
    const tick = (now) => {
      if (!state.fly || !state.fly.on) return;
      state.fly.d += Math.min(0.1, (now - last) / 1000) * FLY_RATE[params().speed - 1];
      last = now;
      if (state.fly.d >= r.length) { state.fly.d = r.length; state.fly.on = false; }
      renderStep();
      if (state.fly.on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function stopFly() { if (state.fly) state.fly.on = false; state.fly = null; }

  function recompute(keepStep) {
    const p = params();
    const { grid, start, goal } = state.map;
    state.res = search(grid, start, goal, p.algo, p.w);
    state.all = Object.fromEntries(ALGOS.map((a) => [a, a === p.algo ? state.res : search(grid, start, goal, a, p.w)]));
    stopFly();
    mainPlayer.pause();
    mainPlayer.max = state.res.expanded.length;
    mainPlayer.range.max = mainPlayer.max;
    mainPlayer.set(keepStep ? Math.min(state.step, mainPlayer.max) : mainPlayer.max);
    comparePlayer.pause();
    comparePlayer.setMax(Math.max(...ALGOS.map((a) => state.all[a].expanded.length)));
    comparePlayer.set(comparePlayer.max);
    renderExplain();
    renderCompareTable();
    renderTab();
  }

  function newMap() {
    const p = params();
    state.map = makeMap(p.size, p.density, state.seed);
    state.inspected = null;
    recompute();
  }

  const ALGO_TEXT = {
    'BFS': `${t('BFS', 'BFS')} достаёт из ${t('frontier', 'очереди')} клетку, которая попала туда раньше всех. Расходится волной и не учитывает, что шаг по диагонали дороже прямого.`,
    'Dijkstra': `${t('Dijkstra', 'Dijkstra')} достаёт клетку с наименьшим пройденным путём ${t('g', 'g')}. Расходится кругом и гарантирует ${t('optimal', 'кратчайший путь')}, но не знает, где цель.`,
    'Greedy': `${t('Greedy', 'Жадный поиск')} достаёт клетку, ближайшую к цели на глаз (${t('h', 'h')}). Рвётся к цели и мало проверяет, но путь может выйти длинным.`,
    'A*': `${t('A*', 'A*')} достаёт клетку с наименьшим ${t('f', 'f')} = ${t('g', 'g')} + ${t('w', 'w')}·${t('h', 'h')}: пройденный путь плюс оценка до цели. При w = 1 путь ${t('optimal', 'кратчайший')}, а проверенных клеток меньше, чем у Dijkstra.`,
  };

  function renderExplain() {
    const p = params();
    let s = ALGO_TEXT[p.algo];
    if (p.algo === 'A*' && p.w !== 1)
      s += p.w > 1 ? ` Сейчас w > 1: оценка завышена (эвристика уже не ${t('admissible', 'допустимая')}), поиск быстрее, но кратчайший путь не гарантирован.`
        : ' Сейчас w < 1: оценка занижена, а при w = 0 A* превращается в Dijkstra.';
    $('explain').innerHTML = s;
  }

  function pseudoLines(algo) {
    const pick = {
      BFS: 'клетку, которая раньше всех попала в очередь',
      Dijkstra: `клетку с наименьшим ${t('f', 'f')} = ${t('g', 'g')}`,
      Greedy: `клетку с наименьшим ${t('f', 'f')} = ${t('h', 'h')}`,
      'A*': `клетку с наименьшим ${t('f', 'f')} = ${t('g', 'g')} + ${t('w', 'w')}·${t('h', 'h')}`,
    }[algo];
    return [
      `Положить старт в ${t('frontier', 'очередь')}, g(старт) = 0`,
      'Пока очередь не пуста:',
      `достать ${pick}`,
      'если это цель — пройти назад по «откуда пришли» и вернуть путь',
      `для каждого ${t('neighbor', 'соседа')} клетки:`,
      `новый g = g(клетка) + ${t('step-cost', 'цена шага')}`,
      algo === 'BFS' ? 'если сосед ещё не встречался — запомнить «откуда пришли» и положить в очередь'
        : 'если новый g меньше известного — запомнить g и «откуда пришли», положить соседа в очередь',
      'Очередь опустела — пути нет',
    ];
  }
  const INDENT = [0, 0, 1, 1, 1, 2, 2, 0];

  const xy = (k) => [k % state.res.n, (k / state.res.n) | 0];
  const fmtXY = (k) => `(${xy(k).join(', ')})`;

  function renderStep() {
    const p = params(), r = state.res, s = state.step, total = r.expanded.length;
    const entry = s > 0 ? r.log[s - 1] : null;

    // Псевдокод с подсветкой.
    let active = [];
    if (s === 0) active = [0];
    else if (entry.goal) active = [2, 3];
    else if (s === total && !r.path.length) active = [7];
    else active = entry.added + entry.improved ? [2, 4, 5, 6] : [2, 4, 5];
    $('pseudo').innerHTML = pseudoLines(p.algo)
      .map((l, i) => `<li class="ind${INDENT[i]}${active.includes(i) ? ' hl' : ''}">${l}</li>`).join('');

    // Рассказ о шаге.
    let html;
    if (s === 0) {
      html = `<b>Шаг 0.</b> В ${t('frontier', 'очереди')} только старт ${fmtXY(r.expanded[0])}. Нажмите ▶, чтобы смотреть поиск, или ▶|, чтобы идти по одному шагу.`;
    } else {
      const fVal = p.algo === 'A*' ? entry.g + p.w * entry.h : p.algo === 'Dijkstra' ? entry.g : entry.h;
      const fFormula = p.algo === 'A*' ? `${t('f', 'f')} = ${t('g', 'g')} + ${t('w', 'w')}·${t('h', 'h')} = ${f2(entry.g)} + ${p.w}·${f2(entry.h)} = <b>${f2(fVal)}</b>`
        : p.algo === 'Dijkstra' ? `${t('f', 'f')} = ${t('g', 'g')} = <b>${f2(entry.g)}</b>`
        : p.algo === 'Greedy' ? `${t('f', 'f')} = ${t('h', 'h')} = <b>${f2(entry.h)}</b>` : '';
      const why = p.algo === 'BFS' ? 'она дольше всех ждала в очереди' : 'у неё наименьший f во всей очереди';
      html = `<b>Шаг ${s}.</b> Достали клетку ${fmtXY(entry.k)}: ${why}.`;
      html += `<div class="nums">${t('g', 'g')} = ${f2(entry.g)} · ${t('h', 'h')} = ${f2(entry.h)}${fFormula ? '<br>' + fFormula : ''}</div>`;
      if (entry.goal) {
        html += `Это цель! Идём по стрелкам «откуда пришли» от цели к старту и получаем путь: ${r.path.length - 1} шагов, ${t('path-length', 'длина')} ${f2(r.length)}.`;
        if (state.fly) html += ' Дрон летит по пути.';
      } else {
        html += `Новых соседей в очередь: <b>${entry.added}</b>.`;
        if (p.algo !== 'BFS') html += ` Нашли более короткий путь к уже известным: <b>${entry.improved}</b>.`;
        html += ` В очереди теперь ${cells(r.frontiers[s - 1].length)}.`;
        if (s === total) html += ' Очередь опустела, а цель так и не встретилась: <b>пути нет</b>.';
      }
    }
    $('narrative').innerHTML = html;
    renderInspector();

    const phase = $('phase');
    phase.textContent = state.fly && state.fly.on ? 'дрон летит по пути'
      : s < total ? `поиск: шаг ${s} из ${total}`
      : r.path.length ? `путь найден · длина ${f2(r.length)}` : 'пути нет';
    phase.classList.toggle('on', mainPlayer.playing || !!(state.fly && state.fly.on));
    setActive(state.fly && state.fly.on ? ['trajectory', 'controller', 'drone'] : mainPlayer.playing ? ['planner'] : []);

    const drone = r.path.length ? poseAt(r.path, state.fly ? state.fly.d : (s >= total ? r.length : 0)) : null;
    drawMap($('world'), state.map, r, s, { current: true, drone, inspected: state.inspected, trace: inspectTrace() });
  }

  function inspectTrace() {
    const c = state.inspected, r = state.res;
    if (!c) return null;
    const k = c[1] * r.n + c[0];
    if (!(r.closedAt.get(k) <= state.step)) return null;
    const out = [];
    for (let q = k; q !== -1 && q !== undefined; q = r.parent.get(q)) out.push(xy(q));
    return out;
  }

  function renderInspector() {
    const c = state.inspected, box = $('inspector');
    if (!c) { box.classList.add('muted'); box.innerHTML = state.clickMode === 'inspect' ? 'Кликните по клетке на карте.' : 'Включите «Осмотреть клетку» и кликните по карте.'; return; }
    box.classList.remove('muted');
    const p = params(), r = state.res, [x, y] = c, k = y * r.n + x;
    const { start, goal, grid } = state.map;
    let s = `<b>Клетка (${x}, ${y})</b>`;
    if (x === start[0] && y === start[1]) s += ' — старт';
    if (x === goal[0] && y === goal[1]) s += ' — цель';
    if (grid[y][x]) { box.innerHTML = s + '. Это препятствие: алгоритм в неё не заходит.'; return; }
    const at = r.closedAt.get(k);
    const inQueue = state.step > 0 && state.step <= r.frontiers.length && r.frontiers[state.step - 1].includes(k);
    const status = at !== undefined && at <= state.step ? `${t('closed', 'проверена')} на шаге ${at}`
      : inQueue ? `ждёт в ${t('frontier', 'очереди')}`
      : r.gCost.has(k) && at === undefined ? 'алгоритм её увидел, но так и не проверил: цель нашлась раньше'
      : 'алгоритм до неё ещё не дошёл';
    s += `<br>Статус: ${status}.`;
    const h = window.Planner.heuristic([x, y], goal);
    if (r.gCost.has(k)) {
      const g = r.gCost.get(k), fv = p.algo === 'A*' ? g + p.w * h : p.algo === 'Dijkstra' ? g : h;
      s += `<div class="nums">${t('g', 'g')} = ${f2(g)} · ${t('h', 'h')} = ${f2(h)}${p.algo !== 'BFS' ? ` · ${t('f', 'f')} = ${f2(fv)}` : ''}</div>`;
      const par = r.parent.get(k);
      if (par !== -1) s += `Пришли из клетки ${fmtXY(par)}.`;
      if (at !== undefined && at <= state.step) s += ' Пунктир на карте — лучший путь от старта до этой клетки.';
    } else {
      s += `<div class="nums">${t('h', 'h')} = ${f2(h)} · ${t('g', 'g')} неизвестно: путь к клетке ещё не найден.</div>`;
    }
    box.innerHTML = s;
  }

  $('world').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect(), n = state.map.grid.length;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    const y = n - 1 - Math.floor(((e.clientY - rect.top) / rect.height) * n);
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    if (state.clickMode === 'inspect') { state.inspected = [x, y]; renderStep(); return; }
    const { start, goal, grid } = state.map;
    if ((x === start[0] && y === start[1]) || (x === goal[0] && y === goal[1])) return;
    grid[y][x] = grid[y][x] ? 0 : 1;
    recompute();
  });
  document.querySelectorAll('[data-click]').forEach((b) => b.addEventListener('click', () => {
    state.clickMode = b.dataset.click;
    document.querySelectorAll('[data-click]').forEach((o) => o.classList.toggle('on', o === b));
    renderInspector();
  }));

  // ---------- Вкладка «Сравнение» ----------
  const minis = $('minis');
  minis.innerHTML = ALGOS.map((a) => `
    <button class="mini" data-algo="${a}">
      <canvas aria-label="${a}"></canvas>
      <span class="mini-cap"><i class="sw" style="background:var(--${a === 'A*' ? 'c-A' : 'c-' + a})"></i><b>${a}</b> <span class="mini-stat"></span></span>
    </button>`).join('');
  minis.addEventListener('click', (e) => {
    const b = e.target.closest('.mini');
    if (!b) return;
    $('algo').value = b.dataset.algo;
    recompute();
    switchTab('step');
  });
  const comparePlayer = new Player($('player-compare'), {
    rate: () => SEARCH_RATE[params().speed - 1],
    onChange: () => renderCompare(),
  });

  function renderCompare() {
    if (!state.all) return;
    const s = comparePlayer.value;
    minis.querySelectorAll('.mini').forEach((b) => {
      const r = state.all[b.dataset.algo], step = Math.min(s, r.expanded.length);
      drawMap(b.querySelector('canvas'), state.map, r, step, { current: true });
      b.querySelector('.mini-stat').textContent = step < r.expanded.length ? `ищет: ${step}` : `проверил ${r.expanded.length}`;
    });
    drawMap($('overlay'), state.map, null, 0, {
      paths: ALGOS.map((a) => ({ path: state.all[a].path, color: algoColor(a) })),
    });
  }

  function renderCompareTable() {
    const p = params();
    const best = Math.min(...ALGOS.map((a) => (state.all[a].path.length ? state.all[a].length : Infinity)));
    $('compare').innerHTML = ALGOS.map((a) => {
      const r = state.all[a];
      const name = a === 'A*' ? `A* (w = ${p.w})` : a;
      const len = r.path.length ? f2(r.length) : 'пути нет';
      const extra = !r.path.length ? '—' : r.length - best < 1e-9 ? 'кратчайший ✓' : `+${(((r.length - best) / best) * 100).toFixed(1)}%`;
      return `<tr class="${a === p.algo ? 'current' : ''}"><td><i class="sw" style="background:${algoColor(a)}"></i>${name}</td><td>${r.expanded.length}</td><td>${len}</td><td>${extra}</td></tr>`;
    }).join('');
  }

  // ---------- Вкладка «3D» ----------
  const player3 = new Player($('player-3d'), {
    rate: () => SEARCH_RATE[params().speed - 1] * 2,
    onChange: (v) => window.View3D && window.View3D.setStep(v),
    onEnd: () => window.View3D && window.View3D.fly(FLY_RATE[params().speed - 1]),
    label: (v, m) => `проверено ${v} из ${m} вокселей`,
  });

  function recompute3d() {
    const p = params();
    if (!state.map3) state.map3 = makeMap3d(14, 8, 0.18, state.seed3);
    state.res3 = search3d(state.map3, p.algo, p.w);
    // Тот же мир, но дрон обязан держаться на одной высоте у пола.
    const m = state.map3, floor = { grid: m.grid[0], start: [m.start[0], m.start[1]], goal: [m.goal[0], m.goal[1]] };
    const r2 = search(floor.grid, floor.start, floor.goal, p.algo, p.w);
    const r3 = state.res3, n = m.n;
    $('d3-table').innerHTML = `
      <tr><td>Клеток в мире</td><td>${n}×${n} = ${n * n}</td><td>${n}×${n}×${m.h} = ${n * n * m.h}</td></tr>
      <tr><td>${t('neighbor', 'Соседей')} у клетки</td><td>8</td><td>26</td></tr>
      <tr><td>${p.algo} ${t('closed', 'проверил')}</td><td>${r2.expanded.length}</td><td>${r3.expanded.length}</td></tr>
      <tr><td>Путь</td><td>${r2.path.length ? f2(r2.length) : '<b>нет</b>: стена от пола до потолка, а окно выше'}</td><td>${r3.path.length ? f2(r3.length) + ', через окно в стене' : 'нет'}</td></tr>`;
    if (window.View3D && window.View3D.ready) {
      window.View3D.setData(state.map3, state.res3, colors);
      player3.pause();
      player3.setMax(state.res3.expanded.length);
      player3.set(player3.max);
    }
  }

  function open3d() {
    recompute3d();
    window.View3D.load($('view3d')).then(() => {
      window.View3D.setData(state.map3, state.res3, colors);
      player3.setMax(state.res3.expanded.length);
      player3.set(player3.max);
    }).catch(() => {
      $('view3d').innerHTML = '<div class="loading">Не удалось загрузить 3D-библиотеку. Проверьте интернет и обновите страницу.</div>';
    });
  }
  $('new-map-3d').addEventListener('click', () => { state.seed3 += 1; state.map3 = null; recompute3d(); });

  // ---------- Словарь и всплывающие подсказки ----------
  function termCtx() {
    const p = params(), r = state.res;
    let free = 0;
    for (const row of state.map.grid) for (const v of row) free += v ? 0 : 1;
    return {
      algo: p.algo, w: p.w, n: state.map.grid.length, free, res: r, step: state.step,
      entry: state.step > 0 ? r.log[state.step - 1] : null,
      d3: state.map3 ? { n: state.map3.n, h: state.map3.h } : null,
    };
  }
  function termHTML(id, withTitle = true) {
    const d = TERMS[id];
    if (!d) return '';
    let live = '';
    try { live = d.live ? d.live(termCtx()) : ''; } catch (e) { live = ''; }
    return (withTitle ? `<h4>${d.title}</h4>` : '') + `<p>${d.text}</p>` +
      (d.formula ? `<div class="formula">${d.formula}</div>` : '') +
      (d.formulaNote ? `<p class="note">${d.formulaNote}</p>` : '') +
      (live ? `<p class="live"><span>На этой карте:</span> ${live}</p>` : '');
  }

  const pop = $('term-pop');
  let popFor = null;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.term');
    if (b) {
      e.preventDefault(); e.stopPropagation();
      if (popFor === b && !pop.hidden) return closePop();
      popFor = b;
      pop.querySelector('.body').innerHTML = termHTML(b.dataset.term);
      pop.hidden = false;
      placePop(b);
      return;
    }
    if (!pop.hidden && !e.target.closest('#term-pop')) closePop();
  }, true);
  pop.querySelector('.close').addEventListener('click', closePop);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
  function closePop() { pop.hidden = true; popFor = null; }
  function placePop(b) {
    if (window.innerWidth < 640) { pop.style.left = pop.style.top = ''; return; } // нижняя шторка через CSS
    const r = b.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(window.innerWidth - pw - 12, Math.max(12, r.left + r.width / 2 - pw / 2));
    let top = r.bottom + 8;
    if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 8);
    pop.style.left = left + window.scrollX + 'px';
    pop.style.top = top + window.scrollY + 'px';
  }

  function renderGlossary() {
    $('glossary').innerHTML = Object.keys(TERMS).map((id) => `<article class="gl-card" id="gl-${id}">${termHTML(id)}</article>`).join('');
  }

  // ---------- Вкладки ----------
  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    for (const id of ['step', 'compare', 'd3', 'glossary']) $('tab-' + id).hidden = id !== tab;
    try { history.replaceState(null, '', tab === 'step' ? location.pathname : '#' + tab); } catch (e) {}
    renderTab();
  }
  function renderTab() {
    if (state.tab === 'step') renderStep();
    if (state.tab === 'compare') renderCompare();
    if (state.tab === 'glossary') renderGlossary();
    if (state.tab === 'd3') open3d();
  }
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // ---------- Управление ----------
  $('algo').innerHTML = ALGOS.map((a) => `<option${a === 'A*' ? ' selected' : ''}>${a}</option>`).join('');
  const outputs = { w: (v) => parseFloat(v).toFixed(1), density: (v) => Math.round(v * 100) + '%', speed: (v) => '×' + v };
  for (const id in outputs) {
    const sync = () => { $(id + '-out').textContent = outputs[id]($(id).value); };
    $(id).addEventListener('input', sync);
    sync();
  }
  $('algo').addEventListener('change', () => recompute());
  $('w').addEventListener('input', () => recompute());
  $('density').addEventListener('input', newMap);
  $('size').addEventListener('change', newMap);
  $('new-map').addEventListener('click', () => { state.seed += 1; newMap(); });
  $('clear').addEventListener('click', () => { for (const row of state.map.grid) row.fill(0); recompute(); });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    readColors(); renderTab();
    if (state.tab === 'd3' && window.View3D && window.View3D.ready) window.View3D.setData(state.map3, state.res3, colors);
  });
  window.addEventListener('resize', () => { renderTab(); if (!pop.hidden && popFor) placePop(popFor); });

  buildSchema();
  readColors();
  selectBlock('planner');
  newMap();
  const startTab = location.hash.slice(1);
  if (['compare', 'd3', 'glossary'].includes(startTab)) switchTab(startTab);
})();
