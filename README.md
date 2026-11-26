# Sky Courier — Alpine Airlift

A complete, original flight game that plays offline in a desktop browser.
You are the pilot of a little twin-prop mail plane crossing an alpine
valley. Fly through the glowing delivery rings to finish each leg, grab
bonus stars, refuel at the green rings, and steer around the storm
balloons — three strikes and the flight is over.

## How to run

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. No build step, no
network: every file the game loads lives under `game/`.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys / WASD | Steer (left/right) and climb / descend (up/down) |
| Shift | Throttle up |
| Ctrl | Throttle down |
| P | Pause |
| M | Mute / unmute sound |
| Enter (or click) | Take off / restart |

## The flight

- **Takeoff:** hold Shift to build speed down the runway; the plane lifts
  off on its own past 165 knots.
- **Delivery rings:** amber rings are worth 100 points (150 for a
  dead-centre pass). Fly through 10 to complete a leg: +500 bonus, and the
  next leg flies faster with more balloons.
- **Fuel rings:** green rings refill 45% of the tank. Fuel burns faster at
  full throttle — running dry means a forced glide down.
- **Stars:** gold stars between the rings are worth 25 points each.
- **Hazards:** red-and-gold storm balloons cost a life on contact, and so
  does flying into the ridge. You have 3 lives.
- **Instruments:** the HUD shows altitude (feet), speed (knots) and
  heading on the top bar, plus a working attitude indicator, altimeter
  dial, speed dial, fuel gauge and throttle bar.

## Screenshots

`?demo=title`, `?demo=flight` and `?demo=over` jump straight to the
title screen, a mid-flight scene or the game-over screen (with `?seed=`
for a reproducible valley) — used to capture the screenshots in
`screenshots/`.

## Layout

- `game/index.html` — the page; `game/style.css` — page chrome
- `game/src/main.js` — bootstrap and frame loop
- `game/src/game.js` — state machine, legs, rings, hazards, scoring
- `game/src/terrain.js` — sky, mountains, clouds, ground, runway, rings
- `game/src/plane.js` — the aircraft and its flight model
- `game/src/hud.js` — HUD, dials, attitude indicator, title/game-over
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized WebAudio engine and effects
- `game/src/config.js` — tuning constants
- `game/src/random.js` — seeded RNG and value noise
- `main.ts` — the hand-in program (copies `game/` + `screenshots/` and
  writes `dossier.json`)
- `serve.ts` — local static server for play-testing

## License

MIT — see `LICENSE`.
