import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dataModule = (source) => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const liquidSource = await readFile(new URL("../rider-liquid.js", import.meta.url), "utf8");
const motionSource = (await readFile(new URL("../rider-motion.js", import.meta.url), "utf8"))
  .replace('"./rider-liquid.js"', JSON.stringify(dataModule(liquidSource)));
const { sampleTransform, recordKeyframe, removeKeyframe, createSimulation, stepSimulation, resetSimulation, seekSimulation, getSimulatedTransform, getLiquidParticles } = await import(dataModule(motionSource));
const coreSource = await readFile(new URL("../rider-core.js", import.meta.url), "utf8");
const { createObjectRecord } = await import(dataModule(coreSource));
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be near ${expected}`);
const body = (id, overrides = {}) => createObjectRecord("box", { id, position: [0, 3, 0], physics: { type: "rigid", restitution: 0 }, ...overrides });
const run = (sim, time, fps = 60) => { for (let i = 0; i < Math.round(time * fps); i++) stepSimulation(sim, 1 / fps); return sim; };

test("keyframes interpolate independent transforms and retain intended full turns", () => {
  const object = body("animated", {
    keyframes: [
      { time: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { time: 2, position: [4, 6, 8], rotation: [0, Math.PI * 2, 0], scale: [3, 5, 7] },
    ],
  });
  const middle = sampleTransform(object, 1);
  assert.deepEqual(middle.position, [2, 3, 4]);
  assert.deepEqual(middle.rotation, [0, Math.PI, 0]);
  assert.deepEqual(middle.scale, [2, 3, 4]);
  assert.deepEqual(sampleTransform(object, -10).position, [0, 0, 0]);
  assert.deepEqual(sampleTransform(object, 20).position, [4, 6, 8]);
  middle.position[0] = 100;
  assert.equal(object.keyframes[0].position[0], 0);
});

test("smooth and step timing produce different meaningful intermediate poses", () => {
  const object = body("smooth", { keyframes: [{ time: 0, position: [0, 0, 0], interpolation: "smooth" }, { time: 1, position: [8, 0, 0] }] });
  near(sampleTransform(object, 0.25).position[0], 1.25);
  object.keyframes[0].interpolation = "step";
  near(sampleTransform(object, 0.99).position[0], 0);
  near(sampleTransform(object, 1).position[0], 8);
});

test("recording replaces a pose at the same time and removal does not mutate the scene", () => {
  const object = body("record");
  object.keyframes = recordKeyframe(object, 2);
  object.position[0] = 5;
  const recorded = recordKeyframe(object, 2, "smooth");
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].position[0], 5);
  assert.equal(object.keyframes[0].position[0], 0);
  object.keyframes = recorded;
  const added = recordKeyframe(object, 0);
  assert.deepEqual(added.map((frame) => frame.time), [0, 2]);
  assert.deepEqual(removeKeyframe({ ...object, keyframes: added }, 2).map((frame) => frame.time), [0]);
  assert.equal(added.length, 2);
  assert.throws(() => recordKeyframe(object, NaN), TypeError);
});

test("gravity falls under fixed steps and rigid bodies settle on the floor", () => {
  const sim = createSimulation([body("fall")]);
  run(sim, 0.2);
  assert.ok(getSimulatedTransform(sim, "fall").position[1] < 3);
  assert.ok(sim.bodies.get("fall").velocity[1] < 0);
  run(sim, 2);
  near(getSimulatedTransform(sim, "fall").position[1], 0.5);
  near(sim.bodies.get("fall").velocity[1], 0);
});

test("restitution bounces and floor friction reduces horizontal sliding", () => {
  const sim = createSimulation([body("bounce", { position: [0, 1, 0], physics: { type: "rigid", restitution: 0.8, friction: 0.8, velocity: [2, 0, 0] } })]);
  run(sim, 0.4);
  assert.ok(sim.bodies.get("bounce").velocity[1] > 0);
  assert.ok(sim.bodies.get("bounce").velocity[0] < 2);
  assert.ok(getSimulatedTransform(sim, "bounce").position[1] >= 0.5);
});

test("pair collisions conserve equal-mass elastic horizontal momentum", () => {
  const sim = createSimulation([
    body("left", { position: [-1, 2, 0], physics: { type: "rigid", restitution: 1, friction: 0, velocity: [2, 0, 0] } }),
    body("right", { position: [1, 2, 0], physics: { type: "rigid", restitution: 1, friction: 0, velocity: [-2, 0, 0] } }),
  ], { gravity: [0, 0, 0], ground: null });
  run(sim, 0.5);
  near(sim.bodies.get("left").velocity[0], -2);
  near(sim.bodies.get("right").velocity[0], 2);
  near(getSimulatedTransform(sim, "left").position[0], -getSimulatedTransform(sim, "right").position[0]);
});

test("static elevated obstacles support dynamic objects without falling themselves", () => {
  const sim = createSimulation([
    body("platform", { position: [0, 1.5, 0], parameters: { width: 4, height: 0.25, depth: 4 }, physics: { type: "static" } }),
    body("fall"),
  ]);
  run(sim, 2);
  near(getSimulatedTransform(sim, "platform").position[1], 1.5);
  near(getSimulatedTransform(sim, "fall").position[1], 2.125);
});

test("local bounds centers and rotations are respected by collider ground contact", () => {
  const supplied = createSimulation([body("offset", { position: [0, 5, 0], scale: [2, 2, 1] })], {
    bounds: { offset: { min: [0, -1, -0.1], max: [2, 0, 0.1] } },
  });
  run(supplied, 2);
  near(getSimulatedTransform(supplied, "offset").position[1], 2);
  resetSimulation(supplied);
  run(supplied, 2);
  near(getSimulatedTransform(supplied, "offset").position[1], 2);
  const rotated = createSimulation([body("rotated", {
    parameters: { width: 4, height: 1, depth: 1 }, rotation: [0, 0, Math.PI / 2],
  })]);
  run(rotated, 2);
  near(getSimulatedTransform(rotated, "rotated").position[1], 2);
});

test("keyframed bodies remain kinematic and nonphysics or locked objects retain their pose", () => {
  const sim = createSimulation([
    body("animated", { keyframes: [{ time: 0, position: [0, 2, 0] }, { time: 1, position: [5, 4, 0] }] }),
    body("locked", { locked: true }), body("none", { physics: { type: "none" } }),
  ]);
  run(sim, 1);
  assert.deepEqual(getSimulatedTransform(sim, "animated").position, [5, 4, 0]);
  near(getSimulatedTransform(sim, "locked").position[1], 3);
  near(getSimulatedTransform(sim, "none").position[1], 3);
});

test("soft bodies deform on impact and damped springs recover their rest shape", () => {
  const sim = createSimulation([body("soft", { position: [0, 1, 0], physics: { type: "soft", restitution: 0, stiffness: 0.3 } })]);
  run(sim, 0.35);
  const impact = getSimulatedTransform(sim, "soft").scale;
  assert.ok(impact[1] < 0.99, "impact compresses the vertical shape");
  assert.ok(impact[0] > 1, "impact expands a lateral dimension");
  run(sim, 3);
  const settled = getSimulatedTransform(sim, "soft").scale;
  near(settled[0], 1, 0.01);
  near(settled[1], 1, 0.01);
});

test("2D simulations collide in XY regardless of depth and preserve the drawing plane", () => {
  const sim = createSimulation([
    body("left", { position: [-1, 2, -4], physics: { type: "rigid", restitution: 1, velocity: [2, 0, 5] } }),
    body("right", { position: [1, 2, 4], physics: { type: "rigid", restitution: 1, velocity: [-2, 0, -5] } }),
  ], { mode: "2d", gravity: [0, 0, 10], ground: null });
  run(sim, 0.5);
  near(sim.bodies.get("left").velocity[0], -2);
  near(getSimulatedTransform(sim, "left").position[2], -4);
  near(getSimulatedTransform(sim, "right").position[2], 4);
});

test("reset, different render rates and forward/backward seeking reproduce the same simulation", () => {
  const object = body("repeat", { physics: { type: "soft", restitution: 0.6, velocity: [1, 0, 0] } });
  const sim = run(createSimulation([object]), 2, 30);
  const expected = getSimulatedTransform(sim, "repeat");
  resetSimulation(sim);
  run(sim, 2, 120);
  assert.deepEqual(getSimulatedTransform(sim, "repeat"), expected);
  seekSimulation(sim, 1);
  seekSimulation(sim, 2);
  assert.deepEqual(getSimulatedTransform(sim, "repeat"), expected);
  assert.deepEqual(object.position, [0, 3, 0]);
});

test("2D liquids interact with gravity and obstacles and replay deterministic particles", () => {
  const sim = createSimulation([
    body("water", { position: [0, 3, 0], physics: { type: "liquid" } }),
    body("platform", { position: [0, 0.7, 0], parameters: { width: 6, height: 0.2, depth: 1 }, physics: { type: "static" } }),
  ], { mode: "2d", liquidCount: 24 });
  const first = getLiquidParticles(sim, "water");
  assert.equal(first.length, 24);
  run(sim, 2);
  const expected = getLiquidParticles(sim, "water");
  assert.ok(expected.every((particle) => particle.position[1] >= 0.8 + particle.radius - 1e-8));
  assert.ok(expected.reduce((sum, particle) => sum + particle.position[1], 0) < first.reduce((sum, particle) => sum + particle.position[1], 0));
  resetSimulation(sim); run(sim, 2);
  assert.deepEqual(getLiquidParticles(sim, "water"), expected);
  const copied = getLiquidParticles(sim, "water");
  copied[0].position[0] = 1000;
  assert.notEqual(getLiquidParticles(sim, "water")[0].position[0], 1000);
  assert.deepEqual(getLiquidParticles(sim, "unknown"), []);
});

test("invalid elapsed times and bounds fail explicitly instead of corrupting physics", () => {
  const sim = createSimulation([body("safe")]);
  for (const value of [-1, NaN, Infinity]) assert.throws(() => stepSimulation(sim, value), TypeError);
  assert.throws(() => seekSimulation(sim, -1), TypeError);
  assert.throws(() => createSimulation([body("bad")], { bounds: { bad: { min: [1, 0, 0], max: [0, 0, 0] } } }), TypeError);
  assert.equal(getSimulatedTransform(sim, "unknown"), null);
});
