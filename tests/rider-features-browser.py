"""Exercise visible animation/physics/modeling workflows, using real browser rendering.
Serve the repository at localhost:8000, then python tests/rider-features-browser.py.
"""
import json, math, os, shutil, struct, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('RIDER_TEST_URL', 'http://127.0.0.1:8000')
ARTIFACTS = Path(tempfile.mkdtemp(prefix='rider-features-'))

def edit(page, selector, value):
    page.locator(selector).fill(str(value))
    page.locator(selector).dispatch_event('change')

def save(page):
    with page.expect_download() as event:
        page.locator('#saveBtn').click()
    return json.loads(Path(event.value.path()).read_text())

def new_scene(page):
    page.locator('#newBtn').click()
    page.locator('#confirmNewBtn').click()
    page.locator('#buildTab').click()

def stl(page):
    page.locator('.export-menu summary').click()
    with page.expect_download() as event:
        page.locator('#exportStlBtn').click()
    data = Path(event.value.path()).read_bytes()
    triangles = struct.unpack_from('<I', data, 80)[0]
    assert triangles > 0 and len(data) == 84 + triangles * 50
    return data

with sync_playwright() as p:
    launch = {'headless': True, 'executable_path': os.environ.get('RIDER_BROWSER_PATH') or shutil.which('chromium'),
              'args': ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']}
    if os.environ.get('HTTPS_PROXY'):
        launch['proxy'] = {'server': os.environ['HTTPS_PROXY'], 'bypass': 'localhost,127.0.0.1'}
    browser = p.chromium.launch(**launch)
    page = browser.new_page(viewport={'width': 1440, 'height': 960}, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE + '/3d-rider.html', wait_until='networkidle')
    page.wait_for_selector('#loading', state='hidden')
    new_scene(page)
    page.locator('[data-add="box"]').click()
    edit(page, '#px', 0); edit(page, '#py', 4)
    page.locator('#keyframeBtn').click()
    edit(page, '#timelineTime', 2)
    edit(page, '#px', 4); edit(page, '#rz', 180); edit(page, '#sx', 3)
    page.locator('#keyframeBtn').click()
    edit(page, '#timelineTime', 1)
    assert abs(float(page.locator('#px').input_value()) - 2) < .001
    assert abs(float(page.locator('#rz').input_value()) - 90) < .001
    assert abs(float(page.locator('#sx').input_value()) - 2) < .001
    animated = save(page)
    assert len(animated['objects'][0]['keyframes']) == 2
    page.locator('#playBtn').click()
    page.wait_for_timeout(200)
    page.locator('#playBtn').click()
    assert float(page.locator('#timelineTime').input_value()) > 1
    page.locator('#stopAnimationBtn').click()
    assert float(page.locator('#timelineTime').input_value()) == 0
    assert float(page.locator('#px').input_value()) == 0
    print('3D keyframe interpolation, playback and reset checked', flush=True)

    new_scene(page)
    page.locator('[data-add="sphere"]').click()
    edit(page, '#py', 4)
    page.locator('#physicsType').select_option('rigid')
    edit(page, '#timelineTime', .5)
    falling = float(page.locator('#py').input_value())
    assert 2 < falling < 4, falling
    edit(page, '#timelineTime', 3)
    assert float(page.locator('#py').input_value()) >= .64
    page.locator('#stopAnimationBtn').click()
    assert float(page.locator('#py').input_value()) == 4
    page.locator('#physicsType').select_option('soft')
    edit(page, '#timelineTime', .84)
    assert abs(float(page.locator('#sy').input_value()) - 1) > .02
    assert save(page)['objects'][0]['position'][1] == 4, 'Simulation must not bake over the editable starting scene'
    print('3D rigid drop/collision, soft deformation and nondestructive reset checked', flush=True)

    geometries = []
    for variant in ['ball', 'ellipsoid', 'capsule', 'chain', 'cluster', 'ring', 'sheet']:
        new_scene(page)
        page.locator('#metaballVariant').select_option(variant)
        page.locator('[data-add="meta"]').click()
        geometries.append(stl(page))
    assert len(set(geometries)) == 7, 'Metaball variants must change the actual exported surface'
    print('All seven 3D metaball variants have distinct real geometry', flush=True)

    new_scene(page)
    page.locator('[data-add="text"]').click()
    edit(page, '#textContent', 'Rider')
    edit(page, '#textSize', 1.2)
    for shader in ['toon', 'normal', 'glass', 'standard']:
        page.locator('#shaderSelect').select_option(shader)
    font = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    if font.exists():
        page.locator('#fontFile').set_input_files(str(font))
        page.wait_for_function('document.querySelector("#fontSelect").options.length > 1')
        uploaded = save(page)
        assert uploaded['objects'][0]['text']['fontData']['glyphs']['R']['o']
    else:
        page.locator('#fontFile').set_input_files(str(Path('assets/fonts/helvetiker_regular.typeface.json').resolve()))
        page.wait_for_function('document.querySelector("#fontSelect").options.length > 1')
    text_scene = save(page)
    page.locator('#convertTextMeshBtn').click()
    mesh_scene = save(page)
    assert mesh_scene['objects'][0]['type'] == 'custom'
    assert len(mesh_scene['objects'][0]['geometry']['data']['attributes']['position']['array']) > 100
    stl(page)
    page.locator('#undoBtn').click()
    assert page.locator('#textPanel').is_visible()
    page.locator('#convertTextMetaBtn').click()
    meta_scene = save(page)
    assert meta_scene['objects'][0]['type'] == 'meta'
    assert len(meta_scene['objects'][0]['metaSources']) > 8
    stl(page)
    print('Text, uploaded fonts, shaders and glyph mesh/metaball conversion checked', flush=True)
    page.locator('#openFile').set_input_files({'name': 'roundtrip.3drider', 'mimeType': 'application/json', 'buffer': json.dumps(text_scene).encode()})
    page.wait_for_timeout(400)
    assert save(page)['objects'] == text_scene['objects']
    assert not errors, errors
    page.screenshot(path=str(ARTIFACTS / 'features-desktop.png'))
    print(json.dumps({'result': 'passed', 'artifacts': str(ARTIFACTS), 'browser_errors': errors}))
    browser.close()
