import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

let captureDir, shot, panel, row, buttons;
function desktopGeometry(){
  execFileSync('import',['-window','root',shot]);
  const geometry=execFileSync('convert',[shot,'-colorspace','Gray','-threshold','96%',
    '-define','connected-components:verbose=true','-define','connected-components:area-threshold=1000',
    '-connected-components','4','null:'],{encoding:'utf8'});
  const boxes=[...geometry.matchAll(/(\d+)x(\d+)\+(\d+)\+(\d+)[^\n]*?gray\(([^)]+)\)/g)].map(m=>({w:+m[1],h:+m[2],x:+m[3],y:+m[4],light:['255','100%','1'].includes(m[5])}));
  panel=boxes.find(b=>b.light&&b.w>=500&&b.w<=850&&b.h>=400&&b.h<=700);
  if(!panel)return false;
  buttons=boxes.filter(b=>!b.light&&b.y>panel.y+panel.h-85&&b.y<panel.y+panel.h-10&&b.x>panel.x+panel.w/2&&b.x<panel.x+panel.w&&b.w>55&&b.w<130&&b.h>20&&b.h<58).sort((a,b)=>a.x-b.x);
  const enlarged=path.join(captureDir,'ocr.png');
  execFileSync('convert',[shot,'-crop',panel.w+'x'+panel.h+'+'+panel.x+'+'+panel.y,'+repage','-resize','200%','-colorspace','Gray',enlarged]);
  const tsv=execFileSync('tesseract',[enlarged,'stdout','--psm','11','tsv'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
  const words=tsv.trim().split('\n').map(s=>s.split('\t')).filter(c=>c[0]==='5');
  const name=words.find(c=>/whiteboard/i.test(c[11]));
  if(!name||!words.some(c=>c[11]==='Window'))return false;
  row={x:panel.x+Number(name[6])/2,y:panel.y+Number(name[7])/2,w:Number(name[8])/2,h:Number(name[9])/2};
  return true;
}
export async function prepareShare(page,action){
  if(!process.env.DISPLAY)throw Error('The native sharing chooser requires an isolated desktop display.');
  if(action.chooser){
    captureDir=await fs.mkdtemp(path.join(os.tmpdir(),'iliam-chooser-'));
    shot=path.join(captureDir,'screen.png');
    const board=await page.context().newPage();
    await board.goto('https://iliam4388.github.io/whiteboard.html');
    await page.bringToFront();
    await page.locator('#gc-share').click();
    for(let i=0;i<8;i++){
      if(desktopGeometry())return;
      await delay(200);
    }
    throw Error('The native chooser did not show the Whiteboard tab.');
  }
  await clickWord(row);
  if(!desktopGeometry()||buttons.length!==2)throw Error('Could not locate the two dialog actions after selecting the Whiteboard tab.');
  await clickWord(buttons[1]);
  await page.getByRole('button',{name:/Stop sharing/i}).waitFor();
  await fs.rm(captureDir,{recursive:true});
}
async function clickWord(w){
  execFileSync('python3',['-c',`import ctypes as c,sys
x=c.CDLL('libX11.so.6'); t=c.CDLL('libXtst.so.6')
x.XOpenDisplay.restype=c.c_void_p
d=c.c_void_p(x.XOpenDisplay(None))
if not d: raise RuntimeError('Display unavailable')
t.XTestFakeMotionEvent(d,-1,int(sys.argv[1]),int(sys.argv[2]),0)
t.XTestFakeButtonEvent(d,1,1,0); t.XTestFakeButtonEvent(d,1,0,0)
x.XSync(d,0)`,String(Math.round(w.x+w.w/2)),String(Math.round(w.y+w.h/2))]);
  await delay(200);
}
export async function captureChooser(filename){
  const {x,y,w,h}=panel;
  execFileSync('convert',[shot,'-fill','none','-stroke','#ffe24a','-strokewidth','4','-draw',
    'roundrectangle '+(row.x-40)+','+(row.y-9)+' '+(row.x+row.w+12)+','+(row.y+row.h+9)+' 5,5',
    '-crop',(w+24)+'x'+(h+24)+'+'+(x-12)+'+'+(y-12),'+repage',filename]);
}
