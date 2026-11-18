// HUD: health, money, wanted stars, objective, speedometer, ammo, crosshair,
// hitmarker, damage vignette, and a live 2D minimap.
import { fmtMoney } from './random.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    this.el = {};
    for (const id of ['health-fill', 'health-num', 'money', 'stars', 'mission-title', 'objective', 'objective-dist', 'mission-timer', 'speed', 'ammo', 'weapon-name', 'crosshair', 'hitmarker', 'vignette', 'toast']) {
      this.el[id] = doc.getElementById(id);
    }
    this.map = doc.getElementById('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this._stars = -1;
    this._toastT = null;
  }
  setHealth(h) {
    if (!this.el['health-fill']) return;
    this.el['health-fill'].style.width = Math.max(0, Math.min(100, h)) + '%';
    this.el['health-num'].textContent = Math.ceil(h);
    this.el['health-fill'].style.background = h > 50 ? '#f5b301' : h > 25 ? '#e07a1a' : '#c22a2a';
  }
  setMoney(m) { if (this.el.money) this.el.money.textContent = fmtMoney(m); }
  // Wanted stars render from the NUMBER game.wanted.wanted (never the object).
  setWanted(n) {
    if (this._stars === n) return;
    this._stars = n;
    if (!this.el.stars) return;
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    this.el.stars.textContent = s;
    this.el.stars.style.color = n > 0 ? '#ffd21a' : '#5a5a5a';
  }
  setMission(title, objective, dist, timer) {
    if (this.el['mission-title']) this.el['mission-title'].textContent = title;
    if (this.el.objective) this.el.objective.textContent = objective;
    if (this.el['objective-dist']) this.el['objective-dist'].textContent = dist > 0 ? Math.round(dist) + ' m' : '';
    if (this.el['mission-timer']) {
      this.el['mission-timer'].textContent = timer > 0 ? Math.ceil(timer) + 's' : '';
      this.el['mission-timer'].style.color = timer > 0 && timer < 20 ? '#ff5a4a' : '#ffd21a';
    }
  }
  setSpeed(mph) { if (this.el.speed) this.el.speed.textContent = Math.round(mph); }
  setAmmo(name, mag, reserve, reloading) {
    if (this.el['weapon-name']) this.el['weapon-name'].textContent = name;
    if (this.el.ammo) this.el.ammo.textContent = reloading ? 'RELOADING' : mag + ' / ' + reserve;
  }
  setCrosshair(on) { if (this.el.crosshair) this.el.crosshair.style.display = on ? 'block' : 'none'; }
  setHitmarker(on) { if (this.el.hitmarker) this.el.hitmarker.style.opacity = on ? '1' : '0'; }
  flashDamage(a) { if (this.el.vignette) this.el.vignette.style.opacity = Math.max(0, Math.min(1, a)); }
  toast(msg, ms = 2600) {
    if (!this.el.toast) return;
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms);
  }
  // Live 2D minimap: roads, sea, player arrow, mission marker, police, cars.
  drawMinimap(world, player, missionTarget, cops, cars) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const S = this.map.width, half = 196, sc = S / (half * 2);
    const px = (x) => (x + half) * sc, py = (z) => (z + half) * sc;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, S, S);
    // sea (east)
    ctx.fillStyle = '#155a82'; ctx.fillRect(px(196), 0, S - px(196), S);
    // blocks
    ctx.fillStyle = '#2a2f36';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const x0 = world.roadAxes[i] + 9.5, z0 = world.roadAxes[j] + 9.5;
      ctx.fillRect(px(x0), py(z0), (56 - 19) * sc, (56 - 19) * sc);
    }
    // roads
    ctx.strokeStyle = '#5a6068'; ctx.lineWidth = 2;
    for (const a of world.roadAxes) {
      ctx.beginPath(); ctx.moveTo(px(a), 0); ctx.lineTo(px(a), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, py(a)); ctx.lineTo(S, py(a)); ctx.stroke();
    }
    // mission marker
    if (missionTarget) {
      ctx.fillStyle = '#ffc21a';
      ctx.beginPath(); ctx.arc(px(missionTarget.x), py(missionTarget.z), 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffc21a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px(missionTarget.x), py(missionTarget.z), 7, 0, Math.PI * 2); ctx.stroke();
    }
    // traffic cars
    ctx.fillStyle = '#9aa0a8';
    for (const c of cars) ctx.fillRect(px(c.x) - 1.5, py(c.z) - 1.5, 3, 3);
    // police
    ctx.fillStyle = '#3a7dff';
    for (const c of cops) ctx.fillRect(px(c.x) - 2, py(c.z) - 2, 4, 4);
    // player arrow
    if (player) {
      ctx.save();
      ctx.translate(px(player.x), py(player.z));
      ctx.rotate(Math.atan2(Math.sin(player.heading), Math.cos(player.heading)));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}
