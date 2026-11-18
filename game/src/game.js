// Game: orchestrates world, player, cars, police, missions, HUD, audio.
// States: menu / playing / paused / busted / wasted / ended.
import * as THREE from 'three';
import { CITY, SPAWN, PLACES, CARS, WEAPONS, TUNE } from './config.js';
import { makeRng, clamp } from './random.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Car, Traffic, makeParkedCars } from './vehicles.js';
import { Player, Pedestrian, makePedestrians } from './people.js';
import { Wanted, Police } from './police.js';
import { Weapons } from './weapons.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { createRenderer, createScene, createCamera } from './render.js';
import { stageShot } from './shots.js';

export class Game {
  constructor(canvas, doc, opts = {}) {
    this.doc = doc;
    this.canvas = canvas;
    this.opts = opts;
    this.renderer = createRenderer(canvas);
    const { scene, sun } = createScene();
    this.scene = scene;
    this.sun = sun;
    this.camera = createCamera();
    this.world = new World(scene, opts.seed || 1);
    this.input = new Input(canvas);
    this.wanted = new Wanted();
    this.police = new Police(scene, this.world);
    this.missions = new Missions(scene);
    this.hud = new HUD(doc);
    this.audio = new AudioEngine();
    this.weapons = new Weapons(scene, this.camera);
    this.player = new Player(scene, this.world, SPAWN.x, SPAWN.z, SPAWN.heading);
    this.playerCar = null;
    this.traffic = new Traffic(scene, this.world, 7);
    this.parked = makeParkedCars(scene, this.world, 11);
    this.peds = makePedestrians(scene, this.world, 23);
    // golden Manta for the Harbor Job (parked at the docks, gold paint)
    this.goldenCar = new Car(scene, this.world, CARS[5], PLACES.goldenCar.x, PLACES.goldenCar.z, Math.PI * 0.75, { parked: true });
    this.goldenCar.setPaint(0xd4a017);
    this.parked.push(this.goldenCar);
    // Mara waits at her corner for mission 2
    this.mara = new Pedestrian(scene, this.world, makeRng(5), PLACES.mara.x, PLACES.mara.z);
    this.mara.target = { x: PLACES.mara.x, z: PLACES.mara.z };
    this.peds.push(this.mara);
    this.money = 0;
    this.kills = 0;
    this.state = 'menu';
    this.camMode = 'aerial';
    this.yaw = SPAWN.heading;
    this.pitch = 0.32;
    this.camPos = new THREE.Vector3(0, 4, -14);
    this.collecting = false;
    this.damageFlash = 0;
    this.regenT = 0;
    this.shotMode = opts.shot || null;
    this.shotT = 0;
    this.frozen = false;
    this.time = 0;
    this.last = performance.now();
    this._bindUI();
    this._installClickRouter();
    this._loadSave();
    if (this.shotMode) {
      stageShot(this, this.shotMode);
      this._startShotClock();
    }
    window.addEventListener('resize', () => this._resize());
  }
  // ---- UI overlays ----
  _bindUI() {
    const bind = (id, fn) => {
      const el = this.doc.getElementById(id);
      if (el) el.addEventListener('click', (e) => { e.stopPropagation(); this.audio.ensure(); this.audio.click(); fn(); });
    };
    bind('btn-new', () => this.newGame());
    bind('btn-continue', () => this.continueGame());
    bind('btn-resume', () => this.resume());
    bind('btn-busted', () => this.respawn());
    bind('btn-wasted', () => this.respawn());
    bind('btn-again', () => this.newGame());
    bind('btn-menu', () => this.toMenu());
  }
  _show(id) {
    for (const s of ['screen-start', 'screen-pause', 'screen-busted', 'screen-wasted', 'screen-end']) {
      const el = this.doc.getElementById(s);
      if (el) el.style.display = s === id ? 'flex' : 'none';
    }
    const cont = this.doc.getElementById('btn-continue');
    if (cont && id === 'screen-start') {
      cont.style.display = this._hasSave() ? 'inline-block' : 'none';
    }
  }
  _installClickRouter() {
    // Headless SwiftShader's compositor swallows overlay-button clicks (the
    // WebGL canvas gets pointer events even when the overlay is hidden).
    // Route clicks at the window level: if a click lands on the canvas while an
    // overlay is visible, map it by coordinates to the visible overlay button.
    // .screen has pointer-events:none; buttons keep pointer-events:auto.
    window.addEventListener('click', (e) => {
      if (this.state === 'playing') return;
      const target = e.target;
      if (target && target.closest && target.closest('button')) return;
      const screenId = { menu: 'screen-start', paused: 'screen-pause', busted: 'screen-busted', wasted: 'screen-wasted', ended: 'screen-end' }[this.state];
      if (!screenId) return;
      const screen = this.doc.getElementById(screenId);
      if (!screen) return;
      const btns = [...screen.querySelectorAll('button')].filter((b) => b.offsetParent !== null && b.style.display !== 'none');
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          b.click();
          return;
        }
      }
    });
  }
  // ---- state ----
  newGame() {
    this.money = 0;
    this.player.health = 100;
    this.wanted.clear();
    this.missions.idx = 0; this.missions.step = 0; this.missions.done = false;
    this.missions.timer = 0;
    this.missions._setMarker();
    this.player.x = SPAWN.x; this.player.z = SPAWN.z;
    this.player.heading = SPAWN.heading; this.player.yaw = SPAWN.heading;
    this.player.mesh.position.set(SPAWN.x, 0, SPAWN.z);
    this.exitCar(true);
    this.state = 'playing';
    this.camMode = 'foot';
    this._show(null);
    this.audio.ensure();
    this.hud.toast('Mission 1 — Homecoming. Steal a car.');
    this.missions.start();
  }
  continueGame() {
    if (!this._hasSave()) { this.newGame(); return; }
    this._loadSave();
    this.state = 'playing';
    this.camMode = this.playerCar ? 'chase' : 'foot';
    this._show(null);
    this.audio.ensure();
  }
  resume() {
    this.state = 'playing';
    this._show(null);
    this.audio.ensure();
    this.save();
  }
  toMenu() {
    this.state = 'menu';
    this.camMode = 'aerial';
    this.exitCar(true);
    this._show('screen-start');
    this.input.unlockPointer();
  }
  respawn() {
    const lost = Math.min(this.money, 150);
    this.money -= lost;
    this.player.health = 100;
    this.wanted.clear();
    this.police.clearAll();
    this.player.x = SPAWN.x; this.player.z = SPAWN.z;
    this.player.heading = SPAWN.heading; this.player.yaw = SPAWN.heading;
    this.player.mesh.position.set(SPAWN.x, 0, SPAWN.z);
    this.exitCar(true);
    this.state = 'playing';
    this.camMode = 'foot';
    this._show(null);
    this.hud.toast(lost > 0 ? `You lost ${lost} in the hospital bill.` : 'Back on your feet.');
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this._show('screen-pause');
    this.input.unlockPointer();
    this.save();
  }
  // ---- car enter/exit ----
  enterCar(car, silent = false) {
    if (!car) return false;
    car.parked = false;
    car.stolen = true;
    car.openDoor();
    this.playerCar = car;
    this.camMode = 'chase';
    this.player.mesh.visible = false;
    if (!silent) {
      this.wanted.add(1);
      this.audio.ensure();
      this.hud.toast(`You stole the ${car.spec.name}.`);
    }
    return true;
  }
  exitCar(silent = false) {
    if (!this.playerCar) return;
    const car = this.playerCar;
    car.speed = 0;
    // place the player beside the car
    const side = 1;
    const px = car.x + Math.cos(car.heading) * side * 2.2;
    const pz = car.z - Math.sin(car.heading) * side * 2.2;
    this.player.x = px; this.player.z = pz;
    this.player.yaw = car.heading;
    this.player.heading = car.heading;
    this.player.mesh.position.set(px, 0, pz);
    this.player.mesh.visible = true;
    this.playerCar = null;
    this.camMode = 'foot';
    if (!silent) this.audio.ensure();
  }
  nearestCar(maxD = TUNE.carEnterDist) {
    let best = null, bd = maxD;
    for (const c of this.parked) {
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bd) { bd = d; best = c; }
    }
    for (const c of this.traffic.cars) {
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bd && Math.abs(c.speed) < 2) { bd = d; best = c; }
    }
    return best;
  }
  // ---- damage / death ----
  damage(amount, src) {
    if (this.state !== 'playing') return;
    this.player.health -= amount;
    this.damageFlash = Math.min(1, this.damageFlash + 0.5);
    this.regenT = 0;
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.state = 'wasted';
      this._show('screen-wasted');
      this.input.unlockPointer();
      this.audio.wasted();
    }
  }
  onBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this._show('screen-busted');
    this.input.unlockPointer();
    this.audio.busted();
  }
  // ---- mission hooks ----
  onMissionComplete(m) {
    this.hud.toast(`Mission complete: ${m.name} — +$${m.pay}`);
    this.audio.mission();
    this.save();
  }
  onMissionFailed(m) {
    this.hud.toast(`Mission failed: ${m.name}. Try again.`);
  }
  onMissionStart(m) {
    this.hud.toast(`Mission ${m.id} — ${m.name}: $${m.pay}`);
  }
  onAllMissionsDone() {
    this.state = 'ended';
    this._show('screen-end');
    this.input.unlockPointer();
    this.audio.mission();
    const el = this.doc.getElementById('end-money');
    if (el) el.textContent = '$' + this.money.toLocaleString('en-US');
  }
  onPickup() {
    this.mara.mesh.visible = false;
    this.hud.toast("Mara's in. Drive to the drop-off.");
    this.audio.pickup();
  }
  // ---- save / load ----
  get playerPos() { return this.playerCar ? { x: this.playerCar.x, z: this.playerCar.z } : { x: this.player.x, z: this.player.z }; }
  save() {
    try {
      localStorage.setItem(TUNE.saveKey, JSON.stringify({
        money: this.money, mission: this.missions.idx, step: this.missions.step,
        health: this.player.health, x: this.player.x, z: this.player.z,
        wanted: this.wanted.wanted, t: Date.now(),
      }));
    } catch (e) { /* storage unavailable */ }
  }
  _hasSave() {
    try { return !!localStorage.getItem(TUNE.saveKey); } catch (e) { return false; }
  }
  _loadSave() {
    try {
      const raw = localStorage.getItem(TUNE.saveKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.money = s.money || 0;
      this.missions.idx = Math.min(s.mission || 0, 4);
      this.missions.step = s.step || 0;
      this.player.health = s.health ?? 100;
      this.player.x = s.x ?? SPAWN.x; this.player.z = s.z ?? SPAWN.z;
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.wanted.set(s.wanted || 0);
      this.missions._setMarker();
    } catch (e) { /* bad save */ }
  }
  // ---- shot mode ----
  _startShotClock() { this.shotT = 0; }
  // ---- API (window.IRONHAVEN) ----
  apiState() {
    const speed = this.playerCar ? Math.abs(this.playerCar.speed) * 2.237 : 0;
    return {
      mode: this.state,
      state: this.state,
      money: this.money,
      health: Math.ceil(this.player.health),
      wanted: this.wanted.wanted,
      police: this.police.copCars.length + this.police.footCops.length,
      mission: this.missions.done ? 5 : this.missions.idx,
      missionStep: this.missions.step,
      objective: this.missions.objective,
      driving: !!this.playerCar,
      inCar: !!this.playerCar,
      speed,
      kills: this.kills,
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
      car: this.playerCar ? { x: this.playerCar.x, z: this.playerCar.z, speed: this.playerCar.speed, model: this.playerCar.spec.key } : null,
      peds: this.peds.filter((p) => p.alive).length,
      parked: this.parked.length,
    };
  }
  apiTeleport(x, z) {
    this.exitCar(true);
    this.player.x = x; this.player.z = z;
    this.player.mesh.position.set(x, 0, z);
  }
  apiSetWanted(n) { this.wanted.set(n); }
  apiAimAt(x, y, z) {
    const dx = x - this.player.x, dz = z - this.player.z;
    this.player.yaw = Math.atan2(dx, dz);
    this.yaw = this.player.yaw;
  }
  apiShoot() {
    const origin = this._muzzleOrigin();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return this._fire(origin, dir);
  }
  apiStartMission(n) {
    const i = Math.max(0, Math.min(4, n - 1));
    this.missions.idx = i; this.missions.step = 0;
    this.missions.done = false;
    const m = this.missions.current;
    if (m && m.timed) this.missions.timer = m.timed;
    this.missions._setMarker();
    if (this.state !== 'playing') { this.state = 'playing'; this._show(null); }
  }
  apiSave() { this.save(); return true; }
  _muzzleOrigin() {
    const p = this.playerCar
      ? new THREE.Vector3(this.playerCar.x, 1.4, this.playerCar.z)
      : new THREE.Vector3(this.player.x, 1.5, this.player.z);
    return p;
  }
  // ---- combat ----
  _fire(origin, dir) {
    const targets = [];
    for (const p of this.peds) {
      if (!p.alive) continue;
      targets.push({
        pos: new THREE.Vector3(p.x, 1.2, p.z), radius: 0.7,
        onHit: (dmg) => {
          p.die();
          this.kills++;
          this.wanted.add(1);
          this.audio.hit();
        },
      });
    }
    for (const c of this.police.footCops) {
      if (c.dead) continue;
      targets.push({
        pos: new THREE.Vector3(c.x, 1.2, c.z), radius: 0.7,
        onHit: (dmg) => {
          this.kills++;
          this.wanted.add(1);
          this.audio.hit();
          // foot cop falls
          c.mesh.rotation.x = -Math.PI / 2;
          c.mesh.position.y = 0.25;
          c.dead = true;
        },
      });
    }
    for (const c of this.police.copCars) {
      targets.push({
        pos: new THREE.Vector3(c.x, 1.0, c.z), radius: 2.2, dmgMul: 0.4,
        onHit: (dmg) => {
          this.wanted.add(1);
          this.audio.hit();
          c.car.speed *= 0.7;
        },
      });
    }
    const hit = this.weapons.shoot(origin, dir, targets, (w, ammoLeft) => {
      this.audio.shot();
      if (ammoLeft === 0) this.weapons.reload();
    });
    return hit;
  }
  // ---- per-frame ----
  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  _updateCamera(dt) {
    const cam = this.camera;
    if (this.camMode === 'aerial') {
      const t = performance.now() / 1000;
      const a = t * 0.05;
      cam.position.set(Math.sin(a) * 150, 120, Math.cos(a) * 150);
      cam.lookAt(0, 0, 0);
      return;
    }
    // Mission shot: frame the golden car from a 3/4 angle so the player is
    // beside it, not directly between the camera and the car (which would
    // hide the car behind the player).
    if (this.camMode === 'mission' && this.goldenCar) {
      const gx = this.goldenCar.x, gz = this.goldenCar.z;
      const desired = new THREE.Vector3(gx - 13, 4.5, gz - 11);
      this.camPos.lerp(desired, Math.min(1, dt * 5));
      cam.position.copy(this.camPos);
      cam.lookAt(gx, 1.0, gz);
      return;
    }
    const target = this.playerCar
      ? new THREE.Vector3(this.playerCar.x, 1.2, this.playerCar.z)
      : new THREE.Vector3(this.player.x, 1.5, this.player.z);
    const back = this.playerCar ? 10 : 6.5;
    const height = this.playerCar ? 4.2 : 3.1;
    const bx = target.x - Math.sin(this.yaw) * back;
    const bz = target.z - Math.cos(this.yaw) * back;
    const desired = new THREE.Vector3(bx, height, bz);
    // keep the camera out of buildings (simple: raise it if inside a collider)
    for (const c of this.world.colliders) {
      if (desired.x > c.minX && desired.x < c.maxX && desired.z > c.minZ && desired.z < c.maxZ) {
        desired.y = Math.max(desired.y, 12);
      }
    }
    this.camPos.lerp(desired, Math.min(1, dt * 7));
    cam.position.copy(this.camPos);
    const look = target.clone();
    look.y += this.pitch * 2.2;
    look.x += Math.sin(this.yaw) * 4;
    look.z += Math.cos(this.yaw) * 4;
    cam.lookAt(look);
  }
  _handleKeys() {
    // Edge-triggered keys use the justPressed queue (never dropped between frames).
    if (this.input.wasPressed('KeyE') && this.state === 'playing') {
      if (this.playerCar) this.exitCar();
      else {
        const car = this.nearestCar();
        if (car) this.enterCar(car);
      }
    }
    if (this.input.wasPressed('KeyR') && this.state === 'playing') {
      this.weapons.reload(); this.audio.reload();
    }
    if (this.input.wasPressed('KeyP')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
    if (this.input.wasPressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
      this.hud.toast(this.audio.muted ? 'Muted' : 'Sound on');
    }
    for (let i = 0; i < 3; i++) {
      if (this.input.wasPressed('Digit' + (i + 1))) this.weapons.switch(i);
    }
  }
  _updatePlaying(dt) {
    // mouse look
    const { dx, dy } = this.input.consumeMouse();
    if (this.input.locked) {
      this.yaw -= dx * 0.0028;
      this.pitch = clamp(this.pitch + dy * 0.0022, -0.35, 0.85);
      if (!this.playerCar) this.player.yaw = this.yaw;
    }
    this._handleKeys();
    // click to lock pointer / shoot
    if (this.input.consumeClick()) {
      if (!this.input.locked && this.state === 'playing') this.input.lockPointer();
      else if (this.input.locked && !this.playerCar) {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        this._fire(this._muzzleOrigin(), dir);
      }
    }
    // collecting (shakedown): hold E near the shop
    const step = this.missions.stepDef;
    this.collecting = false;
    if (step && step.kind === 'collect') {
      const t = this.missions.targetPos;
      if (t && Math.hypot(this.player.x - t.x, this.player.z - t.z) < 6 && this.input.down('KeyE')) {
        this.collecting = true;
      }
    }
    // player / car
    if (this.playerCar) {
      this.playerCar.update(dt, this.input, true);
      this.player.x = this.playerCar.x; this.player.z = this.playerCar.z;
    } else {
      this.player.update(dt, this.input, false);
    }
    // traffic + peds + police + missions
    const pp = this.playerPos;
    this.traffic.update(dt, this.playerCar, pp);
    const rng = this.world.rng;
    const danger = this.weapons.hitT > 0 ? pp : null;
    for (const p of this.peds) p.update(dt, rng, pp, danger);
    this.wanted.update(dt);
    this.police.update(dt, { x: pp.x, z: pp.z, inCar: !!this.playerCar, car: this.playerCar, damage: (a, s) => this.damage(a, s) }, this.wanted, () => this.onBusted());
    this.missions.update(dt, this);
    this.weapons.update(dt);
    this.world.updateTrafficLights(this.time);
    // health regen
    this.regenT += dt;
    if (this.regenT > 6 && this.player.health < 100) this.player.health = Math.min(100, this.player.health + 2 * dt);
    // audio
    this.audio.setEngine(this.playerCar ? this.playerCar.speed : 0, !!this.playerCar);
    this.audio.setSiren(this.wanted.wanted > 0);
    // damage vignette decay
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.4);
    // HUD
    this._updateHUD();
  }
  _updateHUD() {
    const h = this.hud;
    h.setHealth(this.player.health);
    h.setMoney(this.money);
    h.setWanted(this.wanted.wanted);
    const m = this.missions.current;
    const title = this.missions.done ? 'IRONHAVEN — Complete' : (m ? `Mission ${m.id} — ${m.name}` : '');
    const dist = this.missions.distanceTo(this.playerPos.x, this.playerPos.z);
    h.setMission(title, this.missions.objective, dist, this.missions.current && this.missions.current.timed ? this.missions.timer : 0);
    const mph = this.playerCar ? Math.abs(this.playerCar.speed) * 2.237 : 0;
    h.setSpeed(mph);
    const w = this.weapons.current;
    h.setAmmo(w.name, this.weapons.ammo[this.weapons.idx], this.weapons.reserve[this.weapons.idx], this.weapons.reloading);
    h.setCrosshair(this.state === 'playing' && !this.playerCar && this.input.locked);
    h.setHitmarker(this.weapons.hitT > 0);
    h.flashDamage(this.damageFlash);
    h.drawMinimap(this.world, { x: this.playerPos.x, z: this.playerPos.z, heading: this.playerCar ? this.playerCar.heading : this.player.yaw }, this.missions.targetPos, this.police.copCars.map((c) => ({ x: c.x, z: c.z })), this.traffic.cars);
  }
  frame() {
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = clamp(dt, 0, 0.15);
    if (this.shotMode) {
      this.shotT += dt;
      if (this.shotT > 1.6) this.frozen = true;
    }
    if (this.state === 'playing' && !this.frozen) {
      this.time += dt;
      this._updatePlaying(dt);
    } else if (this.state === 'menu' && !this.frozen) {
      this.time += dt;
      this.world.updateTrafficLights(this.time);
      this.traffic.update(dt, null, null);
    }
    this._updateCamera(this.frozen ? 0 : dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.frame());
  }
  start() {
    this._show(this.state === 'menu' ? 'screen-start' : null);
    this._updateHUD();
    this.frame();
  }
}
