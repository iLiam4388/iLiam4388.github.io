"""Exercise both editors from watch dimensions to an ultrawide display.

Requires Python Playwright and Chromium. Serve the repository first, then run
python tests/rider-responsive-browser.py. RIDER_TEST_URL overrides localhost:8000.
"""
import json
import os
import shutil
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("RIDER_TEST_URL", "http://127.0.0.1:8000")
ARTIFACTS = Path(tempfile.mkdtemp(prefix="rider-responsive-"))
SIZES = [(162, 197), (184, 224), (390, 844), (600, 600), (601, 600), (768, 844), (2560, 1080)]


def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Page overflows horizontally"


def full_screen(page, selector, width, height):
    box = page.locator(selector).bounding_box()
    assert box and box["x"] == 0 and box["y"] == 0, (selector, box)
    assert box["width"] == width and box["height"] == height, (selector, box)
    no_overflow(page)


def screenshot(page, name):
    page.screenshot(path=str(ARTIFACTS / f"{name}.png"))


def check_3d(page):
    page.goto(BASE + "/3d-rider.html", wait_until="networkidle", timeout=60000)
    page.wait_for_selector("#loading", state="hidden", timeout=60000)
    for width, height in SIZES:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(100)
        no_overflow(page)
        assert page.locator("#view").bounding_box()["height"] > 40
        assert page.locator(".camera-presets").is_visible() == (width > 600)
        screenshot(page, f"3d-{width}-canvas")
        if width > 600:
            continue
        for selector in ["#libraryToggle", "#inspectorToggle"]:
            box = page.locator(selector).bounding_box()
            assert box["width"] >= 44 and box["height"] >= 44
            assert box["x"] >= 0 and box["x"] + box["width"] <= width
        page.locator("#libraryToggle").click()
        full_screen(page, "#libraryPanel", width, height)
        page.locator('[data-add="box"]').click()
        if page.locator("#libraryPanel").is_visible():
            page.locator("#libraryPanel [data-panel-close]").click()
        if not page.locator("#inspectorPanel").is_visible():
            page.locator("#inspectorToggle").click()
        full_screen(page, "#inspectorPanel", width, height)
        page.locator("#px").fill("2.5")
        page.locator("#px").press("Tab")
        assert page.locator("#px").input_value() == "2.5"
        if width <= 240:
            assert page.locator("#px").bounding_box()["width"] > 100
        page.locator('[data-nudge="x"][data-delta=".25"]').click()
        assert float(page.locator("#px").input_value()) == 2.75
        page.locator('[data-resize="1.25"]').click()
        assert float(page.locator("#sx").input_value()) == 1.25
        for button in page.locator(".touch-transform-grid button").all():
            box = button.bounding_box()
            assert box["width"] >= 44 and box["height"] >= 44
        screenshot(page, f"3d-{width}-inspector")
        page.locator("#px").focus()
        page.keyboard.press("Escape")
        assert not page.locator("#inspectorPanel").is_visible()
        assert page.evaluate("document.activeElement.id") == "inspectorToggle"
        page.locator("#animationToggle").click()
        full_screen(page, "#animationPanel", width, height)
        page.locator("#timelineTime").fill("1")
        page.locator("#timelineTime").press("Tab")
        screenshot(page, f"3d-{width}-timeline")
        page.locator("#animationCloseBtn").click()
        assert page.evaluate("document.activeElement.id") == "animationToggle"
        page.locator("#compactMenu summary").click()
        full_screen(page, ".compact-menu-body", width, height)
        assert page.locator('#compactMenu [data-action="saveBtn"]').is_visible()
        screenshot(page, f"3d-{width}-project")
        page.locator('#compactMenu [data-action="frameBtn"]').click()
        assert not page.locator("#compactMenu").evaluate("el => el.open")
    print("3D watch, phone, breakpoint, tablet, and ultrawide checks passed", flush=True)


def check_2d(page):
    page.goto(BASE + "/2d-rider.html", wait_until="networkidle", timeout=60000)
    for width, height in SIZES:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(100)
        no_overflow(page)
        assert page.locator("#canvas").bounding_box()["height"] > 40
        screenshot(page, f"2d-{width}-canvas")
        if width > 600:
            continue
        for button in page.locator(".dock button:visible").all():
            box = button.bounding_box()
            assert box and box["height"] >= 44 and box["width"] >= 44
            assert box["x"] >= 0 and box["x"] + box["width"] <= width
        if width <= 240:
            box = page.locator("#projectMenuBtn").bounding_box()
            assert box and box["width"] >= 44 and box["height"] >= 44
            assert box["x"] >= 0 and box["x"] + box["width"] <= width
        page.locator('.dock [data-panel="buildPanel"]').click()
        full_screen(page, "#buildPanel", width, height)
        page.locator('[data-add="rect"]').click()
        if page.locator("#buildPanel").is_visible():
            page.locator("#buildPanel [data-close]").click()
        if not page.locator("#editPanel").is_visible():
            page.locator('.dock [data-panel="editPanel"]').click()
        full_screen(page, "#editPanel", width, height)
        page.locator("#x").fill("2")
        page.locator("#x").press("Tab")
        assert page.locator("#x").input_value() == "2"
        screenshot(page, f"2d-{width}-edit")
        page.locator("#editPanel [data-close]").click()
        page.locator('.dock [data-panel="timelinePanel"]').click()
        full_screen(page, "#timelinePanel", width, height)
        page.locator("#duration").fill("3")
        page.locator("#duration").press("Tab")
        screenshot(page, f"2d-{width}-timeline")
        page.locator("#timelinePanel [data-close]").click()
        page.locator("#projectMenuBtn" if width <= 240 else '.dock [data-panel="projectPanel"]').click()
        full_screen(page, "#projectPanel", width, height)
        screenshot(page, f"2d-{width}-project")
        page.locator("#projectPanel [data-close]").click()
    print("2D watch, phone, breakpoint, tablet, and ultrawide checks passed", flush=True)


with sync_playwright() as playwright:
    launch = {"headless": True, "args": ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"]}
    browser_path = os.environ.get("RIDER_BROWSER_PATH") or shutil.which("chromium")
    if browser_path:
        launch["executable_path"] = browser_path
    if os.environ.get("HTTPS_PROXY"):
        launch["proxy"] = {"server": os.environ["HTTPS_PROXY"], "bypass": "localhost,127.0.0.1"}
    browser = playwright.chromium.launch(**launch)
    context = browser.new_context(viewport={"width": 1440, "height": 960})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    check_3d(page)
    check_2d(page)
    assert not errors, errors
    print(json.dumps({"result": "passed", "artifacts": str(ARTIFACTS), "browser_errors": errors}))
    browser.close()
