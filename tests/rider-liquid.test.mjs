import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../rider-liquid.js", import.meta.url), "utf8");
const { createLiquid, stepLiquid, resetLiquid, getLiquidParticles } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);

const advance = (state, seconds, obstacles = []) => {
  for (let frame = 0; frame < seconds * 60; frame++) stepLiquid(state, 1 / 60, obstacles);
};

test("gravity advances particles with fixed-step integration", () => {
  const state = createLiquid({ count: 1, center: [0, 3] });
  stepLiquid(state, 1 / 120);
  const [particle] = getLiquidParticles(state);
  assert.ok(Math.abs(particle.velocity[1] + 9.81 / 120) < 1e-10);
  assert.ok(Math.abs(particle.position[1] - (3 - 9.81 / (120 * 120))) < 1e-10);
  const stationary = createLiquid({ count: 1, center: [0, 3], gravity: [0, 0] });
  advance(stationary, 1);
  assert.deepEqual(getLiquidParticles(stationary)[0].position, [0, 3]);
});

test("particles settle above the floor without tunneling", () => {
  const state = createLiquid({ center: [0, 3], count: 24, ground: -1 });
  advance(state, 3);
  const particles = getLiquidParticles(state);
  assert.ok(particles.every(({ position, velocity }) => position[1] >= -1 + state.radius - 1e-9));
  assert.ok(particles.some(({ position }) => position[1] < 0));
  assert.ok(particles.every(({ position, velocity }) => [...position, ...velocity].every(Number.isFinite)));
});

test("pressure separates overlapping neighbors even when gravity is disabled", () => {
  const state = createLiquid({ count: 2, center: [0, 3], radius: 0.15, gravity: [0, 0] });
  state.particles[0].position = [0, 3];
  state.particles[1].position = [0, 3];
  stepLiquid(state, 1 / 60);
  const [a, b] = getLiquidParticles(state);
  assert.ok(Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]) >= state.radius * 1.7);
  assert.ok(Math.abs((a.position[0] + b.position[0]) / 2) < 1e-10);
  assert.ok(Math.abs((a.position[1] + b.position[1]) / 2 - 3) < 1e-10);
});

test("frame partitioning and reset reproduce the same deterministic liquid", () => {
  const options = { id: "pool", center: [0, 3], count: 16 };
  const a = createLiquid(options);
  const b = createLiquid(options);
  const initial = getLiquidParticles(a);
  advance(a, 1);
  for (let frame = 0; frame < 120; frame++) stepLiquid(b, 1 / 120);
  assert.deepEqual(getLiquidParticles(a), getLiquidParticles(b));
  const settled = getLiquidParticles(a);
  resetLiquid(a);
  assert.deepEqual(getLiquidParticles(a), initial);
  assert.equal(a.accumulator, 0);
  assert.equal(a.elapsed, 0);
  advance(a, 1);
  assert.deepEqual(getLiquidParticles(a), settled);
});

test("circle/AABB collisions support a particle and expel particles starting inside", () => {
  const box = { min: [-1, 1], max: [1, 2] };
  const state = createLiquid({ count: 1, center: [0, 3] });
  advance(state, 2, [box]);
  assert.ok(getLiquidParticles(state)[0].position[1] >= box.max[1] + state.radius - 1e-9);
  state.particles[0].position = [0, 1.5];
  state.particles[0].velocity = [0, 0];
  stepLiquid(state, 1 / 120, [box]);
  const { position, radius } = getLiquidParticles(state)[0];
  const nearestX = Math.max(box.min[0], Math.min(box.max[0], position[0]));
  const nearestY = Math.max(box.min[1], Math.min(box.max[1], position[1]));
  assert.ok(Math.hypot(position[0] - nearestX, position[1] - nearestY) >= radius - 1e-9);
});

test("viscosity exchanges momentum and reduces relative velocities", () => {
  const state = createLiquid({ count: 2, center: [0, 3], gravity: [0, 0], stiffness: 0, viscosity: 1 });
  state.particles[0].position = [-0.15, 3];
  state.particles[1].position = [0.15, 3];
  state.particles[0].velocity = [0, 1];
  state.particles[1].velocity = [0, -1];
  stepLiquid(state, 1 / 120);
  const [a, b] = getLiquidParticles(state);
  assert.ok(Math.abs(a.velocity[1] - b.velocity[1]) < 2);
  assert.ok(Math.abs(a.velocity[1] + b.velocity[1]) < 1e-10);
});

test("particle budgets, bounds and independent render copies are enforced", () => {
  const state = createLiquid({ count: 10000, center: [0, 2], bounds: { left: -1, right: 1, top: 4, bottom: 0 } });
  assert.equal(state.count, 96);
  advance(state, 0.5);
  assert.ok(getLiquidParticles(state).every(({ position, radius }) =>
    position[0] >= -1 + radius - 1e-9 && position[0] <= 1 - radius + 1e-9 &&
    position[1] >= radius - 1e-9 && position[1] <= 4 - radius + 1e-9));
  const copy = getLiquidParticles(state);
  copy[0].position[0] = 100;
  copy[0].velocity[0] = 100;
  assert.notEqual(state.particles[0].position[0], 100);
  assert.notEqual(state.particles[0].velocity[0], 100);
  assert.throws(() => stepLiquid(state, NaN), TypeError);
  assert.throws(() => stepLiquid(state, -1), TypeError);
  assert.throws(() => createLiquid({ count: Infinity }), TypeError);
  assert.throws(() => createLiquid({ bounds: { left: 1, right: -1 } }), RangeError);
});
