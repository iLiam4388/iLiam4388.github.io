/** Mesh component topology. Coincident render vertices share one editable vertex,
 * while UV seams and hard normals keep their separate buffer attributes. */
import * as THREE from "three";
import { MAX_GEOMETRY_VALUES } from "./rider-core.js";

export function meshTopology(geometry) {
  const position = geometry.getAttribute("position");
  const vertices = [], rawToVertex = [], byPosition = new Map();
  for (let raw = 0; raw < position.count; raw++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, raw);
    const key = point.toArray().map((v) => Math.round(v * 1e6)).join(":");
    let id = byPosition.get(key);
    if (id === undefined) {
      id = vertices.length;
      byPosition.set(key, id);
      vertices.push({ point, raw: [] });
    }
    vertices[id].raw.push(raw);
    rawToVertex[raw] = id;
  }
  const triangles = [], allEdges = new Map();
  const count = geometry.index?.count ?? position.count;
  for (let offset = 0; offset + 2 < count; offset += 3) {
    const raw = [0, 1, 2].map((i) => geometry.index ? geometry.index.getX(offset + i) : offset + i);
    const ids = raw.map((i) => rawToVertex[i]);
    const [a, b, c] = ids.map((i) => vertices[i].point);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const index = triangles.length;
    triangles.push({ raw, vertices: ids, normal, face: -1 });
    for (let i = 0; i < 3; i++) {
      const pair = [ids[i], ids[(i + 1) % 3]];
      const key = [...pair].sort((x, y) => x - y).join(":");
      if (!allEdges.has(key)) allEdges.set(key, { vertices: pair, triangles: [] });
      allEdges.get(key).triangles.push(index);
    }
  }
  const adjacent = triangles.map(() => []);
  const labels = geometry.userData?.riderFaces;
  const hasLabels = Array.isArray(labels) && labels.length === triangles.length && labels.every((v) => Number.isInteger(v) && v >= 0);
  for (const edge of allEdges.values()) {
    if (edge.triangles.length !== 2) continue;
    const [a, b] = edge.triangles;
    if (hasLabels ? labels[a] === labels[b] : triangles[a].normal.dot(triangles[b].normal) > 1 - 1e-6) {
      adjacent[a].push(b); adjacent[b].push(a);
    }
  }
  const faces = [];
  triangles.forEach((triangle, index) => {
    if (triangle.face !== -1) return;
    const id = faces.length, stack = [index], faceTriangles = [], points = new Set();
    triangle.face = id;
    while (stack.length) {
      const current = stack.pop(), item = triangles[current];
      faceTriangles.push(current);
      item.vertices.forEach((v) => points.add(v));
      for (const neighbor of adjacent[current]) {
        if (triangles[neighbor].face !== -1) continue;
        triangles[neighbor].face = id;
        stack.push(neighbor);
      }
    }
    const normal = faceTriangles.reduce((sum, i) => sum.add(triangles[i].normal), new THREE.Vector3()).normalize();
    faces.push({ triangles: faceTriangles, vertices: [...points], normal });
  });
  const edges = [...allEdges.values()].filter((edge) => edge.triangles.length !== 2 ||
    triangles[edge.triangles[0]].face !== triangles[edge.triangles[1]].face);
  return { vertices, edges, faces, triangles, rawToVertex };
}

export function componentVertices(topology, mode, selection) {
  const result = new Set();
  for (const index of selection) {
    if (mode === "vertex") result.add(index);
    else (mode === "edge" ? topology.edges[index] : topology.faces[index])?.vertices.forEach((v) => result.add(v));
  }
  return [...result];
}

export function selectedTriangles(topology, mode, selection) {
  if (mode === "face") return new Set([...selection].flatMap((i) => topology.faces[i]?.triangles || []));
  if (mode === "edge") return new Set([...selection].flatMap((i) => topology.edges[i]?.triangles || []));
  return new Set(topology.triangles.flatMap((triangle, i) => triangle.vertices.some((v) => selection.has(v)) ? [i] : []));
}

export function bufferGeometryJSON(geometry) {
  // Primitive .toJSON() only saves parameters. Always save editable attributes.
  const buffer = new THREE.BufferGeometry();
  buffer.copy(geometry);
  buffer.type = "BufferGeometry";
  delete buffer.parameters;
  const json = buffer.toJSON();
  buffer.dispose();
  return json;
}

/** Rebuild triangle data after topology edits, preserving UVs/colors. */
function checkTriangleBudget(geometry, triangles) {
  const valuesPerVertex = 3 + Object.entries(geometry.attributes)
    .filter(([key]) => key !== "normal" && key !== "tangent")
    .reduce((sum, [, attribute]) => sum + attribute.itemSize, 0);
  if (triangles * 3 * valuesPerVertex > MAX_GEOMETRY_VALUES)
    throw new Error("This edit would exceed the mesh size limit. Select fewer faces or use a simpler mesh.");
}
function triangleWriter(geometry) {
  const attributes = Object.entries(geometry.attributes).filter(([key]) => key !== "normal" && key !== "tangent");
  const arrays = Object.fromEntries(attributes.map(([key]) => [key, []]));
  let triangles = 0;
  const faces = [];
  const sample = (raw, offset = new THREE.Vector3()) => Object.fromEntries(attributes.map(([key, attribute]) => {
    const values = Array.from({ length: attribute.itemSize }, (_, i) => attribute.array[raw * attribute.itemSize + i]);
    if (key === "position") { values[0] += offset.x; values[1] += offset.y; values[2] += offset.z; }
    return [key, values];
  }));
  const write = (corners, face) => {
    for (const corner of corners) for (const [key] of attributes) arrays[key].push(...corner[key]);
    faces.push(face);
    return triangles++;
  };
  const finish = () => {
    const result = new THREE.BufferGeometry();
    result.userData.riderFaces = faces;
    for (const [key, attribute] of attributes) {
      result.setAttribute(key, new THREE.BufferAttribute(new attribute.array.constructor(arrays[key]), attribute.itemSize, attribute.normalized));
    }
    result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere();
    return result;
  };
  return { sample, write, finish };
}

export function deleteMeshComponents(geometry, topology, mode, selection) {
  const remove = selectedTriangles(topology, mode, selection);
  if (!remove.size) throw new Error("Select components to delete.");
  if (remove.size === topology.triangles.length) throw new Error("This would remove the entire mesh. Use Object mode to delete the object.");
  const writer = triangleWriter(geometry);
  topology.triangles.forEach((triangle, i) => {
    if (!remove.has(i)) writer.write(triangle.raw.map((raw) => writer.sample(raw)), triangle.face);
  });
  return { geometry: writer.finish(), selectedTriangles: [] };
}

export function subdivideMeshFaces(geometry, topology, selection) {
  const selected = selectedTriangles(topology, "face", selection);
  if (!selected.size) throw new Error("Select faces to subdivide.");
  checkTriangleBudget(geometry, topology.triangles.length + selected.size * 3);
  const writer = triangleWriter(geometry), caps = [];
  let nextFace = topology.faces.length;
  const midpoint = (a, b) => Object.fromEntries(Object.keys(a).map((key) => [key, a[key].map((v, i) => (v + b[key][i]) / 2)]));
  topology.triangles.forEach((triangle, i) => {
    const [a, b, c] = triangle.raw.map((raw) => writer.sample(raw));
    if (!selected.has(i)) { writer.write([a, b, c], triangle.face); return; }
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    for (const corners of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) caps.push(writer.write(corners, nextFace++));
  });
  return { geometry: writer.finish(), selectedTriangles: caps };
}

export function extrudeMeshFaces(geometry, topology, selection, distance) {
  const selected = selectedTriangles(topology, "face", selection);
  if (!selected.size) throw new Error("Select faces to extrude.");
  if (!Number.isFinite(distance) || Math.abs(distance) < 1e-5) throw new Error("Enter a nonzero extrusion distance.");
  const offsets = new Map(), boundary = new Map();
  for (const i of selection) {
    const face = topology.faces[i];
    for (const v of face.vertices) {
      if (!offsets.has(v)) offsets.set(v, new THREE.Vector3());
      offsets.get(v).add(face.normal);
    }
  }
  for (const offset of offsets.values()) offset.normalize().multiplyScalar(distance);
  for (const i of selected) {
    const triangle = topology.triangles[i];
    for (let j = 0; j < 3; j++) {
      const a = triangle.vertices[j], b = triangle.vertices[(j + 1) % 3];
      const key = [a, b].sort((x, y) => x - y).join(":");
      if (boundary.has(key)) boundary.delete(key);
      else boundary.set(key, { a, b, rawA: triangle.raw[j], rawB: triangle.raw[(j + 1) % 3] });
    }
  }
  checkTriangleBudget(geometry, topology.triangles.length + boundary.size * 2);
  const writer = triangleWriter(geometry), caps = [];
  topology.triangles.forEach((triangle, i) => {
    const corners = triangle.raw.map((raw, j) => writer.sample(raw, selected.has(i) ? offsets.get(triangle.vertices[j]) : undefined));
    const id = writer.write(corners, triangle.face);
    if (selected.has(i)) caps.push(id);
  });
  let nextFace = topology.faces.length;
  for (const edge of boundary.values()) {
    const a = writer.sample(edge.rawA), b = writer.sample(edge.rawB);
    const topA = writer.sample(edge.rawA, offsets.get(edge.a)), topB = writer.sample(edge.rawB, offsets.get(edge.b));
    writer.write([a, b, topB], nextFace); writer.write([a, topB, topA], nextFace++);
  }
  return { geometry: writer.finish(), selectedTriangles: caps };
}
