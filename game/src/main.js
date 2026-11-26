// Bootstrap: wires the canvas, input and game together and runs the frame
// loop. The loop is capped at a fixed timestep so the flight model behaves
// the same on a 60 Hz screen and a 144 Hz one. A `?demo=` query parameter
// (title, flight, over) and `?seed=` let the maker capture reproducible
// screenshots; a normal visit starts on the title screen with a fresh seed.
import { CONFIG } from './config.js';
import { Game, GameState } from './game.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

const params = new URLSearchParams(window.location.search);
const demo = params.get('demo');
const seedParam = Number(params.get('seed'));
const game = new Game(canvas, {
  demo: demo || null,
  seed: Number.isFinite(seedParam) ? seedParam : undefined,
});
const input = new Input();
input.attach(canvas);

input.onStart = () => {
  if (game.state === GameState.TITLE || game.state === GameState.OVER) {
    game.startRun();
  }
};
input.onPause = () => game.pauseToggle();
input.onMute = () => {
  const muted = game.sounds.toggleMute();
  game.setMessage(muted ? 'SOUND OFF' : 'SOUND ON', 1);
};

// Expose the live game for play-testing and debugging from the console.
window.__skyCourier = game;

let last = performance.now();
let accumulator = 0;
const STEP = 1 / 60;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += dt;
  while (accumulator >= STEP) {
    game.update(STEP, input.state());
    accumulator -= STEP;
  }
  game.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
