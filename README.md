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

- Build with editable cubes, spheres, cylinders, cones, toruses, planes, and merging metaballs.
- Start from an editable robot, rocket, or miniature desk.
- Select objects on the canvas; move, rotate, and scale with handles or precise numeric inputs.
- Use snapping, undo/redo, duplication, visibility controls, camera presets, and material presets.
- Save and reopen `.3drider` projects, including imported geometry, lights, and materials. Version 1 projects are supported; older STL objects without saved geometry restore as clearly reported placeholders.
- Import STL meshes and export visible models as STL/OBJ or the current camera view as PNG.
- Recover the last workspace from browser storage. Download a project file to keep a portable copy; large scenes may exceed browser storage capacity.

The studio is a static HTML/CSS/JavaScript application using Three.js. There is no build step. It requires a browser with WebGL2 and a network connection to load the pinned Three.js modules and fonts. STL/OBJ exports contain geometry; `.3drider` is the format that preserves studio materials and lighting. Metaballs use a shared surface with blended colors and averaged surface settings. This is a modeling studio for shape composition, rather than a full CAD or vertex-editing application.

### Local development and checks

Serve the repository with `python -m http.server 8000`, then visit `http://localhost:8000/3d-rider.html`.

Run the project-format, import validation, and history checks with:

```sh
node --test tests/rider-core.test.mjs
```

For browser regression checks, install Python Playwright and Chromium, start the local server, and run:

```sh
python tests/rider-browser.py
```

The browser suite covers modeling edits, undo/redo, save/reopen, STL persistence, rejected imports, metaball STL/OBJ export, PNG export, browser recovery, starters, and mobile panels. `RIDER_TEST_URL` and `RIDER_BROWSER_PATH` can override the server URL and browser executable.
