# iLiam

Welcome to the source code for my personal website!

🌐 Website: https://iliam4388.github.io

## Features

- 🏠 Home page
- 📸 Photos
- 🎥 Videos
- 📥 Downloads
- 🛒 Store
- ⭐ GitHub-powered reviews with Giscus

## Built With

- HTML5
- CSS3
- JavaScript
- GitHub Pages
- Giscus

## About

This website is where I share my projects, downloads, videos, photos, and other things I'm working on.

Feel free to look around and leave a review!

## License

© 2026 iLiam. All rights reserved.

## 3D Rider Studio

[Open 3D Rider](https://iliam4388.github.io/3d-rider.html) from the [Other page](https://iliam4388.github.io/other.html).

- Build with editable cubes, spheres, cylinders, cones, toruses, planes, text, and merging metaballs (ball, ellipsoid, capsule, chain, cluster, ring, and sheet).
- Start from an editable robot, rocket, or miniature desk.
- Select objects on the canvas; move, rotate, and scale with handles or precise numeric inputs.
- Use snapping, undo/redo, duplication, visibility controls, camera presets, and material presets.
- Animate position, rotation, and scale: set a pose, add a keyframe, move the timeline to another time, change the pose, and add another keyframe. Scrub or Play to preview; Stop returns to the beginning.
- Preview rigid-body gravity, bounces and collisions with static objects; soft bodies squash on impact and recover using damped shape springs. Keyframed bodies follow their animation and act as kinematic colliders. Preview physics does not overwrite the saved starting pose.
- Edit text, upload local TTF/OTF or Three.js font JSON, then convert actual glyph geometry to a mesh or a merging metaball surface. Undo restores editable text. Uploaded 3D font data travels with the project.
- Choose standard, toon, normals, or glass shaders alongside the existing material presets.
- Save and reopen `.3drider` projects, including keyframes, physics settings, text, fonts, imported geometry, lights, and materials. Version 1 projects are supported; older STL objects without saved geometry restore as clearly reported placeholders.
- Import STL meshes and export visible models as STL/OBJ or the current camera view as PNG.
- Recover the last workspace from browser storage. Download a project file to keep a portable copy; large scenes may exceed browser storage capacity.

Camera presets stay visible on large screens and disappear at 600px and below. Small screens use full-screen Build, Inspector, Timeline, and project menus, large touch targets, individual numeric axis controls, and tap-to-zoom buttons. The 3D renderer reduces pixel density, shadow work, and metaball resolution on small displays.

The studio is a static HTML/CSS/JavaScript application using Three.js. There is no build step. It requires WebGL2 and a connection to load the pinned Three.js modules; its default geometry font is bundled locally. STL/OBJ exports contain the visible geometry at the current preview time; `.3drider` preserves editable state. Metaballs use a shared surface with blended colors and averaged surface settings. Collision shapes use rotated bounding-box proxies; soft bodies use shape springs, not finite-element or triangle-level simulation. This is a lightweight modeling studio, rather than a full CAD or offline physics application.

## 2D Rider Studio

[Open 2D Rider](https://iliam4388.github.io/2d-rider.html) from the [Other page](https://iliam4388.github.io/other.html), or switch studios from either workspace.

2D Rider uses Canvas 2D without a WebGL dependency. Build and transform shapes, merging metaballs, and text; animate transform keyframes; preview rigid bodies, deformable soft bodies, and bounded liquid particles; upload fonts; convert text to polygon meshes or metaballs; save/reopen projects; and export PNG images. Full-screen touch drawers keep editing tools reachable on watch-sized displays while larger screens show side panels beside the canvas. Font uploads stay local to the browser.

### Local development and checks

Serve the repository with `python -m http.server 8000`, then visit `http://localhost:8000/3d-rider.html`.

Run the project-format, import validation, and history checks with:

```sh
node --test tests/*.test.mjs
```

For browser regression checks, install Python Playwright and Chromium, start the local server, and run:

```sh
python tests/rider-browser.py
python tests/rider-features-browser.py
python tests/rider-responsive-browser.py
python tests/rider-2d-browser.py
python tests/rider-modeling-browser.py
python tests/rider-integration-browser.py
```

The browser checks cover existing modeling workflows, actual keyframe interpolation, playback/reset, rigid/soft physics, distinct metaball geometry, font upload, text conversion, exports, persistence, and responsive controls. `RIDER_TEST_URL` and `RIDER_BROWSER_PATH` can override the server URL and browser executable. Unit tests cover validation, history, fixed-step animation/physics, and liquid interactions.
