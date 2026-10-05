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
    const expanded = [], frontiers = [];
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
      frontiers.push(bfs ? queue.slice(head) : queue.items());
      if (k === goalKey) break;
      const x = k % n, y = (k / n) | 0;
      for (const [nx, ny, cost] of neighbors(grid, x, y)) {
        const nk = key(nx, ny), g = gCost.get(k) + cost;
        if (bfs) {
          if (!parent.has(nk)) { parent.set(nk, k); gCost.set(nk, g); queue.push(nk); }
        } else if (!closed.has(nk) && g < (gCost.has(nk) ? gCost.get(nk) : Infinity)) {
          gCost.set(nk, g); parent.set(nk, k);
          queue.push([priority(g, nx, ny), ++counter, nk]);
        }
      }
    }

    const path = [];
    if (closed.has(goalKey)) {
      for (let k = goalKey; k !== -1; k = parent.get(k)) path.push([k % n, (k / n) | 0]);
      path.reverse();
    }
    let length = 0;
    for (let i = 1; i < path.length; i++)
      length += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    return { path, length, expanded, frontiers, n };
  }

  const api = { makeMap, search, heuristic, ALGOS: ['BFS', 'Dijkstra', 'Greedy', 'A*'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Planner = api;
})(this);
