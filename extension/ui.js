(() => {
  'use strict';
  const I18n = TCCI18n;
  const t = I18n.message;
  const CSS = `
    :host{all:initial;color-scheme:dark;font:13px/1.4 system-ui,-apple-system,sans-serif;color:#eee;display:block}
    [hidden]{display:none!important}*{box-sizing:border-box}
    button{height:24px;min-height:24px;flex-shrink:0;font:12px/20px system-ui,-apple-system,sans-serif;color:inherit;background:#25242e;border:1px solid #494554;border-radius:5px;padding:1px 10px;cursor:pointer;white-space:nowrap}
    button:hover{background:#393440}button:focus-visible{outline:2px solid #c6a5ff;outline-offset:0}
    .bar{direction:ltr;height:${TCCCore.HEADER_HEIGHT}px;display:flex;align-items:center;gap:12px;padding:5px 14px;background:#17151f;border-bottom:1px solid #373140;overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:thin}
    .title{direction:ltr;unicode-bidi:plaintext;font-size:12px;font-weight:650;margin-right:auto;overflow:hidden;text-overflow:ellipsis;min-width:24px;max-width:240px;flex:1 1 auto}
    .modes{direction:ltr;display:flex;gap:4px;flex-shrink:0;padding:0;border:0;background:transparent}.mode{border:0;background:transparent;padding:2px 12px;font-size:11px;font-weight:600;line-height:20px}.mode[aria-pressed="true"]{background:#7651a5;color:white}.mode:hover{background:#393040}
    .panel{height:100%;background:#101014;display:grid;grid-template-rows:${TCCCore.HEADER_HEIGHT}px minmax(0,1fr)}.area{direction:ltr;display:flex;min-height:0;min-width:0}.area.bottom{flex-direction:column}.video{position:relative;background:black;flex:1 1 auto;min-width:0;min-height:0}.chat{display:flex;flex-direction:column;flex:0 0 var(--chat-size);min-width:0;min-height:0;background:#18171c;border-left:1px solid #38313f}.bottom .chat{border-left:0;border-top:1px solid #38313f}.chat iframe{width:100%;height:100%;min-height:0;flex:1 1 auto;border:0;background:#18171c}
    .notice{position:absolute;right:8px;top:${TCCCore.HEADER_HEIGHT + 6}px;z-index:2;max-width:min(340px,calc(100vw - 16px));padding:8px 10px;background:#30213e;border:1px solid #6a4d7b;border-radius:6px;color:#eee;font-size:12px;pointer-events:none}.notice:empty{display:none}
    @media(max-width:500px){.bar{gap:6px;padding:5px 8px}.bar button{font-size:11px;padding-left:8px;padding-right:8px}.modes{gap:3px}}
    @media(max-width:360px){.bar{gap:5px}.bar .mode{font-size:10px;padding-left:6px;padding-right:6px}.bar button{padding-left:6px;padding-right:6px}.modes{gap:2px}}
  `;
  function element(doc,tag,className,text){const el=doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
  function button(doc,text,action,className=''){const el=element(doc,'button',className,text);el.type='button';el.addEventListener('click',action);return el;}
  function makeModes(doc,mode,onMode){
    const group=element(doc,'div','modes');group.setAttribute('role','group');group.setAttribute('aria-label',t('layoutGroup'));
    const names={auto:t('modeAutoTitle'),side:t('modeSideTitle'),bottom:t('modeBottomTitle'),hide:t('modeHideTitle')};
    const buttons=TCCCore.MODES.map(key=>{const b=button(doc,key.toUpperCase(),()=>onMode(key),'mode');b.title=names[key];b.setAttribute('aria-label',`${key.toUpperCase()}: ${names[key]}`);b.setAttribute('aria-pressed',String(key===mode));group.append(b);return b;});
    group.addEventListener('keydown',event=>{const index=buttons.indexOf(event.target);if(index<0)return;let target;
      if(event.key==='ArrowRight')target=(index+1)%buttons.length;else if(event.key==='ArrowLeft')target=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')target=0;else if(event.key==='End')target=buttons.length-1;else return;
      event.preventDefault();buttons[target].focus();
    });
    return {group,setMode(value){buttons.forEach((b,index)=>b.setAttribute('aria-pressed',String(TCCCore.MODES[index]===value)));}};
  }
  function makePanel({doc,channel,hostname,mode,onMode,onChatWindow,native=false}){
    const host=doc.createElement('div');host.id='tcc-panel';host.lang=I18n.language;host.dir=I18n.direction;host.setAttribute('data-tcc-window-mode',native?'native-popout':'document-pip');host.style.cssText='position:fixed;inset:0;z-index:2147483601;pointer-events:none;';
    const shadow=host.attachShadow({mode:'closed'});const style=element(doc,'style');style.textContent=CSS;shadow.append(style);
    const panel=element(doc,'section','panel');panel.setAttribute('aria-label',t('panelLabel'));
    const bar=element(doc,'header','bar');bar.style.pointerEvents='auto';const title=element(doc,'span','title',channel);title.title=channel;
    const modes=makeModes(doc,mode,onMode);bar.append(title,modes.group);
    const area=element(doc,'main','area');const video=element(doc,'div','video');
    if(native){panel.style.background='transparent';video.style.background='transparent';}else video.style.pointerEvents='auto';
    const chat=element(doc,'section','chat');chat.style.pointerEvents='auto';
    const frame=element(doc,'iframe');frame.title=t('chatFrameTitle',[channel]);frame.src=TCCCore.chatURL(channel,hostname);frame.referrerPolicy='strict-origin-when-cross-origin';
    const notice=element(doc,'div','notice');notice.setAttribute('role','status');
    const reload=button(doc,t('reloadLabel'),()=>{notice.textContent='';frame.src=TCCCore.chatURL(channel,hostname);});reload.dir=I18n.direction;reload.title=t('reloadTitle');reload.setAttribute('aria-label',t('reloadTitle'));
    const separate=button(doc,t('separateLabel'),onChatWindow);separate.dir=I18n.direction;separate.title=t('separateTitle');separate.setAttribute('aria-label',t('separateTitle'));
    bar.append(reload,separate);chat.append(frame);area.append(video,chat);panel.append(bar,area,notice);shadow.append(panel);
    return {host,video,frame,setMode:modes.setMode,setLayout(info){area.className=`area ${info.mode}`;area.style.setProperty('--chat-size',`${info.chat}px`);chat.hidden=info.mode==='hide';},status(message){notice.textContent=message;},destroy(){frame.removeAttribute('src');host.remove();}};
  }
  globalThis.TCCUI=Object.freeze({makePanel,element});
})();
