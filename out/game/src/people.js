// People: smooth humanoids with articulated limbs and walk animation.
import * as THREE from 'three';
import { TUNE } from './config.js';
import { makeRng, clamp, angleLerp } from './random.js';

// Build a humanoid: head, torso, two arms (shoulder+forearm), two legs (thigh+shin).
// Returns { group, limbs: {armL, armR, legL, legR, head}, height }.
// setWalk(phase, amp) swings the limbs; setAim(yaw) turns the torso/head.
export function buildHumanoid(opts = {}) {
  const skin = new THREE.MeshStandardMaterial({ color: opts.skin ?? 0xc98d64, roughness: 0.75 });
  const shirt = new THREE.MeshStandardMaterial({ color: opts.shirt ?? 0x8a1f1f, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: opts.pants ?? 0x1f2937, roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 });
  const hair = new THREE.MeshStandardMaterial({ color: opts.hair ?? 0x1a1210, roughness: 0.95 });
  const g = new THREE.Group();
  // legs: pivot at hip (y=0.95), thigh + shin
  function limb(mat, len, rad) {
    const pivot = new THREE.Group();
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.85, len, 8), mat);
    seg.position.y = -len / 2;
    seg.castShadow = true;
    pivot.add(seg);
    return pivot;
  }
  const legL = limb(pants, 0.85, 0.11); legL.position.set(-0.13, 0.95, 0);
  const legR = limb(pants, 0.85, 0.11); legR.position.set(0.13, 0.95, 0);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.3), shoes);
  shoeL.position.set(0, -0.85, 0.05); shoeL.castShadow = true;
  const shoeR = shoeL.clone();
  legL.add(shoeL); legR.add(shoeR);
  // torso: slightly tapered box
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirt);
  torso.position.y = 1.28; torso.castShadow = true;
  g.add(torso);
  // jacket shoulders
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.32), shirt);
  shoulder.position.y = 1.56; shoulder.castShadow = true;
  g.add(shoulder);
  // arms: pivot at shoulder (y=1.52), upper arm + forearm
  const armL = limb(shirt, 0.62, 0.085); armL.position.set(-0.32, 1.52, 0);
  const armR = limb(shirt, 0.62, 0.085); armR.position.set(0.32, 1.52, 0);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skin);
  handL.position.y = -0.66; handL.castShadow = true;
  const handR = handL.clone();
  armL.add(handL); armR.add(handR);
  // head + hair
  const headG = new THREE.Group();
  headG.position.y = 1.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  head.position.y = 0.08; head.castShadow = true;
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairM.position.y = 0.11; hairM.castShadow = true;
  headG.add(head, hairM);
  g.add(legL, legR, armL, armR, headG);
  const limbs = { armL, armR, legL, legR, head: headG, torso };
  return {
    group: g, limbs, height: 1.95,
    setWalk(phase, amp = 1) {
      const s = Math.sin(phase), c = Math.sin(phase + Math.PI);
      legL.rotation.x = s * 0.65 * amp;
      legR.rotation.x = c * 0.65 * amp;
      armL.rotation.x = c * 0.5 * amp;
      armR.rotation.x = s * 0.5 * amp;
      g.position.y = Math.abs(Math.cos(phase)) * 0.05 * amp;
    },
    setIdle(t) {
      legL.rotation.x = 0; legR.rotation.x = 0;
      armL.rotation.x = Math.sin(t * 1.4) * 0.05;
      armR.rotation.x = -Math.sin(t * 1.4) * 0.05;
      g.position.y = 0;
    },
    setAim(yaw) { headG.rotation.y = clamp(yaw, -1.1, 1.1); },
  };
}

const SKINS = [0xc98d64, 0xa06a42, 0x8a5a34, 0xe0b08a, 0x6e4426];
const SHIRTS = [0x2b4a7a, 0x3a7a3a, 0x7a6a2b, 0x5a3a7a, 0x7a2b2b, 0x2b7a7a, 0x888888, 0x9a4a6a];
const PANTS = [0x1f2937, 0x3a2e22, 0x2b3a4a, 0x4a4a4a];

export class Pedestrian {
  constructor(scene, world, rng, x, z) {
    this.world = world;
    this.body = buildHumanoid({
      skin: rng.pick(SKINS), shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS),
    });
    this.mesh = this.body.group;
    this.x = x; this.z = z;
    this.heading = rng.range(0, Math.PI * 2);
    this.speed = rng.range(1.0, 1.8);
    this.phase = rng.range(0, Math.PI * 2);
    this.target = this._pickTarget(rng);
    this.alive = true;
    this.fleeing = false;
    this.fleeT = 0;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
    this.scene = scene;
  }
  _pickTarget(rng) {
    // sidewalk point: near a road axis but off the drivable surface
    const axes = this.world.roadAxes;
    const horizontal = rng.chance(0.5);
    const a = axes[rng.int(0, axes.length)];
    const along = rng.range(-180, 180);
    const off = rng.chance(0.5) ? 8.4 : -8.4;
    return horizontal ? { x: along, z: a + off } : { x: a + off, z: along };
  }
  update(dt, rng, playerPos, danger) {
    if (!this.alive) return;
    if (this.fleeing) {
      this.fleeT -= dt;
      if (this.fleeT <= 0) this.fleeing = false;
    }
    // flee from danger (gunfire / a car bearing down)
    if (danger && Math.hypot(danger.x - this.x, danger.z - this.z) < 12) {
      this.fleeing = true; this.fleeT = 2.5;
      const away = Math.atan2(this.x - danger.x, this.z - danger.z);
      this.heading = angleLerp(this.heading, away, Math.min(1, dt * 6));
    }
    const t = this.target;
    const dx = t.x - this.x, dz = t.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) { this.target = this._pickTarget(rng); return; }
    const want = Math.atan2(dx, dz);
    this.heading = angleLerp(this.heading, want, Math.min(1, dt * 3));
    const sp = this.fleeing ? this.speed * 2.6 : this.speed;
    const vx = Math.sin(this.heading) * sp, vz = Math.cos(this.heading) * sp;
    const hit = this.world.collideCircle(this.x + vx * dt, this.z + vz * dt, TUNE.pedRadius, vx, vz);
    this.x = hit.x; this.z = hit.z;
    this.phase += dt * sp * 2.4;
    this.body.setWalk(this.phase, clamp(sp / 1.6, 0.4, 1.6));
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
  die() {
    this.alive = false;
    // fall over
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.25;
  }
}

export function makePedestrians(scene, world, seed = 23) {
  const rng = makeRng(seed);
  const peds = [];
  let placed = 0, guard = 0;
  while (placed < TUNE.pedCount && guard++ < 400) {
    const axes = world.roadAxes;
    const horizontal = rng.chance(0.5);
    const a = axes[rng.int(0, axes.length)];
    const along = rng.range(-180, 180);
    const off = rng.chance(0.5) ? 8.4 : -8.4;
    const x = horizontal ? along : a + off;
    const z = horizontal ? a + off : along;
    if (Math.hypot(x - 0, z + 8) < 12) continue;
    if (world.colliders.some((c) => x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1)) continue;
    peds.push(new Pedestrian(scene, world, rng, x, z));
    placed++;
  }
  return peds;
}

// The player character (Dario) — red jacket, on foot.
export class Player {
  constructor(scene, world, x, z, heading) {
    this.world = world;
    this.body = buildHumanoid({ skin: 0xc98d64, shirt: 0x8a1f1f, pants: 0x1f2937, hair: 0x14100c });
    this.mesh = this.body.group;
    this.x = x; this.z = z; this.heading = heading;
    this.yaw = heading; // camera-facing yaw
    this.vy = 0; this.y = 0; this.grounded = true;
    this.speed = 0;
    this.phase = 0;
    this.health = 100;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.scene = scene;
  }
  get radius() { return TUNE.playerRadius; }
  update(dt, input, inCar) {
    if (inCar) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const ax = input.axis();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const target = sprint ? TUNE.sprintSpeed : TUNE.walkSpeed;
    // move relative to camera yaw
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = (ax.x * cos - ax.z * sin), mz = (ax.x * sin + ax.z * cos);
    // note: input z is -1 for forward (W); flip so W moves toward camera facing
    mx = -mx; mz = -mz;
    const ml = Math.hypot(mx, mz);
    let moving = false;
    if (ml > 0.01) {
      moving = true;
      mx /= ml; mz /= ml;
      this.heading = Math.atan2(mx, mz);
      const vx = mx * target, vz = mz * target;
      const hit = this.world.collideCircle(this.x + vx * dt, this.z + vz * dt, this.radius, vx, vz);
      this.x = hit.x; this.z = hit.z;
      this.speed = target;
      this.phase += dt * target * 1.9;
      this.body.setWalk(this.phase, sprint ? 1.25 : 1);
    } else {
      this.speed = 0;
      this.body.setIdle(performance.now() / 1000);
    }
    // jump
    if (input.down('Space') && this.grounded) { this.vy = TUNE.jumpVel; this.grounded = false; }
    this.vy -= TUNE.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; this.grounded = true; }
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    return moving;
  }
}
