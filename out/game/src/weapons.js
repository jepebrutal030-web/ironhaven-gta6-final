// Weapons: aim-corrected shooting, ammo, reload, hitmarker.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp } from './random.js';

export class Weapons {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.idx = 0;
    this.ammo = WEAPONS.map((w) => w.mag);
    this.reserve = WEAPONS.map((w) => w.reserve);
    this.cooldown = 0;
    this.reloadT = 0;
    this.hitT = 0; // hitmarker timer
    this.muzzle = null;
    this.tracer = null;
    this.ray = new THREE.Raycaster();
    this.ray.far = 120;
  }
  get current() { return WEAPONS[this.idx]; }
  get reloading() { return this.reloadT > 0; }
  switch(i) {
    if (i >= 0 && i < WEAPONS.length && i !== this.idx) { this.idx = i; this.cooldown = 0.15; this.reloadT = 0; }
  }
  reload() {
    const w = this.current;
    if (this.reloadT > 0 || this.ammo[this.idx] === w.mag || this.reserve[this.idx] <= 0) return;
    this.reloadT = w.key === 'shotgun' ? 1.6 : 1.1;
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hitT = Math.max(0, this.hitT - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const w = this.current;
        const need = w.mag - this.ammo[this.idx];
        const take = Math.min(need, this.reserve[this.idx]);
        this.ammo[this.idx] += take;
        this.reserve[this.idx] -= take;
        this.reloadT = 0;
      }
    }
    if (this.muzzle) {
      this.muzzle.material.opacity = Math.max(0, this.muzzle.material.opacity - dt * 8);
      if (this.muzzle.material.opacity <= 0) { this.scene.remove(this.muzzle); this.muzzle = null; }
    }
    if (this.tracer) {
      this.tracer.material.opacity = Math.max(0, this.tracer.material.opacity - dt * 6);
      if (this.tracer.material.opacity <= 0) { this.scene.remove(this.tracer); this.tracer = null; }
    }
  }
  // Aim-corrected shot: ray from camera center; snap to the nearest hittable
  // within a small cone so shots feel right in third person.
  // targets: [{mesh|group, pos:Vector3, radius, onHit(dmg, point)}]
  shoot(origin, dir, targets, onShot) {
    const w = this.current;
    if (this.cooldown > 0 || this.reloadT > 0) return false;
    if (this.ammo[this.idx] <= 0) { this.reload(); return false; }
    this.cooldown = 1 / w.rate;
    this.ammo[this.idx]--;
    let hitSomething = false;
    for (let p = 0; p < w.pellets; p++) {
      const spread = w.spread * (p === 0 ? 1 : 1.6);
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * spread * 2;
      d.y += (Math.random() - 0.5) * spread * 2;
      d.z += (Math.random() - 0.5) * spread * 2;
      d.normalize();
      // aim correction: nearest target whose center is within ~4 deg of the ray
      let best = null, bestScore = Infinity;
      for (const t of targets) {
        const to = t.pos.clone().sub(origin);
        const dist = to.length();
        if (dist > 120) continue;
        to.normalize();
        const ang = Math.acos(clamp(d.dot(to), -1, 1));
        const score = ang * dist; // closer + more aligned wins
        if (ang < 0.09 && score < bestScore) { best = t; bestScore = score; }
      }
      let end;
      if (best) {
        const dmg = w.dmg * (best.dmgMul || 1);
        best.onHit(dmg, best.pos);
        this.hitT = 0.35;
        hitSomething = true;
        end = best.pos;
      } else {
        this.ray.set(origin, d);
        const hits = this.ray.intersectObjects(this.scene.children, true);
        end = hits.length ? hits[0].point : origin.clone().add(d.clone().multiplyScalar(90));
      }
      this._tracer(origin, end);
    }
    this._muzzle(origin, dir);
    if (onShot) onShot(w, this.ammo[this.idx]);
    return hitSomething;
  }
  _tracer(a, b) {
    if (this.tracer) this.scene.remove(this.tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.85 });
    this.tracer = new THREE.Line(geo, mat);
    this.scene.add(this.tracer);
  }
  _muzzle(origin, dir) {
    if (this.muzzle) this.scene.remove(this.muzzle);
    const geo = new THREE.SphereGeometry(0.09, 6, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 1 });
    this.muzzle = new THREE.Mesh(geo, mat);
    this.muzzle.position.copy(origin).add(dir.clone().multiplyScalar(0.7));
    this.scene.add(this.muzzle);
  }
}
