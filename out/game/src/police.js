// Police: wanted level 0-5, pursuit cars, foot-cop arrest (BUSTED), WASTED.
import * as THREE from 'three';
import { CARS, TUNE } from './config.js';
import { Car } from './vehicles.js';
import { buildHumanoid } from './people.js';
import { makeRng, clamp, angleLerp } from './random.js';

export class Wanted {
  constructor() { this.wanted = 0; this.heat = 0; }
  add(n) { this.wanted = clamp(this.wanted + n, 0, 5); this.heat = 1; }
  set(n) { this.wanted = clamp(n, 0, 5); this.heat = 1; }
  clear() { this.wanted = 0; this.heat = 0; }
  update(dt) {
    if (this.wanted > 0) {
      this.heat = Math.max(0, this.heat - dt * TUNE.wantedDecay);
      if (this.heat <= 0) this.wanted = Math.max(0, this.wanted - 1);
    }
  }
}

class CopCar {
  constructor(scene, world, x, z, heading) {
    this.world = world;
    this.car = new Car(scene, world, CARS[7], x, z, heading);
    this.hold = false; // staged roadblock: stays put, light bar still flashes
    this.flashT = Math.random() * 1;
    this.scene = scene;
  }
  get x() { return this.car.x; }
  get z() { return this.car.z; }
  update(dt, px, pz, wanted) {
    const bar = this.car.built.lightBar;
    this.flashT += dt * 6;
    if (bar) {
      const on = Math.sin(this.flashT) > 0;
      bar.red.material.emissiveIntensity = on ? 2.2 : 0.2;
      bar.blue.material.emissiveIntensity = on ? 0.2 : 2.2;
    }
    if (this.hold) return;
    const dx = px - this.car.x, dz = pz - this.car.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    this.car.heading = angleLerp(this.car.heading, want, Math.min(1, dt * 2.2));
    const max = TUNE.copCarSpeed[wanted] || 30;
    const target = d > 6 ? max : max * 0.5;
    this.car.speed += (target - this.car.speed) * Math.min(1, dt * 1.2);
    const vx = Math.sin(this.car.heading) * this.car.speed;
    const vz = Math.cos(this.car.heading) * this.car.speed;
    const hit = this.world.collideCircle(this.car.x + vx * dt, this.car.z + vz * dt, this.car.radius * 0.8, vx, vz);
    this.car.x = hit.x; this.car.z = hit.z;
    this.car.mesh.position.set(this.car.x, 0, this.car.z);
    this.car.mesh.rotation.y = this.car.heading;
    const spin = this.car.speed * dt * 2.4;
    this.car.built.wheels.forEach((w) => { w.rotation.x += spin; });
  }
  dispose() { this.scene.remove(this.car.mesh); }
}

class FootCop {
  constructor(scene, world, x, z) {
    this.world = world;
    this.body = buildHumanoid({ skin: 0xc98d64, shirt: 0x1a2a4a, pants: 0x1a1a22, hair: 0x14100c });
    this.mesh = this.body.group;
    this.x = x; this.z = z;
    this.heading = 0;
    this.phase = 0;
    this.speed = 6.4;
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.scene = scene;
  }
  update(dt, px, pz) {
    const dx = px - this.x, dz = pz - this.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    this.heading = angleLerp(this.heading, want, Math.min(1, dt * 5));
    const vx = Math.sin(this.heading) * this.speed, vz = Math.cos(this.heading) * this.speed;
    const hit = this.world.collideCircle(this.x + vx * dt, this.z + vz * dt, 0.45, vx, vz);
    this.x = hit.x; this.z = hit.z;
    this.phase += dt * this.speed * 2.2;
    this.body.setWalk(this.phase, 1.4);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    return d;
  }
  dispose() { this.scene.remove(this.mesh); }
}

export class Police {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.rng = makeRng(99);
    this.copCars = [];
    this.footCops = [];
    this.spawnT = 0;
  }
  wantedCarCount(wanted) {
    return wanted <= 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 5;
  }
  update(dt, player, wanted, onBusted) {
    const w = wanted.wanted;
    this.spawnT -= dt;
    // spawn / despawn pursuit cars to match the wanted level
    const wantCars = this.wantedCarCount(w);
    if (this.copCars.length < wantCars && this.spawnT <= 0) {
      this.spawnT = 1.2;
      const a = this.rng.range(0, Math.PI * 2);
      const x = clamp(player.x + Math.sin(a) * TUNE.copSpawnDist, -190, 190);
      const z = clamp(player.z + Math.cos(a) * TUNE.copSpawnDist, -190, 190);
      const heading = Math.atan2(player.x - x, player.z - z);
      this.copCars.push(new CopCar(this.scene, this.world, x, z, heading));
    }
    while (this.copCars.length > wantCars) {
      const c = this.copCars.pop();
      if (c) c.dispose();
    }
    // foot cops at wanted >= 3
    const wantCops = w >= 3 ? Math.min(TUNE.maxFootCops, w - 1) : 0;
    if (this.footCops.length < wantCops && this.spawnT <= 0 && w >= 3) {
      this.spawnT = 1.5;
      const a = this.rng.range(0, Math.PI * 2);
      const x = clamp(player.x + Math.sin(a) * 24, -190, 190);
      const z = clamp(player.z + Math.cos(a) * 24, -190, 190);
      this.footCops.push(new FootCop(this.scene, this.world, x, z));
    }
    while (this.footCops.length > wantCops) {
      const c = this.footCops.pop();
      if (c) c.dispose();
    }
    for (const c of this.copCars) c.update(dt, player.x, player.z, w);
    for (const c of this.footCops) {
      const d = c.update(dt, player.x, player.z);
      if (d < 1.6 && !player.inCar) {
        onBusted();
        return;
      }
    }
    // ramming: a cop car touching the player's car damages + shoves
    if (player.car) {
      for (const c of this.copCars) {
        const d = Math.hypot(c.x - player.car.x, c.z - player.car.z);
        if (d < 3.4) {
          player.damage(6 * dt * 10, 'ram');
          const push = 3.2;
          const away = Math.atan2(player.car.x - c.x, player.car.z - c.z);
          player.car.x += Math.sin(away) * push * dt;
          player.car.z += Math.cos(away) * push * dt;
        }
      }
    }
  }
  // Spawn one foot cop at (x,z) and return it (used by the test harness and
  // by wanted escalation). The cop is added to the foot-cop roster.
  spawnFootCop(x, z) {
    const cop = new FootCop(this.scene, this.world, x, z);
    this.footCops.push(cop);
    return cop;
  }
  // Stage a police roadblock ahead of the player (for screenshots): hold=true
  // so Wanted.update doesn't drive them away; light bars still flash.
  stageRoadblock(px, pz, heading, count = 3) {
    this.clearAll();
    for (let i = 0; i < count; i++) {
      const fwd = 14 + i * 2;
      const lat = (i - 1) * 4.5;
      const x = px + Math.sin(heading) * fwd + Math.cos(heading) * lat;
      const z = pz + Math.cos(heading) * fwd - Math.sin(heading) * lat;
      const cop = new CopCar(this.scene, this.world, x, z, heading + Math.PI);
      cop.hold = true;
      this.copCars.push(cop);
    }
  }
  clearAll() {
    for (const c of this.copCars) c.dispose();
    for (const c of this.footCops) c.dispose();
    this.copCars = []; this.footCops = [];
  }
}
