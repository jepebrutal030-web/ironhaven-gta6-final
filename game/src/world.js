// World: procedural 392x392 m city, 7x7 blocks, districts, sea, colliders.
import * as THREE from 'three';
import { CITY, PLACES } from './config.js';
import { makeRng, clamp, dist2 } from './random.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Facade texture: window grid on a base color. repeat scales windows to ~4 m.
function facadeTexture(base, win, lit, cols, rows) {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    // subtle vertical shading strips
    for (let x = 0; x < 256; x += 32) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, 0, 4, 256); }
    const cw = 256 / cols, ch = 256 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.22, y = r * ch + ch * 0.22;
        const w = cw * 0.56, h = ch * 0.56;
        g.fillStyle = (r * 7 + c * 3) % 5 === 0 ? lit : win;
        g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(x, y, w, 3);
      }
    }
  });
}

function groundTexture() {
  const S = 2048, m = 392, px = S / m; // px per meter
  const toPx = (v) => (v + 196) * px;
  return canvasTexture(S, S, (g) => {
    // block interiors base (grass + concrete)
    g.fillStyle = '#5d7a45'; g.fillRect(0, 0, S, S);
    // sidewalk aprons around every block
    g.fillStyle = '#9aa0a3';
    for (const bx of CITY.roadAxes) for (const bz of CITY.roadAxes) {
      // block cell centered between road axes; draw sidewalk pad
    }
    // roads: dark asphalt along each axis
    g.fillStyle = '#23262b';
    for (const a of CITY.roadAxes) {
      g.fillRect(toPx(a - 7), 0, 14 * px, S);
      g.fillRect(0, toPx(a - 7), S, 14 * px);
    }
    // sidewalks: light border along roads
    g.fillStyle = '#8d9296';
    for (const a of CITY.roadAxes) {
      g.fillRect(toPx(a - 9.5), 0, 2.5 * px, S);
      g.fillRect(toPx(a + 7), 0, 2.5 * px, S);
      g.fillRect(0, toPx(a - 9.5), S, 2.5 * px);
      g.fillRect(0, toPx(a + 7), S, 2.5 * px);
    }
    // block interiors: concrete pads with grass corners
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const x0 = CITY.roadAxes[i] + 9.5, z0 = CITY.roadAxes[j] + 9.5;
      const w = 56 - 19;
      g.fillStyle = (i + j) % 2 === 0 ? '#7d8a6a' : '#6f7f5e';
      g.fillRect(toPx(x0), toPx(z0), w * px, w * px);
      g.fillStyle = '#a8a49a';
      g.fillRect(toPx(x0 + 3), toPx(z0 + 3), (w - 6) * px, (w - 6) * px);
    }
    // lane markings: yellow center dashes + white edge lines
    g.fillStyle = '#d8b13a';
    for (const a of CITY.roadAxes) {
      for (let d = -196; d < 196; d += 8) {
        g.fillRect(toPx(a) - 1, toPx(d), 2, 4 * px);
        g.fillRect(toPx(d), toPx(a) - 1, 4 * px, 2);
      }
    }
    g.fillStyle = '#e8e8e8';
    for (const a of CITY.roadAxes) {
      g.fillRect(toPx(a - 6.4), 0, 1, S);
      g.fillRect(toPx(a + 6.4), 0, 1, S);
      g.fillRect(0, toPx(a - 6.4), S, 1);
      g.fillRect(0, toPx(a + 6.4), S, 1);
    }
    // crosswalks at intersections
    g.fillStyle = '#e8e8e8';
    for (const ax of CITY.roadAxes) for (const az of CITY.roadAxes) {
      for (let k = -3; k <= 3; k++) {
        g.fillRect(toPx(ax + k * 1.8) - 2, toPx(az - 6.5), 4, 3 * px);
        g.fillRect(toPx(ax + k * 1.8) - 2, toPx(az + 3.5), 4, 3 * px);
        g.fillRect(toPx(ax - 6.5), toPx(az + k * 1.8) - 2, 3 * px, 4);
        g.fillRect(toPx(ax + 3.5), toPx(az + k * 1.8) - 2, 3 * px, 4);
      }
    }
  });
}

function seaTexture() {
  return canvasTexture(256, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#1a5f8a'); grad.addColorStop(0.5, '#1d6f9e'); grad.addColorStop(1, '#155a82');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 14; i++) {
      const y = (i * 37) % 256;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.1 + i) * 3);
      g.stroke();
    }
  });
}

export class World {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.colliders = []; // {minX,maxX,minZ,maxZ}
    this.treeCircles = []; // {x,z,r}
    this.buildings = [];
    this.lamps = [];
    this.trafficLights = [];
    this.roadAxes = CITY.roadAxes;
    this._buildGround();
    this._buildSea();
    this._buildBuildings();
    this._buildTrees();
    this._buildLamps();
    this._buildTrafficLights();
    this._buildHarbor();
  }
  _mat(color, rough = 0.85, metal = 0.05) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }
  _buildGround() {
    const tex = groundTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(392, 392), mat);
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.scene.add(g);
    this.ground = g;
  }
  _buildSea() {
    const tex = seaTexture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.35 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 392), mat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(196 + 160, -0.4, 0);
    sea.receiveShadow = true;
    this.scene.add(sea);
    this.sea = sea;
    // beach strip at the harbor edge
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(12, 392), this._mat(0xc2b280, 1, 0));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(196 + 2, -0.15, 0);
    sand.receiveShadow = true;
    this.scene.add(sand);
  }
  _facade(kind) {
    if (!this._facades) {
      this._facades = {
        glass: facadeTexture('#2c3e50', '#1a2a3a', '#ffd98a', 8, 12),
        glass2: facadeTexture('#3a4a5e', '#22303f', '#ffe9b0', 6, 10),
        brick: facadeTexture('#7a4a35', '#3a2a22', '#ffcf7a', 7, 6),
        concrete: facadeTexture('#8a8d90', '#4a4d52', '#ffe1a0', 8, 8),
        warehouse: facadeTexture('#5e6b73', '#2e3a40', '#ffe9b0', 10, 3),
      };
    }
    return this._facades[kind];
  }
  _addBuilding(x, z, w, d, h, kind) {
    const tex = this._facade(kind).clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 10)));
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: kind === 'glass' ? 0.25 : 0.05 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    // roof cap
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.6, d * 0.92), this._mat(0x3a3f44, 0.9, 0.1));
    roof.position.set(x, h + 0.3, z);
    roof.castShadow = true;
    this.scene.add(roof);
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    this.buildings.push(mesh);
    return mesh;
  }
  _district(x, z) {
    if (x > 130) return 'harbor';
    if (Math.abs(x) < 112 && Math.abs(z) < 112) return 'downtown';
    return 'residential';
  }
  _buildBuildings() {
    const rng = this.rng;
    // blocks are the 6x6 cells between road axes
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const x0 = CITY.roadAxes[i] + 9.5, z0 = CITY.roadAxes[j] + 9.5;
      const cx = x0 + 18.5, cz = z0 + 18.5; // block center
      const dist = this._district(cx, cz);
      if (dist === 'harbor') {
        // warehouses: long low sheds
        const w = rng.range(22, 30), d = rng.range(12, 16), h = rng.range(6, 9);
        this._addBuilding(cx + rng.range(-3, 3), cz + rng.range(-4, 4), w, d, h, 'warehouse');
        continue;
      }
      if (dist === 'downtown') {
        // 1 tall tower + 1 mid block per downtown cell
        const h1 = rng.range(34, 78);
        this._addBuilding(cx - 6, cz - 4, rng.range(16, 20), rng.range(14, 18), h1, rng.pick(['glass', 'glass2']));
        this._addBuilding(cx + 9, cz + 8, rng.range(12, 15), rng.range(10, 13), rng.range(14, 26), rng.pick(['concrete', 'glass2']));
      } else {
        // residential: 2-3 mid-rise brick/concrete blocks
        const n = rng.int(2, 3);
        for (let k = 0; k < n; k++) {
          const bx = cx + rng.range(-11, 11), bz = cz + rng.range(-11, 11);
          const w = rng.range(9, 14), d = rng.range(9, 13), h = rng.range(8, 20);
          this._addBuilding(bx, bz, w, d, h, rng.pick(['brick', 'brick', 'concrete']));
        }
      }
    }
    // the warehouse at (140,28) the mission shot must clear
    this._addBuilding(PLACES.warehouse.x, PLACES.warehouse.z, 26, 14, 8, 'warehouse');
  }
  _buildTrees() {
    const rng = this.rng;
    const trunkMat = this._mat(0x5a3d24, 1, 0);
    const leafMat = this._mat(0x3f7a34, 0.95, 0);
    const leafMat2 = this._mat(0x4d8a3d, 0.95, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.4, 6);
    const leafGeo = new THREE.SphereGeometry(1.7, 8, 6);
    let placed = 0, guard = 0;
    while (placed < 70 && guard++ < 600) {
      const x = rng.range(-188, 188), z = rng.range(-188, 188);
      // keep >=10 m off every road axis
      let ok = true;
      for (const a of CITY.roadAxes) {
        if (Math.abs(x - a) < 10 || Math.abs(z - a) < 10) { ok = false; break; }
      }
      if (!ok) continue;
      // not inside a building
      for (const c of this.colliders) {
        if (x > c.minX - 2 && x < c.maxX + 2 && z > c.minZ - 2 && z < c.maxZ + 2) { ok = false; break; }
      }
      if (!ok) continue;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.2; trunk.castShadow = true;
      const leaf = new THREE.Mesh(leafGeo, placed % 2 ? leafMat : leafMat2);
      leaf.position.y = 3.4; leaf.scale.y = 1.25; leaf.castShadow = true;
      const leaf2 = new THREE.Mesh(leafGeo, placed % 2 ? leafMat2 : leafMat);
      leaf2.position.set(0.8, 2.7, 0.4); leaf2.scale.setScalar(0.7); leaf2.castShadow = true;
      g.add(trunk, leaf, leaf2);
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.treeCircles.push({ x, z, r: 0.9 });
      placed++;
    }
  }
  _buildLamps() {
    const poleMat = this._mat(0x2a2d31, 0.6, 0.4);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 0.9, roughness: 0.4 });
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
    const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
    for (const a of CITY.roadAxes) {
      for (let d = -168; d <= 168; d += 56) {
        for (const side of [-1, 1]) {
          const x = a + side * 8.2, z = d;
          const g = new THREE.Group();
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.y = 2.7; pole.castShadow = true;
          const head = new THREE.Mesh(headGeo, headMat);
          head.position.set(0, 5.5, 0);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), poleMat);
          arm.position.set(-side * 0.6, 5.4, 0);
          g.add(pole, head, arm);
          g.position.set(x, 0, z);
          this.scene.add(g);
          this.lamps.push(g);
        }
      }
    }
  }
  _buildTrafficLights() {
    const poleMat = this._mat(0x1c1e22, 0.6, 0.4);
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.13, 5.6, 6);
    const boxGeo = new THREE.BoxGeometry(0.5, 1.4, 0.4);
    for (const ax of CITY.roadAxes) for (const az of CITY.roadAxes) {
      if ((ax + az) % 112 !== 0) continue; // lights at every other intersection
      const g = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 2.8; pole.castShadow = true;
      const box = new THREE.Mesh(boxGeo, this._mat(0x111214, 0.5, 0.3));
      box.position.set(0, 5.0, 0);
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 1.4 }));
      red.position.set(0, 5.45, 0.22);
      const yel = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffc21a, emissive: 0x332200, emissiveIntensity: 0.4 }));
      yel.position.set(0, 5.0, 0.22);
      const grn = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2aff5a, emissive: 0x062a10, emissiveIntensity: 0.4 }));
      grn.position.set(0, 4.55, 0.22);
      g.add(pole, box, red, yel, grn);
      g.position.set(ax + 8.2, 0, az + 8.2);
      this.scene.add(g);
      this.trafficLights.push({ group: g, red, yel, grn, phase: (ax + az) % 224 === 0 ? 0 : 1 });
    }
  }
  _buildHarbor() {
    const rng = this.rng;
    // dock piers into the sea (east edge)
    const pierMat = this._mat(0x6b5a44, 1, 0);
    for (const z of [-84, 0, 84]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 8), pierMat);
      pier.position.set(196 + 10, 0.2, z);
      pier.castShadow = true; pier.receiveShadow = true;
      this.scene.add(pier);
    }
    // shipping containers (colored boxes) near the docks
    const contColors = [0xb03030, 0x2a6db0, 0x2a8a4a, 0xc07a1a, 0x7a4a9a];
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.6, 2.6),
        this._mat(contColors[i % contColors.length], 0.7, 0.25)
      );
      const x = rng.range(148, 188), z = rng.range(-150, 150);
      // keep off the golden-car spot and the road
      if (dist2(x, z, PLACES.goldenCar.x, PLACES.goldenCar.z) < 400) continue;
      c.position.set(x, 1.3, z);
      c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
      c.castShadow = true; c.receiveShadow = true;
      this.scene.add(c);
      this.colliders.push({ minX: x - 3.2, maxX: x + 3.2, minZ: z - 3.2, maxZ: z + 3.2 });
    }
    // harbor crane (tall gantry)
    const craneMat = this._mat(0xd07a1a, 0.6, 0.3);
    const legGeo = new THREE.BoxGeometry(0.8, 26, 0.8);
    for (const [lx, lz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) {
      const leg = new THREE.Mesh(legGeo, craneMat);
      leg.position.set(160 + lx, 13, -56 + lz);
      leg.castShadow = true;
      this.scene.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 34), craneMat);
    beam.position.set(160, 26.5, -56);
    beam.castShadow = true;
    this.scene.add(beam);
  }
  // ---- helpers ----
  nearestRoadAxis(v) {
    let best = CITY.roadAxes[0], bd = Infinity;
    for (const a of CITY.roadAxes) { const d = Math.abs(v - a); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  onRoad(x, z) {
    return Math.abs(x - this.nearestRoadAxis(x)) < CITY.roadHalf ||
           Math.abs(z - this.nearestRoadAxis(z)) < CITY.roadHalf;
  }
  // Circle vs building AABBs + tree circles. Returns corrected {x,z}.
  // Adds a lateral bias so cars don't wedge on corners / plaza trees.
  collideCircle(x, z, r, vx = 0, vz = 0) {
    let nx = x, nz = z;
    for (const c of this.colliders) {
      const cx = clamp(nx, c.minX, c.maxX), cz = clamp(nz, c.minZ, c.maxZ);
      const dx = nx - cx, dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          nx += dx * push; nz += dz * push;
        } else {
          // center inside the box: push out along the smallest axis
          const pl = nx - (c.minX - r), pr = (c.maxX + r) - nx;
          const pt = nz - (c.minZ - r), pb = (c.maxZ + r) - nz;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) nx = c.minX - r; else if (m === pr) nx = c.maxX + r;
          else if (m === pt) nz = c.minZ - r; else nz = c.maxZ + r;
        }
      }
    }
    for (const t of this.treeCircles) {
      const dx = nx - t.x, dz = nz - t.z;
      const rr = r + t.r, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (rr - d) / d;
        nx += dx * push; nz += dz * push;
        // lateral bias: nudge perpendicular to travel so the car slides past
        const sp = Math.hypot(vx, vz);
        if (sp > 0.5) {
          const px = -vz / sp, pz = vx / sp;
          const side = (dx * px + dz * pz) >= 0 ? 1 : -1;
          nx += px * side * 0.35; nz += pz * side * 0.35;
        }
      }
    }
    nx = clamp(nx, -194, 194); nz = clamp(nz, -194, 194);
    return { x: nx, z: nz };
  }
  updateTrafficLights(t) {
    const cycle = Math.floor(t / 4) % 2;
    for (const tl of this.trafficLights) {
      const green = (cycle + tl.phase) % 2 === 0;
      tl.red.material.emissiveIntensity = green ? 0.15 : 1.6;
      tl.grn.material.emissiveIntensity = green ? 1.6 : 0.15;
      tl.yel.material.emissiveIntensity = 0.3;
    }
  }
}
