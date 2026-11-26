// The aircraft: a little twin-prop cargo plane drawn from behind (chase
// view), plus its flight model. The plane banks into turns, pitches with
// climb and descent, and its propeller spins faster with throttle. The
// drawing is all canvas paths — no image assets, so it loads offline.
import { CONFIG } from './config.js';

export class Plane {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0; // lateral position, -1.6..1.6
    this.y = 0.05; // altitude, 0..1
    this.speed = 0; // knots
    this.throttle = 0.55;
    this.bank = 0; // visual bank, radians
    this.heading = 0; // degrees, drifts with bank
    this.pitch = 0; // visual pitch
    this.propAngle = 0;
    this.shake = 0;
    this.onGround = true;
  }

  // input: {left,right,up,down,throttleUp,throttleDown} booleans; dt seconds.
  update(input, dt, airborne) {
    // Throttle.
    if (input.throttleUp) this.throttle = Math.min(1, this.throttle + dt * 0.5);
    if (input.throttleDown) this.throttle = Math.max(0, this.throttle - dt * 0.6);
    const target = CONFIG.minSpeed + (CONFIG.maxSpeed - CONFIG.minSpeed) * this.throttle;
    this.speed += (target - this.speed) * Math.min(1, dt * 0.6);

    // Bank and turn.
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const targetBank = steer * CONFIG.bankMax;
    this.bank += (targetBank - this.bank) * Math.min(1, dt * 5);
    this.x += steer * CONFIG.turnRate * (0.4 + this.speed / CONFIG.maxSpeed) * dt;
    this.x = Math.max(CONFIG.lateralMin, Math.min(CONFIG.lateralMax, this.x));
    this.heading += steer * CONFIG.headingRate * dt * (0.5 + this.speed / CONFIG.maxSpeed);
    if (this.heading > 180) this.heading -= 360;
    if (this.heading < -180) this.heading += 360;

    // Pitch and altitude.
    const climb = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    if (airborne) {
      this.y += climb * CONFIG.climbRate * dt * (0.5 + this.speed / CONFIG.maxSpeed);
      if (!input.up && !input.down) this.y -= CONFIG.descendRate * 0.22 * dt;
      this.y = Math.max(CONFIG.altitudeMin, Math.min(CONFIG.altitudeMax, this.y));
    }
    const targetPitch = climb * -0.14;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 4);

    this.propAngle += dt * (4 + this.throttle * 26);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  // Screen position of the plane: centred laterally, rising with altitude.
  screenPos(w, h) {
    const baseY = h * 0.78;
    const y = baseY - this.y * h * 0.42;
    const x = w / 2 + this.x * w * 0.24;
    return { x, y };
  }

  draw(ctx, w, h, time) {
    const { x, y } = this.screenPos(w, h);
    const s = Math.min(w, h) / 720; // scale factor
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 14 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 10 : 0;
    ctx.save();
    ctx.translate(x + shakeX, y + shakeY);
    ctx.rotate(this.bank + this.pitch * 0.4);
    ctx.scale(s, s);

    // Soft shadow on the ground far below when low.
    // Wings: broad, slightly swept, with red tips.
    ctx.fillStyle = '#d8433a';
    ctx.beginPath();
    ctx.moveTo(-118, 6);
    ctx.lineTo(-30, -8);
    ctx.lineTo(30, -8);
    ctx.lineTo(118, 6);
    ctx.lineTo(108, 16);
    ctx.lineTo(-108, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath();
    ctx.moveTo(-104, 8);
    ctx.lineTo(-28, -6);
    ctx.lineTo(28, -6);
    ctx.lineTo(104, 8);
    ctx.lineTo(96, 14);
    ctx.lineTo(-96, 14);
    ctx.closePath();
    ctx.fill();

    // Tailplane and fin.
    ctx.fillStyle = '#b8322a';
    ctx.beginPath();
    ctx.moveTo(-34, -34);
    ctx.lineTo(-14, -58);
    ctx.lineTo(14, -58);
    ctx.lineTo(34, -34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d8433a';
    ctx.beginPath();
    ctx.moveTo(-6, -52);
    ctx.lineTo(0, -92);
    ctx.lineTo(8, -52);
    ctx.closePath();
    ctx.fill();

    // Fuselage: rounded body with a cargo stripe and lit windows.
    const body = ctx.createLinearGradient(0, -46, 0, 26);
    body.addColorStop(0, '#fdfbf2');
    body.addColorStop(0.6, '#e8e2cd');
    body.addColorStop(1, '#b9b29a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -58);
    ctx.bezierCurveTo(20, -56, 26, -34, 26, -8);
    ctx.bezierCurveTo(26, 14, 14, 26, 0, 26);
    ctx.bezierCurveTo(-14, 26, -26, 14, -26, -8);
    ctx.bezierCurveTo(-26, -34, -20, -56, 0, -58);
    ctx.closePath();
    ctx.fill();
    // Cargo stripe.
    ctx.fillStyle = '#2f6db3';
    ctx.fillRect(-26, -18, 52, 9);
    // Cockpit windows glowing warm.
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.ellipse(-9, -44, 7, 9, -0.25, 0, Math.PI * 2);
    ctx.ellipse(9, -44, 7, 9, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,40,10,0.55)';
    ctx.beginPath();
    ctx.ellipse(-9, -44, 5, 7, -0.25, 0, Math.PI * 2);
    ctx.ellipse(9, -44, 5, 7, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Twin propellers: spinning arcs on the wings.
    for (const side of [-1, 1]) {
      const px = side * 62;
      const py = -2;
      ctx.strokeStyle = 'rgba(40,40,40,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 20, this.propAngle, this.propAngle + Math.PI * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 20, this.propAngle + Math.PI, this.propAngle + Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Navigation lights: red left, green right, blinking white tail.
    const blink = Math.sin(time * 6) > 0;
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(-118, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2dff5e';
    ctx.beginPath();
    ctx.arc(118, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -92, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
