// Vehicles: 8 car models, arcade driving, traffic AI, parked cars.
import * as THREE from 'three';
import { CARS, TUNE } from './config.js';
import { makeRng, clamp, angleLerp } from './random.js';

function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2ea'; g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#1a2a6b'; g.font = 'bold 20px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('IH-' + Math.floor(1000 + Math.random() * 9000), 64, 17);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCar(spec, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: opts.color ?? spec.color, roughness: 0.32, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0d1620, roughness: 0.12, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.7, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.9 });
  const L = spec.len, W = spec.wid, H = spec.h;
  // main body: lower slab + upper cabin
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.55, L), paint);
  body.position.y = H * 0.32;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, spec.top, L * 0.52), glass);
  cabin.position.set(0, H * 0.62 + spec.top * 0.42, -L * 0.04);
  cabin.castShadow = true;
  g.add(cabin);
  // hood + trunk hints
  const hood = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, H * 0.12, L * 0.16), paint);
  hood.position.set(0, H * 0.6, L * 0.42);
  g.add(hood);
  if (spec.type === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, H * 0.3, L * 0.34), dark);
    bed.position.set(0, H * 0.62, -L * 0.3);
    g.add(bed);
  }
  if (spec.type === 'van') {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, H * 0.2, L * 0.8), paint);
    roof.position.set(0, H * 0.95, -L * 0.05);
    g.add(roof);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-W / 2 + 0.1, L * 0.32], [W / 2 - 0.1, L * 0.32], [-W / 2 + 0.1, -L * 0.32], [W / 2 - 0.1, -L * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.34, wz);
    w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  // headlights / taillights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xcc1111, emissiveIntensity: 1.0 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headMat);
    hl.position.set(s * (W / 2 - 0.3), H * 0.42, L / 2 + 0.01);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    tl.position.set(s * (W / 2 - 0.3), H * 0.42, -L / 2 - 0.01);
    g.add(tl);
  }
  // bumpers + plate
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.16, 0.12), chrome);
  bumper.position.set(0, H * 0.18, L / 2 + 0.02);
  g.add(bumper);
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.16),
    new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.5 })
  );
  plate.position.set(0, H * 0.32, -L / 2 - 0.03);
  plate.rotation.y = Math.PI;
  g.add(plate);
  // police light bar
  let lightBar = null;
  if (spec.type === 'police') {
    const bar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.6 }));
    r.position.x = -0.28;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1.6 }));
    b.position.x = 0.28;
    bar.add(r, b);
    bar.position.set(0, H + spec.top * 0.7, -L * 0.04);
    g.add(bar);
    lightBar = { group: bar, red: r, blue: b };
    // black-and-white doors
    const door = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, H * 0.4, L * 0.3), new THREE.MeshStandardMaterial({ color: 0xf2f2ea, roughness: 0.4, metalness: 0.4 }));
    door.position.set(0, H * 0.35, 0);
    g.add(door);
  }
  // taxi sign
  if (spec.type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc21a, emissiveIntensity: 0.9 }));
    sign.position.set(0, H + spec.top * 0.75, -L * 0.04);
    g.add(sign);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, paintMat: paint, wheels, lightBar, spec, length: L, width: W };
}

export class Car {
  constructor(scene, world, spec, x, z, heading, opts = {}) {
    this.world = world;
    this.built = buildCar(spec, opts);
    this.mesh = this.built.group;
    this.group = this.mesh; // alias: test harness reads .group.position
    this.name = spec.name; // test harness reads .name
    this.spec = spec;
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steer = 0;
    this.parked = !!opts.parked;
    this.stolen = false;
    this.doorTimer = 0; // 0.25s door-close timer
    this.doorOpen = false;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.scene = scene;
  }
  get radius() { return Math.max(this.spec.len, this.spec.wid) * 0.5; }
  setPaint(hex) { this.built.paintMat.color.setHex(hex); }
  openDoor() { this.doorOpen = true; this.doorTimer = 0; }
  update(dt, input, isPlayer) {
    if (this.parked) return;
    const s = this.spec;
    if (isPlayer && input) {
      const fwd = (input.down('KeyW') || input.down('ArrowUp')) ? 1 : 0;
      const back = (input.down('KeyS') || input.down('ArrowDown')) ? 1 : 0;
      const left = (input.down('KeyA') || input.down('ArrowLeft')) ? 1 : 0;
      const right = (input.down('KeyD') || input.down('ArrowRight')) ? 1 : 0;
      const boost = (input.down('ShiftLeft') || input.down('ShiftRight')) ? 1.25 : 1;
      const hand = input.down('Space');
      if (hand) { this.speed *= Math.max(0, 1 - 3.2 * dt); }
      else if (fwd) this.speed += s.accel * boost * dt;
      else if (back) this.speed -= (this.speed > 0.5 ? s.accel * 1.4 : s.accel * 0.7) * dt;
      else this.speed *= Math.max(0, 1 - 0.9 * dt);
      const max = s.max * boost;
      this.speed = clamp(this.speed, -max * 0.4, max);
      const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
      const spd = Math.abs(this.speed);
      const dir = this.speed >= 0 ? 1 : -1;
      this.heading += this.steer * dir * clamp(spd / 9, 0, 1) * 1.9 * dt * s.grip;
    }
    const vx = Math.sin(this.heading) * this.speed;
    const vz = Math.cos(this.heading) * this.speed;
    let nx = this.x + vx * dt, nz = this.z + vz * dt;
    const hit = this.world.collideCircle(nx, nz, this.radius * 0.85, vx, vz);
    if (Math.abs(hit.x - nx) > 0.01 || Math.abs(hit.z - nz) > 0.01) this.speed *= 0.45;
    this.x = hit.x; this.z = hit.z;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // wheel spin + steering visual
    const spin = this.speed * dt * 2.4;
    this.built.wheels.forEach((w, i) => {
      w.rotation.x += spin;
      if (i < 2) w.rotation.y = this.steer * 0.4;
    });
    if (this.doorOpen) {
      this.doorTimer += dt;
      if (this.doorTimer >= TUNE.doorCloseTime) { this.doorOpen = false; this.doorTimer = 0; }
    }
  }
}

// Traffic: cars following rectangular loops on the road grid.
export class Traffic {
  constructor(scene, world, seed = 7) {
    this.scene = scene; this.world = world;
    this.rng = makeRng(seed);
    this.cars = [];
    const axes = world.roadAxes;
    for (let i = 0; i < TUNE.trafficCount; i++) {
      const spec = CARS[this.rng.int(0, 6)]; // never police as traffic
      const ax = axes[this.rng.int(0, axes.length)];
      const az = axes[this.rng.int(0, axes.length)];
      const horizontal = this.rng.chance(0.5);
      const lane = this.rng.chance(0.5) ? 3.2 : -3.2;
      const x = horizontal ? this.rng.range(-180, 180) : ax + lane;
      const z = horizontal ? az + lane : this.rng.range(-180, 180);
      const heading = horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? Math.PI : 0);
      const car = new Car(scene, world, spec, x, z, heading);
      car.speed = this.rng.range(9, 15);
      car.loop = this._makeLoop(horizontal, ax, az);
      car.loopIdx = this.rng.int(0, 3);
      car.targetSpeed = car.speed;
      this.cars.push(car);
    }
  }
  _makeLoop(horizontal, ax, az) {
    // rectangle around a block, hugging road lanes
    const a = ax, b = az;
    const x1 = a - 56, x2 = a + 56, z1 = b - 56, z2 = b + 56;
    return [
      { x: x1, z: z1 }, { x: x2, z: z1 }, { x: x2, z: z2 }, { x: x1, z: z2 },
    ];
  }
  update(dt, playerCar, playerPos) {
    for (const car of this.cars) {
      const t = car.loop[car.loopIdx];
      const dx = t.x - car.x, dz = t.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) { car.loopIdx = (car.loopIdx + 1) % 4; continue; }
      const want = Math.atan2(dx, dz);
      car.heading = angleLerp(car.heading, want, Math.min(1, dt * 1.6));
      // slow for the player / a car ahead
      let target = car.targetSpeed;
      if (playerPos) {
        const pd = Math.hypot(playerPos.x - car.x, playerPos.z - car.z);
        if (pd < 9) target = Math.min(target, 3);
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
      const vx = Math.sin(car.heading) * car.speed, vz = Math.cos(car.heading) * car.speed;
      const hit = this.world.collideCircle(car.x + vx * dt, car.z + vz * dt, car.radius * 0.8, vx, vz);
      car.x = hit.x; car.z = hit.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt * 2.4;
      car.built.wheels.forEach((w) => { w.rotation.x += spin; });
    }
  }
}

export function makeParkedCars(scene, world, seed = 11) {
  const rng = makeRng(seed);
  const parked = [];
  const axes = world.roadAxes;
  let placed = 0, guard = 0;
  while (placed < TUNE.parkedCount && guard++ < 300) {
    const horizontal = rng.chance(0.5);
    const ax = axes[rng.int(0, axes.length)];
    const az = axes[rng.int(0, axes.length)];
    const along = rng.range(-170, 170);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = horizontal ? along : ax + side * 5.4;
    const z = horizontal ? az + side * 5.4 : along;
    // not too close to spawn or the harbor golden spot
    if (Math.hypot(x - 0, z + 8) < 18) continue;
    if (Math.hypot(x - 172, z - 28) < 14) continue;
    // not overlapping another parked car
    if (parked.some((p) => Math.hypot(p.x - x, p.z - z) < 8)) continue;
    const spec = CARS[rng.int(0, 6)];
    const heading = horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? Math.PI : 0);
    const car = new Car(scene, world, spec, x, z, heading, { parked: true });
    parked.push(car);
    placed++;
  }
  return parked;
}
