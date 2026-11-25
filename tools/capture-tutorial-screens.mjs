import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://iliam4388.github.io';
const manifest = JSON.parse(await fs.readFile(path.join(root,'tools/tutorial-screens.json')));
const output = process.env.CAPTURE_OUTPUT || path.join(root,'images/tutorials');
await fs.mkdir(output,{recursive:true});
const three = path.dirname(fileURLToPath(import.meta.resolve('three'))).replace(/\/build$/,'');
const fixture = await fs.readFile(new URL('./tutorial-fixtures/firebase.mjs',import.meta.url),'utf8');
const types = {'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.mp4':'video/mp4','.jpg':'image/jpeg','.gif':'image/gif'};
async function respond(route) {
  const url = new URL(route.request().url());
  const reply = body => route.fulfill({body,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
  if(url.hostname==='www.gstatic.com' && /\/firebase-(app|auth|firestore)\.js$/.test(url.pathname))
    return reply('export * from "'+origin+'/tutorial-fixture.mjs"');
  if(url.origin===origin && url.pathname==='/tutorial-fixture.mjs')return reply(fixture);
  let base, relative;
  if(url.origin===origin){base=root;relative=url.pathname.slice(1)||'index.html';}
  else if(url.origin==='https://cdn.jsdelivr.net' && url.pathname.startsWith('/npm/three@0.180.0/')){
    base=three; relative=url.pathname.slice('/npm/three@0.180.0/'.length);
  }else return route.abort();
  const file=path.resolve(base,decodeURIComponent(relative));
  if(!file.startsWith(path.resolve(base)+path.sep))return route.abort();
  try{
    await route.fulfill({body:await fs.readFile(file),contentType:types[path.extname(file)]||'application/octet-stream',headers:{'Access-Control-Allow-Origin':'*'}});
  }catch{await route.fulfill({status:404,body:''});}
}
const browser=await chromium.launch({
  executablePath:process.env.CAPTURE_CHROMIUM || undefined,
  headless:!process.env.CAPTURE_HEADED,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']
});
async function draw(page,tool){
  await page.locator('[data-tool="'+tool+'"]').click();
  await page.locator('#board').scrollIntoViewIfNeeded();
  const b=await page.locator('#board').boundingBox();
  const x=b.x+b.width*.32,y=b.y+b.height*.55;
  if(!await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.id==='board',[x,y]))throw Error('Drawing surface covered: '+await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.outerHTML.slice(0,160),[x,y]));
  await page.mouse.move(x,y); await page.mouse.down();
  for(const [dx,dy] of [[45,-55],[80,-15],[115,-70],[160,-8]])await page.mouse.move(x+dx,y+dy,{steps:4});
  await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('#undo').disabled);
}
async function act(page,a){
  if(typeof a==='string')return page.locator(a).click();
  if(a.page)return page.goto(origin+'/'+a.page);
  if(a.fill)return page.locator(a.fill).fill(a.value);
  if(a.select)return page.locator(a.select).selectOption(a.value);
  if(a.press)return page.locator(a.press[0]).press(a.press[1]);
  if(a.waitHidden)return page.locator(a.waitHidden).waitFor({state:'hidden'});
  if(a.draw)return draw(page,a.draw);
  if(a.note){
    await page.locator('[data-tool=sticky]').click();
    page.once('dialog',d=>d.accept('Mountain sketch'));
    return page.locator('#board').click({position:{x:240,y:125}});
  }
  if(a.linkPrompt){
    page.once('dialog',async d=>{
      page.once('dialog',next=>next.accept('Open Whiteboard'));
      await d.accept(origin+'/whiteboard.html');
    });
    return page.locator('#linkButton').click();
  }
  if(a.secondKey2d){
    await page.locator('#x').fill('2');
    await page.locator('#x').press('Enter');
    return page.locator('#timelineKeyBtn').click();
  }
  if(a.chooser||a.share) return nativeShare(page,a);
  throw Error('Unknown preparation: '+JSON.stringify(a));
}
async function nativeShare(page,action) {
  const {prepareShare}=await import('./tutorial-fixtures/share-chooser.mjs');
  return prepareShare(page,action);
}
async function capture(page,step,filename){
  if(step.target==='@chooser'){
    const {captureChooser}=await import('./tutorial-fixtures/share-chooser.mjs');
    return captureChooser(filename);
  }
  const target=page.locator(step.target);
  await target.waitFor({state:'visible'});
  if(await target.count()!==1)throw Error('Ambiguous screenshot target: '+step.target);
  if(!await target.isEnabled())throw Error('Control disabled: '+step.target);
  await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  await page.evaluate(()=>document.fonts.ready);
  const clip=await target.evaluate(el=>{
    const r=el.getBoundingClientRect(),clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
    const hit=document.elementFromPoint(clamp(r.x+r.width/2,0,innerWidth-1),clamp(r.y+r.height/2,0,innerHeight-1));
    if(!el.contains(hit)&&!hit?.contains(el))throw Error('Covered by '+hit?.outerHTML.slice(0,130));
    const left=Math.max(3,r.left-4),top=Math.max(3,r.top-4),right=Math.min(innerWidth-3,r.right+4),bottom=Math.min(innerHeight-3,r.bottom+4);
    const outline=document.createElement('div');outline.id='tutorial-target-outline';
    Object.assign(outline.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483647',boxSizing:'border-box',border:'3px solid #ffe24a',boxShadow:'0 0 0 1px #362c00',borderRadius:'5px',left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});
    document.body.append(outline);
    const width=Math.min(innerWidth,Math.max(612,Math.ceil(right-left+70))),height=Math.min(innerHeight,Math.max(380,Math.ceil(bottom-top+68)));
    return {x:clamp(Math.round((left+right-width)/2),0,innerWidth-width),y:clamp(Math.round((top+bottom-height)/2),0,innerHeight-height),width,height};
  });
  try{await page.screenshot({path:filename,clip,animations:'disabled',caret:'hide'});}
  finally{await page.locator('#tutorial-target-outline').evaluate(el=>el.remove());}
}
const selected=process.env.CAPTURE_LESSONS?.split(',').map(Number);
const queue=manifest.filter(l=>!selected||selected.includes(l.id));
const failures=[];
async function worker(){
  while(queue.length){
    const lesson=queue.shift();
    const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce',locale:'en-US',timezoneId:'UTC',permissions:lesson.id===4?undefined:['camera','microphone']});
    let number=0;
    try{
      await context.route('**/*',respond);
      await context.addInitScript(id=>{window.captureLesson=id;
        if(id===4 && 'Notification' in window)Object.defineProperty(Notification,'permission',{get:()=>'default'});
        if(id>=21&&id<=24 && navigator.mediaDevices){
          // Demonstration media comes from the site's video catalog, never a physical device.
          navigator.mediaDevices.getUserMedia=async()=>{
            const player=document.createElement('video');
            player.src='/videos/golden-sphere.mp4';player.muted=true;player.loop=true;
            await player.play();
            const stream=player.captureStream();
            const audio=new AudioContext();
            stream.addTrack(audio.createMediaStreamDestination().stream.getAudioTracks()[0]);
            return stream;
          };
        }
        if(id!==4)sessionStorage.setItem('iliam-permission-later-demo','1');},lesson.id);
      const page=await context.newPage();
      page.setDefaultTimeout(6500);
      page.on('pageerror',error=>console.warn('Page error',lesson.id,error.message));
      await page.goto(origin+'/'+lesson.page);
      if(lesson.page==='3d-rider.html')await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
      for(const step of lesson.steps){
        number++;
        for(const action of step.before||[])await act(page,action);
        const name='lesson-'+lesson.id+'-step-'+number+'.png';
        await capture(page,step,path.join(output,name));
        console.log(name);
      }
    }catch(error){console.error('Diagnostic',lesson.id,await context.pages()[0]?.locator('#gc-picker-status,#gc-invite-status,#gc-active-status,#room-status,#item-count,#iliam-permission-status').allTextContents());failures.push({lesson:lesson.id,step:number,message:error.message});console.error('FAILED',lesson.id,number,error.message);}
    finally{await context.close();}
  }
}
try{await Promise.all(Array.from({length:Number(process.env.CAPTURE_WORKERS||2)},worker));}
finally{await browser.close();}
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exitCode=1;}
