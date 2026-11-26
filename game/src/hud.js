// HUD and instruments: everything the pilot reads while flying. Altitude,
// speed and heading sit on the top bar; the lower corners hold a working
// attitude indicator, an altimeter dial, a speed dial, a fuel gauge and a
// throttle bar. All of it is drawn with canvas primitives and lit like a
// real panel, so the screenshots show instruments that look flown.
import { CONFIG } from './config.js';

function panel(ctx, x, y, w, h, r = 10) {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 18, 30, 0.72)';
  ctx.strokeStyle = 'rgba(160, 200, 240, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function dial(ctx, cx, cy, r, value, min, max, label, unit, color) {
  ctx.save();
  ctx.translate(cx, cy);
  // Face.
  ctx.fillStyle = '#0d1622';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(170, 205, 240, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Ticks.
  ctx.strokeStyle = 'rgba(200, 220, 245, 0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const x1 = Math.cos(a) * (r - 6);
    const y1 = Math.sin(a) * (r - 6);
    const x2 = Math.cos(a) * (r - 13);
    const y2 = Math.sin(a) * (r - 13);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // Needle.
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const ang = Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ang) * (r - 16), Math.sin(ang) * (r - 16));
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  // Digital readout.
  ctx.fillStyle = '#eaf4ff';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(value)), 0, r * 0.52);
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '10px monospace';
  ctx.fillText(label, 0, -r - 8);
  ctx.fillStyle = '#7ba7d4';
  ctx.font = '9px monospace';
  ctx.fillText(unit, 0, r + 16);
  ctx.restore();
}

export function drawHUD(ctx, w, h, state) {
  const { plane, score, distance, ringsHit, ringsTotal, leg, fuel, lives, message, messageTime } = state;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top bar: score left, compass centre, altitude/speed right.
  panel(ctx, 12, 10, 250, 64);
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 26, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(String(score).padStart(6, '0'), 26, 56);
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '11px monospace';
  ctx.fillText(`DIST ${Math.floor(distance)} NM   RINGS ${ringsHit}/${ringsTotal}`, 26, 70 - 2);

  // Compass strip.
  const cw = 300;
  const cx = w / 2;
  panel(ctx, cx - cw / 2, 10, cw, 64);
  const heading = ((plane.heading % 360) + 360) % 360;
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HDG', cx, 28);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - cw / 2 + 8, 34, cw - 16, 26);
  ctx.clip();
  ctx.font = 'bold 15px monospace';
  for (let d = -60; d <= 60; d += 15) {
    const hd = Math.round((heading + d) / 15) * 15;
    const off = (((hd - heading + 540) % 360) - 180);
    const px = cx + off * 2.1;
    const label = ((hd % 360) + 360) % 360;
    ctx.fillStyle = d === 0 ? '#ffd76a' : '#dfeeff';
    ctx.fillText(String(label).padStart(3, '0'), px, 56);
    ctx.strokeStyle = 'rgba(200,220,245,0.6)';
    ctx.beginPath();
    ctx.moveTo(px, 34);
    ctx.lineTo(px, 42);
    ctx.stroke();
  }
  ctx.restore();
  // Centre lubber line.
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, 34);
  ctx.lineTo(cx, 44);
  ctx.stroke();

  // Altitude and speed, top right.
  panel(ctx, w - 262, 10, 250, 64);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '11px monospace';
  ctx.fillText('ALTITUDE', w - 148, 30);
  ctx.fillText('SPEED', w - 26, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  const altFt = Math.round(plane.y * 12000);
  ctx.fillText(String(altFt).padStart(5, '0'), w - 148, 56);
  ctx.fillText(String(Math.round(plane.speed)), w - 26, 56);
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '10px monospace';
  ctx.fillText('FT', w - 148, 70);
  ctx.fillText('KT', w - 26, 70);

  // Bottom-left: attitude indicator (artificial horizon).
  const ax = 78;
  const ay = h - 78;
  const ar = 52;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.beginPath();
  ctx.arc(0, 0, ar, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(-plane.bank);
  const pitchOff = plane.pitch * 160;
  ctx.fillStyle = '#3d7ac2';
  ctx.fillRect(-ar - 4, -ar - 4 + pitchOff, ar * 2 + 8, ar + 4 - pitchOff);
  ctx.fillStyle = '#8a6b42';
  ctx.fillRect(-ar - 4, pitchOff, ar * 2 + 8, ar + 4);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-ar, pitchOff);
  ctx.lineTo(ar, pitchOff);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(170, 205, 240, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax - 22, ay);
  ctx.lineTo(ax + 22, ay);
  ctx.moveTo(ax, ay - 3);
  ctx.lineTo(ax, ay + 5);
  ctx.stroke();
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', ax, ay + ar + 15);

  // Bottom-centre: altimeter and speed dials.
  dial(ctx, w / 2 - 70, h - 62, 44, altFt, 0, 12000, 'ALT', 'FT', '#7fd0ff');
  dial(ctx, w / 2 + 70, h - 62, 44, plane.speed, 0, CONFIG.maxSpeed, 'SPD', 'KT', '#ffd76a');

  // Bottom-right: fuel gauge and throttle bar, plus lives.
  panel(ctx, w - 212, h - 108, 200, 96);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '11px monospace';
  ctx.fillText('FUEL', w - 198, h - 86);
  const fuelColor = fuel < 25 ? '#ff5a4a' : '#7fd0ff';
  ctx.fillStyle = '#12233a';
  ctx.fillRect(w - 198, h - 78, 172, 12);
  ctx.fillStyle = fuelColor;
  ctx.fillRect(w - 198, h - 78, 172 * Math.max(0, fuel / CONFIG.fuelMax), 12);
  ctx.fillStyle = '#eaf4ff';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${Math.round(fuel)}%`, w - 198, h - 52);
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '11px monospace';
  ctx.fillText('THROTTLE', w - 198, h - 36);
  ctx.fillStyle = '#12233a';
  ctx.fillRect(w - 198, h - 30, 172, 10);
  ctx.fillStyle = '#ffd76a';
  ctx.fillRect(w - 198, h - 30, 172 * plane.throttle, 10);
  // Lives.
  ctx.fillStyle = '#9fc3e8';
  ctx.font = '10px monospace';
  ctx.fillText(`LEG ${leg}  •  LIVES ${lives}`, w - 120, h - 52);

  // Centre flash message (ring scored, leg complete, warnings).
  if (message && messageTime > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, messageTime * 2);
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(message, w / 2, h * 0.24);
    ctx.restore();
  }
  ctx.restore();
}

// Title screen: plane on the runway, big title, controls, best score.
export function drawTitle(ctx, w, h, best) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8, 16, 30, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 12;
  ctx.fillText('SKY COURIER', w / 2, h * 0.2);
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('— Alpine Airlift —', w / 2, h * 0.2 + 38);
  ctx.shadowBlur = 0;
  ctx.font = '16px monospace';
  ctx.fillStyle = '#eaf4ff';
  const lines = [
    'Fly the mail plane through every glowing ring to finish the delivery leg.',
    'Fuel rings refill your tanks. Storm balloons cost a life — steer around them.',
    '',
    'ARROWS / WASD  steer & climb      SHIFT / CTRL  throttle up / down',
    'P  pause      M  mute      ENTER  start / restart',
    '',
    'Finish 10 rings to complete a leg: +500 bonus, faster skies ahead.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.52 + i * 26));
  if (best > 0) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`BEST SCORE  ${best}`, w / 2, h * 0.52 + lines.length * 26 + 12);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace';
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) ctx.fillText('PRESS ENTER TO TAKE OFF', w / 2, h * 0.86);
  ctx.restore();
}

// Game-over screen with the final tally.
export function drawGameOver(ctx, w, h, score, best, distance, ringsHit) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 24, 0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff8a7a';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText('FLIGHT OVER', w / 2, h * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px monospace';
  ctx.fillText(`SCORE  ${score}`, w / 2, h * 0.42);
  ctx.fillText(`RINGS FLOWN  ${ringsHit}      DISTANCE  ${Math.floor(distance)} NM`, w / 2, h * 0.42 + 34);
  if (score >= best && score > 0) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('★ NEW BEST SCORE ★', w / 2, h * 0.42 + 72);
  } else {
    ctx.fillStyle = '#9fc3e8';
    ctx.font = '16px monospace';
    ctx.fillText(`BEST  ${best}`, w / 2, h * 0.42 + 72);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px monospace';
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) ctx.fillText('PRESS ENTER TO FLY AGAIN', w / 2, h * 0.78);
  ctx.restore();
}
