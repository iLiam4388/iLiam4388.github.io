// Small deterministic CPU liquid solver for 2D Rider. The particle budget is
// intentionally bounded so the same scene remains usable on a watch browser.
const FIXED_STEP = 1 / 120;
const MAX_PARTICLES = 96;
const EPSILON = 1e-9;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function number(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Liquid settings must contain finite numbers.");
  }
  return clamp(value, min, max);
}

function vector(value, fallback) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError("Liquid vectors need two coordinates.");
  }
  return value.map((part) => number(part, 0, -10000, 10000));
}

/** Create a liquid emitter. Width/height describe the initial particle region. */
export function createLiquid(options = {}) {
  const center = vector(options.center, [0, 2]);
  const radius = number(options.radius, 0.12, 0.01, 2);
  const width = number(options.width, 2, radius * 2, 100);
  const height = number(options.height, 2, radius * 2, 100);
  const count = Math.round(number(options.count, 48, 1, MAX_PARTICLES));
  const ground = number(options.ground, 0, -10000, 10000);
  const suppliedBounds = options.bounds || {};
  const bounds = {
    left: number(suppliedBounds.left, center[0] - width * 2, -10000, 10000),
    right: number(suppliedBounds.right, center[0] + width * 2, -10000, 10000),
    bottom: Math.max(ground, number(suppliedBounds.bottom, ground, -10000, 10000)),
    top: number(suppliedBounds.top, Infinity, -10000, 10000),
  };
  if (bounds.right - bounds.left < radius * 2 || bounds.top - bounds.bottom < radius * 2) {
    throw new RangeError("Liquid bounds must fit a particle.");
  }
  const state = {
    id: typeof options.id === "string" ? options.id : "liquid",
    center,
    count,
    radius,
    width,
    height,
    gravity: vector(options.gravity, [0, -9.81]),
    ground,
    bounds,
    viscosity: number(options.viscosity, 0.12, 0, 1),
    stiffness: number(options.stiffness, 0.65, 0, 1),
    elapsed: 0,
    accumulator: 0,
    particles: [],
    initialParticles: [],
  };
  const columns = Math.max(1, Math.ceil(Math.sqrt(count * width / height)));
  const rows = Math.ceil(count / columns);
  const spacingX = Math.max(radius * 2.05, (width - radius * 2) / Math.max(columns - 1, 1));
  const spacingY = Math.max(radius * 1.8, (height - radius * 2) / Math.max(rows - 1, 1));
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const particle = {
      position: [
        center[0] + (column - (columns - 1) / 2 + (row % 2) * 0.5) * spacingX,
        center[1] + (row - (rows - 1) / 2) * spacingY,
      ],
      velocity: [0, 0],
      radius,
    };
    collide(particle.position, radius, bounds, []);
    state.particles.push(particle);
  }
  state.initialParticles = getLiquidParticles(state);
  return state;
}

function obstacleList(obstacles) {
  if (!Array.isArray(obstacles)) throw new TypeError("Liquid obstacles must be an array.");
  return obstacles.slice(0, 256).map((obstacle) => {
    if (!obstacle || typeof obstacle !== "object") throw new TypeError("Invalid liquid obstacle.");
    const min = vector(obstacle.min);
    const max = vector(obstacle.max);
    if (!min || !max || min[0] > max[0] || min[1] > max[1]) {
      throw new TypeError("Liquid obstacle bounds are invalid.");
    }
    return { min, max };
  });
}

// Circle/AABB separation handles corners with the true circle distance, and
// chooses the closest exit face when a particle starts inside an obstacle.
function collide(position, radius, bounds, obstacles) {
  position[0] = clamp(position[0], bounds.left + radius, bounds.right - radius);
  position[1] = clamp(position[1], bounds.bottom + radius, bounds.top - radius);
  for (const { min, max } of obstacles) {
    const nearestX = clamp(position[0], min[0], max[0]);
    const nearestY = clamp(position[1], min[1], max[1]);
    const dx = position[0] - nearestX;
    const dy = position[1] - nearestY;
    const distance = Math.hypot(dx, dy);
    if (distance >= radius) continue;
    if (distance > EPSILON) {
      const displacement = (radius - distance) / distance;
      position[0] += dx * displacement;
      position[1] += dy * displacement;
    } else {
      const exits = [
        [position[0] - min[0], 0, min[0] - radius],
        [max[0] - position[0], 0, max[0] + radius],
        [position[1] - min[1], 1, min[1] - radius],
        [max[1] - position[1], 1, max[1] + radius],
      ];
      exits.sort((a, b) => a[0] - b[0]);
      position[exits[0][1]] = exits[0][2];
    }
  }
  position[0] = clamp(position[0], bounds.left + radius, bounds.right - radius);
  position[1] = clamp(position[1], bounds.bottom + radius, bounds.top - radius);
}

function substep(state, obstacles) {
  const particles = state.particles;
  const radius = state.radius;
  const support = radius * 4;
  const previous = particles.map((particle) => [...particle.position]);

  // Pair viscosity exchanges velocity symmetrically, retaining momentum.
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i];
      const b = particles[j];
      const distance = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]);
      if (distance >= support) continue;
      const blend = state.viscosity * (1 - distance / support) * 0.25;
      for (let axis = 0; axis < 2; axis++) {
        const impulse = (b.velocity[axis] - a.velocity[axis]) * blend;
        a.velocity[axis] += impulse;
        b.velocity[axis] -= impulse;
      }
    }
  }
  for (const particle of particles) {
    for (let axis = 0; axis < 2; axis++) {
      particle.velocity[axis] = clamp(particle.velocity[axis] + state.gravity[axis] * FIXED_STEP, -50, 50);
      particle.position[axis] += particle.velocity[axis] * FIXED_STEP;
    }
  }

  // Double-density relaxation provides pressure in crowded neighborhoods,
  // followed by a short-range incompressibility constraint.
  for (let iteration = 0; iteration < 3; iteration++) {
    const density = new Float64Array(particles.length);
    const nearDensity = new Float64Array(particles.length);
    const pairs = [];
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i].position;
        const b = particles[j].position;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const distance = Math.hypot(dx, dy);
        if (distance >= support) continue;
        // An index-dependent direction separates an exact overlap without RNG.
        const angle = ((i * 13 + j * 7) % 32) * Math.PI / 16;
        const nx = distance > EPSILON ? dx / distance : Math.cos(angle);
        const ny = distance > EPSILON ? dy / distance : Math.sin(angle);
        const q = 1 - distance / support;
        density[i] += q * q;
        density[j] += q * q;
        nearDensity[i] += q * q * q;
        nearDensity[j] += q * q * q;
        pairs.push({ i, j, distance, nx, ny, q });
      }
    }
    const corrections = particles.map(() => [0, 0]);
    for (const pair of pairs) {
      const { i, j, distance, nx, ny, q } = pair;
      const pressure = Math.max(density[i] - 2, 0) + Math.max(density[j] - 2, 0);
      const nearPressure = nearDensity[i] + nearDensity[j];
      const fluidSeparation = state.stiffness * radius * 0.06 * (pressure * q + nearPressure * q * q);
      const collisionSeparation = Math.max(radius * 1.8 - distance, 0) * 0.48;
      const displacement = Math.min(radius * 0.3, Math.max(fluidSeparation, collisionSeparation));
      corrections[i][0] -= nx * displacement;
      corrections[i][1] -= ny * displacement;
      corrections[j][0] += nx * displacement;
      corrections[j][1] += ny * displacement;
    }
    particles.forEach((particle, index) => {
      particle.position[0] += corrections[index][0];
      particle.position[1] += corrections[index][1];
      collide(particle.position, radius, state.bounds, obstacles);
    });
  }
  particles.forEach((particle, index) => {
    for (let axis = 0; axis < 2; axis++) {
      particle.velocity[axis] = clamp((particle.position[axis] - previous[index][axis]) / FIXED_STEP, -50, 50);
    }
    // Remove downward momentum at the floor and damp the contact tangentially.
    if (particle.position[1] <= state.bounds.bottom + radius + EPSILON) {
      particle.velocity[1] = Math.max(0, particle.velocity[1]);
      particle.velocity[0] *= 0.98;
    }
  });
  state.elapsed += FIXED_STEP;
}

/** Advance fixed steps. Each call accepts at most 0.25 seconds to bound work. */
export function stepLiquid(state, dt, obstacles = []) {
  if (typeof dt !== "number" || !Number.isFinite(dt) || dt < 0) {
    throw new TypeError("Liquid time steps must be finite and non-negative.");
  }
  const normalizedObstacles = obstacleList(obstacles);
  state.accumulator += Math.min(dt, 0.25);
  while (state.accumulator + EPSILON >= FIXED_STEP) {
    substep(state, normalizedObstacles);
    state.accumulator = Math.max(0, state.accumulator - FIXED_STEP);
  }
  return state;
}

/** Restore the emitter to the exact initial positions and zero velocities. */
export function resetLiquid(state) {
  state.particles = state.initialParticles.map((particle) => ({
    position: [...particle.position],
    velocity: [...particle.velocity],
    radius: particle.radius,
  }));
  state.accumulator = 0;
  state.elapsed = 0;
  return state;
}

/** Copies are safe for rendering or export without mutating the simulation. */
export function getLiquidParticles(state) {
  return state.particles.map((particle) => ({
    position: [...particle.position],
    velocity: [...particle.velocity],
    radius: particle.radius,
  }));
}
