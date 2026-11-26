import {accessorySVG,profileClasses} from './liam-expansion.js?v=1';
const palette={blue:'#47c9ff',purple:'#b16dff',green:'#52e6a1',gold:'#ffcf59'};
// Downsample the real site favicon once so SVG avatar data URLs remain small.
let faviconImage='';
const faviconReady=new Promise(resolve=>{
 const image=new Image();let complete=false;
 const done=()=>{if(!complete){complete=true;resolve()}};
 const timer=setTimeout(done,3000);
 image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,48,48);faviconImage=canvas.toDataURL('image/png')}catch(e){console.warn('iDot favicon could not be embedded',e)}finally{clearTimeout(timer);done()}};
 image.onerror=()=>{clearTimeout(timer);done()};
 image.src=new URL('./images/favicon.png',import.meta.url).href;
});
await faviconReady;
export const defaultAppearance={avatar:false,color:'blue',glasses:false,hat:false,follower:false,frame:false,gradient:false,username:false,cursor:false,texture:false,tag:false};
export function dotSVG(c={},x=0,y=0){
 const color=palette[c.color]||palette.blue;
 x=Math.max(-3,Math.min(3,Number(x)||0));y=Math.max(-3,Math.min(3,Number(y)||0));
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><ellipse cx="50" cy="89" rx="29" ry="5" fill="#071b35" opacity=".24"/><circle cx="50" cy="52" r="37" fill="'+color+'" stroke="#102947" stroke-width="4"/><ellipse cx="37" cy="47" rx="11" ry="14" fill="white"/><ellipse cx="63" cy="47" rx="11" ry="14" fill="white"/><circle class="idot-pupil" data-x="37" data-y="47" cx="'+(37+x)+'" cy="'+(47+y)+'" r="5.5" fill="#122039"/><circle class="idot-pupil" data-x="63" data-y="47" cx="'+(63+x)+'" cy="'+(47+y)+'" r="5.5" fill="#122039"/><path d="M40 67 Q50 77 60 67" stroke="#102947" stroke-width="3.5" stroke-linecap="round" fill="none"/><ellipse cx="24" cy="61" rx="5" ry="3" fill="#ff98ae" opacity=".75"/><ellipse cx="76" cy="61" rx="5" ry="3" fill="#ff98ae" opacity=".75"/>'+(c.glasses?'<path d="M24 39h23v14q-12 9-23 0zM53 39h23v14q-12 9-23 0z" fill="#14233c" stroke="#eefaff" stroke-width="2"/><path d="M47 42h6M29 43l8 8M58 43l8 8" stroke="#8bbde3" stroke-width="2"/>':'')+(c.hat&&!c.favicon&&!c.accessory?'<path d="M19 30Q19 5 50 5T81 30Z" fill="#f75b85" stroke="#102947" stroke-width="3"/><rect x="15" y="27" width="70" height="9" rx="4" fill="#ffe2eb" stroke="#102947" stroke-width="2"/><circle cx="50" cy="5" r="5" fill="#ffe2eb"/>':'')+(c.accessory?accessorySVG(c.accessory):'')+(c.favicon&&faviconImage?'<circle cx="50" cy="15" r="14" fill="#0b1631" stroke="#ffe396" stroke-width="2"/><image x="38" y="3" width="24" height="24" href="'+faviconImage+'"/></svg>':'</svg>');
}
export function appearanceForProfile(p={}){const c={...defaultAppearance,...p?.liamAppearance};if(!p?.idotFaviconGranted)c.favicon=false;return c;}
export function dotAvatar(c){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(dotSVG(c));}
export function styleIdentity(el,c={}){
 if(!el)return;
 profileClasses(el,c);
 el.classList.toggle('lc-gradient',c.gradient===true);
 const user=el.querySelector('.username');if(user)user.classList.toggle('lc-blue-name',c.username===true);
 const img=el.querySelector('img.avatar');if(img)img.classList.toggle('lc-frame',c.frame===true);
 let tag=el.querySelector('.lc-public-tag');
 if(c.tag&&!tag){tag=document.createElement('span');tag.className='lc-public-tag';tag.textContent='iDot Club';el.append(tag);}
 if(!c.tag&&tag)tag.remove();
}
