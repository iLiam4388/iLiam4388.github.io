/* iLiam shared UI icons: consistent, scalable SVG instead of OS emoji glyphs.
   This script only transforms interface chrome, never authored posts/messages. */
(()=>{
const shapes={
  "star":'<path d="m12 2 3.1 6.3 7 .9-5 4.9 1.2 6.9L12 17.7 5.7 21l1.2-6.9-5-4.9 7-.9z"/>',
  "phone":'<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.7L7.3 9.9a16 16 0 0 0 6.8 6.8l1.7-1.7a2 2 0 0 1 1.7-.6l2.8.5a2 2 0 0 1 1.7 2z"/>',
  "mail":'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>',
  "user":'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  "shield":'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  "link":'<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
  "x":'<path d="M18 6 6 18M6 6l12 12"/>',
  "message":'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H12a9 9 0 0 1-4.1-1L3 21l1.7-4.9A8.5 8.5 0 1 1 21 11.5Z"/>',
  "heart":'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  "settings":'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2.8-2.8.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7l2.8-2.8.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  "edit":'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4z"/>',
  "trash":'<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  "video":'<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3"/>',
  "bell":'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  "moon":'<path d="M20.8 14.1A9 9 0 0 1 9.9 3.2 9 9 0 1 0 20.8 14.1Z"/>',
  "check":'<path d="m5 12 4 4L19 6"/>',
  "users":'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a6 6 0 0 1 4 6"/>',
  "mic":'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  "camera":'<path d="M14 4H9L7 7H3v13h18V7h-5z"/><circle cx="12" cy="13" r="4"/>',
  "monitor":'<rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 22h8M12 18v4"/>',
  "volume":'<path d="M11 5 6 9H2v6h4l5 4zM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/>',
  "volume-off":'<path d="M11 5 6 9H2v6h4l5 4zM17 9l5 6M22 9l-5 6"/>',
  "expand":'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  "sparkles":'<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
  "hand":'<path d="M8 13V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9a7 7 0 0 1-7 7h-2c-3 0-4-2-6-5l-2-3a2 2 0 0 1 3-2z"/>',
  "lock":'<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  "globe":'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  "thumbs-up":'<path d="M7 10v12H3V10zM7 10l5-8a2 2 0 0 1 2 2v5h5a3 3 0 0 1 3 3l-2 8a3 3 0 0 1-3 2H7"/>',
  "megaphone":'<path d="m3 11 14-7v16L3 13zM7 14l2 7h4l-2-6M17 8a4 4 0 0 1 0 8"/>'
};
const symbols={
'★':'star','☆':'star','⭐':'star','📞':'phone','☎':'phone','✉':'mail','👤':'user','🛡':'shield','🔗':'link','✕':'x','💬':'message','♥':'heart',
'⚙':'settings','✎':'edit','🗑':'trash','📹':'video','🔔':'bell','🌙':'moon','☑':'check','☐':'check','👥':'users',
'🎙':'mic','📷':'camera','🖥':'monitor','🔊':'volume','🔇':'volume-off','⛶':'expand','✦':'sparkles','✋':'hand',
'🔒':'lock','🌍':'globe','👍':'thumbs-up','📢':'megaphone','✓':'check'
};
const re=new RegExp(Object.keys(symbols).sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
function svg(name){
 const span=document.createElement('span');span.className='iliam-svg-icon';span.setAttribute('aria-hidden','true');
 span.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+shapes[name]+'</svg>';
 return span;
}
const eligible='button,a:not(.profile-link):not(.saved-profile-link),h1,h2,h3,h4,h5,h6,.modal-head,.modal-title,.topbar,.im-dnd-row,.call-dnd-row,.gc-dnd-footer,.gc-voice,.featured-label';
function processText(node){
 const parent=node.parentElement;if(!parent||parent.closest('.iliam-svg-icon,svg,script,style,textarea,input,[contenteditable],.post-text,.comment-text,.message-text,.chat-message,.review-text'))return;
 const target=parent.closest(eligible);if(!target)return;
 const raw=node.nodeValue;if(!raw||!re.test(raw)){re.lastIndex=0;return;}re.lastIndex=0;
 const out=document.createDocumentFragment();let last=0;
 for(const match of raw.matchAll(re)){if(match.index>last)out.append(document.createTextNode(raw.slice(last,match.index)));out.append(svg(symbols[match[0]]));last=match.index+match[0].length;}
 if(last<raw.length)out.append(document.createTextNode(raw.slice(last)));
 node.replaceWith(out);
}
function scan(root){
 if(root.nodeType===3){processText(root);return;}
 if(root.nodeType!==1||root.matches('script,style,svg,textarea,input'))return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(processText);
}
const css=document.createElement('style');css.textContent='.iliam-svg-icon{display:inline-flex;align-items:center;justify-content:center;vertical-align:-.12em;line-height:1;flex:none}.iliam-svg-icon svg{width:1em;height:1em;display:block;overflow:visible}.featured-label .iliam-svg-icon{color:#fff;stroke:#fff;vertical-align:-.15em}';
document.head.append(css);
if(document.body)scan(document.body);
else document.addEventListener('DOMContentLoaded',()=>scan(document.body),{once:true});
const observer=new MutationObserver(records=>{
 const nodes=new Set();
 for(const record of records){
  if(record.type==='characterData')nodes.add(record.target);
  for(const node of record.addedNodes)nodes.add(node);
 }
 for(const node of nodes)scan(node);
});
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
