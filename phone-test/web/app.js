(async function () {
  const status = document.getElementById('status');
  const report = window.testReport = {ready:false, taps:0, action:'', error:'',targetFPS:30, measuredFPS:0,actionFinished:false};
  let message='';
  if(window.petCanStart===false){report.error='当前 WebView 能力不足';return;}
  const levels=Array(24).fill(0),smoothed=Array(24).fill(0);
  const simulatedLevels=Array(28).fill(0),waveCounts=Array(28).fill(0);
  let waveAlpha=0,waveTime=0,waveBeat=0;
  let lastAudio=0,audioActive=false;
  report.audioPackets=0;report.audioPeak=0;report.waveVisible=false;
  report.bridgeState='未检查';report.sourceSequence=0;
  report.musicPlaying=false;report.enjoyingMusic=false;report.musicBlend=0;
  let lastBridgePoll=0,lastBridgeSequence=0;
  let lastMusicPoll=0,musicPlaying=false;
  function readMusicBridge(now){
    if(now-lastMusicPoll<250)return;
    lastMusicPoll=now;
    if(!window.maml||typeof window.maml.getDoubleByName!=='function')return;
    try{musicPlaying=Number(window.maml.getDoubleByName('music_control.music_state'))===1;report.musicPlaying=musicPlaying;}catch(err){report.bridgeState='读取失败：'+err.message;}
  }
  let lastBatteryPoll=-5000,lowBattery=false,thermalLimited=false;
  report.batteryLevel=null;report.powerSaving=false;report.sadBlend=0;report.thermalStatus=0;report.batteryTemperature=null;
  function readBattery(now){
    if(now-lastBatteryPoll<5000||!window.maml||typeof maml.getDoubleByName!=='function')return;lastBatteryPoll=now;
    try{if(typeof maml.doAction==='function')maml.doAction('refreshBattery');const level=Number(maml.getDoubleByName('anon_battery_level')),scale=Number(maml.getDoubleByName('anon_battery_scale')),fallback=Number(maml.getDoubleByName('battery_level'));
      const percent=scale>0&&level>=0&&level<=scale?level*100/scale:fallback>0&&fallback<=100?fallback:null;
      report.batteryLevel=percent===null?null:Math.round(percent);report.powerSaving=Number(maml.getDoubleByName('anon_power_save'))===1;lowBattery=report.powerSaving||(percent!==null&&percent<=20);report.lowBattery=lowBattery;const epoch=Number(maml.getDoubleByName('anon_power_epoch'));if(epoch>0){report.thermalStatus=Number(maml.getDoubleByName('anon_thermal_status'))||0;const temperature=Number(maml.getDoubleByName('anon_power_temperature'));report.batteryTemperature=temperature>0?temperature/10:null;}const directTemperature=Number(maml.getDoubleByName('anon_battery_temperature'));if(directTemperature>0)report.batteryTemperature=directTemperature/10;const thermalFresh=epoch>0&&((Date.now()%2000000000-epoch+2000000000)%2000000000)<30000;if(!thermalFresh)report.thermalStatus=null;thermalLimited=(thermalFresh&&report.thermalStatus>=2)||report.batteryTemperature>=40||thermalLimited&&report.batteryTemperature>38.5;report.thermalLimited=thermalLimited;
    }catch(e){report.batteryError=String(e);}
  }
  function readAudioBridge(now){
    if(now-lastBridgePoll<100||window.themePreferences.waveSource!=='spectrum')return;
    lastBridgePoll=now;
    const bridge=window.maml;
    if(!bridge||typeof bridge.getDoubleByName!=='function'){report.bridgeState='接口缺失';return;}
    try{
      const sequence=Number(bridge.getDoubleByName('anon_seq'));
      report.sourceSequence=sequence;report.bridgeState='接口就绪';
      if(!Number.isFinite(sequence)||sequence===0||sequence===lastBridgeSequence)return;
      const active=Number(bridge.getDoubleByName('anon_active'));
      const values=Array.from({length:24},(_,i)=>Number(bridge.getDoubleByName('anon_b'+i))/1000);
      if(Number(bridge.getDoubleByName('anon_seq'))!==sequence)return;
      if(!values.every(Number.isFinite)){report.bridgeState='数据无效';return;}
      window.__audio(values,active,sequence);lastBridgeSequence=sequence;
    }catch(err){report.bridgeState='读取失败：'+err.message;}
  }
  window.__audio=(values,active,sequence)=>{if(!Array.isArray(values)||values.length!==24||!values.every(Number.isFinite))return;for(let i=0;i<24;i++)levels[i]=Math.max(0,Math.min(1,values[i]));lastAudio=performance.now();audioActive=active===1;report.audioPackets++;report.sourceSequence=sequence;report.audioPeak=Math.max(...levels);};
  const display=()=>{const audio=!window.themePreferences.waveEnabled?'音波关':window.themePreferences.waveSource==='playback'?(musicPlaying?'音乐播放 · 模拟律动':'音乐暂停'):audioActive&&performance.now()-lastAudio<1500?'频谱包 '+report.audioPackets+' / B '+report.sourceSequence:'等待频谱 · 已收 '+report.audioPackets+' · '+report.bridgeState+' / B '+report.sourceSequence;status.textContent=message+' · 网页 '+report.measuredFPS+' / '+report.targetFPS+'fps · '+audio;};
  const say = text => {message=text;display();};
  async function loadAsset(character,outfit){
    const member=petCatalog.find(m=>m.id===character),entry=member&&member.outfits.find(o=>o.id===outfit);if(!entry)throw Error('角色或服装不存在');
    const script=document.createElement('script');let assetTimer;script.src=entry.script;
      try{await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('模型文件加载失败'));assetTimer=setTimeout(()=>reject(Error('模型文件读取超时')),12000);document.head.appendChild(script);});const asset=window.loadedPetAsset;delete window.loadedPetAsset;if(!asset||asset.key!==character+'/'+outfit)throw Error('模型资源不匹配');asset.settings.url=new URL(asset.settings.url,document.baseURI).href;return asset;}finally{clearTimeout(assetTimer);script.remove();}
  }
  let activeAsset;try{activeAsset=await loadAsset(themePreferences.character,themePreferences.outfit);}catch(err){report.error=String(err);say('加载失败：'+err.message);window.petRuntimeFailure?.('模型资源加载失败');return;}
  const voice=new Audio();voice.preload='none';voice.volume=.65;
  let voiceContext=null,voiceAnalyser=null,voiceSamples=null,lipLevel=0;
  function enableLipSync(){
    try{if(!voiceContext){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;voiceContext=new Context();voiceAnalyser=voiceContext.createAnalyser();voiceAnalyser.fftSize=256;voiceSamples=new Uint8Array(voiceAnalyser.fftSize);const source=voiceContext.createMediaElementSource(voice);source.connect(voiceAnalyser);voiceAnalyser.connect(voiceContext.destination);}if(voiceContext.state==='suspended')voiceContext.resume().catch(e=>report.lipError=String(e));}catch(e){report.lipError=String(e);}
  }
  let voiceActor=null,dialogueToken=0,dialogueBusy=false,switching=false,tapSequence=0,gestureToken=0,gestureBusy=false,gestureReadyAt=0;
  const randomGap=()=>1+Math.floor(Math.random()*3);
  report.voiceCount=activeAsset.voices.length;report.voiceStarted=0;report.voicePlaying=false;report.voiceError='';report.voiceClicksRemaining=randomGap();
  voice.addEventListener('playing',()=>{report.voicePlaying=true;report.voiceStarted++;});
  voice.addEventListener('ended',()=>{report.voicePlaying=false;voice.removeAttribute('src');voice.load();voiceContext?.suspend().catch(()=>{});});
  voice.addEventListener('pause',()=>{report.voicePlaying=false;});
  function stopVoice(){voice.pause();voice.currentTime=0;report.voicePlaying=false;}
  function cancelSpeech(){gestureToken++;gestureBusy=false;dialogueToken++;tapSequence++;dialogueBusy=false;report.dialoguePlaying=false;stopVoice();voice.removeAttribute('src');voice.load();voiceActor=null;voiceContext?.suspend().catch(()=>{});}
  function startClip(actor,file,text=''){
    if(report.suspended||switching||!actor?.model||!voice.paused)return false;
    voiceActor=actor;actor.lip=0;report.voiceActor=actor.slot;report.voiceText=text;report.voiceError='';enableLipSync();voice.src=file;
    voice.play().catch(err=>{if(err.name==='AbortError')return;report.voiceError=err.name;stopVoice();});return true;
  }
  function playVoice(actor){
    const asset=actor.asset;const selection=themePreferences.voiceSelections?.[asset.key.split('/')[0]],fixedIndex=selection?.mode==='fixed'?asset.voices.indexOf(selection.file):-1;if(!themePreferences.voiceEnabled||!asset.voices.length||dialogueBusy)return;
    if(fixedIndex>=0){if(!voice.paused)stopVoice();actor.lastVoice=fixedIndex;report.voiceClip=fixedIndex+1;return {file:asset.voices[fixedIndex],text:asset.voiceInteractions?.[fixedIndex]?.text||'',interaction:asset.voiceInteractions?.[fixedIndex]};}
    if(!actor.slot)actor.gap=report.voiceClicksRemaining;actor.gap=Math.max(0,actor.gap-1);if(!actor.slot)report.voiceClicksRemaining=actor.gap;
    if(actor.gap>0||!voice.paused)return;
    let index=Math.floor(Math.random()*asset.voices.length);if(asset.voices.length>1&&index===actor.lastVoice)index=(index+1)%asset.voices.length;
    actor.lastVoice=index;actor.gap=randomGap();if(!actor.slot)report.voiceClicksRemaining=actor.gap;report.voiceClip=index+1;
    return {file:asset.voices[index],text:asset.voiceInteractions?.[index]?.text||'',interaction:asset.voiceInteractions?.[index]};
  }
  window.onVoiceChange=()=>{if(!themePreferences.voiceEnabled)cancelSpeech();};
  window.addEventListener('error',e=>{report.error=e.message;report.errorStack=e.error&&e.error.stack;say('错误：'+e.message);});
  try {
    say('ANON 66 · 加载中');
    const resolveModelURL=PIXI.live2d.ModelSettings.prototype.resolveURL;
    PIXI.live2d.ModelSettings.prototype.resolveURL=function(path){return path.startsWith('blob:')?path:resolveModelURL.call(this,path);};
    const app = new PIXI.Application({view:document.getElementById('canvas'),width:innerWidth,height:innerHeight,
      resolution:1,autoDensity:true,backgroundAlpha:0,backgroundColor:0x000000,antialias:false,autoStart:false});
    let renderWork=0,qualityScale=1,lastQualityCheck=0;
    let nativeDim=false,nativeState=-1,nativePoll=null,nativeWakeUntil=0,nativeFrameURL=null,nativeFramePending=false,nativeFrameTicket=0;
    let lifecyclePaused=false,releaseTimer=null,sleeping=false,resuming=false,contextLost=false,contextTimer=null,gestureHeartbeat=null;
    let hostPaused=window.__petHostPaused===true;
    try{if(window.maml?.getDoubleByName&&Number(maml.getDoubleByName('anon_host_lifecycle_epoch'))>0)hostPaused=Number(maml.getDoubleByName('anon_host_active'))!==1;}catch(e){}
    const frameLoop=window.createPetFrameLoop(app,ms=>{renderWork=renderWork*.9+ms*.1;report.renderWorkMS=Math.round(renderWork*100)/100;});
    report.frameDriver='scheduled';
    // Canvas hit testing and gestures are handled below; do not retain Pixi hover polling.
    if(app.renderer.plugins.interaction)app.renderer.plugins.interaction.useSystemTicker=false;report.interactionPolling=false;
    const wave=new PIXI.Graphics();app.stage.addChild(wave);
    let waveBars=null,wavePattern=null,waveFrames=[],waveGeometry='';
    function releaseWaveBars(){if(waveBars){wave.removeChild(waveBars);waveBars.destroy({children:true,texture:false,baseTexture:false});}for(const frame of waveFrames)frame?.destroy(false);wavePattern?.destroy(true);waveBars=null;wavePattern=null;waveFrames=[];waveGeometry='';}
    function drawWaveBars(counts,color,alpha,barW,step,maxBlocks,left,barGap,base){
      const geometry=[innerWidth,innerHeight,barW,step,maxBlocks].join('/');
      if(geometry!==waveGeometry){releaseWaveBars();waveGeometry=geometry;report.waveGeometryBuilds=(report.waveGeometryBuilds||0)+1;const pattern=new PIXI.Graphics();
        for(let b=0;b<maxBlocks;b++){pattern.beginFill(0xffffff,.5+.5*b/Math.max(1,maxBlocks-1));pattern.drawRoundedRect(0,(maxBlocks-b-1)*step+3,barW,step-3,Math.min(4,barW/2));pattern.endFill();}
        const patternWidth=Math.ceil(barW);wavePattern=app.renderer.generateTexture(pattern,{resolution:1,region:new PIXI.Rectangle(0,0,patternWidth,maxBlocks*step)});pattern.destroy();
        for(let n=1;n<=maxBlocks;n++)waveFrames[n]=new PIXI.Texture(wavePattern.baseTexture,new PIXI.Rectangle(0,(maxBlocks-n)*step,patternWidth,n*step));
        waveBars=new PIXI.Container();wave.addChild(waveBars);for(let i=0;i<28;i++){const sprite=new PIXI.Sprite(waveFrames[1]);sprite.anchor.set(0,1);sprite.position.set(left+barGap+i*(barW+barGap),base);waveBars.addChild(sprite);}
      }
      waveBars.visible=true;waveBars.alpha=alpha;for(let i=0;i<28;i++){const sprite=waveBars.children[i],n=counts[i];sprite.visible=n>0;if(n)sprite.texture=waveFrames[n];sprite.tint=color;}
    }
    window.onThemeChange=()=>{document.body.style.backgroundColor=window.themePreferences.background;if(window.applyPetBackground)window.applyPetBackground();for(const [id,key] of [['badge-name-display','badgeColor'],['badge-time-display','badgeTimeColor']])document.getElementById(id).style.backgroundColor=window.themePreferences[key]+'99';};
    window.onThemeChange();
    let model,manager,actions=[],currentGroup='idle';
    const actors=[null,null];
    let socialUntil=0,nextSocial=performance.now()+45000+Math.random()*45000;
    function cancelSocial(){socialUntil=0;nextSocial=performance.now()+45000+Math.random()*45000;for(const a of actors)if(a){a.socialBlend=0;a.socialMode=null;a.socialTime=0;a.socialAim=0;}}
    function updateSocial(now,dt){
      const pair=themePreferences.duoEnabled&&actors.every(a=>a?.model);
      const idle=pair&&actors.every(a=>a.finished||a.group==='idle')&&!report.voicePlaying&&!musicPlaying&&!lowBattery&&!report.settingsOpen&&!switching;
      if(now>=nextSocial){nextSocial=now+45000+Math.random()*45000;if(idle&&!dialogueBusy){socialUntil=now+4300;report.socialEvents=(report.socialEvents||0)+1;}}
      const mode=pair&&dialogueBusy?'dialogue':idle&&now<socialUntil?'idle':null;
      for(const actor of actors){if(!actor)continue;if(actor.socialMode!==mode)actor.socialTime=0;actor.socialMode=mode;if(mode)actor.socialTime+=dt;const other=actors[1-actor.slot],dx=other?.model?other.model.x-actor.model?.x:0,aim=Math.abs(dx)>innerWidth*.03?Math.sign(dx):(actor.slot?1:-1);actor.socialAim+=((mode?aim:0)-actor.socialAim)*(1-Math.exp(-dt/.28));actor.socialBlend+=((mode?1:0)-actor.socialBlend)*(1-Math.exp(-dt/.32));}
      report.socialMode=mode;report.nextSocialAt=nextSocial;
    }

    const templateActions=['smile01','wink01','surprised01','smile02','shame01','thinking01','kandou01','kime01','bye01'];
    function disposeModel(target,retained){
      const protectedBases=new Set(actors.filter(a=>a?.model&&a.model!==target).flatMap(a=>a.model.textures.map(t=>t.baseTexture)));if(retained)for(const t of retained.textures)protectedBases.add(t.baseTexture);
      const textures=[...new Set(target.textures)];
      target.destroy({children:true,texture:false,baseTexture:false});
      for(const texture of textures)if(texture.baseTexture&&!protectedBases.has(texture.baseTexture))texture.destroy(true);
    }
    async function prepare(asset){
      const settings=JSON.parse(JSON.stringify(asset.settings)),refs=settings.FileReferences||settings,mocKey=settings.Version===3?'Moc':'model';if(asset.lightTextures)refs[settings.Version===3?'Textures':'textures']=asset.lightTextures;let temporaryMoc=null,candidate;
      try{
        if(refs[mocKey].endsWith('.gz')){
          if(!window.refreshPetCompatibility?.().gzip)throw Error('当前 WebView 不支持压缩模型解码，请更新系统 WebView');
          const bytes=await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('GET',new URL(refs[mocKey],settings.url).href);xhr.responseType='arraybuffer';xhr.onload=()=>xhr.response&&(xhr.status===0||xhr.status===200)?resolve(xhr.response):reject(Error('压缩模型读取失败'));xhr.onerror=()=>reject(Error('压缩模型读取失败'));xhr.send();});
          const decoded=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).blob();
          temporaryMoc=URL.createObjectURL(decoded);refs[mocKey]=temporaryMoc;
        }
        candidate=await PIXI.live2d.Live2DModel.from(settings,{autoInteract:false,autoUpdate:false,motionPreload:'NONE'});
      }finally{if(temporaryMoc)URL.revokeObjectURL(temporaryMoc);}
      try{
        if(asset.settings.Version===3){const native=candidate.internalModel.coreModel._model,drawables=native.drawables;
          if(!drawables.renderOrders&&typeof native.getRenderOrders==='function'){const orders=native.getRenderOrders();if(orders.length!==drawables.count)throw Error('此模型包含当前渲染器尚不支持的离屏层');drawables.renderOrders=orders;}
        }
        const available=(asset.interactionActions||templateActions).filter(name=>(asset.settings.motions||asset.settings.FileReferences.Motions)[name]);if(!available.length)throw Error('缺少互动动作');report.preloadedActions=0;return {candidate,available};}catch(e){disposeModel(candidate,model);throw e;}
    }
    function attach(actor){
      const model=actor.model,activeAsset=actor.asset;
      let gazeTime=0,gazeX=0,gazeY=0,glanceStart=8+Math.random()*3,glanceX=0,glanceY=0;
      const manager=model.internalModel.motionManager;
      const physics=model.internalModel.physics,parameters=model.internalModel.coreModel._model?.parameters?.values;
      if(physics&&typeof physics.evaluate==='function'&&parameters){const original=physics.evaluate,before=new Float32Array(parameters.length),outputs=new Float32Array(parameters.length),previous=new Float32Array(parameters.length),affected=new Uint8Array(parameters.length);let elapsed=0;
        const replay=blend=>{for(let i=0;i<parameters.length;i++)if(affected[i])parameters[i]=previous[i]+(outputs[i]-previous[i])*blend;};
        physics.evaluate=function(core,delta){const busy=report.voicePlaying&&voiceActor===actor||actor.group!=='idle'&&!actor.finished||performance.now()<actor.interactionUntil;
          const limited=themePreferences.duoEnabled&&!busy;
          if(!limited){elapsed=0;affected.fill(0);return original.call(this,core,delta);}
          if(limited){elapsed+=delta;if(elapsed<1/15){replay(elapsed*15);actor.physicsReplays=(actor.physicsReplays||0)+1;return;}delta=elapsed;elapsed%=1/15;}
          before.set(parameters);const result=original.call(this,core,delta);for(let i=0;i<parameters.length;i++){const changed=Math.abs(parameters[i]-before[i])>.000001;previous[i]=affected[i]?outputs[i]:before[i];if(changed)affected[i]=1;if(affected[i])outputs[i]=parameters[i];}if(limited)replay(elapsed*15);return result;};
      }
      // Keep idle plus the two most recently requested motions, rather than every clicked motion.
      const recent=[];const loadMotion=manager.loadMotion;
      manager.loadMotion=async function(group,index){const motion=await loadMotion.call(this,group,index);if(!motion||this.destroyed)return motion;
        if(group!==this.groups.idle){const key=group+'/'+index,old=recent.findIndex(item=>item.key===key);if(old>=0)recent.splice(old,1);recent.push({key,group,index});while(recent.length>2){const removed=recent.shift();delete this.motionGroups[removed.group][removed.index];}}
        return motion;};
      const expressions=manager.expressionManager;
      if(expressions){const recentExpressions=[],loadExpression=expressions.loadExpression;expressions.loadExpression=async function(index){const expression=await loadExpression.call(this,index);if(!expression||this.destroyed)return expression;const old=recentExpressions.indexOf(index);if(old>=0)recentExpressions.splice(old,1);recentExpressions.push(index);while(recentExpressions.length>3){const removed=recentExpressions.shift();if(this.expressions[removed]!==this.currentExpression&&removed!==this.reserveExpressionIndex)delete this.expressions[removed];}for(let i=0;i<this.expressions.length;i++)if(this.expressions[i]&&this.expressions[i]!==this.currentExpression&&i!==this.reserveExpressionIndex&&!recentExpressions.includes(i))delete this.expressions[i];return expression;};}
      manager.on('motionStart',group=>{actor.group=group;if(group!=='idle')actor.finished=false;if(actor.slot===0)report.actionFinished=false;});
      manager.on('motionFinish',()=>{if(actor.group!=='idle'){actor.finished=true;if(actor.slot===0)report.actionFinished=true;if(actor.asset.interactionExpressions&&actor.model){const name=actor.asset.idleExpression||'exp_idle01';actor.model.expression(name).then(()=>report.restingExpression=name).catch(e=>report.expressionError=String(e));}}});
      const core=model.internalModel.coreModel,modern=typeof core.getParameterValueById==='function';
      const ids={PARAM_EYE_L_OPEN:'ParamEyeLOpen',PARAM_EYE_R_OPEN:'ParamEyeROpen',PARAM_ANGLE_Z:'ParamAngleZ',PARAM_ANGLE_X:'ParamAngleX',PARAM_ANGLE_Y:'ParamAngleY',PARAM_EYE_BALL_X:'ParamEyeBallX',PARAM_EYE_BALL_Y:'ParamEyeBallY',PARAM_MOUTH_FORM:'ParamMouthForm',PARAM_BODY_ANGLE_X:'ParamBodyAngleX',PARAM_BODY_ANGLE_Z:'ParamBodyAngleZ'};
      const get=id=>modern?core.getParameterValueById(ids[id]):core.getParamFloat(id);
      const set=(id,value)=>modern?core.setParameterValueById(ids[id],value):core.setParamFloat(id,value);
    model.internalModel.on('beforeModelUpdate',()=>{
      const sway=Math.sin(actor.musicPhase);
      const idle=actor.group==='idle'||actor.finished;
      if(modern&&idle){
        const dt=Math.min(app.ticker.deltaMS/1000,.1);gazeTime+=dt;
        if(gazeTime>=glanceStart+2){glanceStart=gazeTime+8+Math.random()*3;glanceX=(Math.random()<.5?-1:1)*(.18+Math.random()*.12);glanceY=(Math.random()-.5)*.12;}
        if(glanceX===0){glanceX=(Math.random()<.5?-1:1)*.24;glanceY=(Math.random()-.5)*.12;}
        const glance=gazeTime>glanceStart?Math.sin(Math.PI*Math.min(1,(gazeTime-glanceStart)/2)):0;
        const headX=Math.max(-5,Math.min(5,core.getParameterValueById('ParamAngleX')*.25));
        const headY=Math.max(-3,Math.min(3,core.getParameterValueById('ParamAngleY')*.3));
        const headZ=Math.max(-4,Math.min(4,core.getParameterValueById('ParamAngleZ')*.4));
        core.setParameterValueById('ParamAngleX',headX);core.setParameterValueById('ParamAngleY',headY);core.setParameterValueById('ParamAngleZ',headZ);
        const ease=1-Math.exp(-dt/ .28);gazeX+=(glanceX*glance-headX/30*.55-gazeX)*ease;gazeY+=(glanceY*glance-headY/30*.4-gazeY)*ease;
        core.setParameterValueById('ParamEyeBallX',gazeX);core.setParameterValueById('ParamEyeBallY',gazeY);
        report.gazeX=gazeX;report.gazeY=gazeY;report.gazeForward=glance<.05;report.headX=headX;report.headY=headY;report.headZ=headZ;
      }
      if(actor.sadBlend>.001){for(const parameter of activeAsset.sadParameters||[]){const current=modern?core.getParameterValueById(parameter.id):core.getParamFloat(parameter.id);const target=parameter.blend==='Multiply'?current*parameter.value:parameter.blend==='Overwrite'?parameter.value:current+parameter.value;const value=current+(target-current)*actor.sadBlend;if(modern)core.setParameterValueById(parameter.id,value);else core.setParamFloat(parameter.id,value);}report.sadParameterCount=(activeAsset.sadParameters||[]).length;}
      if(modern){
        if(activeAsset.idleExpression&&idle&&actor.sadBlend>.001)core.setParameterValueById('ParamMouthForm',core.getParameterValueById('ParamMouthForm')*(1-actor.sadBlend));
        report.mouthForm=core.getParameterValueById('ParamMouthForm');report.eyeOpen=core.getParameterValueById('ParamEyeLOpen');
      }
      {
        let rms=0;if(report.voicePlaying&&voiceActor===actor&&voiceAnalyser){voiceAnalyser.getByteTimeDomainData(voiceSamples);for(const value of voiceSamples){const sample=(value-128)/128;rms+=sample*sample;}rms=Math.sqrt(rms/voiceSamples.length);}
        const target=report.voicePlaying&&voiceActor===actor?Math.min(1,Math.max(0,(rms-.012)*9)):0;
        const dt=Math.min(app.ticker.deltaMS/1000,.1);actor.lip+=(target-actor.lip)*(1-Math.exp(-dt/(target>actor.lip?.045:.11)));
        if((report.voicePlaying&&voiceActor===actor)||actor.lip>.01){if(modern)core.setParameterValueById('ParamMouthOpenY',actor.lip);else core.setParamFloat('PARAM_MOUTH_OPEN_Y',actor.lip);}
        actor.mouthOpen=modern?core.getParameterValueById('ParamMouthOpenY'):core.getParamFloat('PARAM_MOUTH_OPEN_Y');report.voiceRMS=rms;report.lipLevel=actor.lip;report.mouthOpen=modern?core.getParameterValueById('ParamMouthOpenY'):core.getParamFloat('PARAM_MOUTH_OPEN_Y');
      }
      const other=actors[1-actor.slot];
      if(actor.socialBlend>.001&&other?.model){
        const dx=other.model.x-model.x,direction=Math.abs(dx)>innerWidth*.03?Math.sign(dx):(actor.slot?1:-1);
        const ownY=actor.eyeAlignment?.y||model.y,otherY=other.eyeAlignment?.y||other.model.y,dy=(ownY-otherY)/innerHeight;
        const phase=actor.socialTime-.9+actor.slot*.25,nod=phase>=0&&(phase%6)<1.2?-3*Math.sin(Math.PI*(phase%6)/1.2)**2:0,b=actor.socialBlend;
        for(const [id,target] of [['PARAM_ANGLE_X',actor.socialAim*10],['PARAM_ANGLE_Y',Math.max(-4,Math.min(4,dy*8))+nod],['PARAM_EYE_BALL_X',actor.socialAim*.38],['PARAM_EYE_BALL_Y',Math.max(-.2,Math.min(.2,dy*2))],['PARAM_MOUTH_FORM',Math.max(get('PARAM_MOUTH_FORM'),actor.socialMode==='dialogue'?.35:.65)]])set(id,get(id)*(1-b)+target*b);
        actor.socialLook={mode:actor.socialMode,blend:b,direction,headX:get('PARAM_ANGLE_X'),eyeX:get('PARAM_EYE_BALL_X'),nod,smile:get('PARAM_MOUTH_FORM')};
      }else actor.socialLook=null;
      if(actor.musicBlend<.001)return;
      for(const [id,target] of [['PARAM_EYE_L_OPEN',0],['PARAM_EYE_R_OPEN',0],['PARAM_ANGLE_Z',sway*3],['PARAM_ANGLE_X',sway*2],['PARAM_BODY_ANGLE_X',sway*2],['PARAM_BODY_ANGLE_Z',sway*5]]){
        set(id,get(id)*(1-actor.musicBlend)+target*actor.musicBlend);
      }
      report.musicEyeLeft=get('PARAM_EYE_L_OPEN');report.musicEyeRight=get('PARAM_EYE_R_OPEN');
      report.musicSway=sway;
      report.musicBodyAngleZ=get('PARAM_BODY_ANGLE_Z');
    });
    }
    function newActor(slot,asset,next){return {slot,asset,model:next.candidate,actions:next.available,group:'idle',finished:true,taps:0,gap:randomGap(),lastVoice:-1,interactionUntil:0,musicBlend:0,musicPhase:0,sadBlend:0,lip:0,socialBlend:0,socialTime:0,socialMode:null,socialAim:0};}
    function updateReport(){report.compatibility=window.refreshPetCompatibility?.(false);const bases=new Set(actors.filter(a=>a?.model).flatMap(a=>a.model.textures.map(t=>t.baseTexture)));report.textureBytes=[...bases].reduce((sum,t)=>sum+t.width*t.height*4,0);report.cachedExpressions=actors.filter(a=>a?.model).map(a=>({slot:a.slot,count:a.model.internalModel.motionManager.expressionManager?.expressions.filter(Boolean).length||0}));report.cachedMotions=actors.filter(a=>a?.model).map(a=>({slot:a.slot,count:Object.values(a.model.internalModel.motionManager.motionGroups).reduce((sum,items)=>sum+items.filter(Boolean).length,0)}));const primary=actors[0];model=primary?.model;activeAsset=primary?.asset||activeAsset;actions=primary?.actions||[];report.activeModelCount=actors.filter(a=>a?.model).length;report.textureCacheCount=Object.keys(PIXI.utils.TextureCache).length;report.baseTextureCacheCount=Object.keys(PIXI.utils.BaseTextureCache).length;report.actors=actors.filter(a=>a?.model).map(a=>({slot:a.slot,key:a.asset.key,taps:a.taps,lip:a.lip,mouth:a.mouthOpen,action:a.lastAction,social:a.socialLook,physicsReplays:a.physicsReplays||0,textureSizes:a.model.textures.map(t=>[t.width,t.height])}));if(primary){report.character=primary.asset.key.split('/')[0];report.outfit=primary.asset.key.split('/')[1];report.modelFormat=primary.asset.settings.Version===3?'moc3':'moc';report.availableActions=primary.actions;report.loadedActionCount=primary.actions.length;report.voiceCount=primary.asset.voices.length;report.textureValidity=actors.filter(a=>a?.model).flatMap(a=>a.model.textures.map(t=>!!(t.valid&&t.baseTexture&&!t.baseTexture.destroyed)));}}
    async function install(slot,asset){const next=await prepare(asset),actor=newActor(slot,asset,next);actors[slot]=actor;attach(actor);app.stage.addChild(actor.model);fit();await actor.model.motion('idle',0,1);if(asset.idleExpression){await actor.model.expression(asset.idleExpression);report.restingExpression=asset.idleExpression;}updateReport();return actor;}
    function releaseActor(slot){const actor=actors[slot];if(!actor)return;actors[slot]=null;app.stage.removeChild(actor.model);disposeModel(actor.model,null);actor.model=null;report.disposedModels=(report.disposedModels||0)+1;updateReport();}
    const characterBounds=new WeakMap();
    function visibleBounds(candidate){
      if(characterBounds.has(candidate))return characterBounds.get(candidate);
      candidate.deltaTime=Math.max(candidate.deltaTime,1);app.renderer.render(candidate);
      const internal=candidate.internalModel,core=internal.coreModel,modern=typeof core.getParameterValueById==='function';
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      for(const id of internal.getDrawableIDs()){
        const index=internal.getDrawableIndex(id);
        if(modern&&core.getDrawableOpacity(index)<.01)continue;
        const vertices=internal.getDrawableVertices(index);
        for(let i=0;i<vertices.length;i+=2){const point=internal.localTransform.apply({x:vertices[i],y:vertices[i+1]});left=Math.min(left,point.x);right=Math.max(right,point.x);top=Math.min(top,point.y);bottom=Math.max(bottom,point.y);}
      }
      const bounds=Number.isFinite(left)&&right>left&&bottom>top?{x:left,y:top,width:right-left,height:bottom-top}:{x:0,y:0,width:internal.width,height:internal.height};
      characterBounds.set(candidate,bounds);return bounds;
    }
    const eyeReferences=new WeakMap();
    function eyeReference(candidate){
      if(eyeReferences.has(candidate))return eyeReferences.get(candidate);
      const internal=candidate.internalModel,core=internal.coreModel,visible=visibleBounds(candidate),modern=typeof core.getParameterValueById==='function',id=modern?'ParamEyeBallX':'PARAM_EYE_BALL_X';
      const get=()=>modern?core.getParameterValueById(id):core.getParamFloat(id),set=v=>modern?core.setParameterValueById(id,v):core.setParamFloat(id,v),saved=get(),snapshots=new Map(),parts=[];
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      try{set(-.5);core.update();for(const mesh of internal.getDrawableIDs()){const index=internal.getDrawableIndex(mesh);snapshots.set(mesh,new Float32Array(internal.getDrawableVertices(index)));}
        set(.5);core.update();for(const mesh of internal.getDrawableIDs()){
          const index=internal.getDrawableIndex(mesh);if(modern&&core.getDrawableOpacity(index)<.01)continue;const before=snapshots.get(mesh),after=internal.getDrawableVertices(index);let moved=false,l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
          for(let i=0;i<after.length;i+=2){if(Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])> .00001) moved=true;const point=internal.localTransform.apply({x:(after[i]+before[i])/2,y:(after[i+1]+before[i+1])/2});l=Math.min(l,point.x);r=Math.max(r,point.x);t=Math.min(t,point.y);b=Math.max(b,point.y);}
          if(!moved||t<visible.y||b>visible.y+visible.height*.4||b-t>visible.height*.15||r-l>visible.width*.5)continue;
          parts.push((l+r)/2);left=Math.min(left,l);right=Math.max(right,r);top=Math.min(top,t);bottom=Math.max(bottom,b);
        }
      }finally{set(saved);core.update();}
      const valid=Number.isFinite(left)&&right-left>visible.width*.06&&right-left<visible.width*.7;
      const center=(left+right)/2,median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)],L=parts.filter(x=>x<center-visible.width*.015),R=parts.filter(x=>x>center+visible.width*.015),gap=L.length&&R.length?median(R)-median(L):0;const reference=valid?{x:center,y:(top+bottom)/2,span:gap>visible.width*.035?gap:(right-left)*.62,measured:true}:{x:visible.x+visible.width/2,y:visible.y+visible.height*.16,span:visible.height*(modern?.062:.093),measured:false};
      eyeReferences.set(candidate,reference);return reference;
    }
    let rendererLayout=null;
    function fit() {
      if(!runtimeVisible()){report.layoutPending=true;return;}report.layoutPending=false;
      const reduced=themePreferences.fps===15||report.powerSaving||lowBattery||thermalLimited;
      const compact=window.petCompatibility?.model==='25098PN5AC'||innerWidth<=920&&innerHeight<=620;
      const base=themePreferences.duoEnabled?(reduced||compact?.75:.85):(reduced||compact?.85:1);
      const resolution=Math.round(base*qualityScale*100)/100;
      if(!rendererLayout||rendererLayout.resolution!==resolution||rendererLayout.width!==innerWidth||rendererLayout.height!==innerHeight){app.renderer.resolution=resolution;app.renderer.resize(innerWidth,innerHeight);rendererLayout={resolution,width:innerWidth,height:innerHeight};report.canvasResizes=(report.canvasResizes||0)+1;}report.renderResolution=resolution;
      const active=actors.filter(a=>a?.model),duo=themePreferences.duoEnabled;
      const targetEyeSpan=innerHeight*.062;
      const commonWidthFactor=duo?Math.min(1,...active.map(a=>{const b=visibleBounds(a.model),eye=eyeReference(a.model);return innerWidth*.33/(b.width*targetEyeSpan/eye.span);})):1;
      for(const actor of active){const candidate=actor.model,internal=candidate.internalModel,visible=visibleBounds(candidate),eye=duo?eyeReference(candidate):null;
        const scale=themePreferences[actor.slot?'secondScale':'modelScale'],x=themePreferences[actor.slot?'secondX':'modelX'],y=themePreferences[actor.slot?'secondY':'modelY'];
        const anchorY=duo?eye.y:visible.y+visible.height/2,anchorX=visible.x+visible.width/2;
        candidate.anchor.set(anchorX/internal.width,anchorY/internal.height);candidate.scale.set((duo?targetEyeSpan/eye.span*commonWidthFactor:Math.min(innerHeight*.95/visible.height,innerWidth*.50/visible.width))*scale);candidate.position.set(innerWidth*x,innerHeight*(duo?y-.29:y));
        actor.visibleBounds={x:candidate.x+(visible.x-anchorX)*candidate.scale.x,y:candidate.y+(visible.y-anchorY)*candidate.scale.y,width:visible.width*candidate.scale.x,height:visible.height*candidate.scale.y};
        actor.eyeAlignment=duo?{span:eye.span*candidate.scale.x,y:candidate.y,measured:eye.measured}:null;
        if(!actor.slot){report.modelScale=scale;report.modelX=x;report.modelY=y;report.bounds=candidate.getBounds();report.visibleBounds=actor.visibleBounds;}
      }
      report.actorPositions=active.map(a=>({slot:a.slot,...a.visibleBounds,eye:a.eyeAlignment}));if(!frameLoop.active&&runtimeVisible())app.renderer.render(app.stage);
    }
    window.onModelChange=fit;
    async function replaceActor(slot,character,outfit){
      const previous=actors[slot]?.asset;report.switchPhase='release';releaseActor(slot);report.modelsDuringLoad=actors.filter(a=>a?.model).length;
      try{report.switchPhase='prepare';await install(slot,await loadAsset(character,outfit));report.switchPhase='done';window.refreshPetFeatures?.();}
      catch(error){report.switchPhase='rollback';if(previous)await install(slot,previous);throw error;}
    }
    window.onPetChange=async(character,outfit,slot=0)=>{
      if(actors[slot]?.model&&actors[slot].asset.key===character+'/'+outfit)return;
      if(switching)throw Error('正在加载角色，请稍后');switching=true;cancelSpeech();cancelSocial();say('ANON 66 · 切换中');
      try{await replaceActor(slot,character,outfit);report.taps=0;report.action='';report.actionFinished=true;report.voiceClip=0;report.voiceClicksRemaining=randomGap();say('ANON 66 · '+petCatalog.find(m=>m.id===character).name+' · 就绪');}finally{switching=false;}
    };
    window.onDuoChange=async()=>{
      if(switching)throw Error('正在加载角色，请稍后');switching=true;cancelSpeech();cancelSocial();
      try{for(const slot of [0,1]){if(slot&&!themePreferences.duoEnabled){releaseActor(1);continue;}const character=themePreferences[slot?'secondCharacter':'character'],outfit=themePreferences[slot?'secondOutfit':'outfit'];if(actors[slot]?.asset.key!==character+'/'+outfit||!actors[slot]?.model)await replaceActor(slot,character,outfit);}fit();updateReport();}
      catch(e){themePreferences.duoEnabled=false;releaseActor(1);throw e;}finally{switching=false;}
    };
    let settingsPreviewUntil=0,settingsPauseTimer=null;
    function settingsStatic(){if(['voice','voice-picker'].includes(report.settingsPage)&&report.voicePlaying)return false;return report.settingsOpen&&(!['character','outfit','duo','color'].includes(report.settingsPage)||performance.now()>=settingsPreviewUntil);}
    let lastHostRate=-1,settingsBurstUntil=0,settingsHostTimer=null;
    function syncHostFPS(){const rate=report.suspended?1:report.settingsOpen?(performance.now()<settingsBurstUntil?30:1):15;if(rate===lastHostRate)return;try{if(typeof window.maml?.doAction==='function'){window.maml.doAction(rate===1?'petHostIdle':rate===30?'petHostUI':'petHostActive');lastHostRate=rate;report.hostRequestedFPS=rate;}}catch(e){report.hostRateError=String(e);}}
    function syncFPS(){syncHostFPS();const preferred=[15,30,60].includes(themePreferences.fps)?themePreferences.fps:30;const preview=['character','outfit','duo'].includes(report.settingsPage);const busy=switching||dialogueBusy||gestureBusy||report.voicePlaying||actors.some(a=>a?.model&&(performance.now()<a.interactionUntil||a.group!=='idle'&&!a.finished));const idleSaving=themePreferences.smartPower===true&&!busy;report.smartPower=themePreferences.smartPower===true;report.smartPowerIdle=idleSaving;const target=report.settingsOpen?(preview?Math.min(preferred,15):10):idleSaving?15:preferred;frameLoop.setFPS(target);report.targetFPS=target;const reduced=themePreferences.fps===15||report.powerSaving||lowBattery||thermalLimited;if(report.reducedRendering!==reduced){report.reducedRendering=reduced;fit();}}
    window.onFrameRateChange=syncFPS;
    window.getPetVoiceChoices=slot=>(actors[slot]?.asset.voices||[]).map((file,index)=>{const asset=actors[slot].asset,entry=asset.voiceInteractions?.[index],source=entry?.text||'',note=themePreferences.voiceNotes?.[asset.key.split('/')[0]]?.[file],auto=entry?.transcriptStatus==='auto_unverified';return {file,text:(note||source||'语音 '+(index+1)).slice(0,160),verified:!!source&&!auto&&!/^(人物介绍|登录问候|故事提示|语音\s*\d)/.test(source),auto,custom:!!note};});
    window.previewPetVoice=(slot,file)=>{const actor=actors[slot];if(!actor||!actor.asset.voices.includes(file)||report.suspended||switching)return false;cancelSpeech();const index=actor.asset.voices.indexOf(file);report.voiceClip=index+1;return startClip(actor,file,actor.asset.voiceInteractions?.[index]?.text||'');};
    const voiceState=()=>{if(!report.settingsOpen||!['voice','voice-picker'].includes(report.settingsPage)||!runtimeVisible()||sleeping)return;syncFPS();if(report.voicePlaying)app.start();else{app.stop();for(const actor of actors)if(actor?.model){actor.lip=0;actor.model.update(33);}app.renderer.render(app.stage);}};
    for(const event of ['playing','ended','pause'])voice.addEventListener(event,voiceState);
    await install(0,activeAsset);if(themePreferences.duoEnabled)await install(1,await loadAsset(themePreferences.secondCharacter,themePreferences.secondOutfit));
    fit();window.addEventListener('resize',fit);
    function matchingDialogues(){if(!themePreferences.duoEnabled||actors.some(a=>!a?.model))return [];const keys=actors.map(a=>a.asset.key.split('/')[0]);return (window.petDialogues||[]).filter(d=>d.members.length===2&&new Set(keys).size===2&&d.members.every(id=>keys.includes(id)));}
    function currentDialogue(){return matchingDialogues()[0]||null;}
    window.getPetDialogue=currentDialogue;window.onDialogueChange=cancelSpeech;window.refreshPetFeatures?.();
    async function interact(actor,interaction){const candidate=actor.model;if(!candidate)return false;actor.interactionUntil=performance.now()+650;syncFPS();const groups=actor.asset.settings.motions||actor.asset.settings.FileReferences.Motions;let action=groups[interaction?.action]?interaction.action:actor.actions[(actor.taps-1+actor.actions.length)%actor.actions.length];if(actor.group===action&&!actor.finished)action=actor.actions.find(name=>name!==action)||action;const started=await candidate.motion(action,0,3);if(actor.model!==candidate)return false;const definitions=actor.asset.settings.expressions||actor.asset.settings.FileReferences.Expressions||[];const wanted=interaction?.expression||actor.asset.interactionExpressions?.[action];const expression=definitions.some(e=>(e.name||e.Name)===wanted)?wanted:null;if(expression)await candidate.expression(expression);actor.lastAction=action;if(!actor.slot){report.action=action;report.expression=expression||'';}return started;}
    let nextDialogue=performance.now()+60000;
    window.playPetDialogue=async()=>{
      const choices=matchingDialogues(),d=choices[Math.floor(Math.random()*choices.length)];if(!d||!themePreferences.dialogueEnabled||dialogueBusy||switching||report.suspended||!voice.paused)return false;
      socialUntil=0;dialogueBusy=true;report.dialoguePlaying=true;const token=++dialogueToken;report.dialogueTurns=0;
      try{for(const turn of d.turns){if(token!==dialogueToken||report.suspended||!themePreferences.dialogueEnabled)break;const actor=actors.find(a=>a?.asset.key.split('/')[0]===turn.character);if(!actor)break;await interact(actor,turn);if(token!==dialogueToken||report.suspended)break;
          await new Promise(resolve=>{let timeout;const done=()=>{clearTimeout(timeout);for(const event of ['ended','error','pause'])voice.removeEventListener(event,done);resolve();};for(const event of ['ended','error','pause'])voice.addEventListener(event,done,{once:true});timeout=setTimeout(()=>{stopVoice();done();},20000);if(!startClip(actor,turn.file,turn.text))done();});report.dialogueTurns++;
        }return token===dialogueToken;
      }finally{if(token===dialogueToken){dialogueBusy=false;report.dialoguePlaying=false;}nextDialogue=performance.now()+90000+Math.random()*60000;}
    };
    let lastGesturePoll=0,lastGestureSequence=0;
    window.onGestureDisabled=()=>{if(!themePreferences.gestureEnabled&&!report.gestureActive&&!gestureBusy)return;if(gestureBusy)cancelSpeech();try{window.maml?.doAction?.('stopPetGesture');}catch(e){report.gestureError=String(e);}};
    window.startPetGestureSession=()=>{try{if(typeof window.maml?.doAction!=='function')return false;window.maml.doAction('startPetGesture');return true;}catch(e){report.gestureError=String(e);return false;}};
    window.onPetGesture=async code=>{
      if(!themePreferences.gestureEnabled||![1,2].includes(code)||report.suspended||report.settingsOpen||switching||gestureBusy||performance.now()<gestureReadyAt||dialogueBusy||!voice.paused)return false;
      const active=actors.filter(a=>a?.model);if(!active.length)return false;gestureBusy=true;gestureReadyAt=performance.now()+2500;const token=++gestureToken;
      const label={1:'比耶',2:'单手比心'}[code],preferred={1:['wink01','kime01','smile02'],2:['smile02','smile01','kandou01']}[code];
      report.gestureCount=(report.gestureCount||0)+1;report.gesture=label;report.gestureActions=[];report.gestureVoiceActors=[];
      try{const results=await Promise.allSettled(active.map(async actor=>{const action=preferred.find(name=>actor.actions.includes(name))||actor.actions[0];await interact(actor,{action});report.gestureActions.push({slot:actor.slot,action});}));for(const result of results)if(result.status==='rejected')throw result.reason;
        if(token!==gestureToken)return false;say('ANON 66 · 手势 '+label);
        if(themePreferences.voiceEnabled)for(const actor of active){if(token!==gestureToken||!actor.model||report.suspended)break;const pattern=code===2?/开心|谢谢|喜欢|嬉|ありが|好き/i:/加油|厉害|不错|成功|頑張|すご|最高/i;const choices=(actor.asset.voiceInteractions||[]).map((v,i)=>({v,i})).filter(({v})=>pattern.test(v.text||'')),chosen=choices.length?choices[Math.floor(Math.random()*choices.length)]:null,index=chosen?chosen.i:Math.floor(Math.random()*actor.asset.voices.length),file=actor.asset.voices[index];if(!file)continue;
          await new Promise(resolve=>{let timeout;const done=()=>{clearTimeout(timeout);for(const event of ['ended','pause','error'])voice.removeEventListener(event,done);resolve();};for(const event of ['ended','pause','error'])voice.addEventListener(event,done,{once:true});timeout=setTimeout(()=>{stopVoice();done();},15000);report.gestureVoiceActors.push(actor.slot);if(!startClip(actor,file,chosen?.v.text||''))done();});
        }return token===gestureToken;
      }catch(e){report.gestureError=String(e);return false;}finally{if(token===gestureToken){gestureBusy=false;gestureReadyAt=Math.max(gestureReadyAt,performance.now()+1000);}}
    };
    function readGestureBridge(now){if(!themePreferences.gestureEnabled||now-lastGesturePoll<200||report.settingsOpen||switching||!window.maml||typeof maml.getDoubleByName!=='function')return;lastGesturePoll=now;
      try{const sequence=Number(maml.getDoubleByName('anon_gesture_seq'));if(!sequence||sequence===lastGestureSequence)return;lastGestureSequence=sequence;report.gestureActive=Number(maml.getDoubleByName('anon_gesture_active'))===1;const code=Number(maml.getDoubleByName('anon_gesture_code')),stamp=Number(maml.getDoubleByName('anon_gesture_stamp')),age=(Date.now()%2000000000-stamp+2000000000)%2000000000;if(report.gestureActive&&age<2500)window.onPetGesture(code).catch(e=>report.gestureError=String(e));}catch(e){report.gestureError=String(e);}
    }
    let lastHour=new Date().getHours(),lastEventCheck=-1000,previousPlugged=null,lastChargeEvent=-Infinity,lastReminder='';
    function eventVoice(kind){
      if(dialogueBusy||switching||!voice.paused||report.suspended||report.settingsOpen||lowBattery)return false;
      const candidates=actors.filter(a=>a?.model&&(kind!=='charging'||a.asset.chargingVoice));if(!candidates.length){report.chargingVoiceUnavailable=true;return false;}const actor=candidates[Math.floor(Math.random()*candidates.length)],asset=actor.asset;
      const index=Math.floor(Math.random()*asset.voices.length),entry=kind==='charging'?asset.chargingVoice:asset.voiceInteractions?.[index],file=kind==='charging'?entry.file:asset.voices[index];if(!file)return false;
      interact(actor,entry).catch(e=>report.eventError=String(e));const ok=startClip(actor,file,entry?.text||'');if(ok){report.lastEvent=kind;report.eventCount=(report.eventCount||0)+1;say(kind==='hourly'?'整点提醒 · '+new Date().getHours()+':00':'充电中 · '+petCatalog.find(m=>m.id===actor.asset.key.split('/')[0]).name);}return ok;
    }
    function checkEvents(now,date=new Date()){
      if(now-lastEventCheck<1000)return;lastEventCheck=now;const hour=date.getHours(),key=date.getFullYear()+'-'+date.getMonth()+'-'+date.getDate()+'-'+hour;
      if(hour!==lastHour&&date.getMinutes()===0&&date.getSeconds()<10&&themePreferences.hourlyEnabled&&!lowBattery&&!report.settingsOpen&&lastReminder!==key){let saved='';try{saved=localStorage.getItem('pet-last-hour')||'';}catch(e){}if(saved!==key&&eventVoice('hourly')){lastReminder=key;try{localStorage.setItem('pet-last-hour',key);}catch(e){}}}lastHour=hour;
      if(window.maml&&typeof maml.getDoubleByName==='function'){const plugged=Number(maml.getDoubleByName('anon_battery_plugged'));if([0,1,2,4].includes(plugged)){if(previousPlugged!==null&&![1,2].includes(previousPlugged)&&[1,2].includes(plugged)&&themePreferences.chargingEnabled&&now-lastChargeEvent>60000){let saved=0;try{saved=Number(localStorage.getItem('pet-last-charge'));}catch(e){}if(Date.now()-saved>60000&&eventVoice('charging')){lastChargeEvent=now;try{localStorage.setItem('pet-last-charge',Date.now());}catch(e){}}}previousPlugged=plugged;report.charging=plugged>0;}}
      if(themePreferences.dialogueEnabled&&!lowBattery&&!report.settingsOpen&&now>=nextDialogue){nextDialogue=now+90000;window.playPetDialogue().catch(e=>report.dialogueError=String(e));}
    }
    let frames=0,sampleTime=performance.now();
    app.ticker.add(()=>{
      const tickNow=performance.now(),dt=Math.min(app.ticker.deltaMS,150)/1000;
      readMusicBridge(tickNow);readBattery(tickNow);readGestureBridge(tickNow);
      const freshAudio=audioActive&&tickNow-lastAudio<1500;
      const heardMusic=musicPlaying;
      syncFPS();checkEvents(tickNow);updateSocial(tickNow,dt);
      for(const actor of actors){if(!actor?.model)continue;const clicking=dialogueBusy||actor.socialBlend>.05||tickNow<actor.interactionUntil||(actor.group!=='idle'&&!actor.finished)||voiceActor===actor&&report.voicePlaying;
        actor.musicBlend+=((heardMusic&&!clicking?1:0)-actor.musicBlend)*(1-Math.exp(-dt/.22));actor.sadBlend+=((lowBattery&&!clicking&&!heardMusic?1:0)-actor.sadBlend)*(1-Math.exp(-dt/.35));
        if(actor.musicBlend>.001)actor.musicPhase+=dt*Math.PI*2/2.8;else actor.musicPhase=0;if(!report.settingsOpen||['character','outfit','duo'].includes(report.settingsPage)||report.voicePlaying&&voiceActor===actor)actor.model.update(Math.min(app.ticker.deltaMS,150));const stats=report.actors?.find(a=>a.slot===actor.slot);if(stats){stats.lip=actor.lip;stats.mouth=actor.mouthOpen;stats.social=actor.socialLook;}if(!actor.slot){report.sadBlend=actor.sadBlend;report.enjoyingMusic=heardMusic&&!clicking;report.musicBlend=actor.musicBlend;report.musicRotationDeg=0;}
      }
      const playbackWave=window.themePreferences.waveSource==='playback';
      const enabled=!thermalLimited&&window.themePreferences.waveEnabled&&(!report.settingsOpen||report.settingsPage==='color')&&(playbackWave?musicPlaying:freshAudio);
      if(report.waveVisible||enabled)wave.clear();if(waveBars)waveBars.visible=false;let peak=0;const blend=1-Math.exp(-app.ticker.deltaMS/100);
      for(let i=0;i<24;i++){const target=enabled&&!playbackWave?levels[i]:0;smoothed[i]+=(target-smoothed[i])*blend;peak=Math.max(peak,smoothed[i]);}
      waveAlpha+=((enabled&&playbackWave?1:0)-waveAlpha)*(1-Math.exp(-dt*4));
      report.waveVisible=playbackWave?waveAlpha>.01:enabled&&peak>.01;
      const color=parseInt(window.themePreferences.wave.slice(1),16);
      if(playbackWave&&report.waveVisible){
        waveTime+=dt;waveBeat=Math.max(0,waveBeat-dt*3);if(enabled&&Math.random()<dt*2.4)waveBeat=1;
        const blockH=13,gap=3,barGap=5,left=innerWidth*.02,span=innerWidth*.96,barW=(span-barGap*29)/28,base=innerHeight-18,maxBlocks=Math.max(1,Math.floor(innerHeight*.42/(blockH+gap)));
        let blocks=0;const counts=waveCounts;
        for(let i=0;i<28;i++){
          let target=(.75+.15*Math.sin(waveTime*3.1+i*.4)+.11*Math.sin(waveTime*5.7+i*.95)+.08*Math.sin(waveTime*1.7+i*.2))*(1-.55*i/27)*(.55+.65*waveBeat)*(.85+.15*Math.sin(waveTime*11+i*2.3));
          target=Math.max(0,Math.min(1,target));const rate=target>simulatedLevels[i]?13:6;
          simulatedLevels[i]+=(target-simulatedLevels[i])*(1-Math.exp(-dt*rate));
          const count=Math.round(simulatedLevels[i]*maxBlocks);counts[i]=count;blocks+=count;
        }
        drawWaveBars(counts,color,waveAlpha,barW,blockH+gap,maxBlocks,left,barGap,base);
        report.waveStyle='stacked';report.waveBlocks=blocks;
      }else if(!playbackWave&&report.waveVisible){const left=innerWidth*.36,width=innerWidth*.57/24,base=innerHeight*.69;
        wave.beginFill(color,.4);for(let i=0;i<24;i++){const height=smoothed[i]*innerHeight*.42;wave.drawRect(left+i*width,base-height/2,Math.max(1,width*.45),height);}wave.endFill();}
      report.renderFrames=(report.renderFrames||0)+1;frames++;const now=performance.now();
      if(now-sampleTime>=1000){report.measuredFPS=Math.round(frames*1000/(now-sampleTime));frames=0;sampleTime=now;updateReport();display();}
      if(now-lastQualityCheck>5000&&!report.settingsOpen&&!switching){lastQualityCheck=now;const budget=1000/report.targetFPS;if(renderWork>budget*.75&&qualityScale>.8){qualityScale=Math.max(.8,qualityScale-.1);report.qualityScale=qualityScale;fit();}}
    });
    function nativeFrame(){
      const layer=document.getElementById('native-freeze-frame'),wanted=themePreferences.dimFreeze&&(nativeDim||hostPaused)&&report.nativeDisplaySupported&&!contextLost;
      if(!wanted){if(runtimeVisible()&&sleeping)return;nativeFrameTicket++;nativeFramePending=false;layer.hidden=true;layer.onload=null;layer.removeAttribute('src');app.view.style.visibility='visible';if(nativeFrameURL)URL.revokeObjectURL(nativeFrameURL);nativeFrameURL=null;report.nativeFrozen=false;return;}
      if(nativeFramePending||nativeFrameURL||!actors.some(a=>a?.model))return;nativeFramePending=true;const ticket=++nativeFrameTicket;try{app.stop();for(const actor of actors)if(actor?.model)actor.model.update(1);app.renderer.render(app.stage);const copy=document.createElement('canvas');copy.width=app.view.width;copy.height=app.view.height;copy.getContext('2d').drawImage(app.view,0,0);copy.toBlob(blob=>{copy.width=copy.height=1;nativeFramePending=false;if(ticket!==nativeFrameTicket||!themePreferences.dimFreeze||!(nativeDim||hostPaused)||!blob)return;nativeFrameURL=URL.createObjectURL(blob);layer.onload=()=>{if(ticket!==nativeFrameTicket||!(nativeDim||hostPaused))return;app.view.style.visibility='hidden';layer.hidden=false;report.nativeFrozen=true;};layer.src=nativeFrameURL;},'image/png');}catch(e){nativeFramePending=false;report.nativeFreezeError=String(e);}
    }
    function requestNativeDisplay(){try{window.maml?.doAction?.('readNativeRearDisplay');}catch(e){report.nativeFreezeError=String(e);}}
    function syncNativePoll(){clearInterval(nativePoll);nativePoll=null;if(themePreferences.dimFreeze&&report.nativeDisplaySupported&&!hostPaused&&!lifecyclePaused&&!document.hidden&&!contextLost&&nativeState!==1){nativePoll=setInterval(requestNativeDisplay,2000);}}
    window.petNativeDisplayState=(state,id)=>{state=Number(state);nativeState=state;report.nativeDisplayState=state;report.nativeDisplaySupported=Number(id)===1&&[1,2,3,4,5,6].includes(state);window.refreshPetFeatures?.();const dim=themePreferences.dimFreeze&&report.nativeDisplaySupported&&[1,3,4].includes(state)&&performance.now()>=nativeWakeUntil;if(dim!==nativeDim){nativeDim=dim;syncLifecycle();}else syncNativePoll();};
    window.onDimFreezeChange=()=>{if(!themePreferences.dimFreeze)nativeDim=false;syncLifecycle();requestNativeDisplay();};
    function wakeNativeFreeze(){if(!themePreferences.dimFreeze||!nativeDim)return;nativeWakeUntil=performance.now()+3000;nativeDim=false;nativeState=-1;hostPaused=false;window.__petHostPaused=false;syncLifecycle();requestNativeDisplay();}
    for(const event of ['touchstart','pointerdown'])document.addEventListener(event,wakeNativeFreeze,{capture:true,passive:true});
    function runtimeVisible(){return !hostPaused&&!nativeDim&&!lifecyclePaused&&!document.hidden&&!contextLost;}
    function releaseHiddenResources(force=false){clearTimeout(releaseTimer);releaseTimer=null;if(runtimeVisible()&&!force)return;if(switching||resuming){scheduleRelease();return;}
      releaseActor(1);releaseActor(0);releaseWaveBars();wave.clear();if(!contextLost){app.renderer.textureGC.run();}
      if(!report.nativeFrozen){document.body.dataset.petSceneReady='false';window.setPetBackgroundActive?.(false);}if(!contextLost){app.renderer.resize(1,1);rendererLayout=null;report.layoutPending=true;}sleeping=true;report.resourcesUnloaded=true;
    }
    function scheduleRelease(){clearTimeout(releaseTimer);releaseTimer=setTimeout(releaseHiddenResources,20000);}
    async function restoreSleepingActors(){if(resuming||!sleeping)return;resuming=true;switching=true;say('ANON 66 · 恢复中');
      try{await install(0,await loadAsset(themePreferences.character,themePreferences.outfit));if(!runtimeVisible()){releaseActor(0);return;}if(themePreferences.duoEnabled)await install(1,await loadAsset(themePreferences.secondCharacter,themePreferences.secondOutfit));if(!runtimeVisible()){releaseActor(1);releaseActor(0);return;}
        window.setPetBackgroundActive?.(true);await window.waitForPetBackground?.();if(!runtimeVisible()){releaseActor(1);releaseActor(0);return;}for(const actor of actors)if(actor?.model)actor.model.update(33);fit();app.renderer.render(app.stage);sleeping=false;report.resourcesUnloaded=false;document.body.dataset.petSceneReady='true';report.error='';say('ANON 66 · 就绪');window.petRuntimeReady?.();
      }catch(e){sleeping=false;releaseActor(1);releaseActor(0);report.error=String(e);say('恢复失败 · 请重新应用');window.petRuntimeFailure?.('角色资源恢复失败');}
      finally{resuming=false;switching=false;syncLifecycle();}}
    function syncLifecycle(){syncNativePoll();const active=runtimeVisible();nativeFrame();report.hostPaused=hostPaused;report.suspended=!active;window.petRuntimeActive=active;document.dispatchEvent(new Event('petvisibilitychange'));window.petDiagnostics?.setActive?.(active);syncHostFPS();if(window.setRuntimeActive)window.setRuntimeActive(active);cancelSocial();clearTimeout(releaseTimer);releaseTimer=null;clearInterval(gestureHeartbeat);gestureHeartbeat=null;
      if(active){window.refreshPetCompatibility?.();if(sleeping){if(!resuming)restoreSleepingActors();return;}sampleTime=performance.now();frames=0;lastMusicPoll=0;lastBatteryPoll=-5000;lastHour=new Date().getHours();previousPlugged=null;nextDialogue=performance.now()+60000;syncFPS();if(report.layoutPending)fit();if(settingsStatic())app.stop();else app.start();startMonitors();}
      else{app.stop();clearTimeout(settingsHostTimer);settingsBurstUntil=0;clearTimeout(settingsPauseTimer);window.onGestureDisabled();cancelSpeech();report.measuredFPS=0;scheduleRelease();}}
    window.petHostVisibility=active=>{if(active){nativeWakeUntil=performance.now()+3000;nativeDim=false;nativeState=-1;}const paused=!active;if(hostPaused===paused){if(active){syncLifecycle();requestNativeDisplay();}return;}hostPaused=paused;window.__petHostPaused=paused;window.petDiagnostics?.record('host_lifecycle',{stage:paused?'pause':'resume'});syncLifecycle();if(active){startMonitors();requestNativeDisplay();}};
    app.view.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;report.contextLost=true;report.contextLosses=(report.contextLosses||0)+1;syncLifecycle();releaseHiddenResources();say('渲染资源丢失 · 等待恢复');clearTimeout(contextTimer);contextTimer=setTimeout(()=>{if(contextLost)window.petRuntimeFailure?.('渲染资源暂未恢复');},8000);});
    app.view.addEventListener('webglcontextrestored',()=>{clearTimeout(contextTimer);let waits=0;const rebuild=()=>{if(switching||resuming){if(++waits>80){window.petRuntimeFailure?.('渲染恢复等待超时');return;}setTimeout(rebuild,100);return;}releaseHiddenResources(true);contextLost=false;report.contextLost=false;report.contextRestores=(report.contextRestores||0)+1;syncLifecycle();};rebuild();});
    document.addEventListener('visibilitychange',syncLifecycle);
    for(const event of ['pagehide','freeze'])window.addEventListener(event,()=>{lifecyclePaused=true;syncLifecycle();if(event==='freeze')releaseHiddenResources();});
    for(const event of ['pageshow','resume'])window.addEventListener(event,()=>{lifecyclePaused=false;syncLifecycle();});
    document.addEventListener('freeze',()=>{lifecyclePaused=true;syncLifecycle();releaseHiddenResources();});
    document.addEventListener('resume',()=>{lifecyclePaused=false;syncLifecycle();});
    window.onPetPanelStateChange=state=>{report.settingsOpen=state.open;report.settingsPage=state.page;report.settingsScenePaused=settingsStatic();if(state.open){cancelSpeech();cancelSocial();}wave.visible=!state.open||state.page==='color';syncFPS();if(runtimeVisible()&&!sleeping){if(settingsStatic()){app.stop();for(const actor of actors)if(actor?.model){actor.lip=0;actor.model.update(33);}app.renderer.render(app.stage);report.measuredFPS=0;display();}else{sampleTime=performance.now();frames=0;app.start();}}};
    window.onPetSettingsInteraction=()=>{if(!report.settingsOpen||!runtimeVisible()||sleeping)return;settingsBurstUntil=performance.now()+800;clearTimeout(settingsHostTimer);syncHostFPS();settingsHostTimer=setTimeout(syncHostFPS,820);if(!['character','outfit','duo','color'].includes(report.settingsPage))return;settingsPreviewUntil=performance.now()+400;report.settingsScenePaused=false;clearTimeout(settingsPauseTimer);syncFPS();app.start();settingsPauseTimer=setTimeout(()=>{if(report.settingsOpen&&settingsStatic()){app.stop();report.settingsScenePaused=true;report.measuredFPS=0;display();}},420);};
    const previousPanelChange=window.onPetPanelStateChange;window.onPetPanelStateChange=state=>{clearTimeout(settingsHostTimer);settingsBurstUntil=0;clearTimeout(settingsPauseTimer);settingsPreviewUntil=0;previousPanelChange(state);startMonitors();if(state.open){window.onGestureDisabled();window.onPetSettingsInteraction();}};
    function startMonitors(){if(!runtimeVisible()||report.settingsOpen){clearInterval(gestureHeartbeat);gestureHeartbeat=null;report.backgroundMonitorsPaused=true;return;}report.backgroundMonitorsPaused=false;if(!themePreferences.gestureEnabled){clearInterval(gestureHeartbeat);gestureHeartbeat=null;}if(themePreferences.gestureEnabled&&!gestureHeartbeat)gestureHeartbeat=setInterval(()=>{if(themePreferences.gestureEnabled&&report.gestureActive&&!report.settingsOpen){try{window.maml?.doAction?.('heartbeatPetGesture');}catch(e){report.gestureError=String(e);}}},5000);readBattery(performance.now());}
    syncLifecycle();startMonitors();window.onPetPanelStateChange(window.petPanelState||{open:false,page:'home'});
    let press=null;
    const canvas=app.view;
    canvas.addEventListener('touchstart',e=>{
      e.preventDefault();
      if(e.touches.length!==1){press=null;return;}
      const t=e.touches[0];press={x:t.clientX,y:t.clientY,time:Date.now(),moved:false};
    },{passive:false});
    canvas.addEventListener('touchmove',e=>{
      e.preventDefault();if(press&&e.touches.length===1){const t=e.touches[0];
        if(Math.abs(t.clientX-press.x)+Math.abs(t.clientY-press.y)>12)press.moved=true;}
      else press=null;
    },{passive:false});
    canvas.addEventListener('touchcancel',()=>{press=null;say('ANON 66 · 触摸取消');});
    canvas.addEventListener('touchend',async e=>{
      e.preventDefault();const point=press;press=null;
      if(report.settingsOpen||switching||!point||point.moved||e.touches.length||Date.now()-point.time>450)return;
      const candidates=actors.filter(a=>a?.model&&a.visibleBounds&&point.x>=a.visibleBounds.x&&point.x<=a.visibleBounds.x+a.visibleBounds.width&&point.y>=a.visibleBounds.y&&point.y<=a.visibleBounds.y+a.visibleBounds.height);
      const actor=candidates.sort((a,b)=>Math.abs(point.x-a.model.x)-Math.abs(point.x-b.model.x))[0];
      if(window.isPetCameraArea(point.x,point.y)||!actor)return;
      if(gestureBusy||dialogueBusy||report.voicePlaying&&voiceActor!==actor)cancelSpeech();
      const sequence=++tapSequence;
      actor.taps++;report.taps++;report.lastTapSlot=actor.slot;
      const fixedVoice=themePreferences.voiceSelections?.[actor.asset.key.split('/')[0]]?.mode==='fixed';const together=!fixedVoice&&themePreferences.dialogueEnabled&&currentDialogue()&&voice.paused&&Math.random()<.25,clip=together?null:playVoice(actor);try{await interact(actor,clip?.interaction);say('ANON 66 · 点击 '+report.taps+' · '+actor.asset.key.split('/')[0]);updateReport();if(sequence!==tapSequence)return;if(together)window.playPetDialogue().catch(e=>report.dialogueError=String(e));else if(clip)startClip(actor,clip.file,clip.text);}catch(err){report.error=String(err);say('动作错误：'+err.message);}
    },{passive:false});
    window.updatePetDeviceLayout();report.ready=true;report.bounds=model.getBounds();report.width=innerWidth;report.height=innerHeight;
    await window.waitForPetBackground?.();if(runtimeVisible()){for(const actor of actors)if(actor?.model)actor.model.update(33);fit();app.renderer.render(app.stage);}document.body.dataset.petSceneReady='true';report.sceneReady=true;say('ANON 66 · 就绪 · 轻点角色');window.petRuntimeReady?.();requestNativeDisplay();
  } catch(err) {report.error=String(err);say('加载失败：'+err.message);console.error(err);window.petRuntimeFailure?.('桌宠初始化失败');}
})();
