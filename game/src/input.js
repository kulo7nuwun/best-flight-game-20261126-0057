// Keyboard and mouse input. Arrow keys / WASD steer, Shift/Ctrl work the
// throttle, P pauses, M mutes, Enter starts or restarts. The game also
// listens for a click/tap on the canvas as a start gesture so a mouse-only
// player can get airborne. Keys are tracked as a held set so holding a key
// down steers continuously.
export class Input {
  constructor() {
    this.held = new Set();
    this.onStart = null; // called on Enter or canvas click
    this.onPause = null;
    this.onMute = null;
    this._keydown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.held.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      if (e.key === 'Enter' && this.onStart) this.onStart();
      if ((e.key === 'p' || e.key === 'P') && this.onPause) this.onPause();
      if ((e.key === 'm' || e.key === 'M') && this.onMute) this.onMute();
    };
    this._keyup = (e) => {
      this.held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    this._click = () => {
      if (this.onStart) this.onStart();
    };
    this._blur = () => this.held.clear();
  }

  attach(canvas) {
    window.addEventListener('keydown', this._keydown);
    window.addEventListener('keyup', this._keyup);
    window.addEventListener('blur', this._blur);
    canvas.addEventListener('pointerdown', this._click);
  }

  detach(canvas) {
    window.removeEventListener('keydown', this._keydown);
    window.removeEventListener('keyup', this._keyup);
    window.removeEventListener('blur', this._blur);
    canvas.removeEventListener('pointerdown', this._click);
  }

  get left() {
    return this.held.has('ArrowLeft') || this.held.has('a');
  }
  get right() {
    return this.held.has('ArrowRight') || this.held.has('d');
  }
  get up() {
    return this.held.has('ArrowUp') || this.held.has('w');
  }
  get down() {
    return this.held.has('ArrowDown') || this.held.has('s');
  }
  get throttleUp() {
    return this.held.has('Shift');
  }
  get throttleDown() {
    return this.held.has('Control');
  }

  // Snapshot of the steering state for one frame.
  state() {
    return {
      left: this.left,
      right: this.right,
      up: this.up,
      down: this.down,
      throttleUp: this.throttleUp,
      throttleDown: this.throttleDown,
    };
  }
}
