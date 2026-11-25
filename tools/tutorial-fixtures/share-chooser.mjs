import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

let captureDir, shot, words;
function word(label){return words.find(w=>w.text===label);}
function tabRow(){
  const y=word('Window')?.y??0;
  return words.find(w=>w.y>y+15 && /community|iliam/i.test(w.text));
}
function readDesktop(){
  execFileSync('import',['-window','root',shot]);
  const tsv=execFileSync('tesseract',[shot,'stdout','--psm','11','tsv'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
  return tsv.trim().split('\n').slice(1).map(row=>row.split('\t')).filter(c=>c[0]==='5').map(c=>({x:+c[6],y:+c[7],w:+c[8],h:+c[9],text:c[11].trim()}));
}
export async function prepareShare(page,action){
  if(!process.env.DISPLAY)throw Error('The native sharing chooser requires a headed Chromium window on an isolated display.');
  if(action.chooser){
    captureDir=await fs.mkdtemp(path.join(os.tmpdir(),'iliam-chooser-'));
    shot=path.join(captureDir,'screen.png');
    await page.bringToFront();
    await page.locator('#gc-share').click();
    for(let i=0;i<8;i++){
      words=readDesktop();
      if(word('Cancel')&&word('Window'))return;
      await delay(200);
    }
    throw Error('Native chooser was not visible: '+words.map(w=>w.text).join(' '));
  }
  // Choose a single tab in Chromium's native picker with real keyboard input.
  const select=tabRow();
  if(!select) throw Error('No iLiam tab in the sharing chooser');
  await clickWord(select);
  words=readDesktop();
  const share=words.filter(w=>w.text==='Share').at(-1);
  if(!share)throw Error('Native Share button was not visible');
  await clickWord(share);
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
  const cancel=word('Cancel'),win=word('Window');
  const tab=tabRow();
  if(!cancel||!win||!tab)throw Error('Could not locate the native source list');
  const left=Math.max(0,win.x-270),top=Math.max(0,win.y-105);
  const bottom=cancel.y+cancel.h+35;
  execFileSync('convert',[shot,'-fill','none','-stroke','#ffe24a','-strokewidth','4','-draw',
    'roundrectangle '+(tab.x-8)+','+(tab.y-7)+' '+(tab.x+tab.w+10)+','+(tab.y+tab.h+7)+' 4,4',
    '-crop','680x'+(bottom-top)+'+'+left+'+'+top,'+repage',filename]);
}
