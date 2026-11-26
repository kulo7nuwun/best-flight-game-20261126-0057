// Terrain and sky: the world the plane flies over. Mountains are layered
// ridgelines from seeded noise (far layers pale and slow, near layers dark
// and fast), the ground is a perspective strip with a runway at the start,
// and the sky holds a sun, drifting clouds and distant peaks. Everything is
// drawn fresh each frame from the plane's position, so the view scrolls.
import { CONFIG } from './config.js';
import { makeNoise1D, makeRng } from './random.js';

export class Terrain {
  constructor(seed) {
    this.rng = makeRng(seed);
    this.noise = makeNoise1D(seed ^ 0x9e3779b9, 4);
    this.noiseFar = makeNoise1D(seed ^ 0x51ed, 2);
    // Clouds live in world space so they drift past the plane.
    this.clouds = [];
    for (let i = 0; i < CONFIG.cloudCount; i++) {
      this.clouds.push({
        x: (this.rng() * 2 - 1) * 2.2,
        y: 0.25 + this.rng() * 0.6,
        z: this.rng() * 2400,
        s: 0.5 + this.rng() * 1.1,
        a: 0.5 + this.rng() * 0.4,
      });
    }
    // Stars for the bonus pickups use their own generator (game.js places them).
    this.sunX = 0.78;
    this.sunY = 0.16;
  }

  // Height of the ground at a lateral offset (used for crash checks and for
  // drawing the near hills). Ranges roughly 0..0.55 in altitude units.
  groundHeight(x) {
    const n = this.noise(x * 0.35 + 3.7);
    return 0.12 + Math.max(0, n) * 0.45;
  }

  drawSky(ctx, w, h, heading, time) {
    const horizon = h * CONFIG.horizonY;
    // Sky gradient: deep blue up top, warm haze at the horizon.
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#1c4e9e');
    sky.addColorStop(0.55, '#5ea4dd');
    sky.addColorStop(1, '#cfe8f7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 1);

    // Sun with a soft halo.
    const sx = w * this.sunX;
    const sy = h * this.sunY;
    const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 110);
    halo.addColorStop(0, 'rgba(255, 246, 200, 0.95)');
    halo.addColorStop(0.35, 'rgba(255, 226, 140, 0.55)');
    halo.addColorStop(1, 'rgba(255, 226, 140, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - 120, sy - 120, 240, 240);
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, Math.PI * 2);
    ctx.fill();

    // Mountain ridgelines, far to near, scrolling with heading.
    const layers = [
      { amp: 0.16, base: 0.99, color: '#8fb3d9', shift: 0.12 },
      { amp: 0.24, base: 1.0, color: '#5d86b3', shift: 0.3 },
      { amp: 0.34, base: 1.02, color: '#3c5f88', shift: 0.55 },
    ];
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      ctx.fillStyle = L.color;
      ctx.beginPath();
      ctx.moveTo(0, horizon + 2);
      const step = 8;
      for (let px = 0; px <= w; px += step) {
        const wx = px / w * 4 - heading * L.shift * 2;
        const n = li === 0 ? this.noiseFar(wx) : this.noise(wx * (0.6 + li * 0.3));
        const y = horizon - Math.max(0, n + 0.25) * h * L.amp * L.base + 6;
        ctx.lineTo(px, y);
      }
      ctx.lineTo(w, horizon + 2);
      ctx.closePath();
      ctx.fill();
      // Snow caps on the nearest ridge.
      if (li === layers.length - 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let px = 0; px < w; px += 46) {
          const wx = px / w * 4 - heading * L.shift * 2;
          const n = this.noise(wx * (0.6 + li * 0.3));
          if (n > 0.55) {
            const y = horizon - Math.max(0, n + 0.25) * h * L.amp * L.base + 6;
            ctx.beginPath();
            ctx.moveTo(px - 14, y + 12);
            ctx.lineTo(px, y - 2);
            ctx.lineTo(px + 14, y + 12);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    // Clouds: soft white puffs, parallax with heading, drifting with time.
    for (const c of this.clouds) {
      const drift = (time * 0.004 + c.z * 0.0002) % 3;
      let cx = (c.x - heading * 0.35 + drift - 1.5) % 3;
      if (cx < -1.5) cx += 3;
      const px = (cx + 1.5) / 3 * w;
      const py = h * (0.06 + c.y * 0.3);
      const r = 26 * c.s;
      ctx.fillStyle = `rgba(255,255,255,${c.a})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.arc(px + r * 0.9, py + 4, r * 0.7, 0, Math.PI * 2);
      ctx.arc(px - r * 0.9, py + 5, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The ground below the horizon: a perspective field with moving stripes
  // and a runway while the plane is near the start of a leg.
  drawGround(ctx, w, h, distance, heading, lateral, altitude, runwayVisible) {
    const horizon = h * CONFIG.horizonY;
    const g = ctx.createLinearGradient(0, horizon, 0, h);
    g.addColorStop(0, '#7fae62');
    g.addColorStop(0.5, '#5d8f4a');
    g.addColorStop(1, '#3f6b34');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Perspective stripes rushing toward the viewer as distance grows.
    const lines = CONFIG.groundLines;
    for (let i = 0; i < lines; i++) {
      const p = ((distance * 0.02 + i / lines) % 1);
      const y = horizon + (h - horizon) * p * p;
      const alpha = 0.08 + p * 0.22;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(0, y, w, 1 + p * 2);
    }
    // Centre-line dashes converging with heading, like a road below.
    ctx.strokeStyle = 'rgba(255, 255, 220, 0.5)';
    ctx.lineWidth = 2;
    const cx = w / 2 - heading * w * 0.35 - lateral * w * 0.22;
    for (let i = 0; i < 10; i++) {
      const p = ((distance * 0.02 + i / 10) % 1);
      const y = horizon + (h - horizon) * p * p;
      const len = 6 + p * 26;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + len);
      ctx.stroke();
    }

    // Runway: a dark strip with white markings, visible near leg start.
    if (runwayVisible) {
      const rw = w * 0.16;
      const rx = cx - rw / 2;
      ctx.fillStyle = '#3a3f46';
      ctx.beginPath();
      ctx.moveTo(rx, horizon + 4);
      ctx.lineTo(rx + rw, horizon + 4);
      ctx.lineTo(rx + rw * 1.7, h);
      ctx.lineTo(rx - rw * 0.7, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f5f5e8';
      for (let i = 0; i < 7; i++) {
        const p = i / 7;
        const y = horizon + 8 + (h - horizon - 14) * p * p;
        const ww = 3 + p * 7;
        ctx.fillRect(cx - ww / 2, y, ww, 5 + p * 12);
      }
      // Runway edge lights.
      ctx.fillStyle = '#ffd76a';
      for (let i = 0; i < 6; i++) {
        const p = i / 5;
        const y = horizon + 10 + (h - horizon - 16) * p * p;
        const off = rw * (0.5 + p * 0.35);
        ctx.beginPath();
        ctx.arc(cx - off, y, 2.5 + p * 2, 0, Math.PI * 2);
        ctx.arc(cx + off, y, 2.5 + p * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// A delivery ring: a glowing torus the pilot flies through. `passed` marks
// it scored, `missed` marks it flown past.
export class Ring {
  constructor(z, x, y, kind = 'ring', seq = 0) {
    this.z = z;
    this.x = x;
    this.y = y;
    this.kind = kind; // 'ring' | 'fuel'
    this.seq = seq;
    this.passed = false;
    this.missed = false;
    this.spin = 0;
  }
}
