// Поиск пути по сетке: тот же алгоритм, что в project/01-graph-search.ipynb.
// Работает и в браузере (window.Planner), и в node (для тестов).
(function (root) {
  const SQRT2 = Math.SQRT2;
  const MOVES = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
  ];

  // Детерминированный генератор случайных чисел: один seed — одна карта.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // grid[y][x]: 1 — препятствие, 0 — свободно. Старт слева внизу, цель справа вверху.
  function makeMap(n, density, seed) {
    const rand = rng(seed);
    const grid = [];
    for (let y = 0; y < n; y++) {
      const row = [];
      for (let x = 0; x < n; x++) row.push(rand() < density ? 1 : 0);
      grid.push(row);
    }
    const start = [1, 1], goal = [n - 2, n - 2];
    for (const [cx, cy] of [start, goal])
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++) grid[y][x] = 0;
    return { grid, start, goal };
  }

  // Длина пути по пустой сетке с диагоналями. Никогда не завышает.
  function heuristic(a, b) {
    const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  }

  function neighbors(grid, x, y) {
    const n = grid.length, out = [];
    for (const [dx, dy, cost] of MOVES) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || grid[ny][nx]) continue;
      if (dx && dy && (grid[y][nx] || grid[ny][x])) continue; // не срезаем угол
      out.push([nx, ny, cost]);
    }
    return out;
  }

  // Минимальная двоичная куча по priority, при равенстве — по порядку добавления.
  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    less(i, j) { const p = this.a[i], q = this.a[j]; return p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]); }
    swap(i, j) { [this.a[i], this.a[j]] = [this.a[j], this.a[i]]; }
    push(item) {
      this.a.push(item);
      let i = this.a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (!this.less(i, p)) break; this.swap(i, p); i = p; }
    }
    pop() {
      const top = this.a[0], last = this.a.pop();
      if (this.a.length) {
        this.a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < this.a.length && this.less(l, m)) m = l;
          if (r < this.a.length && this.less(r, m)) m = r;
          if (m === i) break;
          this.swap(i, m); i = m;
        }
      }
      return top;
    }
    items() { return this.a.map((e) => e[2]); }
  }

  // Один код на все алгоритмы: отличается только приоритет в очереди.
  // Возвращает путь, порядок проверки клеток и фронтир на каждом шаге.
  function search(grid, start, goal, algo, w = 1) {
    const n = grid.length, key = (x, y) => y * n + x;
    const priority = (g, x, y) =>
      algo === 'Dijkstra' ? g :
      algo === 'Greedy' ? heuristic([x, y], goal) :
      g + w * heuristic([x, y], goal);

    const gCost = new Map([[key(...start), 0]]);
    const parent = new Map([[key(...start), -1]]);
    const closed = new Set();
    const expanded = [], frontiers = [], log = [];
    let counter = 0;
    const bfs = algo === 'BFS';
    const queue = bfs ? [key(...start)] : new Heap();
    let head = 0;
    if (!bfs) queue.push([priority(0, ...start), 0, key(...start)]);
    const goalKey = key(...goal);

    while (bfs ? head < queue.length : queue.size) {
      const k = bfs ? queue[head++] : queue.pop()[2];
      if (closed.has(k)) continue;
      closed.add(k);
      expanded.push(k);
      const x = k % n, y = (k / n) | 0;
      const entry = { k, g: gCost.get(k), h: heuristic([x, y], goal), added: 0, improved: 0, goal: k === goalKey };
      log.push(entry);
      if (k === goalKey) { frontiers.push(bfs ? queue.slice(head) : queue.items()); break; }
      for (const [nx, ny, cost] of neighbors(grid, x, y)) {
        const nk = key(nx, ny), g = gCost.get(k) + cost;
        if (bfs) {
          if (!parent.has(nk)) { parent.set(nk, k); gCost.set(nk, g); queue.push(nk); entry.added++; }
        } else if (!closed.has(nk) && g < (gCost.has(nk) ? gCost.get(nk) : Infinity)) {
          if (gCost.has(nk)) entry.improved++; else entry.added++;
          gCost.set(nk, g); parent.set(nk, k);
          queue.push([priority(g, nx, ny), ++counter, nk]);
        }
      }
      // Фронтир после шага: что осталось в очереди.
      frontiers.push(bfs ? queue.slice(head) : queue.items().filter((q) => !closed.has(q)));
    }

    const path = [];
    if (closed.has(goalKey)) {
      for (let k = goalKey; k !== -1; k = parent.get(k)) path.push([k % n, (k / n) | 0]);
      path.reverse();
    }
    let length = 0;
    for (let i = 1; i < path.length; i++)
      length += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    return { path, length, expanded, frontiers, log, gCost, parent, closedAt: new Map(expanded.map((k, i) => [k, i + 1])), n };
  }

  // ---------- 3D: тот же A*, но в кубиках-вокселях ----------
  // grid[z][y][x]; 26 соседей; цена шага 1, √2 или √3.
  function makeMap3d(n, h, density, seed) {
    const rand = rng(seed * 7919);
    const grid = [];
    for (let z = 0; z < h; z++) {
      grid.push([]);
      for (let y = 0; y < n; y++) grid[z].push(new Array(n).fill(0));
    }
    // Колонны разной высоты от пола и несколько висящих плит.
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (rand() < density) {
          const top = 1 + Math.floor(rand() * h);
          for (let z = 0; z < top; z++) grid[z][y][x] = 1;
        }
    for (let s = 0; s < 3; s++) {
      const z = 2 + Math.floor(rand() * (h - 3)), x0 = Math.floor(rand() * (n - 4)), y0 = Math.floor(rand() * (n - 4));
      for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) grid[z][y][x] = 1;
    }
    // Стена поперёк карты с окном: прямой путь у пола закрыт.
    const wy = Math.floor(n / 2), gx = Math.floor(rand() * (n - 3)) + 1, gz = h - 3;
    for (let z = 0; z < h; z++) for (let x = 0; x < n; x++)
      grid[z][wy][x] = (z >= gz && z <= gz + 1 && x >= gx && x <= gx + 1) ? 0 : 1;
    const start = [1, 1, 0], goal = [n - 2, n - 2, 0];
    for (const [cx, cy, cz] of [start, goal])
      for (let z = cz; z <= cz + 1; z++)
        for (let y = cy - 1; y <= cy + 1; y++)
          for (let x = cx - 1; x <= cx + 1; x++) grid[z][y][x] = 0;
    return { grid, start, goal, n, h };
  }

  function heuristic3d(a, b) {
    const d = [Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])].sort((p, q) => p - q);
    return Math.sqrt(3) * d[0] + SQRT2 * (d[1] - d[0]) + (d[2] - d[1]);
  }

  function search3d(map, algo, w = 1) {
    const { grid, start, goal, n, h } = map;
    const key = (x, y, z) => (z * n + y) * n + x;
    const unkey = (k) => [k % n, ((k / n) | 0) % n, (k / (n * n)) | 0];
    const free = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < n && y < n && z < h && !grid[z][y][x];
    const priority = (g, p) =>
      algo === 'Dijkstra' ? g : algo === 'Greedy' ? heuristic3d(p, goal) : g + w * heuristic3d(p, goal);
    const bfs = algo === 'BFS';
    const sk = key(...start), gk = key(...goal);
    const gCost = new Map([[sk, 0]]), parent = new Map([[sk, -1]]), closed = new Set(), expanded = [];
    const queue = bfs ? [sk] : new Heap();
    let head = 0, counter = 0;
    if (!bfs) queue.push([priority(0, start), 0, sk]);
    while (bfs ? head < queue.length : queue.size) {
      const k = bfs ? queue[head++] : queue.pop()[2];
      if (closed.has(k)) continue;
      closed.add(k); expanded.push(k);
      if (k === gk) break;
      const [x, y, z] = unkey(k);
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy && !dz) continue;
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (!free(nx, ny, nz)) continue;
        // Не срезаем углы: все кубики в «коробке» шага должны быть свободны.
        if ((dx && dy && (!free(nx, y, z) || !free(x, ny, z))) ||
            (dx && dz && (!free(nx, y, z) || !free(x, y, nz))) ||
            (dy && dz && (!free(x, ny, z) || !free(x, y, nz))) ||
            (dx && dy && dz && (!free(nx, ny, z) || !free(nx, y, nz) || !free(x, ny, nz)))) continue;
        const nk = key(nx, ny, nz), g = gCost.get(k) + Math.hypot(dx, dy, dz);
        if (bfs) {
          if (!parent.has(nk)) { parent.set(nk, k); gCost.set(nk, g); queue.push(nk); }
        } else if (!closed.has(nk) && g < (gCost.has(nk) ? gCost.get(nk) : Infinity)) {
          gCost.set(nk, g); parent.set(nk, k);
          queue.push([priority(g, [nx, ny, nz]), ++counter, nk]);
        }
      }
    }
    const path = [];
    if (closed.has(gk)) for (let k = gk; k !== -1; k = parent.get(k)) path.push(unkey(k));
    path.reverse();
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(...path[i].map((v, j) => v - path[i - 1][j]));
    return { path, length, expanded: expanded.map(unkey) };
  }

  const api = { makeMap, search, heuristic, makeMap3d, search3d, heuristic3d, ALGOS: ['BFS', 'Dijkstra', 'Greedy', 'A*'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Planner = api;
})(this);
