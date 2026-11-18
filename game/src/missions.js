// Missions: 5 story jobs with objectives, distance, timers, payouts.
import * as THREE from 'three';
import { MISSIONS, PLACES } from './config.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.idx = 0; // current mission index
    this.step = 0;
    this.done = false; // all missions complete
    this.timer = 0;
    this.collectT = 0;
    this.marker = null;
    this.beacon = null;
    this._makeBeacon();
    this._setMarker();
  }
  get current() { return MISSIONS[this.idx]; }
  get stepDef() { return this.current ? this.current.steps[this.step] : null; }
  get objective() {
    if (this.done) return 'All jobs done. Ironhaven is yours.';
    const s = this.stepDef;
    return s ? s.text : '';
  }
  get targetPos() {
    if (this.done) return null;
    const s = this.stepDef;
    if (!s || !s.at) return null;
    const p = PLACES[s.at];
    return p ? { x: p.x, z: p.z, name: p.name } : null;
  }
  _makeBeacon() {
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 26, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 13;
    this.scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(1.6, 2.4, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    this.marker = new THREE.Mesh(ringGeo, ringMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.12;
    this.scene.add(this.marker);
  }
  _setMarker() {
    const t = this.targetPos;
    if (!t || !this.beacon) { if (this.beacon) this.beacon.visible = false; if (this.marker) this.marker.visible = false; return; }
    this.beacon.visible = true; this.marker.visible = true;
    this.beacon.position.x = t.x; this.beacon.position.z = t.z;
    this.marker.position.x = t.x; this.marker.position.z = t.z;
  }
  // Called when the player reaches the current goto target.
  _advance(game) {
    const m = this.current;
    if (!m) return;
    this.step++;
    if (this.step >= m.steps.length) {
      game.money += m.pay;
      game.onMissionComplete(m);
      this.idx++;
      this.step = 0;
      if (this.idx >= MISSIONS.length) {
        this.done = true;
        this.beacon.visible = false; this.marker.visible = false;
        game.onAllMissionsDone();
        return;
      }
      const nm = this.current;
      if (nm.timed) this.timer = nm.timed;
      game.onMissionStart(nm);
    }
    this._setMarker();
  }
  start() {
    const m = this.current;
    if (m && m.timed) this.timer = m.timed;
  }
  update(dt, game) {
    if (this.done || !this.current) return;
    const s = this.stepDef;
    if (!s) return;
    if (this.beacon) this.beacon.rotation.y += dt * 0.8;
    if (this.marker) {
      const pulse = 1 + Math.sin(performance.now() / 240) * 0.15;
      this.marker.scale.setScalar(pulse);
    }
    // timed mission countdown
    if (this.current.timed) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = this.current.timed; // retry the mission
        game.onMissionFailed(this.current);
        this.step = 0;
        this._setMarker();
        return;
      }
    }
    const px = game.playerPos.x, pz = game.playerPos.z;
    if (s.kind === 'goto') {
      const t = this.targetPos;
      if (t && Math.hypot(px - t.x, pz - t.z) < 7) this._advance(game);
    } else if (s.kind === 'steal') {
      // completes when the player is in a car (any car)
      if (game.playerCar) this._advance(game);
    } else if (s.kind === 'pickup') {
      // Mara walks to the car when the player is near her in a car
      const t = this.targetPos;
      if (t && game.playerCar && Math.hypot(px - t.x, pz - t.z) < 6) {
        game.onPickup();
        this._advance(game);
      }
    } else if (s.kind === 'collect') {
      // hold E near the shop; collectT accumulates in game
      if (game.collecting) {
        this.collectT += dt;
        if (this.collectT >= 3) { this.collectT = 0; this._advance(game); }
      } else this.collectT = 0;
    }
  }
  // Distance to the current objective (for the HUD).
  distanceTo(px, pz) {
    const t = this.targetPos;
    if (!t) return 0;
    return Math.hypot(px - t.x, pz - t.z);
  }
}
