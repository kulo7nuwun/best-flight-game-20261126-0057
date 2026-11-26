// Sky Courier game logic: the state machine, the delivery legs, the rings,
// hazards and pickups, scoring, fuel and lives. Rendering of the world
// (sky, ground, rings, balloons, stars) lives here too, while the plane,
// terrain and HUD each keep their own file.
import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { Plane } from './plane.js';
import { Terrain, Ring } from './terrain.js';
import { drawHUD, drawTitle, drawGameOver } from './hud.js';
import { SoundBank } from './audio.js';

export const GameState = {
  TITLE: 'title',
  TAKEOFF: 'takeoff',
  FLYING: 'flying',
  PAUSED: 'paused',
  OVER: 'over',
};

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.demo = opts.demo || null; // 'title' | 'flight' | 'over' — for screenshots
    this.seed = opts.seed ?? (Date.now() % 2147483647);
    this.rng = makeRng(this.seed);
    this.terrain = new Terrain(this.seed);
    this.plane = new Plane();
    this.sounds = new SoundBank();
    this.best = 0;
    try {
      this.best = Number(localStorage.getItem('skycourier.best') || 0) || 0;
    } catch {
      this.best = 0;
    }
    this.resetRun();
    this.state = GameState.TITLE;
    this.time = 0;
    this.message = '';
    this.messageTime = 0;
    this.pausedFrom = null;
    this.flash = 0; // red flash on damage
    if (this.demo === 'flight') this.startRun(true);
    if (this.demo === 'over') {
      this.startRun(true);
      this.score = 2450;
      this.ringsHit = 7;
      this.distance = 312;
      this.endRun();
    }
  }

  resetRun() {
    this.score = 0;
    this.distance = 0; // nautical miles flown this run
    this.worldZ = 0; // distance along the route, world units
    this.fuel = CONFIG.fuelMax;
    this.lives = CONFIG.lives;
    this.leg = 1;
    this.legRingsHit = 0;
    this.ringsHit = 0;
    this.rings = [];
    this.hazards = [];
    this.stars = [];
    this.nextRingZ = 300;
    this.ringSeq = 0;
    this.nextHazardZ = 700;
    this.nextStarZ = 480;
    this.takeoffZ = 0;
    this.plane.reset();
    this.plane.throttle = 0.7;
    this.airborne = false;
  }

  startRun(skipTakeoff = false) {
    this.resetRun();
    this.state = skipTakeoff ? GameState.FLYING : GameState.TAKEOFF;
    this.sounds.ensure();
    if (skipTakeoff) {
      this.plane.y = 0.45;
      this.plane.speed = CONFIG.cruiseSpeed;
      this.plane.throttle = 0.7;
      this.airborne = true;
      this.worldZ = 200;
      this.spawnAhead();
    }
    this.setMessage(skipTakeoff ? '' : 'TAKE OFF — HOLD SHIFT FOR POWER');
  }

  setMessage(text, secs = 2.2) {
    this.message = text;
    this.messageTime = secs;
  }

  pauseToggle() {
    if (this.state === GameState.FLYING || this.state === GameState.TAKEOFF) {
      this.pausedFrom = this.state;
      this.state = GameState.PAUSED;
    } else if (this.state === GameState.PAUSED) {
      this.state = this.pausedFrom || GameState.FLYING;
    }
  }

  endRun() {
    this.state = GameState.OVER;
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem('skycourier.best', String(this.best));
      } catch {
        /* storage unavailable — best score just lives for the session */
      }
    }
  }

  // Cruise speed grows a little each completed leg.
  cruiseSpeed() {
    return CONFIG.cruiseSpeed + (this.leg - 1) * CONFIG.speedRamp;
  }

  hazardChance() {
    return Math.min(0.55, 0.22 + (this.leg - 1) * CONFIG.hazardRamp);
  }

  spawnAhead() {
    // Keep rings, hazards and stars generated ahead of the plane.
    while (this.nextRingZ < this.worldZ + 2600) {
      const kind = this.rng() < 0.2 ? 'fuel' : 'ring';
      const x = (this.rng() * 2 - 1) * 1.1;
      const y = 0.25 + this.rng() * 0.6;
      this.ringSeq++;
      this.rings.push(new Ring(this.nextRingZ, x, y, kind, this.ringSeq));
      this.nextRingZ += CONFIG.ringSpacing + this.rng() * 120;
    }
    while (this.nextHazardZ < this.worldZ + 2600) {
      if (this.rng() < this.hazardChance()) {
        this.hazards.push({
          z: this.nextHazardZ,
          x: (this.rng() * 2 - 1) * 1.2,
          y: 0.2 + this.rng() * 0.65,
          r: 0.16 + this.rng() * 0.1,
          bob: this.rng() * Math.PI * 2,
        });
      }
      this.nextHazardZ += 320 + this.rng() * 320;
    }
    while (this.nextStarZ < this.worldZ + 2600) {
      this.stars.push({
        z: this.nextStarZ,
        x: (this.rng() * 2 - 1) * 1.2,
        y: 0.25 + this.rng() * 0.6,
        taken: false,
        spin: this.rng() * Math.PI * 2,
      });
      this.nextStarZ += 520 + this.rng() * 500;
    }
  }

  update(dt, input) {
    this.time += dt;
    if (this.messageTime > 0) this.messageTime -= dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.6);

    if (this.state === GameState.TITLE) {
      // Idle drift on the title screen: the plane sits on the runway.
      this.plane.propAngle += dt * 3;
      return;
    }
    if (this.state === GameState.PAUSED || this.state === GameState.OVER) return;

    const flying = this.state === GameState.FLYING;
    this.plane.update(input, dt, flying);
    this.sounds.setEngine(this.plane.throttle, flying);

    if (this.state === GameState.TAKEOFF) {
      // Accelerate down the runway, then lift off.
      this.worldZ += this.plane.speed * dt * 0.55;
      this.distance += (this.plane.speed * dt * 0.55) / 60;
      if (this.plane.speed > 150) {
        this.plane.y = Math.min(0.3, this.plane.y + dt * 0.25);
      }
      if (this.plane.speed > 165 && this.plane.y >= 0.28) {
        this.airborne = true;
        this.state = GameState.FLYING;
        this.setMessage('AIRBORNE — FLY THROUGH THE RINGS');
        this.spawnAhead();
      }
      return;
    }

    // Flying: advance along the route.
    const speedUnits = this.plane.speed * dt * 0.55;
    this.worldZ += speedUnits;
    this.distance += speedUnits / 60;

    // Fuel burns with throttle; empty tanks mean a forced glide down.
    this.fuel -= (CONFIG.fuelDrain + this.plane.throttle * CONFIG.fuelDrainThrottle) * dt;
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.plane.y -= CONFIG.descendRate * 0.5 * dt;
      if (this.messageTime <= 0) this.setMessage('OUT OF FUEL — FIND A GREEN RING', 1.2);
    }

    // Terrain collision: flying into the ground ends a life.
    const ground = this.terrain.groundHeight(this.plane.x);
    if (this.plane.y <= CONFIG.altitudeMin + 0.01 && this.plane.y < ground * 0.35) {
      this.crash('TERRAIN');
    }

    this.spawnAhead();
    this.checkRings();
    this.checkStars();
    this.checkHazards();

    // Drop anything far behind.
    const cut = this.worldZ - 120;
    this.rings = this.rings.filter((r) => r.z > cut);
    this.hazards = this.hazards.filter((h) => h.z > cut);
    this.stars = this.stars.filter((s) => s.z > cut);
  }

  checkRings() {
    for (const ring of this.rings) {
      if (ring.passed || ring.missed) continue;
      if (ring.z > this.worldZ) continue;
      const dx = Math.abs(this.plane.x - ring.x);
      const dy = Math.abs(this.plane.y - ring.y);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= CONFIG.ringRadius) {
        ring.passed = true;
        if (ring.kind === 'fuel') {
          this.fuel = Math.min(CONFIG.fuelMax, this.fuel + CONFIG.fuelRingRefill);
          this.score += 50;
          this.sounds.fuel();
          this.setMessage('+50  FUEL REFILLED');
        } else {
          const perfect = dist < CONFIG.ringRadius * 0.4;
          this.score += CONFIG.ringScore + (perfect ? CONFIG.ringPerfectBonus : 0);
          this.ringsHit++;
          this.legRingsHit++;
          this.sounds.ring();
          this.setMessage(perfect ? 'PERFECT RING  +150' : 'RING  +100');
          if (this.legRingsHit >= CONFIG.legRings) {
            this.legRingsHit = 0;
            this.leg++;
            this.score += CONFIG.legBonus;
            this.sounds.legComplete();
            this.setMessage(`LEG ${this.leg - 1} COMPLETE  +${CONFIG.legBonus}`);
          }
        }
      } else {
        ring.missed = true;
        if (ring.kind === 'ring') this.setMessage('RING MISSED', 1.1);
      }
    }
  }

  checkStars() {
    for (const star of this.stars) {
      if (star.taken || star.z > this.worldZ) continue;
      const dx = Math.abs(this.plane.x - star.x);
      const dy = Math.abs(this.plane.y - star.y);
      if (Math.sqrt(dx * dx + dy * dy) < 0.22) {
        star.taken = true;
        this.score += CONFIG.starScore;
        this.sounds.ring();
        this.setMessage(`STAR  +${CONFIG.starScore}`, 0.9);
      }
    }
  }

  checkHazards() {
    for (const hz of this.hazards) {
      if (hz.z > this.worldZ) continue;
      if (hz.z < this.worldZ - 60) continue;
      const bobY = hz.y + Math.sin(this.time * 1.5 + hz.bob) * 0.03;
      const dx = Math.abs(this.plane.x - hz.x);
      const dy = Math.abs(this.plane.y - bobY);
      if (Math.sqrt(dx * dx + dy * dy) < hz.r + 0.12) {
        this.hazards = this.hazards.filter((h) => h !== hz);
        this.crash('BALLOON');
        break;
      }
    }
  }

  crash(cause) {
    this.lives--;
    this.plane.shake = 1;
    this.flash = 1;
    this.sounds.crash();
    this.fuel = Math.max(this.fuel, 30);
    if (this.lives <= 0) {
      this.setMessage(cause === 'TERRAIN' ? 'CRASHED INTO THE RIDGE' : 'HIT A STORM BALLOON', 1.5);
      this.endRun();
    } else {
      this.setMessage(`${cause}!  ${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, 1.6);
      // A mercy climb so the next second is survivable.
      this.plane.y = Math.max(this.plane.y, 0.4);
    }
  }

  // ---- Rendering ----

  // Project a world object at distance `dz` ahead onto the screen.
  // Perspective projection anchored on the plane: an object at the plane's
  // own altitude and lateral position appears exactly where the plane is,
  // and it grows as it approaches, so steering toward a ring reads true.
  project(obj, dz) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const F = 35000; // focal length in px * world units
    const planeScreen = this.plane.screenPos(w, h);
    const px = planeScreen.x + (obj.x - this.plane.x) * F / Math.max(30, dz) - this.plane.heading * 1.2;
    const py = planeScreen.y - (obj.y - this.plane.y) * F / Math.max(30, dz);
    return { x: px, y: py, scale: F / Math.max(30, dz), visible: dz > 20 && dz < 2600 };
  }

  drawRing(ctx, ring) {
    const dz = ring.z - this.worldZ;
    const p = this.project(ring, dz);
    if (!p.visible) return;
    const r = CONFIG.ringRadius * p.scale * 0.9;
    const alpha = Math.max(0.15, Math.min(1, 1 - dz / 2600 + 0.25));
    ctx.save();
    ctx.globalAlpha = alpha;
    const colour = ring.kind === 'fuel' ? '#37d67a' : '#ffb020';
    // Glow.
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(2, r * 0.22);
    ctx.shadowColor = colour;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 0.86, r * 0.79, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Centre marker: a small chevron pointing the way through.
    ctx.fillStyle = colour;
    ctx.font = `bold ${Math.max(10, r * 0.28)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(ring.kind === 'fuel' ? 'FUEL' : `#${ring.seq}`, p.x, p.y - r - 8);
    ctx.restore();
  }

  drawHazard(ctx, hz) {
    const dz = hz.z - this.worldZ;
    const bobY = hz.y + Math.sin(this.time * 1.5 + hz.bob) * 0.03;
    const p = this.project({ x: hz.x, y: bobY }, dz);
    if (!p.visible) return;
    const r = hz.r * p.scale * 0.9;
    ctx.save();
    ctx.globalAlpha = Math.max(0.2, Math.min(1, 1 - dz / 2600 + 0.3));
    // Balloon envelope: striped sphere.
    const grad = ctx.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
    grad.addColorStop(0, '#e8544a');
    grad.addColorStop(0.5, '#f2c14e');
    grad.addColorStop(1, '#8a2f2a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - r * 0.4, r, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,10,10,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - r * 0.4, r * 0.45, r * 1.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Basket.
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(p.x - r * 0.28, p.y + r * 0.75, r * 0.56, r * 0.4);
    ctx.strokeStyle = 'rgba(60,10,10,0.7)';
    ctx.beginPath();
    ctx.moveTo(p.x - r * 0.6, p.y + r * 0.5);
    ctx.lineTo(p.x - r * 0.28, p.y + r * 0.75);
    ctx.moveTo(p.x + r * 0.6, p.y + r * 0.5);
    ctx.lineTo(p.x + r * 0.28, p.y + r * 0.75);
    ctx.stroke();
    ctx.restore();
  }

  drawStar(ctx, star) {
    if (star.taken) return;
    const dz = star.z - this.worldZ;
    const p = this.project(star, dz);
    if (!p.visible) return;
    const r = Math.max(4, 0.09 * p.scale * 0.9);
    ctx.save();
    ctx.globalAlpha = Math.max(0.25, Math.min(1, 1 - dz / 2600 + 0.3));
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(this.time * 2 + star.spin) * 0.4);
    ctx.fillStyle = '#ffe066';
    ctx.strokeStyle = '#e8a91c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const runwayVisible = this.state === GameState.TITLE || this.state === GameState.TAKEOFF || this.worldZ < 400;

    this.terrain.drawSky(ctx, w, h, this.plane.heading / 180, this.time);
    this.terrain.drawGround(ctx, w, h, this.worldZ, this.plane.heading / 180, this.plane.x, this.plane.y, runwayVisible);

    if (this.state === GameState.TAKEOFF || this.state === GameState.FLYING || this.state === GameState.PAUSED) {
      // Far to near so near objects draw over far ones.
      const rings = [...this.rings].sort((a, b) => b.z - a.z);
      for (const ring of rings) this.drawRing(ctx, ring);
      const hazards = [...this.hazards].sort((a, b) => b.z - a.z);
      for (const hz of hazards) this.drawHazard(ctx, hz);
      const stars = [...this.stars].sort((a, b) => b.z - a.z);
      for (const star of stars) this.drawStar(ctx, star);
    }

    this.plane.draw(ctx, w, h, this.time);

    // Damage flash.
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 40, 20, ${this.flash * 0.25})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.state === GameState.TITLE) {
      drawTitle(ctx, w, h, this.best);
    } else if (this.state === GameState.OVER) {
      drawHUD(ctx, w, h, this.hudState());
      drawGameOver(ctx, w, h, this.score, this.best, this.distance, this.ringsHit);
    } else {
      drawHUD(ctx, w, h, this.hudState());
      if (this.state === GameState.PAUSED) {
        ctx.save();
        ctx.fillStyle = 'rgba(8, 16, 30, 0.5)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', w / 2, h / 2 - 10);
        ctx.font = '16px monospace';
        ctx.fillText('Press P to resume', w / 2, h / 2 + 26);
        ctx.restore();
      }
    }
  }

  hudState() {
    return {
      plane: this.plane,
      score: this.score,
      distance: this.distance,
      ringsHit: this.ringsHit,
      ringsTotal: CONFIG.legRings,
      leg: this.leg,
      fuel: this.fuel,
      lives: this.lives,
      message: this.message,
      messageTime: this.messageTime,
    };
  }
}
