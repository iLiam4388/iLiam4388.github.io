import {accessorySVG,profileClasses,cosmeticArt,cosmeticLabel} from './liam-expansion.js?v=5';
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
 const color=palette[c.color]||(typeof cosmeticArt(c.color)==='string'&&/^#[0-9a-f]{6}$/i.test(cosmeticArt(c.color))?cosmeticArt(c.color):palette.blue);
 x=Math.max(-3,Math.min(3,Number(x)||0));y=Math.max(-3,Math.min(3,Number(y)||0));
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><radialGradient id="idot-body" cx="30%" cy="23%" r="80%"><stop stop-color="#fff" stop-opacity=".65"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#0d2847" stop-opacity=".22"/></radialGradient></defs><ellipse cx="50" cy="89" rx="29" ry="5" fill="#071b35" opacity=".24"/><circle cx="50" cy="52" r="37" fill="'+color+'" stroke="#102947" stroke-width="3"/><circle cx="50" cy="52" r="35" fill="url(#idot-body)"/><ellipse cx="37" cy="47" rx="11" ry="14" fill="white"/><ellipse cx="63" cy="47" rx="11" ry="14" fill="white"/><circle class="idot-pupil" data-x="37" data-y="47" cx="'+(37+x)+'" cy="'+(47+y)+'" r="5.5" fill="#122039"/><circle class="idot-pupil" data-x="63" data-y="47" cx="'+(63+x)+'" cy="'+(47+y)+'" r="5.5" fill="#122039"/><path d="M40 67 Q50 77 60 67" stroke="#102947" stroke-width="3.5" stroke-linecap="round" fill="none"/><ellipse cx="24" cy="61" rx="5" ry="3" fill="#ff98ae" opacity=".75"/><ellipse cx="76" cy="61" rx="5" ry="3" fill="#ff98ae" opacity=".75"/>'+(c.glasses&&!c.eyewearStyle?'<path d="M24 39h23v14q-12 9-23 0zM53 39h23v14q-12 9-23 0z" fill="#14233c" stroke="#eefaff" stroke-width="2"/><path d="M47 42h6M29 43l8 8M58 43l8 8" stroke="#8bbde3" stroke-width="2"/>':'')+(c.hat&&!c.favicon&&!c.accessory&&!c.hatStyle?'<path d="M19 30Q19 5 50 5T81 30Z" fill="#f75b85" stroke="#102947" stroke-width="3"/><rect x="15" y="27" width="70" height="9" rx="4" fill="#ffe2eb" stroke="#102947" stroke-width="2"/><circle cx="50" cy="5" r="5" fill="#ffe2eb"/>':'')+(c.accessory?accessorySVG(c.accessory):'')+(c.eyewearStyle?accessorySVG(c.eyewearStyle):'')+(c.hatStyle&&!c.favicon?accessorySVG(c.hatStyle):'')+(c.favicon&&faviconImage?'<circle cx="50" cy="15" r="14" fill="#0b1631" stroke="#ffe396" stroke-width="2"/><image x="38" y="3" width="24" height="24" href="'+faviconImage+'"/></svg>':'</svg>');
}
export function appearanceForProfile(p={}){const c={...defaultAppearance,...p?.liamAppearance};if(!p?.idotFaviconGranted)c.favicon=false;return c;}
export function dotAvatar(c){const bg=cosmeticArt(c?.avatarColor);let svg=dotSVG(c);if(typeof bg==='string'&&/^#[0-9a-f]{6}$/i.test(bg))svg=svg.replace('</defs>','</defs><rect width="100" height="100" rx="50" fill="'+bg+'"/>');return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
export function styleCosmeticProfile(el,c={}){const bg=cosmeticArt(c.avatarColor),banner=cosmeticArt(c.bannerStyle),tagColor=cosmeticArt(c.tagStyle);if(!el)return;const img=el.querySelector('img.avatar,.lc-identity-preview img')||(el.matches('.lc-identity-preview')?el.querySelector('img'):null);if(img){if(typeof bg==='string'&&/^#[0-9a-f]{6}$/i.test(bg))img.style.backgroundColor=bg;else img.style.removeProperty('background-color');}if(el.matches('.profile-summary,.public-profile-summary,.lc-identity-preview')&&Array.isArray(banner)){el.classList.add('lc-custom-banner');el.style.setProperty('--lc-custom-banner','linear-gradient(120deg,'+banner.join(',')+')');}else{el.classList.remove('lc-custom-banner');el.style.removeProperty('--lc-custom-banner');}let tag=el.querySelector('.lc-public-tag');const label=c.tagStyle&&['tagExplorer','tagCreator','tagGamer','tagCollector','tagStar','tagCosmic'].includes(c.tagStyle)?cosmeticLabel(c.tagStyle):c.tag?'iDot Club':'';if(label){if(!tag){tag=document.createElement('span');tag.className='lc-public-tag';el.append(tag);}tag.textContent=label;if(tagColor&&c.tagStyle){tag.style.color=tagColor;tag.style.borderColor=tagColor;}else{tag.style.removeProperty('color');tag.style.removeProperty('border-color');}}else tag?.remove();}
export function styleIdentity(el,c={}){
 if(!el)return;
 profileClasses(el,c);
 el.classList.toggle('lc-gradient',c.gradient===true);
 const user=el.querySelector('.username');if(user)user.classList.toggle('lc-blue-name',c.username===true);
 const img=el.querySelector('img.avatar');if(img)img.classList.toggle('lc-frame',c.frame===true);
 styleCosmeticProfile(el,c);
}
