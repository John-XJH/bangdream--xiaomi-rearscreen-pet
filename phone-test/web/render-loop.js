(function(){
  'use strict';
  window.createPetFrameLoop=function(app,onWork){
    let active=false,timer=null,frame=null,fps=30,next=0;
    const now=()=>performance.now();
    function cancel(){clearTimeout(timer);timer=null;if(frame!==null)cancelAnimationFrame(frame);frame=null;}
    // Arm slightly before the deadline so timer jitter does not miss the next vsync.
    function schedule(){if(!active||timer!==null||frame!==null)return;timer=setTimeout(()=>{timer=null;if(active)frame=requestAnimationFrame(draw);},Math.max(0,next-now()-2));}
    function draw(stamp){frame=null;if(!active)return;if(stamp+.25<next){frame=requestAnimationFrame(draw);return;}const begin=now();app.ticker.update(stamp);onWork?.(now()-begin);const period=1000/fps;next+=period;if(next<now())next+=Math.ceil((now()-next)/period)*period;schedule();}
    app.ticker.autoStart=false;app.ticker.stop();app.ticker.maxFPS=0;
    const loop={get active(){return active;},start(){if(active)return;active=true;next=now();app.ticker.lastTime=next; schedule();},stop(){active=false;cancel();app.ticker.stop();},setFPS(value){const target=Math.max(1,Number(value)||30);if(target===fps)return;fps=target;if(active){cancel();next=now();schedule();}}};
    app.start=()=>loop.start();app.stop=()=>loop.stop();return loop;
  };
})();
