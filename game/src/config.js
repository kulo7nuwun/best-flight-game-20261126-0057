// Sky Courier: Alpine Airlift — tuning constants for the whole game.
// One place for every number a designer would want to tweak: speeds, sizes,
// scoring, difficulty ramp and the look of the sky. Nothing here is copied
// from any other game; these values were picked while play-testing this one.
export const CONFIG = {
  canvasWidth: 1280,
  canvasHeight: 720,

  // Flight model (units are game units, tuned by feel).
  minSpeed: 90, // knots at idle
  maxSpeed: 320, // knots at full throttle
  cruiseSpeed: 180,
  climbRate: 0.55, // altitude units per second at full climb
  descendRate: 0.7,
  turnRate: 1.9, // lateral units per second at full bank
  bankMax: 0.6, // radians of visual bank
  headingRate: 42, // degrees of heading change per second at full bank

  // World bounds.
  altitudeMin: 0.02, // just above the ground
  altitudeMax: 1.0, // service ceiling
  lateralMin: -1.6, // how far left/right the plane may drift
  lateralMax: 1.6,

  // Fuel: drains faster at high throttle, refilled by fuel rings.
  fuelMax: 100,
  fuelDrain: 1.6, // per second at cruise
  fuelDrainThrottle: 1.4, // extra per second at full throttle
  fuelRingRefill: 45,

  // Rings: the delivery targets.
  ringSpacing: 260, // world units between rings
  ringRadius: 0.45, // hit radius in lateral/altitude units
  ringScore: 100,
  ringPerfectBonus: 50, // dead-centre pass
  legRings: 10, // rings per delivery leg; finishing one pays a bonus
  legBonus: 500,

  // Hazards and pickups.
  balloonScore: 0, // balloons are hazards, not points
  starScore: 25, // bonus stars floating between rings

  // Lives and difficulty.
  lives: 3,
  speedRamp: 6, // extra knots of cruise speed per completed leg
  hazardRamp: 0.12, // extra hazard chance per leg (capped below)

  // Rendering.
  horizonY: 0.42, // fraction of screen height where the horizon sits
  groundLines: 14, // perspective ground stripes
  mountainLayers: 3,
  cloudCount: 26,
  starCount: 14,
};
