(function () {
  const R = 5;
  const H = 5;
  const SEG = 72;
  const PLANE_SEG = 36;

  const canvas = document.getElementById('viewport');
  const ctx = canvas.getContext('2d');
  const modeSelect = document.getElementById('mode');
  const resetButton = document.getElementById('resetView');

  const state = {
    yaw: -0.95,
    pitch: 0.58,
    radius: 22,
    target: { x: 0, y: 0, z: 2.5 },
    dragging: false,
    panning: false,
    lastX: 0,
    lastY: 0,
    mode: 'kept'
  };

  function vec(x, y, z) {
    return { x, y, z };
  }

  function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  function sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  function scale(v, s) {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  function length(v) {
    return Math.sqrt(dot(v, v));
  }

  function normalize(v) {
    const len = length(v) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rgb(hex) {
    return {
      r: (hex >> 16) & 255,
      g: (hex >> 8) & 255,
      b: hex & 255
    };
  }

  function rgbaString(color, alpha) {
    return 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + alpha + ')';
  }

  function shadeColor(hex, intensity, alpha) {
    const c = rgb(hex);
    const k = 0.35 + 0.65 * intensity;
    const r = Math.round(clamp(c.r * k, 0, 255));
    const g = Math.round(clamp(c.g * k, 0, 255));
    const b = Math.round(clamp(c.b * k, 0, 255));
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function createMesh() {
    return [];
  }

  function addTriangle(mesh, a, b, c, color, alpha) {
    mesh.push({ a, b, c, color, alpha: alpha == null ? 1 : alpha });
  }

  function addQuad(mesh, a, b, c, d, color, alpha) {
    addTriangle(mesh, a, b, c, color, alpha);
    addTriangle(mesh, a, c, d, color, alpha);
  }

  function addFullDisk(mesh, z, color, alpha, segments) {
    const n = segments || SEG;
    const center = vec(0, 0, z);
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 2;
      const t1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = vec(R * Math.cos(t0), R * Math.sin(t0), z);
      const p1 = vec(R * Math.cos(t1), R * Math.sin(t1), z);
      addTriangle(mesh, center, p0, p1, color, alpha);
    }
  }

  function addHalfDiskFront(mesh, z, color, alpha, segments) {
    const n = segments || SEG;
    const center = vec(0, 0, z);
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI;
      const t1 = ((i + 1) / n) * Math.PI;
      const p0 = vec(R * Math.cos(t0), R * Math.sin(t0), z);
      const p1 = vec(R * Math.cos(t1), R * Math.sin(t1), z);
      addTriangle(mesh, center, p1, p0, color, alpha);
    }
  }

  function addHalfDiskBack(mesh, z, color, alpha, segments) {
    const n = segments || SEG;
    const center = vec(0, 0, z);
    for (let i = 0; i < n; i++) {
      const t0 = Math.PI + (i / n) * Math.PI;
      const t1 = Math.PI + ((i + 1) / n) * Math.PI;
      const p0 = vec(R * Math.cos(t0), R * Math.sin(t0), z);
      const p1 = vec(R * Math.cos(t1), R * Math.sin(t1), z);
      addTriangle(mesh, center, p1, p0, color, alpha);
    }
  }

  function addCurvedSurface(mesh, thetaStart, thetaEnd, zBottomFn, zTopFn, color, alpha, segments) {
    const n = segments || SEG;
    for (let i = 0; i < n; i++) {
      const t0 = thetaStart + (i / n) * (thetaEnd - thetaStart);
      const t1 = thetaStart + ((i + 1) / n) * (thetaEnd - thetaStart);
      const a = vec(R * Math.cos(t0), R * Math.sin(t0), zBottomFn(t0));
      const b = vec(R * Math.cos(t1), R * Math.sin(t1), zBottomFn(t1));
      const c = vec(R * Math.cos(t1), R * Math.sin(t1), zTopFn(t1));
      const d = vec(R * Math.cos(t0), R * Math.sin(t0), zTopFn(t0));
      addQuad(mesh, a, b, c, d, color, alpha);
    }
  }

  function addPlaneFace(mesh, forKept, color, alpha, segments) {
    const n = segments || PLANE_SEG;
    for (let i = 0; i < n; i++) {
      const y0 = (i / n) * R;
      const y1 = ((i + 1) / n) * R;
      const x0 = Math.sqrt(Math.max(0, R * R - y0 * y0));
      const x1 = Math.sqrt(Math.max(0, R * R - y1 * y1));
      const a = vec(-x0, y0, y0);
      const b = vec(x0, y0, y0);
      const c = vec(x1, y1, y1);
      const d = vec(-x1, y1, y1);

      if (forKept) {
        addTriangle(mesh, a, c, b, color, alpha);
        addTriangle(mesh, a, d, c, color, alpha);
      } else {
        addTriangle(mesh, a, b, c, color, alpha);
        addTriangle(mesh, a, c, d, color, alpha);
      }
    }
  }

  function buildKeptMesh() {
    const mesh = createMesh();
    addFullDisk(mesh, H, 0x5eb1ff, 0.88);
    addHalfDiskBack(mesh, 0, 0x5eb1ff, 0.88);
    addCurvedSurface(mesh, Math.PI, 2 * Math.PI, function () { return 0; }, function () { return H; }, 0x5eb1ff, 0.88);
    addCurvedSurface(mesh, 0, Math.PI, function (t) { return Math.max(0, R * Math.sin(t)); }, function () { return H; }, 0x5eb1ff, 0.88);
    addPlaneFace(mesh, true, 0xff6b6b, 0.95);
    return mesh;
  }

  function buildRemovedMesh() {
    const mesh = createMesh();
    addHalfDiskFront(mesh, 0, 0xffb057, 0.88);
    addCurvedSurface(mesh, 0, Math.PI, function () { return 0; }, function (t) { return Math.max(0, R * Math.sin(t)); }, 0xffb057, 0.88);
    addPlaneFace(mesh, false, 0xff6b6b, 0.95);
    return mesh;
  }

  const keptMesh = buildKeptMesh();
  const removedMesh = buildRemovedMesh();

  function resize() {
    canvas.width = Math.max(1, Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)));
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  function getCameraBasis() {
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);
    const cy = Math.cos(state.yaw);
    const sy = Math.sin(state.yaw);

    const eye = {
      x: state.target.x + state.radius * cp * cy,
      y: state.target.y + state.radius * cp * sy,
      z: state.target.z + state.radius * sp
    };

    const forward = normalize(sub(state.target, eye));
    let right = normalize(cross(forward, vec(0, 0, 1)));
    if (length(right) < 1e-6) {
      right = vec(1, 0, 0);
    }
    const up = normalize(cross(right, forward));

    return { eye, forward, right, up };
  }

  function worldToCamera(p, basis) {
    const q = sub(p, basis.eye);
    return {
      x: dot(q, basis.right),
      y: dot(q, basis.up),
      z: dot(q, basis.forward)
    };
  }

  function project(p, basis) {
    const cam = worldToCamera(p, basis);
    if (cam.z <= 0.1) {
      return null;
    }

    const f = (canvas.height * 0.72) / Math.tan((45 * Math.PI / 180) / 2);
    return {
      x: canvas.width / 2 + (cam.x / cam.z) * f,
      y: canvas.height / 2 - (cam.y / cam.z) * f,
      z: cam.z
    };
  }

  function drawBackground(basis) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lines = [];
    const color = 'rgba(140, 180, 255, 0.16)';
    for (let i = -6; i <= 6; i++) {
      lines.push([vec(-12, i * 2, 0), vec(12, i * 2, 0)]);
      lines.push([vec(i * 2, -12, 0), vec(i * 2, 12, 0)]);
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    lines.forEach(function (line) {
      const a = project(line[0], basis);
      const b = project(line[1], basis);
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    const axes = [
      { a: vec(0, 0, 0), b: vec(8, 0, 0), color: 'rgba(255,120,120,0.9)' },
      { a: vec(0, 0, 0), b: vec(0, 8, 0), color: 'rgba(120,255,160,0.9)' },
      { a: vec(0, 0, 0), b: vec(0, 0, 8), color: 'rgba(120,180,255,0.9)' }
    ];

    ctx.lineWidth = 2;
    axes.forEach(function (axis) {
      const a = project(axis.a, basis);
      const b = project(axis.b, basis);
      if (!a || !b) return;
      ctx.strokeStyle = axis.color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
  }

  function collectTriangles(mesh) {
    return mesh.map(function (tri) {
      const ab = sub(tri.b, tri.a);
      const ac = sub(tri.c, tri.a);
      const normal = normalize(cross(ab, ac));
      const center = scale(add(add(tri.a, tri.b), tri.c), 1 / 3);
      return {
        a: tri.a,
        b: tri.b,
        c: tri.c,
        normal: normal,
        center: center,
        color: tri.color,
        alpha: tri.alpha
      };
    });
  }

  const keptTriangles = collectTriangles(keptMesh);
  const removedTriangles = collectTriangles(removedMesh);
  const lightDir = normalize(vec(0.7, -0.4, 1.2));

  function renderMesh(tris, basis) {
    const painted = [];

    tris.forEach(function (tri) {
      const pa = project(tri.a, basis);
      const pb = project(tri.b, basis);
      const pc = project(tri.c, basis);
      if (!pa || !pb || !pc) return;

      const facing = dot(tri.normal, normalize(sub(basis.eye, tri.center)));
      const intensity = clamp(0.35 + 0.65 * Math.abs(dot(tri.normal, lightDir)), 0, 1);

      painted.push({
        pa: pa,
        pb: pb,
        pc: pc,
        depth: (pa.z + pb.z + pc.z) / 3,
        fill: shadeColor(tri.color, intensity, tri.alpha),
        edge: tri.color === 0xff6b6b ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)',
        lineWidth: tri.color === 0xff6b6b ? 1.1 : 0.8,
        priority: facing < 0 ? 1 : 0
      });
    });

    painted.sort(function (u, v) {
      if (u.priority !== v.priority) return u.priority - v.priority;
      return v.depth - u.depth;
    });

    painted.forEach(function (tri) {
      ctx.beginPath();
      ctx.moveTo(tri.pa.x, tri.pa.y);
      ctx.lineTo(tri.pb.x, tri.pb.y);
      ctx.lineTo(tri.pc.x, tri.pc.y);
      ctx.closePath();
      ctx.fillStyle = tri.fill;
      ctx.fill();
      ctx.lineWidth = tri.lineWidth;
      ctx.strokeStyle = tri.edge;
      ctx.stroke();
    });
  }

  function renderCurves(basis) {
    function drawCircle(z) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 160; i++) {
        const t = (i / 160) * Math.PI * 2;
        const p = project(vec(R * Math.cos(t), R * Math.sin(t), z), basis);
        if (!p) continue;
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = 'rgba(210,225,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    drawCircle(0);
    drawCircle(H);

    const a = project(vec(-R, 0, 0), basis);
    const b = project(vec(R, 0, 0), basis);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  function render() {
    const basis = getCameraBasis();
    drawBackground(basis);

    if (state.mode === 'kept') {
      renderMesh(keptTriangles, basis);
    } else if (state.mode === 'removed') {
      renderMesh(removedTriangles, basis);
    } else {
      renderMesh(keptTriangles, basis);
      renderMesh(removedTriangles, basis);
    }

    renderCurves(basis);
  }

  function animate() {
    render();
    requestAnimationFrame(animate);
  }

  function resetView() {
    state.yaw = -0.95;
    state.pitch = 0.58;
    state.radius = 22;
    state.target = { x: 0, y: 0, z: 2.5 };
  }

  canvas.addEventListener('mousedown', function (e) {
    state.dragging = true;
    state.panning = e.shiftKey || e.button === 1 || e.button === 2;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  });

  window.addEventListener('mousemove', function (e) {
    if (!state.dragging) return;

    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    if (state.panning) {
      const basis = getCameraBasis();
      const panScale = state.radius * 0.0025;
      state.target.x -= basis.right.x * dx * panScale;
      state.target.y -= basis.right.y * dx * panScale;
      state.target.z -= basis.right.z * dx * panScale;
      state.target.x += basis.up.x * dy * panScale;
      state.target.y += basis.up.y * dy * panScale;
      state.target.z += basis.up.z * dy * panScale;
    } else {
      state.yaw -= dx * 0.01;
      state.pitch += dy * 0.01;
      state.pitch = clamp(state.pitch, -1.45, 1.45);
    }
  });

  window.addEventListener('mouseup', function () {
    state.dragging = false;
  });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.001);
    state.radius = clamp(state.radius * factor, 8, 80);
  }, { passive: false });

  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  modeSelect.addEventListener('change', function (e) {
    state.mode = e.target.value;
  });

  resetButton.addEventListener('click', function () {
    resetView();
  });

  window.addEventListener('resize', resize);

  resize();
  resetView();
  animate();
})();
