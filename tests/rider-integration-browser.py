"""Regression checks for animation, text edits, and scene history integration.

Serve the repository at localhost:8000, then run this file with Python.
"""
import json
import os
from pathlib import Path
import shutil

from playwright.sync_api import sync_playwright


BASE = os.environ.get("RIDER_TEST_URL", "http://127.0.0.1:8000")
FONT = Path(__file__).resolve().parents[1] / "assets/fonts/helvetiker_regular.typeface.json"


def edit(page, selector, value):
    page.locator(selector).fill(str(value))
    page.locator(selector).dispatch_event("change")


def save(page):
    with page.expect_download() as event:
        page.locator("#saveBtn").click()
    return json.loads(Path(event.value.path()).read_text())


def new_scene(page):
    page.locator("#newBtn").click()
    page.locator("#confirmNewBtn").click()
    page.locator("#buildTab").click()


with sync_playwright() as playwright:
    launch = {
        "headless": True,
        "executable_path": os.environ.get("RIDER_BROWSER_PATH") or shutil.which("chromium"),
        "args": ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
    }
    if os.environ.get("HTTPS_PROXY"):
        launch["proxy"] = {"server": os.environ["HTTPS_PROXY"], "bypass": "localhost,127.0.0.1"}
    browser = playwright.chromium.launch(**launch)
    page = browser.new_page(viewport={"width": 1440, "height": 960}, accept_downloads=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("dialog", lambda dialog: dialog.accept())
    page.goto(BASE + "/3d-rider.html", wait_until="networkidle")
    page.wait_for_selector("#loading", state="hidden")

    new_scene(page)
    page.locator('[data-add="text"]').click()
    for content in ["", "   ", "\n"]:
        edit(page, "#textContent", content)
        edit(page, "#timelineTime", 1)
        page.locator("#playBtn").click()
        page.wait_for_timeout(120)
        page.locator("#stopAnimationBtn").click()
    assert not errors, errors
    print("Empty and whitespace text can scrub, play, and reset", flush=True)

    new_scene(page)
    page.locator('[data-add="sphere"]').click()
    edit(page, "#py", 4)
    page.locator("#physicsType").select_option("rigid")
    edit(page, "#timelineTime", 0.5)
    assert 2 < float(page.locator("#py").input_value()) < 4
    page.locator("#groundBtn").click()
    assert abs(float(page.locator("#py").input_value()) - 0.65) < 0.001
    page.locator("#undoBtn").click()
    assert float(page.locator("#py").input_value()) == 4
    print("Ground placement uses the visible simulated pose, and Undo restores the original", flush=True)

    new_scene(page)
    page.locator('[data-add="text"]').click()
    original = save(page)["objects"][0]
    edit(page, "#textContent", "Upload race")
    page.evaluate("""() => {
        const original = File.prototype.text;
        window.originalFileText = original;
        File.prototype.text = async function () {
            const result = await original.call(this);
            await new Promise(resolve => { window.releaseFontRead = resolve; });
            return result;
        };
    }""")
    page.locator("#fontFile").set_input_files(str(FONT))
    page.wait_for_function('typeof window.releaseFontRead === "function"')
    page.locator("#undoBtn").click()
    page.evaluate("window.releaseFontRead()")
    page.wait_for_timeout(150)
    after = save(page)["objects"][0]
    assert after == original, "A font upload started before Undo must not modify the restored record"
    assert page.locator("#textContent").input_value() == original["text"]["content"]
    assert page.locator("#fontSelect").input_value() == "default"
    page.evaluate("File.prototype.text = window.originalFileText; delete window.releaseFontRead")
    print("Delayed font upload cannot overwrite an undone text edit", flush=True)

    edit(page, "#textContent", "Rider")
    page.locator("#physicsType").select_option("soft")
    page.locator("#shaderSelect").select_option("toon")
    page.locator("#keyframeBtn").click()
    edit(page, "#timelineTime", 2)
    edit(page, "#px", 3)
    page.locator("#keyframeBtn").click()
    before_conversion = save(page)["objects"][0]
    for button, kind in [("#convertTextMeshBtn", "custom"), ("#convertTextMetaBtn", "meta")]:
        page.locator(button).click()
        converted = save(page)["objects"][0]
        assert converted["type"] == kind
        if kind == "custom":
            assert len(converted["geometry"]["data"]["attributes"]["position"]["array"]) > 100
        else:
            assert len(converted["metaSources"]) > 8
        for key in ["id", "keyframes", "position", "rotation", "scale", "physics", "material"]:
            assert converted[key] == before_conversion[key], f"Text conversion must preserve {key}"
        edit(page, "#timelineTime", 1)
        assert abs(float(page.locator("#px").input_value()) - 1.5) < 0.001
        page.locator("#undoBtn").click()
        assert save(page)["objects"][0] == before_conversion
        assert page.locator("#textPanel").is_visible()
    page.locator("#duplicateBtn").click()
    duplicate = save(page)["objects"][1]
    assert duplicate["id"] != before_conversion["id"]
    for source, copied in zip(before_conversion["keyframes"], duplicate["keyframes"]):
        assert copied["time"] == source["time"]
        for axis, offset in enumerate([0.6, 0, 0.6]):
            assert abs(copied["position"][axis] - source["position"][axis] - offset) < 0.000001
    edit(page, "#timelineTime", 1)
    assert abs(float(page.locator("#px").input_value()) - 2.1) < 0.001
    assert abs(float(page.locator("#pz").input_value()) - 0.6) < 0.001
    assert not errors, errors
    print("Text conversions preserve scene state; duplicated animation follows the shifted path", flush=True)
    browser.close()
