/**
 * Renderer-independent animation and deterministic preview physics.
 * Collision shapes are rotated bounding-box proxies, not triangle meshes.
 * Soft bodies use damped shape springs; the 2D liquid uses interacting particles.
 * A keyframed physics object is kinematic so animation has an unambiguous priority.
 */
import { createLiquid, stepLiquid, resetLiquid, getLiquidParticles as copyLiquidParticles } from "./rider-liquid.js";

const copy = (vector) => [...vector];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const zero = () => [0, 0, 0];
const axes = (mode) => mode === "2d" ? 2 : 3;
const finite = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const transform = (object) => ({ position: copy(object.position || zero()), rotation: copy(object.rotation || zero()), scale: copy(object.scale || [1, 1, 1]) });

/** Linear Euler interpolation intentionally preserves full 360-degree turns. */
export function sampleTransform(object, time = 0) {
  const frames = object.keyframes || [];
  if (!frames.length) return transform(object);
  time = finite(time, 0);
  if (time <= frames[0].time) return transform(frames[0]);
  if (time >= frames.at(-1).time) return transform(frames.at(-1));
  let left = 0, right = frames.length - 1;
  while (right - left > 1) {
    const middle = Math.floor((left + right) / 2);
    if (frames[middle].time <= time) left = middle;
    else right = middle;
  }
  const a = frames[left], b = frames[right];
  let fraction = (time - a.time) / (b.time - a.time);
  if (a.interpolation === "step") fraction = 0;
  else if (a.interpolation === "smooth") fraction = fraction * fraction * (3 - 2 * fraction);
  const result = {};
  for (const key of ["position", "rotation", "scale"])
    result[key] = a[key].map((value, index) => {
      const sampled = value + (b[key][index] - value) * fraction;
      return key === "scale" && Math.abs(sampled) < 0.001 ? (sampled < 0 ? -0.001 : 0.001) : sampled;
    });
  return result;
}

/** Returns new sorted frames. Callers assign the result and commit one history edit. */
export function recordKeyframe(object, time, interpolation = "linear") {
  if (!Number.isFinite(time) || time < 0 || time > 3600) throw new TypeError("Keyframe time must be between 0 and 3600 seconds.");
  if (!["linear", "smooth", "step"].includes(interpolation)) throw new TypeError("Unknown keyframe interpolation.");
  const frames = (object.keyframes || []).filter((frame) => Math.abs(frame.time - time) > 0.00001)
    .map((frame) => ({ ...transform(frame), time: frame.time, interpolation: frame.interpolation || "linear" }));
  if (frames.length >= 500) throw new RangeError("An object can contain at most 500 keyframes.");
  frames.push({ ...transform(object), time, interpolation });
  return frames.sort((a, b) => a.time - b.time);
}

export function removeKeyframe(object, time) {
  return (object.keyframes || []).filter((frame) => Math.abs(frame.time - time) > 0.00001)
    .map((frame) => ({ ...transform(frame), time: frame.time, interpolation: frame.interpolation || "linear" }));
}

function localBounds(object) {
  const p = object.parameters || {};
  let half;
  switch (object.type) {
    case "box": half = [(p.width || 1) / 2, (p.height || 1) / 2, (p.depth || 1) / 2]; break;
    case "plane": half = [(p.width || 2) / 2, (p.height || 2) / 2, 0.025]; break;
    case "cylinder": half = [Math.max(p.radiusTop || 0, p.radiusBottom || 0, 0.01), (p.height || 1.5) / 2, Math.max(p.radiusTop || 0, p.radiusBottom || 0, 0.01)]; break;
    case "cone": half = [p.radius || 0.7, (p.height || 1.6) / 2, p.radius || 0.7]; break;
    case "torus": half = [(p.radius || 0.65) + (p.tube || 0.2), (p.radius || 0.65) + (p.tube || 0.2), p.tube || 0.2]; break;
    case "text": half = [Math.max(0.1, (object.text?.content.length || 1) * (object.text?.size || 1) * 0.32), (object.text?.size || 1) * 0.5, (object.text?.depth || 0.15) * 0.5]; break;
    default: half = [p.radius || 0.65, p.radius || 0.65, p.radius || 0.65];
  }
  const positions = object.geometry?.data?.attributes?.position?.array;
  if (positions?.length || object.metaSources?.length) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    if (positions?.length) {
      for (let i = 0; i < positions.length; i += 3)
        for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], positions[i + a]); max[a] = Math.max(max[a], positions[i + a]); }
    } else for (const source of object.metaSources)
      for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], source.position[a] - source.radius); max[a] = Math.max(max[a], source.position[a] + source.radius); }
    return { center: min.map((v, a) => (v + max[a]) / 2), half: min.map((v, a) => Math.max(0.005, (max[a] - v) / 2)) };
  }
  return { center: zero(), half };
}

// Matrix for Three.js's default XYZ Euler convention.
function rotationMatrix(rotation) {
  const [x, y, z] = rotation, a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  return [[c * e, -c * f, d], [a * f + b * e * d, a * e - b * f * d, -b * c], [b * f - a * e * d, b * e + a * f * d, a * c]];
}

function updateBounds(body, mode) {
  const matrix = rotationMatrix(body.rotation);
  const size = body.local.half.map((value, axis) => Math.abs(value * body.scale[axis]));
  body.half = matrix.map((row) => row.reduce((sum, value, axis) => sum + Math.abs(value) * size[axis], 0));
  const center = body.local.center.map((value, axis) => value * body.scale[axis]);
  body.center = matrix.map((row, axis) => body.position[axis] + row.reduce((sum, value, j) => sum + value * center[j], 0));
  body.min = body.center.map((value, axis) => value - body.half[axis]);
  body.max = body.center.map((value, axis) => value + body.half[axis]);
  if (mode === "2d") body.half[2] = 0;
}

function springImpact(body, axis, speed, mode) {
  if (body.type !== "soft") return;
  const compression = Math.min(0.6, Math.abs(speed) * 0.035 / Math.max(0.15, body.physics.stiffness));
  body.deformation[axis] = Math.max(-0.65, body.deformation[axis] - compression);
  for (let other = 0; other < axes(mode); other++)
    if (other !== axis) body.deformation[other] += compression / (axes(mode) - 1) * 0.4;
}

function stepSprings(body, dt) {
  if (body.type !== "soft") return;
  const stiffness = 30 + body.physics.stiffness * 200;
  const damping = 2 * Math.sqrt(stiffness) * 0.45;
  for (let axis = 0; axis < 3; axis++) {
    body.deformationVelocity[axis] += (-stiffness * body.deformation[axis] - damping * body.deformationVelocity[axis]) * dt;
    body.deformation[axis] = clamp(body.deformation[axis] + body.deformationVelocity[axis] * dt, -0.65, 0.6);
  }
}

function makeBody(object, mode, bounds = {}) {
  const physics = { type: "none", mass: 1, restitution: 0.35, friction: 0.4, stiffness: 0.65, velocity: zero(), angularVelocity: zero(), ...object.physics };
  physics.velocity = copy(physics.velocity);
  physics.angularVelocity = copy(physics.angularVelocity);
  const body = {
    id: object.id,
    // Geometry/font data are read only. Transform/keyframe copies allow editing the scene during playback safely.
    object: { ...object, ...transform(object), physics, parameters: { ...object.parameters }, keyframes: (object.keyframes || []).map((frame) => ({ ...frame, ...transform(frame) })) },
    physics, type: physics.type,
    dynamic: !object.locked && !(object.keyframes?.length) && (physics.type === "rigid" || physics.type === "soft"),
    collidable: object.visible !== false && object.type !== "light" && ["rigid", "soft", "static"].includes(physics.type),
    local: localBounds(object), ...sampleTransform(object, 0),
    velocity: copy(physics.velocity), deformation: zero(), deformationVelocity: zero(),
  };
  const supplied = bounds instanceof Map ? bounds.get(object.id) : bounds[object.id];
  if (supplied) {
    if (![supplied.min, supplied.max].every((value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) || supplied.min.some((value, axis) => value > supplied.max[axis]))
      throw new TypeError("Simulation bounds must contain finite ordered min/max vectors.");
    body.local = {
      center: supplied.min.map((value, axis) => (value + supplied.max[axis]) / 2),
      half: supplied.min.map((value, axis) => Math.max(0.005, (supplied.max[axis] - value) / 2)),
    };
  }
  if (mode === "2d") body.velocity[2] = 0;
  updateBounds(body, mode);
  return body;
}

export function createSimulation(objects = [], options = {}) {
  const mode = options.mode === "2d" ? "2d" : "3d";
  const sim = {
    mode, time: 0, accumulator: 0,
    fixedStep: clamp(finite(options.fixedStep, 1 / 60), 1 / 240, 1 / 30),
    gravity: copy(options.gravity || [0, -9.81, 0]),
    ground: options.ground === null ? null : finite(options.ground, 0),
    bounds: options.bounds || {},
    bodies: new Map(objects.map((object) => [object.id, makeBody(object, mode, options.bounds)])), liquids: new Map(),
  };
  if (mode === "2d") for (const body of sim.bodies.values()) if (body.type === "liquid" && body.object.visible !== false) {
    const liquid = createLiquid({
      id: body.id, center: body.position.slice(0, 2), count: options.liquidCount || 48,
      radius: clamp(Math.min(body.half[0], body.half[1]) / 5, 0.04, 0.2),
      width: Math.max(0.5, body.half[0] * 2), height: Math.max(0.5, body.half[1] * 2),
      gravity: sim.gravity.slice(0, 2), ground: sim.ground ?? -10000,
      viscosity: body.physics.friction, stiffness: body.physics.stiffness,
    });
    for (const particle of [...liquid.particles, ...liquid.initialParticles]) particle.velocity = body.physics.velocity.slice(0, 2);
    sim.liquids.set(body.id, liquid);
  }
  return sim;
}

function resolveGround(body, sim, dt) {
  if (sim.ground === null || body.min[1] >= sim.ground) return;
  body.position[1] += sim.ground - body.min[1];
  if (body.velocity[1] < 0) {
    const impact = body.velocity[1];
    const resting = Math.abs(impact) < Math.abs(sim.gravity[1]) * dt * 1.5;
    body.velocity[1] = resting ? 0 : -impact * body.physics.restitution;
    if (!resting) springImpact(body, 1, impact, sim.mode);
  }
  const friction = Math.max(0, 1 - body.physics.friction * 10 * dt);
  body.velocity[0] *= friction;
  body.velocity[2] *= friction;
  updateBounds(body, sim.mode);
}

function resolvePair(a, b, sim) {
  const dimensions = axes(sim.mode);
  let collisionAxis = 0, depth = Infinity;
  for (let axis = 0; axis < dimensions; axis++) {
    const overlap = a.half[axis] + b.half[axis] - Math.abs(a.center[axis] - b.center[axis]);
    if (overlap <= 0) return;
    if (overlap < depth) { depth = overlap; collisionAxis = axis; }
  }
  const inverseA = a.dynamic ? 1 / a.physics.mass : 0, inverseB = b.dynamic ? 1 / b.physics.mass : 0;
  const inverseSum = inverseA + inverseB;
  if (!inverseSum) return;
  const normal = b.center[collisionAxis] >= a.center[collisionAxis] ? 1 : -1;
  a.position[collisionAxis] -= normal * depth * inverseA / inverseSum;
  b.position[collisionAxis] += normal * depth * inverseB / inverseSum;
  const relativeVelocity = (b.velocity[collisionAxis] - a.velocity[collisionAxis]) * normal;
  if (relativeVelocity < 0) {
    const impulse = -(1 + Math.min(a.physics.restitution, b.physics.restitution)) * relativeVelocity / inverseSum;
    if (a.dynamic) a.velocity[collisionAxis] -= normal * impulse * inverseA;
    if (b.dynamic) b.velocity[collisionAxis] += normal * impulse * inverseB;
    const friction = Math.sqrt(a.physics.friction * b.physics.friction);
    for (let axis = 0; axis < dimensions; axis++) if (axis !== collisionAxis) {
      const tangentVelocity = b.velocity[axis] - a.velocity[axis];
      const tangentImpulse = clamp(-tangentVelocity / inverseSum, -impulse * friction, impulse * friction);
      if (a.dynamic) a.velocity[axis] -= tangentImpulse * inverseA;
      if (b.dynamic) b.velocity[axis] += tangentImpulse * inverseB;
    }
    springImpact(a, collisionAxis, relativeVelocity * inverseA / inverseSum, sim.mode);
    springImpact(b, collisionAxis, relativeVelocity * inverseB / inverseSum, sim.mode);
  }
  updateBounds(a, sim.mode); updateBounds(b, sim.mode);
}

function fixedTick(sim) {
  const dt = sim.fixedStep;
  sim.time += dt;
  const collisionBodies = [];
  for (const body of sim.bodies.values()) {
    if (body.object.keyframes.length) {
      const previous = copy(body.position);
      Object.assign(body, sampleTransform(body.object, sim.time));
      body.velocity = body.position.map((value, axis) => (value - previous[axis]) / dt);
    } else if (body.dynamic) {
      for (let axis = 0; axis < axes(sim.mode); axis++) {
        body.velocity[axis] += sim.gravity[axis] * dt;
        body.position[axis] += body.velocity[axis] * dt;
      }
      for (let axis = 0; axis < 3; axis++)
        if (sim.mode === "3d" || axis === 2) body.rotation[axis] += body.physics.angularVelocity[axis] * dt;
      stepSprings(body, dt);
    }
    updateBounds(body, sim.mode);
    if (body.collidable) {
      if (body.dynamic) resolveGround(body, sim, dt);
      collisionBodies.push(body);
    }
  }
  // Sweep-and-prune avoids checking every pair in a large dispersed scene.
  collisionBodies.sort((a, b) => a.min[0] - b.min[0]);
  for (let i = 0; i < collisionBodies.length; i++)
    for (let j = i + 1; j < collisionBodies.length && collisionBodies[j].min[0] < collisionBodies[i].max[0]; j++)
      if (collisionBodies[i].dynamic || collisionBodies[j].dynamic) resolvePair(collisionBodies[i], collisionBodies[j], sim);
  for (const body of collisionBodies) if (body.dynamic) resolveGround(body, sim, dt);
  if (sim.liquids.size) {
    const obstacles = collisionBodies.map((body) => ({ min: body.min.slice(0, 2), max: body.max.slice(0, 2) }));
    for (const liquid of sim.liquids.values()) stepLiquid(liquid, dt, obstacles);
  }
}

/** Advances at a fixed time step. Excess wall-clock lag is dropped after 0.25 s. */
export function stepSimulation(sim, elapsed) {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new TypeError("Simulation elapsed time must be finite and nonnegative.");
  sim.accumulator += Math.min(elapsed, 0.25);
  while (sim.accumulator + 1e-10 >= sim.fixedStep) {
    fixedTick(sim);
    sim.accumulator = Math.max(0, sim.accumulator - sim.fixedStep);
  }
  return sim;
}

export function resetSimulation(sim) {
  const objects = [...sim.bodies.values()].map((body) => body.object);
  sim.bodies = new Map(objects.map((object) => [object.id, makeBody(object, sim.mode, sim.bounds)]));
  for (const liquid of sim.liquids.values()) resetLiquid(liquid);
  sim.time = 0; sim.accumulator = 0;
  return sim;
}

/** Replays fixed ticks from the same initial state; forward scrubbing reuses matching ticks. */
export function seekSimulation(sim, time) {
  if (!Number.isFinite(time) || time < 0 || time > 3600) throw new TypeError("Simulation time must be between 0 and 3600 seconds.");
  const ticks = Math.floor((time + 1e-10) / sim.fixedStep);
  let currentTicks = Math.round(sim.time / sim.fixedStep);
  if (ticks < currentTicks) { resetSimulation(sim); currentTicks = 0; }
  if (!sim.liquids.size && ![...sim.bodies.values()].some((body) => body.dynamic)) {
    sim.time = ticks * sim.fixedStep;
    for (const body of sim.bodies.values()) {
      Object.assign(body, sampleTransform(body.object, sim.time));
      updateBounds(body, sim.mode);
    }
  } else for (let tick = currentTicks; tick < ticks; tick++) fixedTick(sim);
  sim.accumulator = Math.max(0, time - sim.time);
  return sim;
}

export function getSimulatedTransform(sim, id) {
  const body = sim.bodies.get(id);
  if (!body) return null;
  const result = transform(body);
  if (body.object.keyframes.length) return sampleTransform(body.object, sim.time + sim.accumulator);
  if (body.type === "soft") result.scale = result.scale.map((value, axis) => value * (1 + body.deformation[axis]));
  return result;
}

export function getLiquidParticles(sim, id) {
  const liquid = sim.liquids.get(id);
  return liquid ? copyLiquidParticles(liquid) : [];
}
