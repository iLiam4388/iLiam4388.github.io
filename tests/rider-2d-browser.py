"""Functional 2D Rider browser regressions. Requires Python Playwright and Chromium.

Serve the repository, then run python tests/rider-2d-browser.py.
RIDER_TEST_URL and RIDER_BROWSER_PATH override the defaults.
"""
import copy
import json
import math
import os
import shutil
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("RIDER_TEST_URL", "http://127.0.0.1:8000")
ARTIFACTS = Path(tempfile.mkdtemp(prefix="rider-2d-check-"))


def state(page):
    return page.evaluate("async () => (await import('./rider-2d.js')).getStudioState()")


def field(page, selector, value):
    page.locator(selector).fill(str(value))
    page.locator(selector).press("Tab")


def open_panel(page, panel):
    if not page.locator(f"#{panel}").evaluate("e => e.classList.contains('open')"):
        page.locator(f'[data-panel="{panel}"]').click()


def seek(page, seconds):
    open_panel(page, "timelinePanel")
    field(page, "#timeNumber", seconds)


def import_project(page, project):
    page.locator("#projectFile").set_input_files({"name": "test.2drider", "mimeType": "application/json", "buffer": json.dumps(project).encode()})
    page.wait_for_timeout(120)


def save_project(page):
    open_panel(page, "projectPanel")
    with page.expect_download() as download:
        page.locator("#saveBtn").click()
    return json.loads(Path(download.value.path()).read_text())


def body(kind, identifier, **values):
    record = dict(id=identifier, type=kind, name=identifier, x=0, y=0, rotation=0, sx=1, sy=1,
                  color="#66c6d4", shader="flat", opacity=1, physics="none", mass=1,
                  bounce=0.2, softness=0.35, influence=1, keyframes=[])
    record.update(values)
    return record


def project(objects):
    return dict(format="2d-rider", version=1, name="Regression scene", objects=objects, fonts=[],
                duration=5, loop=False, gravity=9.8, floor=3, floorEnabled=True,
                background="#181a20", grid=False)


with sync_playwright() as p:
    launch = dict(headless=True, args=["--no-sandbox"])
    browser_path = os.environ.get("RIDER_BROWSER_PATH") or shutil.which("chromium")
    if browser_path:
        launch["executable_path"] = browser_path
    browser = p.chromium.launch(**launch)
    context = browser.new_context(viewport={"width": 1440, "height": 960}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda dialog: dialog.accept())
    page.goto(BASE + "/2d-rider.html", wait_until="networkidle")
    page.wait_for_timeout(150)
    assert len(state(page)["project"]["objects"]) == 2
    page.screenshot(path=str(ARTIFACTS / "desktop.png"))

    # Saved empty scenes remain empty after reload.
    import_project(page, project([]))
    page.wait_for_timeout(500)
    page.reload(wait_until="networkidle")
    assert state(page)["project"]["objects"] == []

    # Authored transform controls and real position, rotation and scale keyframes.
    page.locator('[data-add="rect"]').click()
    field(page, "#x", 0)
    field(page, "#y", 0)
    field(page, "#rotation", 0)
    field(page, "#sx", 1)
    field(page, "#sy", 1)
    page.locator("#addKeyframeBtn").click()
    seek(page, 2)
    page.locator("#timelinePanel [data-close]").click()
    field(page, "#x", 4)
    field(page, "#rotation", 180)
    field(page, "#sx", 2)
    field(page, "#sy", 3)
    page.locator("#addKeyframeBtn").click()
    assert len(state(page)["project"]["objects"][0]["keyframes"]) == 2
    seek(page, 1)
    pose = state(page)["poses"][0]
    assert (pose["x"], pose["rotation"], pose["sx"], pose["sy"]) == (2, 90, 1.5, 2)
    field(page, "#duration", 1)
    assert state(page)["project"]["duration"] == 2  # Preserve future keys.
    page.locator("#timelinePanel [data-close]").click()
    field(page, "#objectName", "Animated rectangle")
    assert state(page)["project"]["objects"][0]["x"] == 4  # Authored final edit survives preview.
    seek(page, 1)
    page.locator("#timelinePanel [data-close]").click()
    field(page, "#x", 7)
    page.locator("#addKeyframeBtn").click()
    keys = state(page)["project"]["objects"][0]["keyframes"]
    assert keys[1]["time"] == 1 and keys[1]["x"] == 7
    print("Transform and keyframe authoring passed", flush=True)

    # Rigid floor, real collider support, collision separation and deterministic seeks.
    rigid_project = project([
        body("circle", "fall", x=-2, y=-1, physics="rigid"),
        body("rect", "obstacle", x=-2, y=2, physics="static"),
        body("circle", "overlap-a", x=2, y=0, physics="rigid"),
        body("circle", "overlap-b", x=2.2, y=0, physics="rigid"),
    ])
    import_project(page, rigid_project)
    seek(page, 2)
    first = state(page)
    poses = {pose["id"]: pose for pose in first["poses"]}
    assert -1 < poses["fall"]["y"] < 0.7  # Supported by static rectangle top, not floor.
    assert math.hypot(poses["overlap-a"]["x"] - poses["overlap-b"]["x"], poses["overlap-a"]["y"] - poses["overlap-b"]["y"]) > 1.5
    assert all(pose["y"] <= 3 for pose in first["poses"])
    seek(page, 0.4)
    seek(page, 2)
    assert state(page)["poses"] == first["poses"]
    saved = save_project(page)
    assert saved["objects"][0]["y"] == -1
    page.locator("#projectPanel [data-close]").click()
    page.locator("#shader").select_option("neon")
    assert state(page)["project"]["objects"][0]["y"] == -1
    seek(page, 1)
    page.locator("#timelinePanel [data-close]").click()
    page.locator('[data-add="triangle"]').click()
    assert state(page)["project"]["objects"][0]["y"] == -1
    saved = save_project(page)
    assert saved["objects"][0]["y"] == -1
    page.locator("#projectPanel [data-close]").click()
    seek(page, 1)
    page.locator("#resetBtn").click()
    assert state(page)["poses"][0]["y"] == -1
    page.locator("#playBtn").click()
    page.wait_for_timeout(220)
    assert state(page)["poses"][0]["y"] > -1
    saved = save_project(page)
    assert saved["objects"][0]["y"] == -1
    print("Rigid collisions, authored saves, reset and deterministic scrub passed", flush=True)

    # Soft bodies deform at the floor; fluids interact and remain bounded.
    fluid_project = project([
        body("circle", "soft", x=-2, y=-0.5, physics="soft", softness=0.75),
        body("liquid", "liquid", x=1.2, y=-0.8, particleCount=80),
        body("rect", "liquid-obstacle", x=1.2, y=1.6, physics="static", sx=1.4, sy=0.5),
    ])
    import_project(page, fluid_project)
    seek(page, 1.6)
    runtime = state(page)
    soft = runtime["soft"][0]
    assert len(soft["nodes"]) >= 8
    assert max(node["y"] for node in soft["nodes"]) <= 3.001
    radii = [math.hypot(node["x"] - sum(n["x"] for n in soft["nodes"]) / len(soft["nodes"]), node["y"] - sum(n["y"] for n in soft["nodes"]) / len(soft["nodes"])) for node in soft["nodes"]]
    assert max(radii) - min(radii) > 0.08  # Spring cage actually deforms.
    particles = runtime["liquids"][0]["particles"]
    assert len(particles) == 80 and all(math.isfinite(p["x"]) and p["y"] < 3.01 for p in particles)
    assert sum(p["y"] for p in particles) / len(particles) > -0.8
    assert min(p["x"] for p in particles) < 0 or max(p["x"] for p in particles) > 2.4
    seek(page, 0.1)
    seek(page, 1.6)
    assert state(page)["soft"] == runtime["soft"]
    assert state(page)["liquids"] == runtime["liquids"]
    page.screenshot(path=str(ARTIFACTS / "soft-fluid.png"))
    print("Soft spring deformation and interacting liquid particles passed", flush=True)

    # Uploaded font bytes, editable text, real polygon outlines/counters and metaballs.
    import_project(page, project([]))
    page.locator('[data-add="text"]').click()
    field(page, "#textContent", "O")
    font_paths = list(Path("/usr/share/fonts").rglob("*.ttf"))
    assert font_paths, "Install a TTF font for the font-upload regression"
    page.locator("#fontFile").set_input_files(str(font_paths[0]))
    page.wait_for_function("async () => (await import('./rider-2d.js')).getStudioState().project.fonts.length === 1")
    text_project = save_project(page)
    assert text_project["fonts"][0]["data"].startswith("data:font/ttf;base64,")
    font_family = text_project["objects"][0]["font"]
    page.locator("#projectPanel [data-close]").click()
    page.locator("#textMeshBtn").click()
    mesh = state(page)["project"]["objects"][0]
    assert mesh["type"] == "mesh" and len(mesh["contours"]) >= 2
    assert sum(len(ring) for ring in mesh["contours"]) > 12
    page.locator("#physics").select_option("soft")
    seek(page, 1.5)
    assert len(state(page)["project"]["objects"][0]["contours"]) == len(mesh["contours"])
    page.screenshot(path=str(ARTIFACTS / "soft-text-mesh.png"))
    import_project(page, text_project)
    assert state(page)["project"]["objects"][0]["font"] == font_family
    page.locator("#physics").select_option("soft")
    seek(page, 1.5)
    assert state(page)["soft"][0]["textContourCount"] >= 2
    page.locator("#timelinePanel [data-close]").click()
    page.locator("#physics").select_option("none")
    page.locator("#textMetaBtn").click()
    meta = state(page)["project"]["objects"][0]
    assert meta["type"] == "meta" and len(meta["sources"]) > 3
    for variant in ["ball", "capsule", "chain", "ring", "cluster"]:
        page.locator(f'[data-meta="{variant}"]').click()
    assert len(state(page)["project"]["objects"]) == 6
    saved = save_project(page)
    import_project(page, saved)
    assert state(page)["project"] == saved
    print("Font upload, soft glyph counters, text geometry, metaball variants and roundtrip passed", flush=True)

    # Export PNG must contain canvas imagery, with a valid PNG payload.
    open_panel(page, "projectPanel")
    with page.expect_download() as download:
        page.locator("#exportBtn").click()
    assert Path(download.value.path()).read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    page.locator("#projectPanel [data-close]").click()

    # Invalid import preserves the current scene. Undo/redo remain authored.
    before = state(page)["project"]
    invalid = copy.deepcopy(before)
    invalid["objects"][1]["id"] = invalid["objects"][0]["id"]
    import_project(page, invalid)
    assert state(page)["project"] == before
    page.locator('[data-add="rect"]').click()
    open_panel(page, "projectPanel")
    page.locator("#undoBtn").click()
    assert len(state(page)["project"]["objects"]) == 6
    page.locator("#redoBtn").click()
    assert len(state(page)["project"]["objects"]) == 7
    page.locator("#projectPanel [data-close]").click()
    page.locator("#sceneList button").last.click()

    for width, height in [(162, 197), (184, 224), (390, 844), (2560, 1080)]:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(100)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        assert page.locator("#canvas").bounding_box()["height"] > 40
        if width < 240:
            page.locator('[data-panel="editPanel"]').click()
            assert page.locator("#x").bounding_box()["width"] > 100
            page.locator("#x").focus()
            page.keyboard.press("Escape")
            assert not page.locator("#editPanel").is_visible()
            page.locator("#projectMenuBtn").click()
            assert page.locator("#projectPanel").bounding_box()["height"] == height
            page.locator("#projectPanel [data-close]").click()
        page.screenshot(path=str(ARTIFACTS / f"responsive-{width}.png"))
    assert not errors, errors
    browser.close()
    print(f"2D Rider regressions passed; screenshots: {ARTIFACTS}", flush=True)
