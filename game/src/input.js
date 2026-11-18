// Keyboard + mouse input with pointer lock.
// A justPressed queue records quick taps so a press that lands between two
// frames (common at low headless frame rates) is never dropped.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // codes pressed since last consume
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.mouseClicked = false;
    this.locked = false;
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onLockChange = () => { this.locked = document.pointerLockElement === canvas; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
    window.addEventListener('blur', this._onBlur);
  }
  down(code) { return this.keys.has(code); }
  // True once per physical press, even if the key was released before the
  // next frame consumed it. Consumes the press.
  wasPressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  axis() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, z };
  }
  consumeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return { dx, dy }; }
  consumeClick() { const c = this.mouseClicked; this.mouseClicked = false; return c; }
  lockPointer() { if (document.pointerLockElement !== this.canvas) { try { this.canvas.requestPointerLock(); } catch (e) { /* noop */ } } }
  unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    window.removeEventListener('blur', this._onBlur);
  }
}
