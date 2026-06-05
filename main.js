import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/controls/OrbitControls.js';

const R = 5;
const H = 5;
const SEG = 96;
const PLANE_SEG = 48;

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(14, 12, 16);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 2.5);

scene.add(new THREE.AmbientLight(0xffffff, 0.65));

const dir1 = new THREE.DirectionalLight(0xffffff, 1.0);
dir1.position.set(10, 15, 12);
scene.add(dir1);

const dir2 = new THREE.DirectionalLight(0x88aaff, 0.55);
dir2.position.set(-10, -4, 8);
scene.add(dir2);

const grid = new THREE.GridHelper(24, 24, 0x3e5a86, 0x20324f);
grid.position.z = -0.02;
grid.rotation.x = Math.PI / 2;
scene.add(grid);

const axes = new THREE.AxesHelper(7.5);
scene.add(axes);

function createBuilder() {
  const positions = [];
  const normals = [];

  function addTriangle(a, b, c) {
    const v1 = new THREE.Vector3().subVectors(b, a);
    const v2 = new THREE.Vector3().subVectors(c, a);
    const n = new THREE.Vector3().crossVectors(v1, v2).normalize();

    [a, b, c].forEach((v) => {
      positions.push(v.x, v.y, v.z);
      normals.push(n.x, n.y, n.z);
    });
  }

  function addQuad(a, b, c, d) {
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  }

  function build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  return { addTriangle, addQuad, build };
}

function fullDiskGeometry(z, segments = SEG) {
  const b = createBuilder();
  const center = new THREE.Vector3(0, 0, z);

  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI * 2;
    const t1 = ((i + 1) / segments) * Math.PI * 2;
    const p0 = new THREE.Vector3(R * Math.cos(t0), R * Math.sin(t0), z);
    const p1 = new THREE.Vector3(R * Math.cos(t1), R * Math.sin(t1), z);
    b.addTriangle(center, p0, p1);
  }

  return b.build();
}

function halfDiskGeometryFront(z, segments = SEG) {
  const b = createBuilder();
  const center = new THREE.Vector3(0, 0, z);

  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI;
    const t1 = ((i + 1) / segments) * Math.PI;
    const p0 = new THREE.Vector3(R * Math.cos(t0), R * Math.sin(t0), z);
    const p1 = new THREE.Vector3(R * Math.cos(t1), R * Math.sin(t1), z);
    b.addTriangle(center, p1, p0);
  }

  return b.build();
}

function halfDiskGeometryBack(z, segments = SEG) {
  const b = createBuilder();
  const center = new THREE.Vector3(0, 0, z);

  for (let i = 0; i < segments; i++) {
    const t0 = Math.PI + (i / segments) * Math.PI;
    const t1 = Math.PI + ((i + 1) / segments) * Math.PI;
    const p0 = new THREE.Vector3(R * Math.cos(t0), R * Math.sin(t0), z);
    const p1 = new THREE.Vector3(R * Math.cos(t1), R * Math.sin(t1), z);
    b.addTriangle(center, p1, p0);
  }

  return b.build();
}

function curvedSurfaceGeometry(thetaStart, thetaEnd, zBottomFn, zTopFn, segments = SEG) {
  const b = createBuilder();

  for (let i = 0; i < segments; i++) {
    const t0 = thetaStart + (i / segments) * (thetaEnd - thetaStart);
    const t1 = thetaStart + ((i + 1) / segments) * (thetaEnd - thetaStart);

    const a = new THREE.Vector3(R * Math.cos(t0), R * Math.sin(t0), zBottomFn(t0));
    const bb = new THREE.Vector3(R * Math.cos(t1), R * Math.sin(t1), zBottomFn(t1));
    const c = new THREE.Vector3(R * Math.cos(t1), R * Math.sin(t1), zTopFn(t1));
    const d = new THREE.Vector3(R * Math.cos(t0), R * Math.sin(t0), zTopFn(t0));

    b.addQuad(a, bb, c, d);
  }

  return b.build();
}

function planeFaceGeometry(forKept = true, segments = PLANE_SEG) {
  const b = createBuilder();

  for (let i = 0; i < segments; i++) {
    const y0 = (i / segments) * R;
    const y1 = ((i + 1) / segments) * R;
    const x0 = Math.sqrt(Math.max(0, R * R - y0 * y0));
    const x1 = Math.sqrt(Math.max(0, R * R - y1 * y1));

    const a = new THREE.Vector3(-x0, y0, y0);
    const bb = new THREE.Vector3(x0, y0, y0);
    const c = new THREE.Vector3(x1, y1, y1);
    const d = new THREE.Vector3(-x1, y1, y1);

    if (forKept) {
      b.addTriangle(a, c, bb);
      b.addTriangle(a, d, c);
    } else {
      b.addTriangle(a, bb, c);
      b.addTriangle(a, c, d);
    }
  }

  return b.build();
}

function outlineCircle(z, color = 0x6f86a8) {
  const pts = [];

  for (let i = 0; i <= 128; i++) {
    const t = (i / 128) * Math.PI * 2;
    pts.push(new THREE.Vector3(R * Math.cos(t), R * Math.sin(t), z));
  }

  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 })
  );
}

function buildKeptSolid() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x5eb1ff,
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide
  });

  const cutMat = new THREE.MeshPhysicalMaterial({
    color: 0xff6b6b,
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide
  });

  group.add(new THREE.Mesh(fullDiskGeometry(H), bodyMat));
  group.add(new THREE.Mesh(halfDiskGeometryBack(0), bodyMat));
  group.add(new THREE.Mesh(curvedSurfaceGeometry(Math.PI, 2 * Math.PI, () => 0, () => H), bodyMat));
  group.add(new THREE.Mesh(curvedSurfaceGeometry(0, Math.PI, (t) => Math.max(0, R * Math.sin(t)), () => H), bodyMat));
  group.add(new THREE.Mesh(planeFaceGeometry(true), cutMat));

  return group;
}

function buildRemovedSolid() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xffb057,
    roughness: 0.38,
    metalness: 0.04,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });

  const cutMat = new THREE.MeshPhysicalMaterial({
    color: 0xff6b6b,
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide
  });

  group.add(new THREE.Mesh(halfDiskGeometryFront(0), bodyMat));
  group.add(new THREE.Mesh(curvedSurfaceGeometry(0, Math.PI, () => 0, (t) => Math.max(0, R * Math.sin(t))), bodyMat));
  group.add(new THREE.Mesh(planeFaceGeometry(false), cutMat));

  return group;
}

const kept = buildKeptSolid();
const removed = buildRemovedSolid();
scene.add(kept);
scene.add(removed);

const diameterLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-R, 0, 0),
    new THREE.Vector3(R, 0, 0)
  ]),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
);
scene.add(diameterLine);
scene.add(outlineCircle(0));
scene.add(outlineCircle(H));

function setMode(mode) {
  if (mode === 'kept') {
    kept.visible = true;
    removed.visible = false;
  } else if (mode === 'removed') {
    kept.visible = false;
    removed.visible = true;
  } else {
    kept.visible = true;
    removed.visible = true;
  }
}

setMode('kept');

document.getElementById('mode').addEventListener('change', (e) => {
  setMode(e.target.value);
});

document.getElementById('resetView').addEventListener('click', () => {
  camera.position.set(14, 12, 16);
  controls.target.set(0, 0, 2.5);
  controls.update();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
