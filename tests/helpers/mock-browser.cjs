'use strict';
// Deterministic DOM/API doubles. These do not establish live Twitch DOM,
// computed CSS, real user activation, video playback, or browser PiP support.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Style {
  constructor(owner) {
    this.owner=owner;this.values=new Map();this.priorities=new Map();
    return new Proxy(this,{get:(t,k)=>k in t?t[k]:t.getPropertyValue(String(k).replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)),set:(t,k,v)=>{if(k in t){t[k]=v;return true;}t.setProperty(String(k).replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`),v);return true;}});
  }
  get cssText(){return [...this.values].map(([k,v])=>`${k}: ${v}${this.getPropertyPriority(k)?' !important':''};`).join(' ');}
  set cssText(v){this.values.clear();this.priorities.clear();this.owner.attributes.set('style','');for(const item of String(v).split(';')){const i=item.indexOf(':');if(i<0)continue;let value=item.slice(i+1).trim();const priority=/\s*!important$/.test(value)?'important':'';value=value.replace(/\s*!important$/,'');this.setProperty(item.slice(0,i).trim(),value,priority);}}
  setProperty(k,v,p=''){this.owner.attributes.set('style','');this.values.set(k,String(v));this.priorities.set(k,p);}
  getPropertyValue(k){return this.values.get(k)||'';}
  getPropertyPriority(k){return this.priorities.get(k)||'';}
  removeProperty(k){const v=this.getPropertyValue(k);this.values.delete(k);this.priorities.delete(k);return v;}
}
function simpleMatch(el, selector, scope){
  let s=selector.trim();
  if(!s)return false;
  if(s.includes(':scope')){if(el!==scope)return false;s=s.replace(':scope','');}
  s=s.replace(/:not\(([^()]*)\)/g,(_all,negative)=>{if(simpleMatch(el,negative,scope))return '!';return '';});
  if(s.includes('!'))return false;
  const tag=s.match(/^([\w-]+|\*)/);if(tag){if(tag[1]!=='*'&&el.tagName!==tag[1].toUpperCase())return false;s=s.slice(tag[0].length);}
  for(const match of s.matchAll(/([.#])([\w-]+)|\[([^\]=\s]+)(?:\s*=\s*["']?([^\]"']*)["']?)?\]/g)){
    if(match[1]==='#'&&el.id!==match[2])return false;
    if(match[1]==='.'&&!el.classList.contains(match[2]))return false;
    if(match[3]&&(!el.hasAttribute(match[3])||(match[4]!==undefined&&el.getAttribute(match[3])!==match[4])))return false;
  }
  return !!tag||/[.#\[]/.test(s)||s==='';
}
function selectorMatch(el, selector, scope){
  return selector.split(',').some(part=>{
    // Split combinators outside attribute strings (which can contain spaces).
    const pieces=part.trim().match(/(?:\[[^\]]*\]|[^\s>])+|>/g)||[];
    let node=el,index=pieces.length-1;
    if(index<0||!simpleMatch(node,pieces[index--],scope))return false;
    while(index>=0){const direct=pieces[index]==='>';if(direct)index--;const target=pieces[index--];node=node.parentElement;if(direct){if(!node||!simpleMatch(node,target,scope))return false;}else{while(node&&!simpleMatch(node,target,scope))node=node.parentElement;if(!node)return false;}}
    return true;
  });
}
class Element extends EventTarget {
  constructor(tag,doc){super();this.nodeType=1;this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.parentNode=null;this.children=[];this.attributes=new Map();this.style=new Style(this);this.hidden=false;this._text='';this.controls=false;this.paused=false;this.pauseCount=0;this.playCount=0;this.srcAssignments=[];this.rect={width:800,height:450,top:0,left:0,right:800,bottom:450};}
  get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
  get isConnected(){return !!this.parentNode?.isConnected;}
  get childNodes(){return this.children;}
  get firstChild(){return this.children[0]||null;}
  get firstElementChild(){return this.firstChild;}
  get lastElementChild(){return this.children.at(-1)||null;}
  get nextSibling(){if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)+1]||null;}
  get nextElementSibling(){return this.nextSibling;}
  get previousElementSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)-1]||null;}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){for(const child of this.children||[])child.parentNode=null;this.children=[];this._text=String(value??'');}
  get innerText(){return this.textContent;} set innerText(value){this.textContent=value;}
  get className(){return this.getAttribute('class')||'';} set className(value){this.setAttribute('class',value);}
  get classList(){const element=this;return {contains:name=>element.className.split(/\s+/).includes(name),add(...names){element.className=[...new Set([...element.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove(...names){element.className=element.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');}};}
  get id(){return this.getAttribute('id')||'';} set id(value){this.setAttribute('id',value);}
  get src(){return this.getAttribute('src')||'';} set src(value){this.srcAssignments.push(String(value));this.setAttribute('src',value);}
  setAttribute(k,v){if(k==='style'){this.style.cssText=v;return;}this.attributes.set(k,String(v));}
  getAttribute(k){return k==='style'?(this.attributes.has('style')?this.style.cssText:null):(this.attributes.get(k)??null);}
  hasAttribute(k){return this.attributes.has(k);}
  removeAttribute(k){this.attributes.delete(k);if(k==='style'){this.style.values.clear();this.style.priorities.clear();}}
  append(...nodes){for(const node of nodes)this.insertBefore(node,null);}
  appendChild(node){return this.insertBefore(node,null);}
  prepend(...nodes){for(const node of nodes.reverse())this.insertBefore(node,this.firstChild);}
  insertBefore(node,next){if(next!==null&&!this.children.includes(next))throw new Error('NotFoundError');node.remove();let i=next===null?this.children.length:this.children.indexOf(next);this.children.splice(i,0,node);node.parentNode=this;node.adopt(this.ownerDocument);return node;}
  after(node){this.parentNode?.insertBefore(node,this.nextSibling);}
  adopt(doc){this.ownerDocument=doc;for(const child of this.children)child.adopt(doc);this._shadow?.adopt(doc);}
  remove(){if(!this.parentNode)return;const i=this.parentNode.children.indexOf(this);this.parentNode.children.splice(i,1);this.parentNode=null;}
  removeChild(node){if(node.parentNode!==this)throw new Error('NotFoundError');node.remove();return node;}
  replaceWith(node){const p=this.parentNode;if(!p)return;p.insertBefore(node,this);this.remove();}
  contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
  matches(selector){return selectorMatch(this,selector,this);}
  closest(selector){let e=this;while(e){if(e.matches?.(selector))return e;e=e.parentElement;}return null;}
  querySelectorAll(selector){const result=[];const walk=node=>{for(const child of node.children){if(selectorMatch(child,selector,this))result.push(child);walk(child);}};walk(this);return result;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  attachShadow(){const shadow=new Element('#shadow-root',this.ownerDocument);Object.defineProperty(shadow,'isConnected',{get:()=>this.isConnected});shadow.host=this;this._shadow=shadow;return shadow;}
  getRootNode(){let node=this;while(node.parentNode)node=node.parentNode;return node;}
  getBoundingClientRect(){return this.rect;}
  getClientRects(){return this.isConnected&&!this.hidden&&this.style.display!=='none'&&this.rect.width>0&&this.rect.height>0?[this.rect]:[];}
  focus(){if(!this.isConnected||this.disabled)return;let active=this,node=this.parentNode;while(node){if(node.host){node.activeElement=active;active=node.host;node=active.parentNode;}else if(node.nodeType===9){node.activeElement=active;return;}else node=node.parentNode;}}
  click(){if(!this.disabled)emit(this,'click',{bubbles:true});}
  pause(){this.paused=true;this.pauseCount++;}
  play(){this.paused=false;this.playCount++;return Promise.resolve();}
}
class Document extends EventTarget {
  constructor(){super();this.nodeType=9;this.isConnected=true;this.children=[];this.documentElement=new Element('html',this);this.documentElement.parentNode=this;this.children.push(this.documentElement);this.body=new Element('body',this);this.documentElement.append(this.body);}
  createElement(tag){return new Element(tag,this);}
  querySelectorAll(s){return this.documentElement.querySelectorAll(s);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  contains(node){return this.documentElement.contains(node);}
}
function emit(target,type,props={}){const event=new Event(type,{cancelable:true,bubbles:props.bubbles??false});for(const [k,v]of Object.entries(props))if(k!=='bubbles')Object.defineProperty(event,k,{value:v});if(!Object.hasOwn(props,'target'))Object.defineProperty(event,'target',{value:target});const nodes=[];for(let node=target;node;node=event.bubbles?node.parentNode:null)nodes.push(node);Object.defineProperty(event,'composedPath',{value:()=>nodes});for(const node of nodes){node.dispatchEvent(event);if(event.cancelBubble)break;}return event;}
function keydown(target,key){return emit(target,'keydown',{key,bubbles:true});}
function focusedElement(doc){let active=doc.activeElement;while(active?._shadow?.activeElement)active=active._shadow.activeElement;return active;}
function deepElements(root){return [...root.children.flatMap(c=>[c,...deepElements(c)]),...(root._shadow?deepElements(root._shadow):[])];}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function createHarness(options={}){
  const timers=new Map(),observers=[],writes=[],opened=[],openContexts=[],pipWindows=[],pipRequests=[];let id=0;
  const document=new Document();
  const root=document.createElement('div');root.id='twitch-app';const player=document.createElement('div');player.className='video-player';player.setAttribute('data-a-target','video-player');const container=document.createElement('div');player.append(container);root.append(player);document.body.append(root);
  const video=document.createElement('video');if(options.video!==false)container.append(video);
  const gear=document.createElement('button');gear.setAttribute('data-a-target','player-settings-button');gear.setAttribute('aria-label','設定');gear.setAttribute('aria-expanded','false');player.append(gear);
  const location=new URL(options.url||'https://www.twitch.tv/example');
  class Window extends EventTarget{
    constructor(doc){super();this.document=doc;doc.defaultView=this;this.innerWidth=960;this.innerHeight=620;this.closed=false;this.top=this;this.navigation=new EventTarget();}
    close(){if(this.closed)return;this.closed=true;emit(this,'pagehide',{persisted:false});}
    focus(){this.focused=true;}
    open(...args){opened.push(args);openContexts.push(this);return options.popupBlocked?null:{opener:this};}
  }
  const window=new Window(document);
  if(options.nested)window.top={};
  options.setup?.({document,root,player,container,video,gear,window});
  if(options.pip!==false)window.documentPictureInPicture={requestWindow:(request)=>{pipRequests.push(JSON.parse(JSON.stringify(request)));const win=new Window(new Document());pipWindows.push(win);return options.pipRequest?options.pipRequest(win):Promise.resolve(win);}};
  class MutationObserver{constructor(fn){this.fn=fn;this.active=false;this.observations=[];observers.push(this);}observe(target,settings){this.target=target;this.settings=settings;this.observations.push({target,settings});this.active=true;}disconnect(){this.active=false;}}
  const setTimer=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};
  const clearTimer=key=>timers.delete(key);
  const getComputedStyle=el=>({display:el.hidden?'none':el.style.display||'block',visibility:el.style.visibility||'visible',opacity:el.style.opacity||'1'});
  Object.assign(window,{location,MutationObserver,setTimeout:setTimer,clearTimeout:clearTimer,getComputedStyle,requestAnimationFrame:fn=>setTimer(fn,16),cancelAnimationFrame:clearTimer,AbortController});
  const locale=options.locale||'ja';
  const available=fs.readdirSync(path.join(__dirname,'../../extension/_locales'));
  const selected=available.includes(locale)?locale:(available.includes(locale.split(/[-_]/)[0])?locale.split(/[-_]/)[0]:'en');
  const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../../extension/_locales',selected,'messages.json'),'utf8'));
  const i18n={getMessage(key,substitutions=[]){
    if(key==='@@ui_locale')return selected;
    if(key==='@@bidi_dir')return selected==='ar'?'rtl':'ltr';
    const entry=catalog[key];if(!entry)return '';
    const values=Array.isArray(substitutions)?substitutions:[substitutions];
    return entry.message.replace(/\$([A-Z_]+)\$/gi,(_match,name)=>{const placeholder=entry.placeholders?.[name.toLowerCase()]||entry.placeholders?.[name];return placeholder?placeholder.content.replace(/\$(\d)/g,(_m,n)=>values[Number(n)-1]??''):'';});
  }};
  const storageListeners=new Set();
  const storageState={tccPreferences:options.preferences,...(options.consent===false?{}:{tccConsentVersion:options.consent??1})};
  const pendingStorageReads=[];
  function changeConsent(value){const oldValue=storageState.tccConsentVersion;storageState.tccConsentVersion=value;for(const listener of [...storageListeners])listener({tccConsentVersion:{oldValue,newValue:value}},'local');}
  const storage={onChanged:{addListener:listener=>storageListeners.add(listener),removeListener:listener=>storageListeners.delete(listener)},local:{get:(_key,fn)=>{const value={...storageState};if(options.deferStorage)pendingStorageReads.push(()=>fn(value));else fn(value);},set:(value,fn)=>{writes.push(JSON.parse(JSON.stringify(value)));Object.assign(storageState,value);fn?.();}}};
  const context=vm.createContext({window,document,location,URL,AbortController,MutationObserver,Element,HTMLElement:Element,Event,getComputedStyle,queueMicrotask,console:{warn:()=>{}},setTimeout:setTimer,clearTimeout:clearTimer,chrome:{i18n,runtime:{getManifest:()=>({version:"1.5.1"})},storage}});
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../../extension/manifest.json'),'utf8'));
  for(const file of manifest.content_scripts[0].js)vm.runInContext(fs.readFileSync(path.join(__dirname,'../../extension',file),'utf8'),context,{filename:file});
  function runTimers(ms){for(const [key,t]of [...timers])if(ms===undefined||t.ms<=ms){timers.delete(key);t.fn();}}
  function button(text,doc=document){return deepElements(doc.documentElement).find(e=>e.tagName==='BUTTON'&&e.textContent===text);}
  async function click(text,doc=document){const b=button(text,doc);if(!b)throw new Error(`Button missing: ${text}`);b.click();await flush();}
  function mutation(records){for(const observer of [...observers])if(observer.active)observer.fn(records);}
  // Matches user-provided Japanese screenshot: verified menu -> direct row div
  // -> native menuitem button -> div -> div text. No guessed popout selector.
  function openGear({label='ポップアウト',nativeAction=()=>{},menuParent=player}={}){
    let menu=document.querySelector('[data-a-target="player-settings-menu"]');if(menu)menu.remove();
    menu=document.createElement('div');menu.setAttribute('data-a-target','player-settings-menu');menu.className='Layout-sc-1xcs6mc-0 native-settings-menu';
    const addRow=text=>{const row=document.createElement('div');row.className='Layout-sc-1xcs6mc-0 native-row';const button=document.createElement('button');button.setAttribute('role','menuitem');button.className='ScCoreButton-sc-ocjdkq-0 native-menu-button';const outer=document.createElement('div');outer.className='Layout-sc-1xcs6mc-0 native-content';const inner=document.createElement('div');inner.textContent=text;outer.append(inner);button.append(outer);row.append(button);menu.append(row);return {row,button};};
    addRow('詳細設定');const native=addRow(label);native.button.addEventListener('click',nativeAction);addRow('キーボードショートカット');menuParent.append(menu);gear.setAttribute('aria-expanded','true');emit(gear,'click',{bubbles:true});mutation([{type:'childList',target:menuParent,addedNodes:[menu],removedNodes:[]}]);runTimers(200);return {menu,nativeRow:native.row,nativeButton:native.button};
  }
  function closeGear(){const menu=document.querySelector('[data-a-target="player-settings-menu"]');menu?.remove();gear.setAttribute('aria-expanded','false');emit(gear,'click',{bubbles:true});mutation([{type:'childList',target:player,addedNodes:[],removedNodes:menu?[menu]:[]}]);runTimers(200);}
  return {document,window,location,root,player,container,video,gear,context,timers,observers,writes,storageListeners,pendingStorageReads,changeConsent,opened,openContexts,pipWindows,pipRequests,runTimers,button,click,mutation,openGear,closeGear,emit,keydown,focusedElement,deepElements};
}
module.exports={createHarness,emit,keydown,focusedElement,deepElements,Document,Element,flush};
