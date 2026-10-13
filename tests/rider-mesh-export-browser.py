"""Real mesh editing, persistence, GIF decoding, H.264 MP4 decoding and cancellation.
Serve the repository, then python tests/rider-mesh-export-browser.py.
Requires Playwright, Chromium, Pillow and ffprobe/ffmpeg.
"""
import io, json, math, os, shutil, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

BASE = os.environ.get('RIDER_TEST_URL', 'http://127.0.0.1:8000')
ARTIFACTS = Path(tempfile.mkdtemp(prefix='rider-mesh-export-'))

def edit(page, selector, value):
    page.locator(selector).fill(str(value))
    page.locator(selector).dispatch_event('change')

def save(page):
    with page.expect_download() as event: page.locator('#saveBtn').click()
    return json.loads(Path(event.value.path()).read_text())

def mode(page, name):
    page.locator('[data-component-mode="' + name + '"]').click()

def new_box(page):
    page.locator('#newBtn').click(); page.locator('#confirmNewBtn').click()
    page.locator('#buildTab').click(); page.locator('[data-add="box"]').click()
    page.locator('[data-camera="front"]').click()
    page.wait_for_timeout(400)

def canvas_click(page, dx=0, dy=0, shift=False):
    rect = page.locator('#view canvas').bounding_box()
    if shift: page.keyboard.down('Shift')
    page.mouse.click(rect['x'] + rect['width']/2 + dx, rect['y'] + rect['height']/2 + dy)
    if shift: page.keyboard.up('Shift')

def exported(page, kind, name):
    page.locator('.export-menu summary').click(); page.locator('#export' + kind + 'Btn').click()
    page.locator('#animationExportWidth').select_option('320')
    page.locator('#animationExportFps').select_option('15')
    with page.expect_download(timeout=180000) as event: page.locator('#startAnimationExportBtn').click()
    output = ARTIFACTS / name; event.value.save_as(str(output))
    page.locator('#cancelAnimationExportBtn').click()
    return output

with sync_playwright() as p:
    launch = {'headless': True, 'executable_path': os.environ.get('RIDER_BROWSER_PATH') or shutil.which('chromium'),
              'args': ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']}
    if os.environ.get('HTTPS_PROXY'):
        launch['proxy'] = {'server': os.environ['HTTPS_PROXY'], 'bypass': 'localhost,127.0.0.1'}
    browser = p.chromium.launch(**launch)
    page = browser.new_page(viewport={'width': 1440, 'height': 960}, accept_downloads=True)
    errors = []; page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE + '/3d-rider.html', wait_until='networkidle')
    page.wait_for_selector('#loading', state='hidden')
    page.evaluate('''async () => {
      const THREE = await import('three'), M = await import('./rider-mesh.js');
      const check = (v,m) => {if(!v) throw new Error(m)};
      const g = new THREE.BoxGeometry(1,1,1), t = M.meshTopology(g);
      check(t.vertices.length===8 && t.edges.length===12 && t.faces.length===6, 'Cube must have 8 vertices, 12 edges and 6 polygon faces');
      const face = t.faces.findIndex(f=>f.normal.z>.99);
      const e = M.extrudeMeshFaces(g,t,new Set([face]),.25);
      check(e.geometry.getAttribute('position').count===60, 'Extrusion must retain caps and add four sides');
      check(Math.abs(e.geometry.boundingBox.max.z-.75)<1e-6, 'Extrusion must move selected cap');
      const s=M.subdivideMeshFaces(g,t,new Set([face]));
      check(s.geometry.getAttribute('position').count===54,'Subdivision must split selected triangles only');
      check(M.meshTopology(s.geometry).faces.length===13,'Subdivided faces must remain individually selectable');
      const splitRestored = new THREE.BufferGeometryLoader().parse(M.bufferGeometryJSON(s.geometry));
      check(M.meshTopology(splitRestored).faces.length===13,'Subdivision edges must survive saves');
      const d=M.deleteMeshComponents(g,t,'face',new Set([face]));
      check(d.geometry.getAttribute('position').count===30,'Face deletion must remove both polygon triangles');
      const json=M.bufferGeometryJSON(g);
      check(json.type==='BufferGeometry' && json.data.attributes.position.array.length===72,'Primitive edits must serialize actual vertex data');
      const restored=new THREE.BufferGeometryLoader().parse(json);
      check(M.meshTopology(restored).faces.length===6,'Geometry must round-trip');
      const settings=(await import('./rider-animation-export.js')).animationExportSettings;
      check(settings({start:0,end:.4,fps:15,width:320,aspect:1.5}).frames===6,'Frame count wrong');
      let invalid=false;try{settings({start:1,end:0,fps:15,width:320,aspect:1})}catch{invalid=true}check(invalid,'Invalid export range accepted');
      [g,e.geometry,s.geometry,d.geometry,restored,splitRestored].forEach(g=>g.dispose());
    }''')
    print('Topology, polygon faces and mesh operations checked', flush=True)

    new_box(page)
    original = save(page)
    mode(page, 'vertex'); page.locator('#selectAllComponentsBtn').click()
    page.wait_for_timeout(150)
    # Find the rendered X handle and drag it with actual pointer events.
    rect = page.locator('#view canvas').bounding_box()
    with Image.open(io.BytesIO(page.locator('#view canvas').screenshot())) as image:
        image = image.convert('RGB'); cx, cy = image.width//2, image.height//2
        red = [(x,y) for x in range(cx+20,min(cx+120,image.width)) for y in range(cy-12,cy+12)
               if image.getpixel((x,y))[0]>180 and image.getpixel((x,y))[1]<100 and image.getpixel((x,y))[2]<100]
    assert red, 'Translate X handle was not rendered'
    tip = max(x for x,y in red)-4
    ys = [y for x,y in red if abs(x-tip)<=1]; handle_y = sum(ys)/len(ys)
    page.mouse.move(rect['x']+tip,rect['y']+handle_y); page.mouse.down()
    page.mouse.move(rect['x']+tip+50,rect['y']+handle_y,steps=8); page.mouse.up()
    dragged = save(page)['objects'][0]
    assert dragged['type']=='custom' and dragged['position']==original['objects'][0]['position']
    assert min(dragged['geometry']['data']['attributes']['position']['array'][::3])>-.49, 'Handle drag must move mesh vertices'
    page.locator('#undoBtn').click(); assert save(page)['objects'][0]['type']=='box'
    mode(page, 'vertex'); assert page.locator('#meshCounts').inner_text() == '8 V · 12 E · 6 F'
    # Front camera framing uses a 1.6 margin, fov 42 degrees and a unit cube.
    rect = page.locator('#view canvas').bounding_box()
    distance = .8 / math.tan(math.radians(21)) / min(rect['width']/rect['height'], 1)
    half = .5 / (distance - .5) / math.tan(math.radians(21)) * rect['height']/2
    canvas_click(page, -half, -half)
    assert page.locator('#componentStatus').inner_text() == '1 vertex selected'
    edit(page, '#componentX', -.75)
    changed = save(page)
    assert changed['objects'][0]['type'] == 'custom'
    assert changed['objects'][0]['position'] == original['objects'][0]['position'], 'Component transform changed object position'
    positions = changed['objects'][0]['geometry']['data']['attributes']['position']['array']
    assert sum(abs(x + .75) < 1e-6 for x in positions[::3]) == 3, 'A welded corner must edit its three render vertices together'
    page.locator('#undoBtn').click(); assert save(page)['objects'][0]['type'] == 'box'
    page.locator('#redoBtn').click(); assert save(page)['objects'][0]['geometry'] == changed['objects'][0]['geometry']
    mode(page, 'edge'); canvas_click(page, half, 0)
    assert page.locator('#componentStatus').inner_text() == '1 edge selected'
    page.locator('#selectAllComponentsBtn').click()
    assert int(page.locator('#componentStatus').inner_text().split()[0]) >= 12
    mode(page, 'object'); page.locator('#openFile').set_input_files({'name':'original.3drider','mimeType':'application/json','buffer':json.dumps(original).encode()})
    page.wait_for_timeout(300); mode(page, 'face'); canvas_click(page)
    assert page.locator('#componentStatus').inner_text() == '1 face selected'
    page.screenshot(path=str(ARTIFACTS/'face-selection.png'))
    page.locator('[data-component-scale="1.25"]').click()
    scaled = save(page)['objects'][0]
    assert abs(max(scaled['geometry']['data']['attributes']['position']['array'][::3]) - .625) < 1e-6
    assert scaled['scale'] == original['objects'][0]['scale'], 'Component scaling must not change object scale'
    page.locator('#undoBtn').click(); canvas_click(page)
    page.locator('[data-component-turn=".261799"]').click()
    rotated = save(page)['objects'][0]
    assert rotated['rotation'] == original['objects'][0]['rotation'], 'Component rotation must not change object rotation'
    assert max(rotated['geometry']['data']['attributes']['position']['array'][2::3]) > .6
    page.locator('#undoBtn').click(); canvas_click(page)
    page.locator('#extrudeFacesBtn').click()
    extruded = save(page)
    assert max(extruded['objects'][0]['geometry']['data']['attributes']['position']['array'][2::3]) == .75
    page.locator('#subdivideFacesBtn').click()
    subdivided = save(page); assert len(subdivided['objects'][0]['geometry']['data']['attributes']['position']['array']) > len(extruded['objects'][0]['geometry']['data']['attributes']['position']['array'])
    page.locator('#deleteComponentsBtn').click(); deleted = save(page)
    assert len(deleted['objects'][0]['geometry']['data']['attributes']['position']['array']) < len(subdivided['objects'][0]['geometry']['data']['attributes']['position']['array'])
    page.locator('#undoBtn').click(); assert save(page)['objects'][0]['geometry'] == subdivided['objects'][0]['geometry']
    mode(page, 'object'); page.locator('#openFile').set_input_files({'name':'edited.3drider','mimeType':'application/json','buffer':json.dumps(subdivided).encode()})
    page.wait_for_timeout(300); assert save(page)['objects'] == subdivided['objects']
    page.screenshot(path=str(ARTIFACTS/'modeling.png'))
    print('Canvas selection, welded vertex edits, edge selection, extrusion/subdivision/deletion and undo/save/reopen checked', flush=True)

    new_box(page)
    edit(page, '#timelineDuration', .4)
    edit(page, '#px', -.25); page.locator('#keyframeBtn').click()
    edit(page, '#timelineTime', .4); edit(page, '#px', .25); edit(page, '#rz', 45); page.locator('#keyframeBtn').click()
    edit(page, '#timelineTime', .2)
    before = save(page); preview = page.locator('#px').input_value()
    gif = exported(page, 'Gif', 'animation.gif')
    with Image.open(gif) as image:
        assert image.n_frames == 6
        duration = 0; frames = []
        for index in range(image.n_frames):
            image.seek(index); duration += image.info['duration']; frames.append(image.convert('RGB').copy())
        assert duration == 400, duration
        assert ImageChops.difference(frames[0], frames[-1]).getbbox(), 'GIF frames must contain animation'
    assert page.locator('#timelineTime').input_value() == '0.20' and page.locator('#px').input_value() == preview
    assert save(page)['objects'] == before['objects'], 'Export changed saved animation'
    mp4 = exported(page, 'Mp4', 'animation.mp4')
    info = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_streams','-show_format','-of','json',str(mp4)]))
    stream = info['streams'][0]
    assert stream['codec_name'] == 'h264' and stream['pix_fmt'] == 'yuv420p'
    assert int(stream['nb_frames']) == 6 and stream['width'] == 320
    assert stream['r_frame_rate'] == '15/1'
    assert abs(float(info['format']['duration'])-.4) < .05
    subprocess.run(['ffmpeg','-v','error','-i',str(mp4),'-f','null','-'],check=True)
    decoded = subprocess.check_output(['ffmpeg','-v','error','-i',str(mp4),'-f','rawvideo','-pix_fmt','rgb24','-'])
    frame_bytes = stream['width'] * stream['height'] * 3
    assert decoded[:frame_bytes] != decoded[-frame_bytes:], 'MP4 must contain changing animation frames'
    assert save(page)['objects'] == before['objects'] and page.locator('#timelineTime').input_value() == '0.20'
    print('GIF and MP4 decoded: six changing frames, 0.4-second timing, restored preview/project', flush=True)

    # Exercise portable encoder even in browsers with a native H.264 encoder.
    page.evaluate('Object.defineProperty(window,"VideoEncoder",{value:undefined,configurable:true})')
    fallback = exported(page, 'Mp4', 'portable.mp4')
    info = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(fallback)]))
    assert info['streams'][0]['codec_name'] == 'h264' and int(info['streams'][0]['nb_frames']) == 6
    page.locator('.export-menu summary').click(); page.locator('#exportGifBtn').click()
    page.locator('#startAnimationExportBtn').click(); page.locator('#cancelAnimationExportBtn').click()
    page.wait_for_function('document.querySelector("#animationExportStatus").textContent === "Export cancelled"')
    page.locator('#cancelAnimationExportBtn').click()
    assert save(page)['objects'] == before['objects'] and page.locator('#timelineTime').input_value() == '0.20'
    for width in [162, 390, 768, 1100, 1440]:
        page.set_viewport_size({'width':width,'height':844}); page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
    assert not errors, errors
    print(json.dumps({'result':'passed','checks':'mesh selection/editing/persistence, GIF, native/portable MP4, cancellation, responsive toolbar','artifacts':str(ARTIFACTS)}))
    browser.close()
