(function(){
  let currentKey='',request=0,loading=null,liveURL=null,active=true,settled=true;
  function backgroundReady(){settled=true;document.dispatchEvent(new Event('petbackgroundready'));}
  window.waitForPetBackground=()=>settled?Promise.resolve():new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);document.removeEventListener('petbackgroundready',done);resolve();};document.addEventListener('petbackgroundready',done);timer=setTimeout(done,2000);});
  const layer=document.getElementById('pet-background');
  function release(){if(loading){loading.abort();loading=null;}for(const image of layer.querySelectorAll('img'))image.removeAttribute('src');layer.replaceChildren();if(liveURL){URL.revokeObjectURL(liveURL);liveURL=null;}layer.style.backgroundImage='none';}
  function list(){return window.petBackgrounds||[];}
  function selected(){const items=list();return items.find(item=>item.id===themePreferences.backgroundImage)||items[0];}
  window.setPetBackgroundActive=value=>{active=value;if(!active){request++;currentKey='';release();if(window.testReport)testReport.backgroundImages=0;}else window.applyPetBackground();};
  window.applyPetBackground=()=>{
    const p=window.themePreferences;if(!active||!p||!p.backgroundMode)return;
    if(window.refreshBackgroundOptions)window.refreshBackgroundOptions();
    const item=selected(),key=p.backgroundMode==='image'?'image/'+(item?.id||'')+'/'+(p.backgroundBlur?p.backgroundBlurStrength:0):p.backgroundMode==='gradient'?'gradient/'+p.background+'/'+p.gradientEnd+'/'+p.gradientAngle:'solid';
    if(key===currentKey)return;currentKey=key;const ticket=++request;release();
    if(window.testReport){testReport.backgroundKey=key;testReport.backgroundImages=0;testReport.backgroundError='';}
    if(p.backgroundMode==='gradient')layer.style.backgroundImage=`linear-gradient(${p.gradientAngle}deg,${p.background},${p.gradientEnd})`;
    if(p.backgroundMode!=='image'||!item){backgroundReady();return;}settled=false;
    const xhr=loading=new XMLHttpRequest();xhr.open('GET',item.file);xhr.responseType='blob';
    xhr.onload=()=>{if(ticket!==request)return;loading=null;if(xhr.status!==0&&xhr.status!==200){currentKey='';if(window.testReport)testReport.backgroundError='图片读取失败';backgroundReady();return;}
      const image=new Image();liveURL=URL.createObjectURL(xhr.response);const url=liveURL;
      image.onload=()=>{if(ticket!==request){image.removeAttribute('src');return;}URL.revokeObjectURL(url);liveURL=null;
        if(!p.backgroundBlur){layer.replaceChildren(image);if(window.testReport){testReport.backgroundImages=1;testReport.backgroundBlur=false;testReport.backgroundDimensions=[image.naturalWidth,image.naturalHeight];}backgroundReady();return;}
        const canvas=document.createElement('canvas');canvas.width=976;canvas.height=596;const ctx=canvas.getContext('2d'),radius=p.backgroundBlurStrength,margin=radius*3;ctx.filter=`blur(${radius}px)`;ctx.drawImage(image,-margin,-margin,canvas.width+2*margin,canvas.height+2*margin);image.removeAttribute('src');
        canvas.toBlob(blob=>{canvas.width=1;canvas.height=1;if(ticket!==request||!blob)return;const blurred=new Image();const blurURL=liveURL=URL.createObjectURL(blob);blurred.onload=()=>{if(ticket!==request){blurred.removeAttribute('src');return;}layer.replaceChildren(blurred);URL.revokeObjectURL(blurURL);liveURL=null;if(window.testReport){testReport.backgroundImages=1;testReport.backgroundBlur=true;testReport.backgroundBlurStrength=radius;testReport.backgroundDimensions=[blurred.naturalWidth,blurred.naturalHeight];}backgroundReady();};blurred.onerror=()=>{if(ticket===request){currentKey='';release();if(window.testReport)testReport.backgroundError='模糊背景解码失败';backgroundReady();}};blurred.src=blurURL;},'image/webp',.9);};
      image.onerror=()=>{if(ticket===request){currentKey='';release();if(window.testReport)testReport.backgroundError='图片解码失败';backgroundReady();}};image.src=url;
    };
    xhr.onerror=()=>{if(ticket!==request)return;loading=null;currentKey='';if(window.testReport)testReport.backgroundError='图片读取失败';backgroundReady();};xhr.send();
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const p=themePreferences;let saved={};try{saved=JSON.parse(localStorage.getItem('anon-colors')||'{}');}catch(e){}
    p.backgroundMode=['solid','gradient','image'].includes(saved.backgroundMode)?saved.backgroundMode:'solid';
    p.gradientEnd=/^#[0-9a-f]{6}$/i.test(saved.gradientEnd)?saved.gradientEnd:'#30395b';p.gradientAngle=[45,90,135,180].includes(saved.gradientAngle)?saved.gradientAngle:135;
    p.backgroundBlur=saved.backgroundBlur===true;p.backgroundBlurStrength=[6,12,20].includes(saved.backgroundBlurStrength)?saved.backgroundBlurStrength:12;
    p.backgroundImage=saved.backgroundImage||saved.backgroundByBand?.[petCatalog.find(m=>m.id===p.character)?.band]||list()[0]?.id;delete p.backgroundByBand;
    const byId=id=>document.getElementById(id),persist=()=>{try{localStorage.setItem('anon-colors',JSON.stringify(p));}catch(e){byId('saved').textContent='当前环境无法保存，设置仅本次有效。';}onThemeChange();};
    function tap(element,callback){let start=null,valid=false;element.addEventListener('touchstart',e=>{e.preventDefault();valid=e.touches.length===1;start=valid?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:false});element.addEventListener('touchmove',e=>{if(start&&e.touches.length===1&&Math.abs(e.touches[0].clientX-start.x)+Math.abs(e.touches[0].clientY-start.y)>10)valid=false;});element.addEventListener('touchcancel',()=>valid=false);element.addEventListener('touchend',e=>{e.preventDefault();if(valid&&!e.touches.length)callback();valid=false;},{passive:false});element.addEventListener('click',callback);}
    const modes=[['solid','纯色'],['gradient','渐变'],['image','故事背景']],angles=[[90,'从左到右'],[180,'从上到下'],[135,'左上到右下'],[45,'左下到右上']];
    function picker(title,choices,current,choose,stay=false){const container=byId('background-picker-list');container.replaceChildren();for(const [value,label] of choices){const button=document.createElement('button');button.textContent=label+(value===current?' ✓':'');button.dataset.value=value;button.dataset.label=label;button.setAttribute('aria-pressed',value===current?'true':'false');container.appendChild(button);tap(button,()=>{choose(value);persist();if(stay){for(const row of container.children){const selected=row.dataset.value===String(value);row.textContent=row.dataset.label+(selected?" ✓":"");row.setAttribute("aria-pressed",String(selected));}}else closePetBackgroundPicker();});}openPetBackgroundPicker(title);}
    tap(byId('background-mode'),()=>picker('背景类型',modes,p.backgroundMode,value=>p.backgroundMode=value));
    tap(byId('gradient-angle'),()=>picker('渐变方向',angles,p.gradientAngle,value=>p.gradientAngle=value));
    for(const [id,key,label] of [['gradient-first','background','渐变起始颜色'],['gradient-last','gradientEnd','渐变结束颜色']])tap(byId(id),()=>editPetBackgroundColor(key,label));
    function options(){byId('background-blur-toggle').textContent='图片模糊：'+(p.backgroundBlur?'开':'关');byId('background-blur-toggle').setAttribute('aria-pressed',String(p.backgroundBlur));byId('background-blur-strength').textContent=({6:'轻',12:'中',20:'强'})[p.backgroundBlurStrength];const items=list(),item=selected();byId('background-mode').textContent=modes.find(row=>row[0]===p.backgroundMode)[1];byId('gradient-angle').textContent=angles.find(row=>row[0]===p.gradientAngle)[1];byId('background-image').textContent=item?.name||'暂无背景';byId('background-note').textContent=items.length?'976×596 WebP · 仅加载当前背景':'该乐队暂未核实专属素材，可使用通用背景';}
    tap(byId('background-image'),()=>picker('故事背景',list().map(bg=>[bg.id,bg.name]),selected()?.id,value=>{p.backgroundImage=value;p.backgroundMode='image';}));
    tap(byId('background-blur-toggle'),()=>{p.backgroundBlur=!p.backgroundBlur;persist();});tap(byId('background-blur-strength'),()=>picker('模糊强度',[[6,'轻'],[12,'中'],[20,'强']],p.backgroundBlurStrength,value=>{p.backgroundBlurStrength=value;p.backgroundBlur=true;},true));
    window.refreshBackgroundOptions=options;options();applyPetBackground();
  });
})();
