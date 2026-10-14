(function(){
  // Dimensions outside 17 Pro Max are preview targets, not device certification.
  const profiles=window.petDeviceProfiles=[
    {id:'17-pro',name:'小米 17 Pro',width:904,height:572,verified:false},
    {id:'17-pro-max',name:'小米 17 Pro Max',width:976,height:596,verified:true},
    {id:'18-pro',name:'小米 18 Pro',width:912,height:596,verified:false},
    {id:'18-pro-max',name:'小米 18 Pro Max',width:976,height:596,verified:false}
  ];
  function update(){
    const p=window.themePreferences||{},selected=profiles.find(item=>item.id===p.deviceProfile);
    const matches=profiles.filter(item=>item.width===innerWidth&&item.height===innerHeight);
    const cameraLeft=Number.isFinite(p.cameraReserve)?Math.max(.25,Math.min(.45,p.cameraReserve)):.35;
    const scale=Math.min(1,innerWidth/976,innerHeight/596);
    const layout=window.petDeviceLayout={profile:selected?.id||'auto',name:selected?.name||'自动按实际画面',width:innerWidth,height:innerHeight,
      reference:selected?[selected.width,selected.height]:null,matches:matches.map(item=>item.id),cameraLeft,uiScale:scale};
    const style=document.documentElement.style;style.setProperty('--pet-camera-left',cameraLeft*100+'vw');style.setProperty('--pet-ui-scale',scale);style.setProperty('--pet-edge',Math.max(28,innerWidth*.05)+'px');
    if(window.testReport)testReport.deviceLayout=layout;
    const runtime=window.refreshPetCompatibility?.();if(window.testReport)testReport.compatibility=runtime;const note=document.getElementById('device-note');if(note)note.textContent=`当前画面 ${innerWidth}×${innerHeight} · 左侧预留 ${Math.round(cameraLeft*100)}%\n布局按当前画面缩放；机型选择不改变屏幕分辨率。17 Pro Max 已实测，其余机型仅预适配，镜头位置与系统入口待验证。`+(runtime?`\n运行方式：${{'maml-enhanced':'背屏增强联动','maml-basic':'背屏基础读取',standalone:'独立预览'}[runtime.mode]||runtime.mode}\n背屏版本：${runtime.hostVersion||'未收到'} · Android API：${runtime.androidAPI||'未收到'}\n${runtime.issues.join('；')}`:'');
    if(window.onModelChange)window.onModelChange();
  }
  window.updatePetDeviceLayout=update;
  window.isPetCameraArea=(x,y)=>x>=0&&x<innerWidth*(window.petDeviceLayout?.cameraLeft??.35)&&y>=0&&y<=innerHeight;
  window.addEventListener('resize',update);update();
})();
