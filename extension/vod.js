/* Archive support: retain Twitch's native player and replay. No chat API or iframe. */
(() => {
  'use strict';
  const Core = TCCCore, I18n = TCCI18n, t = I18n.message;
  const MARKERS = ['data-tcc-vod-path','data-tcc-vod-player','data-tcc-vod-replay'];
  function parseLocation(value) {
    let url; try { url = new URL(value); } catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname === 'www.twitch.tv') {
      const match = /^\/videos\/([1-9]\d{0,19})\/?$/.exec(url.pathname);
      return match ? {kind:'vod', videoId:match[1], popout:url.searchParams.get('tcc_vod') === '1', embedded:false} : null;
    }
    if (url.hostname === 'player.twitch.tv' && !url.searchParams.has('channel')) {
      const match = /^v?([1-9]\d{0,19})$/.exec(url.searchParams.get('video') || '');
      return match ? {kind:'vod', videoId:match[1], popout:false, embedded:true} : null;
    }
    return null;
  }
  function identity(route) { return route?.kind === 'vod' ? `vod:${route.videoId}:${route.popout}:${route.embedded}` : route ? `live:${route.channel}:${route.popout}` : ''; }
  function pageURL(id, seconds = 0, popup = false) {
    if (!/^[1-9]\d{0,19}$/.test(String(id))) throw new TypeError('Invalid archive ID');
    const time = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const url = new URL(`https://www.twitch.tv/videos/${id}`);
    url.searchParams.set('t', `${Math.floor(time / 3600)}h${Math.floor(time / 60) % 60}m${time % 60}s`);
    if (popup) url.searchParams.set('tcc_vod','1');
    return url.href;
  }
  function findParts(doc, video) {
    const roots = [...doc.querySelectorAll('#root')], root = roots.length === 1 ? roots[0] : null;
    const player = video?.closest('[data-a-target="video-player"],.video-player');
    const chats = root ? [...root.querySelectorAll('.video-chat')] : [];
    if (!root || root.parentElement !== doc.body || !player || !root.contains(player) || chats.length !== 1 || player.contains(chats[0]) || chats[0].contains(player)) return null;
    return {root,player,replay:chats[0],video};
  }
  const CSS = `
    html[data-tcc-vod-active],html[data-tcc-vod-active] body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#0e0e10!important}
    [data-tcc-vod-path]{display:contents!important}
    [data-tcc-vod-path]>:not([data-tcc-vod-path]):not([data-tcc-vod-player]):not([data-tcc-vod-replay]){display:none!important}
    [data-tcc-vod-player]{position:fixed!important;left:0!important;top:${Core.HEADER_HEIGHT}px!important;width:var(--tcc-vod-pw)!important;height:var(--tcc-vod-ph)!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;transform:none!important;z-index:10!important;background:#000!important}
    [data-tcc-vod-player] .video-player__container,[data-tcc-vod-player] [data-a-target="video-ref"]{width:100%!important;height:100%!important;max-height:none!important;max-width:none!important}
    [data-tcc-vod-player] video{width:100%!important;height:100%!important;object-fit:contain!important}
    [data-tcc-vod-replay]{position:fixed!important;left:var(--tcc-vod-cx)!important;top:var(--tcc-vod-cy)!important;width:var(--tcc-vod-cw)!important;height:var(--tcc-vod-ch)!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;transform:none!important;display:flex!important;flex-direction:column!important;background:var(--color-background-base,#18181b)!important;z-index:10!important;overflow:hidden!important;visibility:var(--tcc-vod-visible)!important}
    [data-tcc-vod-replay] .video-chat__message-list-wrapper{min-height:0!important;flex:1 1 auto!important;overflow:auto!important}
  `;
  function layout(parts, target, mode) {
    const value=Core.layout(mode,target.innerWidth,target.innerHeight), h=Math.max(0,target.innerHeight-Core.HEADER_HEIGHT), w=target.innerWidth;
    const chat=value.mode==='hide'?0:Math.min(value.chat,value.mode==='side'?w:h);
    const pw=value.mode==='side'?w-chat:w, ph=value.mode==='bottom'?h-chat:h;
    const vars={'--tcc-vod-pw':`${pw}px`,'--tcc-vod-ph':`${ph}px`,'--tcc-vod-cx':`${value.mode==='side'?pw:0}px`,'--tcc-vod-cy':`${value.mode==='bottom'?Core.HEADER_HEIGHT+ph:Core.HEADER_HEIGHT}px`,'--tcc-vod-cw':`${value.mode==='side'?chat:w}px`,'--tcc-vod-ch':`${value.mode==='bottom'?chat:h}px`,'--tcc-vod-visible':value.mode==='hide'?'hidden':'visible'};
    for(const [key,value] of Object.entries(vars)) parts.root.style.setProperty(key,value);
  }
  function decorate(parts, doc) {
    const changed=[];
    function mark(node,name){changed.push([node,name,node.getAttribute(name)]);node.setAttribute(name,'');}
    for(const [node,name] of [[parts.player,MARKERS[1]],[parts.replay,MARKERS[2]]]) mark(node,name);
    const paths=new Set();for(const leaf of [parts.player,parts.replay])for(let n=leaf.parentElement;n&&parts.root.contains(n);n=n.parentElement)paths.add(n);
    for(const node of paths)mark(node,MARKERS[0]);
    mark(doc.documentElement,'data-tcc-vod-active');
    const variables=new Map();for(const key of ['pw','ph','cx','cy','cw','ch','visible']){const name=`--tcc-vod-${key}`;variables.set(name,[parts.root.style.getPropertyValue(name),parts.root.style.getPropertyPriority(name)]);}
    const style=doc.createElement('style');style.textContent=CSS;(doc.head||doc.documentElement).append(style);
    return ()=>{style.remove();for(const [node,key,value] of changed){if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);}for(const [key,[value,priority]] of variables){if(value)parts.root.style.setProperty(key,value,priority);else parts.root.style.removeProperty(key);}};
  }
  function copyStyles(source, target) {
    target.documentElement.className=source.documentElement.className;target.documentElement.lang=source.documentElement.lang;target.documentElement.dir=source.documentElement.dir;target.body.className=source.body.className;
    const head=target.head||target.documentElement;
    for(const original of source.querySelectorAll('style,link[rel="stylesheet"]')){
      const node=target.createElement(original.tagName.toLowerCase());
      if(original.tagName==='STYLE')node.textContent=original.textContent;
      else {node.setAttribute('rel','stylesheet');node.setAttribute('href',original.href||original.getAttribute('href'));}
      const media=original.getAttribute('media');if(media)node.setAttribute('media',media);head.append(node);
    }
  }
  function create({window:win,document:doc,getPreferences,onMode,onSize,onReconcile,getCurrentVideo,allowExperimentalPip=false}) {
    let route=null, gear=null, active=null, generation=0, opening=false, source=null;
    let waiting=null, waitingTimer=0, discoveryAttempted=false;
    function stopWaiting(){waiting?.disconnect();waiting=null;clearTimeout(waitingTimer);waitingTimer=0;}
    function awaitReplay(){
      if(waiting||discoveryAttempted)return;discoveryAttempted=true;waiting=new MutationObserver(()=>onReconcile());
      waiting.observe(doc.querySelector('#root')||doc.body,{childList:true,subtree:true});
      waitingTimer=setTimeout(stopWaiting,10000);
    }
    const valid=()=>identity(route)===identity(parseLocation(win.location.href));
    function status(message){if(active?.bar)active.bar.status(message);else gear?.setStatus(message);}
    function resize(){if(active){active.bar.setMode(getPreferences().mode);layout(active.parts,active.window,getPreferences().mode);}}
    function finish(close=true,message='') {
      if(!active)return;const state=active;active=null;state.observer?.disconnect();state.abort.abort();
      state.cleanup?.();state.bar?.destroy();
      if(state.marker){
        const replacement=doc.querySelector('#root');
        if(state.marker.parentNode===state.parent && state.parent.isConnected && (!replacement||replacement===state.parts.root)) state.marker.replaceWith(state.parts.root);
        else {state.parts.video.pause();state.parts.root.remove();state.marker.remove();}
        onSize(state.window.innerWidth,state.window.innerHeight);
        if(close&&!state.window.closed)state.window.close();
      }
      if(message)status(message);onReconcile();
    }
    function ancestry(node,root){const path=[];for(let n=node.parentElement;n&&root.contains(n);n=n.parentElement)path.push(n);return path;}
    function partsValid(state){const replacement=state.marker?doc.querySelector('#root'):null;const samePaths=state.paths.every(([leaf,path])=>{const current=ancestry(leaf,state.parts.root);return current.length===path.length&&current.every((node,i)=>node===path[i]);});return samePaths&& state.parts.root.isConnected&&state.parts.root.parentElement===state.window.document.body&&(!replacement||replacement===state.parts.root)&&state.parts.player.contains(state.parts.video)&&state.parts.root.contains(state.parts.video)&&state.parts.root.contains(state.parts.replay)&&state.parts.root.contains(state.parts.player)&&state.parts.video.ownerDocument===state.window.document;}
    function mount(parts,target,marker=null,parent=null) {
      const abort=new AbortController(),state={parts,window:target,marker,parent,abort,cleanup:null,bar:null,observer:null,paths:[parts.player,parts.replay].map(leaf=>[leaf,ancestry(leaf,parts.root)])};active=state;
      try {
        state.cleanup=decorate(parts,target.document);
        state.bar=TCCUI.makeToolbar({doc:target.document,title:t('vodTitle'),mode:getPreferences().mode,onMode:value=>{if(active===state&&valid()&&partsValid(state))onMode(value);}});
        target.document.body.append(state.bar.host);resize();
        target.addEventListener('resize',resize,{signal:abort.signal});
        if(marker)target.addEventListener('pagehide',()=>finish(false),{once:true,signal:abort.signal});
        // Observe direct ancestors only, never every incoming replay message.
        state.observer=new MutationObserver(()=>{if(active!==state)return;if(!partsValid(state)||marker&&!marker.isConnected)finish(true,t('vodPlayerChanged'));});
        const watched=new Set();for(const leaf of [parts.video,parts.replay])for(let n=leaf.parentElement;n;n=n.parentElement)watched.add(n);
        if(marker)watched.add(parent);for(const node of watched)state.observer.observe(node,{childList:true});
      } catch(error){finish(true);throw error;}
      return state;
    }
    function stopGear(){gear?.stop();gear=null;}
    function startGear(){
      if(!route||active)return;
      // VOD uses the same fail-closed native menu adapter as live, without a
      // floating fallback or a Document PiP capability requirement.
      if(!gear)gear=TCCGearMenu.create({window:win,document:doc,onOpen:openPopup,label:t(route.embedded?'vodOpenPage':'vodPopupEntry'),language:I18n.language,direction:I18n.direction});
      gear.start(source);
    }
    function openPopup(){
      if(!route||!valid())return;const video=source;
      if(!video?.isConnected||video.ownerDocument!==doc||typeof getCurrentVideo==='function'&&getCurrentVideo()!==video){status(t('vodErrorVideoMissing'));onReconcile();return;}
      let child;try{child=win.open(pageURL(route.videoId,video.currentTime,true),'_blank',`popup,width=${getPreferences().width},height=${getPreferences().height}`);}catch{status(t('vodErrorPopupBlocked'));return;}
      if(!child){status(t('vodErrorPopupBlocked'));return;}
      try{child.opener=null;}catch{}
      video?.pause();status(t('vodPopupOpened'));
    }
    async function openPip(){
      if(active?.marker){active.window.focus();return;}
      if(!allowExperimentalPip||opening||!route||route.embedded||!valid())return;
      const parts=findParts(doc,source);
      if(!parts){status(t('vodMissing'));return;}
      if(parts.root.getAttribute('aria-hidden')==='true'||doc.querySelector('[data-a-target="player-settings-menu"]')){status(t('vodCloseMenu'));return;}
      if(!win.documentPictureInPicture?.requestWindow){status(t('errorPipUnsupported'));return;}
      const version=generation,key=identity(route);opening=true;let child=null,marker=null,parent=null;
      try{
        // First async operation remains inside the original user's click.
        child=await win.documentPictureInPicture.requestWindow({width:getPreferences().width,height:getPreferences().height});
        const current=findParts(doc,parts.video);
        if(version!==generation||key!==identity(route)||!valid()||!parts.video.isConnected||!current||['root','player','replay','video'].some(key=>current[key]!==parts[key])){child.close();return;}
        copyStyles(doc,child.document);child.document.title=`PopChat · ${t('vodTitle')}`;
        parent=parts.root.parentNode;marker=doc.createElement('div');marker.id='tcc-vod-placeholder';marker.textContent=t('pipPlaceholder');
        parent.insertBefore(marker,parts.root);
        // Register state/restoration before the adoption that can throw.
        const abort=new AbortController();active={parts,window:child,marker,parent,abort,cleanup:null,bar:null,observer:null};
        child.document.body.append(parts.root);
        stopWaiting();stopGear();mount(parts,child,marker,parent);
      }catch(error){if(active)finish(true);else{marker?.remove();if(child&&!child.closed)child.close();}status(t('errorPipOpen'));}
      finally{opening=false;}
    }
    function reconcile(next,video){
      if(identity(next)!==identity(route)){generation++;stopWaiting();finish(true);stopGear();route=next;discoveryAttempted=false;}
      if(video)source=video;
      if(!route)return;
      if(active){if(!valid()||!partsValid(active)||active.marker&&!active.marker.isConnected)finish(true,t('vodPlayerChanged'));else return;}
      if(route.popout&&!route.embedded){const parts=findParts(doc,video);if(parts){stopWaiting();stopGear();mount(parts,win);return;}awaitReplay();}
      startGear();if(route.popout)status(t('vodUnavailable'));
    }
    function stop(){generation++;stopWaiting();route=null;source=null;discoveryAttempted=false;finish(true);stopGear();}
    return Object.freeze({reconcile,stop,resize});
  }
  globalThis.TCCVod=Object.freeze({parseLocation,identity,pageURL,findParts,create});
})();
