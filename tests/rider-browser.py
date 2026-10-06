"""End-to-end editor regression checks. Requires Python Playwright and Chromium.
Run: python tests/rider-browser.py (serve the repo at http://127.0.0.1:8000 first).
"""
import json, os, shutil, struct, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE = os.environ.get('RIDER_TEST_URL', 'http://127.0.0.1:8000')
ARTIFACTS = Path(tempfile.mkdtemp(prefix='rider-check-'))

def count(page):
    return int(page.locator('#objectCount').inner_text())

def save(page):
    with page.expect_download() as download:
        page.locator('#saveBtn').click()
    return json.loads(Path(download.value.path()).read_text())

def open_project(page, project):
    page.locator('#openFile').set_input_files({'name':'test.3drider','mimeType':'application/json','buffer':json.dumps(project).encode()})
    page.wait_for_timeout(350)

def new_scene(page):
    page.locator('#newBtn').click()
    page.locator('#confirmNewBtn').click()

with sync_playwright() as p:
    launch = {'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
    browser_path = os.environ.get('RIDER_BROWSER_PATH') or shutil.which('chromium')
    if browser_path: launch['executable_path']=browser_path
    proxy = os.environ.get('HTTPS_PROXY')
    if proxy: launch['proxy']={'server':proxy,'bypass':'localhost,127.0.0.1'}
    browser=p.chromium.launch(**launch)
    context=browser.new_context(viewport={'width':1440,'height':960},device_scale_factor=1,accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda dialog:dialog.accept())
    page.goto(BASE+'/3d-rider.html',wait_until='networkidle',timeout=60000)
    page.wait_for_selector('#loading',state='hidden')
    assert count(page)==14
    assert not errors, errors
    page.screenshot(path=str(ARTIFACTS/'desktop.png'))
    print("Initial scene ready",flush=True)
    new_scene(page)
    assert count(page)==0
    page.locator('#undoBtn').click(); assert count(page)==14
    page.locator('#redoBtn').click(); assert count(page)==0
    for kind in ['box','sphere','cylinder','cone','torus','plane']:
        page.locator('[data-add="'+kind+'"]').click()
    assert count(page)==6
    page.locator('#sceneTab').click()
    page.locator('.object-select').filter(has_text='Sphere').click()
    previous=page.locator('#sceneStats').inner_text()
    page.locator('[data-parameter="widthSegments"]').fill('12')
    page.locator('[data-parameter="widthSegments"]').press('Tab')
    assert page.locator('#sceneStats').inner_text()!=previous, 'Segments must affect actual geometry'
    page.locator('.object-select').filter(has_text='Box').click()
    page.locator('#px').fill('2.5'); page.locator('#px').press('Tab')
    page.locator('#ry').fill('45'); page.locator('#ry').press('Tab')
    page.locator('#sx').fill('-1.25'); page.locator('#sx').press('Tab')
    page.locator('[data-parameter="width"]').fill('2.25'); page.locator('[data-parameter="width"]').press('Tab')
    page.locator('[data-material="metal"]').click()
    page.locator('#duplicateBtn').click(); assert count(page)==7
    page.locator('#undoBtn').click(); assert count(page)==6
    page.locator('#redoBtn').click(); assert count(page)==7
    page.locator('#deleteBtn').click(); assert count(page)==6
    print("Model edits, segments, undo/redo checked",flush=True)
    saved=save(page)
    box=next(o for o in saved['objects'] if o['type']=='box')
    assert box['position'][0]==2.5 and abs(box['rotation'][1]-.7853981634)<1e-6
    assert box['scale'][0]==-1.25 and box['parameters']['width']==2.25
    assert box['material']['metalness']==.95
    new_scene(page); open_project(page,saved)
    assert count(page)==6
    assert save(page)['objects']==saved['objects'], 'Save/reopen must preserve all model state'
    page.locator('#buildTab').click()
    page.locator('[data-add="light"]').click()
    page.locator('#lightIntensity').fill('42');page.locator('#lightIntensity').dispatch_event('input');page.locator('#lightIntensity').dispatch_event('change')
    with_light=save(page)
    light=next(o for o in with_light['objects'] if o['type']=='light')
    assert light['light']['intensity']==42
    light['light']['decay']=1.5
    open_project(page,with_light)
    page.locator('#sceneTab').click();page.locator('.object-select').filter(has_text='Point light').click()
    page.locator('#lightRange').fill('25');page.locator('#lightRange').press('Tab')
    assert next(o for o in save(page)['objects'] if o['type']=='light')['light']['decay']==1.5
    print("Project persistence and lighting checked",flush=True)
    triangle=b'solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test'
    page.locator('#stlFile').set_input_files({'name':'triangle.stl','mimeType':'application/octet-stream','buffer':triangle})
    page.wait_for_timeout(500)
    imported=save(page)
    mesh=next(o for o in imported['objects'] if o['type']=='custom')
    assert len(mesh['geometry']['data']['attributes']['position']['array'])==9
    new_scene(page);open_project(page,imported)
    assert next(o for o in save(page)['objects'] if o['type']=='custom')['geometry']==mesh['geometry']
    print("STL geometry round-trip checked",flush=True)
    before=count(page)
    open_project(page,{'version':2,'objects':[{'type':'custom'}]})
    assert count(page)==before and 'Could not open project' in page.locator('#toast').inner_text()
    new_scene(page)
    page.locator('#buildTab').click()
    page.locator('[data-add="meta"]').click();page.locator('[data-add="meta"]').click()
    meta_project=save(page)
    assert len(meta_project['objects'])==2
    page.locator('.export-menu summary').click()
    with page.expect_download() as download:page.locator('#exportStlBtn').click()
    data=Path(download.value.path()).read_bytes()
    triangle_count=struct.unpack_from('<I',data,80)[0]
    assert triangle_count>0 and len(data)==84+triangle_count*50,'Metaball STL must contain only generated triangles'
    page.locator('.export-menu summary').click()
    with page.expect_download() as download:page.locator('#exportObjBtn').click()
    assert '\nv ' in Path(download.value.path()).read_text()
    page.locator('.export-menu summary').click()
    with page.expect_download() as download:page.locator('#renderBtn').click()
    png=Path(download.value.path()).read_bytes()
    assert png[:8]==b'\x89PNG\r\n\x1a\n' and len(png)>1000
    page.locator('[data-mode="wire"]').click();page.locator('[data-mode="rendered"]').click();page.locator('[data-mode="material"]').click()
    print("Metaball STL/OBJ and PNG exports checked",flush=True)
    page.wait_for_timeout(600);page.reload(wait_until='networkidle');page.wait_for_selector('#loading',state='hidden')
    assert count(page)==2,'Browser autosave must restore session'
    new_scene(page);page.locator('#buildTab').click()
    for name,total in [('robot',14),('rocket',24),('desk',38)]:
        page.locator('[data-template="'+name+'"]').click();assert count(page)==total
    page.wait_for_timeout(500)
    print("Autosave and templates checked",flush=True)
    for width in [1024,768,390,320]:
        page.set_viewport_size({'width':width,'height':844})
        page.wait_for_timeout(200)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Overflow at {width}'
        if width<=680:
            page.locator('#libraryToggle').click()
            assert page.locator('#libraryToggle').get_attribute('aria-expanded')=='true'
            assert page.locator('#libraryPanel').is_visible()
            page.locator('#libraryHelpBtn').click();assert page.locator('#helpDialog').is_visible()
            page.locator('#helpDialog [data-dialog-close]').first.click()
            page.locator('#libraryPanel [data-panel-close]').click()
            page.locator('#inspectorToggle').click();assert page.locator('#inspectorPanel').is_visible()
            page.screenshot(path=str(ARTIFACTS/f'mobile-{width}.png'))
            page.locator('#inspectorPanel [data-panel-close]').click()
    assert not errors, errors
    page.goto(BASE+'/other.html',wait_until='networkidle')
    assert page.locator('a[href="3d-rider.html"]').count()>=1
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    print(json.dumps({'result':'passed','checks':'model edits, undo/redo, version2 save/reopen, light decay, STL import persistence, invalid import retention, metaball STL/OBJ, PNG, autosave, starters, responsive panels','artifacts':str(ARTIFACTS),'browser_errors':errors}))
    browser.close()
