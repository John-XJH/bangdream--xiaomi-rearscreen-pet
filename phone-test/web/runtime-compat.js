(function () {
  'use strict';
  var timer=0, ready=false, retries=0,lastRequest=-Infinity,lastEpoch=0,pendingFailure='',metadataTimers=[];
  try { retries=Number(sessionStorage.getItem('pet-load-retries'))||0; } catch(e) {}
  var state=window.petCompatibility={mode:'checking',hostVersion:null,androidAPI:null,webviewVersion:null,model:null,issues:[]};
  function show(message,retry) {
    var box=document.getElementById('runtime-recovery');
    if(!box){box=document.createElement('div');box.id='runtime-recovery';box.setAttribute('role','status');box.innerHTML='<div id="runtime-recovery-message"></div><button id="runtime-retry">重新加载桌宠</button>';document.body.appendChild(box);document.getElementById('runtime-retry').onclick=function(){try{sessionStorage.removeItem('pet-load-retries');}catch(e){}location.reload();};}
    box.hidden=false;document.getElementById('runtime-recovery-message').textContent=message;document.getElementById('runtime-retry').hidden=!retry;
  }
  function failure(message) {
    if(state.retrying)return;
    if(document.hidden||window.petRuntimeActive===false){clearTimeout(timer);pendingFailure=message;return;}if(ready){show(message+'。请重新加载桌宠；仍失败请检查背屏宿主。',true);return;}clearTimeout(timer);
    show(message+'。请重试；仍失败请通过桌宠助手检查版本。',true);
    if(retries<2){state.retrying=true;retries++;try{sessionStorage.setItem('pet-load-retries',String(retries));}catch(e){return;}timer=setTimeout(function(){if(document.hidden||window.petRuntimeActive===false){pendingFailure=message;return;}location.reload();},retries*3000);}
  }
  function refresh(request) {
    var bridge=window.maml,readable=bridge&&typeof bridge.getDoubleByName==='function';
    state.mode=readable?(typeof bridge.doAction==='function'?'maml-enhanced':'maml-basic'):'standalone';
    state.issues=[];if(!readable){state.hostVersion=null;state.androidAPI=null;state.webviewVersion=null;state.model=null;lastEpoch=0;}
    if(readable){try{if(request!==false&&typeof bridge.doAction==='function'&&(request==='retry'||Date.now()-lastRequest>30000)){lastRequest=Date.now();bridge.doAction('refreshRuntimeCompatibility');}var epoch=Number(bridge.getDoubleByName('anon_runtime_epoch'));if(epoch&&epoch!==lastEpoch){lastEpoch=epoch;var api=Number(bridge.getDoubleByName('anon_runtime_api'));state.androidAPI=api>0?api:null;
      if(typeof bridge.getStringByName==='function'){state.hostVersion=bridge.getStringByName('anon_runtime_host')||null;state.webviewVersion=bridge.getStringByName('anon_runtime_webview')||null;state.model=bridge.getStringByName('anon_runtime_model')||null;}}
    }catch(e){state.issues.push('宿主信息读取失败');}}
    state.knownHost=state.hostVersion==='RELEASE-1.0.2608211912';
    if(!readable)state.issues.push('当前环境没有背屏桥接，音乐和电量联动不可用');
    if(state.hostVersion&&!state.knownHost)state.issues.push('宿主版本未验证：保留基础渲染，联动按实际接口能力启用');
    if(!state.hostVersion)state.issues.push('版本信息未收到：可打开主屏桌宠助手发送检查结果');
    if(state.androidAPI&&state.androidAPI<29)state.issues.push('系统低于助手支持的 Android 10；壁纸兼容性未验证');
    state.gzip=typeof DecompressionStream==='function'&&typeof Blob!=='undefined'&&typeof Blob.prototype.stream==='function';
    return state;
  }
  window.refreshPetCompatibility=refresh;
  window.petRuntimeReady=function(){ready=true;state.retrying=false;pendingFailure='';clearTimeout(timer);try{sessionStorage.removeItem('pet-load-retries');}catch(e){}var box=document.getElementById('runtime-recovery');if(box)box.hidden=true;refresh();for(var i=0;i<metadataTimers.length;i++)clearTimeout(metadataTimers[i]);metadataTimers=[];[1200,3500,8000].forEach(function(delay){metadataTimers.push(setTimeout(function(){if(!lastEpoch&&!document.hidden&&window.petRuntimeActive!==false)refresh('retry');},delay));});};
  window.petRuntimeFailure=failure;
  window.addEventListener('error',function(e){if(!ready&&e.target&&e.target.tagName==='SCRIPT')failure('桌宠脚本读取失败');},true);
  function start(){
    refresh();var missing=[];
    if(typeof Promise!=='function')missing.push('Promise');
    if(!window.URL||typeof URL.createObjectURL!=='function')missing.push('模型资源接口');
    var canvas=document.createElement('canvas'),gl=null;
    try{gl=canvas.getContext('webgl2')||canvas.getContext('webgl');if(gl){var ext=gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();}}catch(e){}
    if(!gl)missing.push('WebGL');
    window.petCanStart=missing.length===0;
    if(missing.length){show('当前 WebView 缺少 '+missing.join('、')+'，无法运行桌宠。请更新系统 WebView 后重新应用。',false);return;}
    timer=setTimeout(function(){failure('桌宠加载超时');},20000);
  }
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&window.petRuntimeActive!==false&&pendingFailure){var reason=pendingFailure;pendingFailure='';failure(reason);}});
  document.addEventListener('petvisibilitychange',function(){if(!document.hidden&&window.petRuntimeActive!==false&&pendingFailure){var reason=pendingFailure;pendingFailure='';failure(reason);}});
  start();
})();
