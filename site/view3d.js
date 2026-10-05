// 3D-вид: three.js грузится только при первом открытии вкладки «3D».
// Оси: x сетки → x сцены, y сетки → z сцены (глубина), z сетки (высота) → y сцены.
(function (root) {
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
  let loading = null;
  let T, scene, camera, renderer, controls, host;
  let groups = {}, data = null, flyState = null, pathCurve = null;

  const loadScript = (src) => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });

  function load(container) {
    if (loading) return loading;
    loading = loadScript(THREE_URL).then(() => loadScript(ORBIT_URL)).then(() => {
      T = window.THREE;
      host = container;
      host.innerHTML = '';
      renderer = new T.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      host.appendChild(renderer.domElement);
      scene = new T.Scene();
      camera = new T.PerspectiveCamera(45, 1, 0.1, 200);
      controls = new T.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      scene.add(new T.AmbientLight(0xffffff, 0.65));
      const sun = new T.DirectionalLight(0xffffff, 0.6);
      sun.position.set(10, 20, 6);
      scene.add(sun);
      new ResizeObserver(resize).observe(host);
      resize();
      api.ready = true;
      loop();
    });
    loading.catch(() => { loading = null; });
    return loading;
  }

  function resize() {
    const w = host.clientWidth, h = Math.max(280, Math.round(w * 0.75));
    if (!w) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!host.offsetParent) return; // вкладка скрыта — не рисуем
    if (flyState && flyState.on) stepFly();
    controls.update();
    renderer.render(scene, camera);
  }

  const pos = (x, y, z) => new T.Vector3(x - data.map.n / 2 + 0.5, z + 0.5, y - data.map.n / 2 + 0.5);

  function clear() {
    for (const k in groups) { scene.remove(groups[k]); }
    groups = {};
  }

  function setData(map, res, colors) {
    data = { map, res, colors };
    flyState = null;
    clear();
    scene.background = new T.Color(colors.cell);
    const { n, h, grid } = map;

    // Пол.
    const floor = new T.GridHelper(n, n, colors.line, colors.line);
    floor.position.y = 0.001;
    groups.floor = floor;

    // Препятствия.
    const walls = [];
    for (let z = 0; z < h; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (grid[z][y][x]) walls.push([x, y, z]);
    const wallMesh = new T.InstancedMesh(new T.BoxGeometry(0.98, 0.98, 0.98),
      new T.MeshLambertMaterial({ color: colors.wall, transparent: true, opacity: 0.32, depthWrite: false }), walls.length);
    const m = new T.Matrix4();
    walls.forEach((p, i) => { m.setPosition(pos(...p)); wallMesh.setMatrixAt(i, m); });
    groups.walls = wallMesh;

    // Проверенные воксели: показываем первые step штук.
    const ex = new T.InstancedMesh(new T.BoxGeometry(0.34, 0.34, 0.34),
      new T.MeshLambertMaterial({ color: colors.closed }), res.expanded.length);
    res.expanded.forEach((p, i) => { m.setPosition(pos(...p)); ex.setMatrixAt(i, m); });
    groups.expanded = ex;

    // Путь — трубка вдоль ломаной.
    if (res.path.length > 1) {
      pathCurve = new T.CurvePath();
      for (let i = 1; i < res.path.length; i++) pathCurve.add(new T.LineCurve3(pos(...res.path[i - 1]), pos(...res.path[i])));
      groups.path = new T.Mesh(new T.TubeGeometry(pathCurve, res.path.length * 8, 0.09, 6, false),
        new T.MeshLambertMaterial({ color: colors.path }));
    } else pathCurve = null;

    // Старт и цель.
    const start = new T.Mesh(new T.SphereGeometry(0.35, 16, 12), new T.MeshLambertMaterial({ color: colors.path }));
    start.position.copy(pos(...map.start));
    groups.start = start;
    const goal = new T.Mesh(new T.OctahedronGeometry(0.42), new T.MeshLambertMaterial({ color: colors.goal }));
    goal.position.copy(pos(...map.goal));
    groups.goal = goal;

    // Дрон: две балки крестом и четыре винта.
    const drone = new T.Group();
    const armMat = new T.MeshLambertMaterial({ color: colors.ink });
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      const arm = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 0.08), armMat);
      arm.rotation.y = rot;
      drone.add(arm);
    }
    const propMat = new T.MeshLambertMaterial({ color: colors.accent, transparent: true, opacity: 0.85 });
    for (const [px, pz] of [[0.32, 0.32], [-0.32, 0.32], [0.32, -0.32], [-0.32, -0.32]]) {
      const prop = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.03, 16), propMat);
      prop.position.set(px, 0.05, pz);
      drone.add(prop);
    }
    drone.position.copy(pos(...map.start));
    groups.drone = drone;

    for (const k in groups) scene.add(groups[k]);
    camera.position.set(n * 0.95, h * 1.6, n * 1.1);
    controls.target.set(0, h * 0.35, 0);
    setStep(res.expanded.length);
  }

  function setStep(s) {
    if (!data) return;
    flyState = null;
    groups.expanded.count = s;
    const done = s >= data.res.expanded.length;
    if (groups.path) groups.path.visible = done;
    if (groups.drone) groups.drone.position.copy(done && pathCurve ? pathCurve.getPoint(1) : pos(...data.map.start));
  }

  function fly(rate) {
    if (!pathCurve) return;
    flyState = { on: true, d: 0, len: pathCurve.getLength(), rate, last: performance.now() };
  }

  function stepFly() {
    const now = performance.now();
    flyState.d += Math.min(0.1, (now - flyState.last) / 1000) * flyState.rate;
    flyState.last = now;
    const u = Math.min(1, flyState.d / flyState.len);
    groups.drone.position.copy(pathCurve.getPointAt(u));
    if (u >= 1) flyState.on = false;
  }

  const api = { ready: false, load, setData, setStep, fly };
  root.View3D = api;
})(this);
