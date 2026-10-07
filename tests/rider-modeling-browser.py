"""Real renderer checks for glyph holes, font imports, fields and material reuse.
Serve the repo at localhost:8000, then python tests/rider-modeling-browser.py.
Optional: RIDER_TTF_FONT / RIDER_OTF_FONT point to local test fonts.
"""
import base64, json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('RIDER_TEST_URL', 'http://127.0.0.1:8000')
ROOT = Path(__file__).resolve().parents[1]
fonts = [{'name': 'Studio.json', 'bytes': base64.b64encode(
    (ROOT / 'assets/fonts/helvetiker_regular.typeface.json').read_bytes()).decode()}]
for extension, default in [('ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'), ('otf', '')]:
    path = Path(os.environ.get('RIDER_' + extension.upper() + '_FONT', default))
    if path.is_file():
        fonts.append({'name': path.name, 'bytes': base64.b64encode(path.read_bytes()).decode()})

with sync_playwright() as p:
    launch = {'headless': True, 'args': ['--no-sandbox', '--enable-unsafe-swiftshader',
              '--use-gl=angle', '--use-angle=swiftshader']}
    executable = os.environ.get('RIDER_BROWSER_PATH') or shutil.which('chromium')
    if executable:
        launch['executable_path'] = executable
    if os.environ.get('HTTPS_PROXY'):
        launch['proxy'] = {'server': os.environ['HTTPS_PROXY'], 'bypass': 'localhost,127.0.0.1'}
    browser = p.chromium.launch(**launch)
    page = browser.new_page(viewport={'width': 1440, 'height': 960})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/3d-rider.html', wait_until='networkidle')
    page.wait_for_selector('#loading', state='hidden')
    result = page.evaluate('''async (fixtures) => {
      const THREE = await import('three');
      const {MarchingCubes} = await import('three/addons/objects/MarchingCubes.js');
      const M = await import('./rider-modeling.js');
      const {normalizeProject} = await import('./rider-core.js');
      const check = (condition, message) => {if (!condition) throw new Error(message);};
      const defaults = {color:'#c378dd',metalness:.12,roughness:.38,opacity:1,emissive:'#000000',emissiveIntensity:0};
      const record = (variant='ball') => ({type:'meta', parameters:{radius:.65,influence:1.25,variant},
        position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],material:{...defaults},visible:true});
      const surface = new MarchingCubes(28, new THREE.MeshPhysicalMaterial(), true, true, 100000);
      surface.isolation = 70;
      const signatures = [];
      for (const variant of M.METABALL_VARIANTS) {
        M.updateMetaballSurface(surface, [record(variant)]);
        check(surface.count > 0, variant + ' has no geometry');
        check(surface.field.every(Number.isFinite), variant + ' has invalid field values');
        signatures.push(surface.count + ':' + surface.scale.toArray().map(v=>v.toFixed(6)).join(',') + ':' + surface.positionArray.slice(0,surface.count*3).reduce((a,b,i)=>a+b*(i%17+1),0).toFixed(6));
      }
      check(new Set(signatures).size === 7, 'Variants must differ in geometry');
      const ellipse = record('ellipsoid');
      M.updateMetaballSurface(surface,[ellipse]);
      const initial = surface.scale.clone();
      ellipse.rotation[2] = Math.PI/2;
      M.updateMetaballSurface(surface,[ellipse]);
      check(Math.abs(surface.scale.x-initial.y)<1e-6 && Math.abs(surface.scale.y-initial.x)<1e-6, 'Ellipsoid rotation lost');
      ellipse.scale = [2,.5,1];
      M.updateMetaballSurface(surface,[ellipse]);
      check(surface.scale.y > surface.scale.x, 'Rotated nonuniform scale lost');
      for (const shader of M.SHADER_VARIANTS) {
        const mesh = new THREE.Mesh();
        const object = {type:'box',material:{...defaults,shader}};
        M.applyRiderMaterial(mesh,object);
        const before = mesh.material;
        object.material.color = '#ffffff';
        M.applyRiderMaterial(mesh,object);
        check(mesh.material === before, shader+' recreates material during animation');
        if(before.color) check(before.color.getHexString()==='ffffff',shader+' fails to update color');
        if(shader==='toon')check(before.isMeshToonMaterial,'Toon material missing');
        if(shader==='normal')check(before.isMeshNormalMaterial,'Normal material missing');
        if(shader==='glass')check(before.transmission>.8,'Glass transmission missing');
        before.dispose();
      }
      await M.loadDefaultFont();
      const hole = M.createTextGeometry({text:{content:'O',size:1,depth:.15}}, {mode:'2d'});
      const hollowSources = M.geometryToMetaballSources(hole,{maxSources:128});
      check(hollowSources.length>20 && hollowSources.length<=128,'Bounded glyph sampling failed');
      check(hollowSources.every(s=>Math.hypot(...s.position.slice(0,2))>.15),'Glyph hole was filled in');
      const fontResults=[];
      for(const fixture of fixtures){
        const bytes = Uint8Array.from(atob(fixture.bytes),c=>c.charCodeAt(0));
        const font = await M.readFontFile(new File([bytes],fixture.name));
        const object={type:'text',text:{content:'Rider',size:1,depth:.15,...font}};
        normalizeProject({version:2,objects:[object]});
        const geometry = M.createTextGeometry(object);
        check(geometry.getAttribute('position').count>100,fixture.name+' has no real geometry');
        check(geometry.getAttribute('position').array.every(Number.isFinite),'Font created invalid geometry');
        const sources=M.geometryToMetaballSources(geometry,{maxSources:128});
        M.updateMetaballSurface(surface,[{...record(),metaSources:sources}]);
        check(surface.count>0, fixture.name+' failed field conversion');
        fontResults.push({font:fixture.name,vertices:geometry.getAttribute('position').count,sources:sources.length});
        geometry.dispose();
      }
      let rejected=false;
      try{await M.readFontFile(new File(['{}'],'bad.json'));}catch{rejected=true;}
      check(rejected,'Invalid fonts must be rejected');
      M.updateMetaballSurface(surface,[]);
      check(!surface.visible && surface.count===0 && surface.geometry.drawRange.count===0,'Empty fields remain visible');
      hole.dispose();surface.geometry.dispose();surface.material.dispose();
      return {result:'passed',fontResults,glyphHoleSources:hollowSources.length,variants:signatures.length};
    }''', fonts)
    assert not errors, errors
    print(json.dumps(result), flush=True)
    browser.close()
