package org.anon.companion;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.graphics.ImageFormat;
import android.hardware.camera2.*;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.*;
import android.util.*;
import java.nio.*;
import java.util.*;
import com.google.mediapipe.framework.image.*;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult;

public class GestureService extends Service {
 public static final String STATE="org.anon.companion.GESTURE_STATE";
 private final Handler main=new Handler(Looper.getMainLooper());private HandlerThread thread;private Handler worker;
 private volatile boolean running=false,closing=false,busy=false;private CameraDevice camera;private CameraCaptureSession session;private ImageReader reader;private HandLandmarker detector;
 private ByteBuffer rgba;private int[] pixels;private final float[][] points=new float[21][3];private final GestureRules rules=new GestureRules();
 private int rotation=90,outWidth,outHeight,frames=0,events=0,code=0;private long started,lastAnalyze=0,lastStatus=0;private String lastGesture="未触发",profile="";private double inferenceMs=0;
 private String terminalMessage=null;
 private volatile long lastRear=0,lastHand=0;private boolean controlRegistered=false;
 private final BroadcastReceiver control=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent i){if(i.getBooleanExtra("stop",false)){terminalMessage="背屏已暂停手势 · 正在释放资源";stopSelf();}else lastRear=SystemClock.uptimeMillis();}};
 private final Runnable watchdog=new Runnable(){@Override public void run(){if(!running)return;long now=SystemClock.uptimeMillis();PowerManager power=getSystemService(PowerManager.class);String reason=RearDisplayState.awake(GestureService.this)==0&&(lastRear>0||now-started>=10000)?"实体背屏已熄灭，已停止手势":power.getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_MODERATE?"系统温控已停止手势":power.isPowerSaveMode()?"省电模式已停止手势":now-started>=300000?"手势会话已结束":now-lastHand>=30000?"30秒未检测到手，已释放识别资源":lastRear==0?(now-started>=45000?"未收到背屏状态，已停止手势":null):(now-lastRear>=20000?"背屏暂停或熄屏，已停止手势":null);if(reason!=null){terminalMessage=reason;stopSelf();}else main.postDelayed(this,2000);}};
 private int sequence=(int)(System.currentTimeMillis()%1000000000L);
 private void packet(int gesture,boolean active){Intent i=new Intent("org.anon.companion.GESTURE").putExtra("code",gesture).putExtra("active",active?1:0).putExtra("seq",++sequence).putExtra("stamp",(int)(System.currentTimeMillis()%2000000000L));for(String pkg:new String[]{"com.xiaomi.subscreencenter","com.android.thememanager"})sendBroadcast(new Intent(i).setPackage(pkg));}
 private void status(String message){sendBroadcast(new Intent(this,DiagnosticInternalReceiver.class).putExtra("event","state").putExtra("stage",message));Intent i=new Intent(STATE).setPackage(getPackageName()).putExtra("active",running).putExtra("message",message).putExtra("frames",frames).putExtra("events",events).putExtra("last",lastGesture).putExtra("profile",profile).putExtra("latency",inferenceMs);sendBroadcast(i);Log.i("AnonGesture",message+" frames="+frames+" events="+events+" last="+lastGesture);}
 private void fail(String message,Throwable e){Log.e("AnonGesture",message,e);running=false;terminalMessage=message;status(message);stopSelf();}
 @Override public int onStartCommand(Intent intent,int flags,int id){
  if(intent==null||"STOP".equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
  if(busy||closing)return START_NOT_STICKY;busy=true;
  thread=new HandlerThread("HandGesture");thread.start();worker=new Handler(thread.getLooper());started=SystemClock.uptimeMillis();
  if("SELFTEST".equals(intent.getAction())){worker.post(()->{try{loadModel();ByteBuffer blank=ByteBuffer.allocateDirect(320*240*4);try(MPImage image=new ByteBufferImageBuilder(blank,320,240,MPImage.IMAGE_FORMAT_RGBA).build()){detector.detectForVideo(image,SystemClock.uptimeMillis());}terminalMessage="识别引擎检查通过 · 未调用摄像头";status(terminalMessage);}catch(Throwable e){terminalMessage="识别引擎检查失败："+e.getClass().getSimpleName();status(terminalMessage);Log.e("AnonGesture","Engine test",e);}finally{stopSelf();}});return START_NOT_STICKY;}
  try{
   NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("gestures","手势互动",NotificationManager.IMPORTANCE_LOW));
   PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,GestureService.class).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
   Notification n=new Notification.Builder(this,"gestures").setSmallIcon(android.R.drawable.ic_menu_camera).setContentTitle("BanG Dream手势互动").setContentText("后置摄像头本地识别 · 闲置自动释放").setOngoing(true).addAction(new Notification.Action.Builder(null,"停止",stop).build()).build();
   startForeground(7,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA);running=true;packet(0,true);status("正在加载识别模型…");
   lastHand=started;if(Build.VERSION.SDK_INT>=33)registerReceiver(control,new IntentFilter("org.anon.companion.GESTURE_CONTROL"),Context.RECEIVER_NOT_EXPORTED);else registerReceiver(control,new IntentFilter("org.anon.companion.GESTURE_CONTROL"));controlRegistered=true;main.postDelayed(watchdog,2000);
   worker.post(()->{try{loadModel();if(running)openCamera();}catch(Throwable e){fail("启动失败："+e.getClass().getSimpleName(),e);}});
  }catch(Throwable e){fail("无法开启相机，请从主屏授权并启动",e);}
  return START_NOT_STICKY;
 }
 private void loadModel(){detector=HandLandmarker.createFromOptions(this,HandLandmarker.HandLandmarkerOptions.builder().setBaseOptions(BaseOptions.builder().setModelAssetPath("hand_landmarker.task").build()).setRunningMode(RunningMode.VIDEO).setNumHands(1).setMinHandDetectionConfidence(.6f).setMinHandPresenceConfidence(.6f).setMinTrackingConfidence(.6f).build());}
 private void openCamera() throws Exception {
  CameraManager manager=getSystemService(CameraManager.class);String id=null;CameraCharacteristics chars=null;
  for(String candidate:manager.getCameraIdList()){CameraCharacteristics c=manager.getCameraCharacteristics(candidate);Integer facing=c.get(CameraCharacteristics.LENS_FACING);if(facing!=null&&facing==CameraCharacteristics.LENS_FACING_BACK){id=candidate;chars=c;break;}}
  if(id==null)throw new IllegalStateException("没有后置摄像头");Integer orientation=chars.get(CameraCharacteristics.SENSOR_ORIENTATION);rotation=orientation==null?90:orientation;
  StreamConfigurationMap map=chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);Size selected=null;long best=Long.MAX_VALUE;
  for(Size size:map.getOutputSizes(ImageFormat.YUV_420_888)){long error=Math.abs((long)size.getWidth()*size.getHeight()-480*360);if(error<best){best=error;selected=size;}}
  if(selected==null)throw new IllegalStateException("没有可用采集尺寸");Range<Integer> fps=null;Range<Integer>[] ranges=chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES);
  if(ranges!=null)for(Range<Integer> range:ranges){if(range.getUpper()<15)continue;if(fps==null||range.getUpper()<fps.getUpper()||range.getUpper().equals(fps.getUpper())&&range.getLower()<fps.getLower())fps=range;}
  final Range<Integer> captureFPS=fps;profile=selected.getWidth()+"×"+selected.getHeight()+" · 相机 "+fps+" · 识别最多6帧，空闲3帧";
  reader=ImageReader.newInstance(selected.getWidth(),selected.getHeight(),ImageFormat.YUV_420_888,2);reader.setOnImageAvailableListener(this::analyze,worker);
  manager.openCamera(id,new CameraDevice.StateCallback(){@Override public void onOpened(CameraDevice value){if(!running){value.close();return;}camera=value;try{camera.createCaptureSession(Collections.singletonList(reader.getSurface()),new CameraCaptureSession.StateCallback(){@Override public void onConfigured(CameraCaptureSession value){if(!running){value.close();return;}session=value;try{CaptureRequest.Builder request=camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);request.addTarget(reader.getSurface());request.set(CaptureRequest.CONTROL_AF_MODE,CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO);if(captureFPS!=null)request.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,captureFPS);session.setRepeatingRequest(request.build(),null,worker);status("已开启 · 请对后置摄像头做手势");}catch(Exception e){fail("相机采集失败",e);}}@Override public void onConfigureFailed(CameraCaptureSession value){fail("相机会话配置失败",new IllegalStateException());}},worker);}catch(Exception e){fail("无法创建相机会话",e);}}
   @Override public void onDisconnected(CameraDevice value){value.close();fail("相机已断开，请重新开启",new IllegalStateException());}@Override public void onError(CameraDevice value,int error){value.close();fail("相机不可用，可能被其他应用占用："+error,new IllegalStateException());}},worker);
 }
 private static int clamp(int value){return Math.max(0,Math.min(255,value));}
 private MPImage convert(Image image){int w=image.getWidth(),h=image.getHeight();outWidth=rotation==90||rotation==270?h:w;outHeight=rotation==90||rotation==270?w:h;
  if(pixels==null||pixels.length!=w*h){pixels=new int[w*h];rgba=ByteBuffer.allocateDirect(w*h*4).order(ByteOrder.LITTLE_ENDIAN);}
  Image.Plane[] planes=image.getPlanes();ByteBuffer y=planes[0].getBuffer(),u=planes[1].getBuffer(),v=planes[2].getBuffer();int ys=planes[0].getRowStride(),us=planes[1].getRowStride(),vs=planes[2].getRowStride(),up=planes[1].getPixelStride(),vp=planes[2].getPixelStride();
  for(int row=0;row<h;row++)for(int col=0;col<w;col++){int l=Math.max(0,(y.get(row*ys+col)&255)-16),a=(u.get(row/2*us+col/2*up)&255)-128,b=(v.get(row/2*vs+col/2*vp)&255)-128;int red=clamp((298*l+409*b+128)>>8),green=clamp((298*l-100*a-208*b+128)>>8),blue=clamp((298*l+516*a+128)>>8);int index=rotation==90?col*h+h-1-row:rotation==270?(w-1-col)*h+row:rotation==180?(h-1-row)*w+w-1-col:row*w+col;pixels[index]=0xff000000|blue<<16|green<<8|red;}
  rgba.clear();rgba.asIntBuffer().put(pixels);return new ByteBufferImageBuilder(rgba,outWidth,outHeight,MPImage.IMAGE_FORMAT_RGBA).build();
 }
 private void analyze(ImageReader source){Image image=null;try{image=source.acquireLatestImage();if(image==null||!running)return;long now=SystemClock.uptimeMillis();long interval=rules.cooling(now)?400:now-lastHand>3000?333:167;if(now-lastAnalyze<interval)return;lastAnalyze=now;long begin=now;
   HandLandmarkerResult result;try(MPImage input=convert(image)){result=detector.detectForVideo(input,now);}inferenceMs=SystemClock.uptimeMillis()-begin;frames++;
   boolean hand=!result.landmarks().isEmpty();if(hand)lastHand=now;if(hand)for(int i=0;i<21;i++){points[i][0]=result.landmarks().get(0).get(i).x();points[i][1]=result.landmarks().get(0).get(i).y();points[i][2]=result.landmarks().get(0).get(i).z();}
   code=rules.update(hand?points:null,now);if(code!=0){events++;lastGesture=GestureRules.name(code);packet(code,true);status("识别成功："+lastGesture);}
   else if(now-lastStatus>1000){lastStatus=now;status(hand?"检测到手 · "+GestureRules.name(rules.candidate):"等待手进入后置摄像头画面");}
  }catch(Throwable e){if(running)fail("识别中断："+e.getClass().getSimpleName(),e);}finally{if(image!=null)image.close();}}
 @Override public void onDestroy(){if(controlRegistered){unregisterReceiver(control);controlRegistered=false;}closing=true;running=false;main.removeCallbacksAndMessages(null);packet(0,false);stopForeground(STOP_FOREGROUND_REMOVE);status(terminalMessage!=null?terminalMessage:"已停止 · 正在释放摄像头和识别进程");
  Runnable cleanup=()->{try{if(session!=null)session.close();if(camera!=null)camera.close();if(reader!=null)reader.close();if(detector!=null)detector.close();pixels=null;rgba=null;}catch(Throwable e){Log.w("AnonGesture","Cleanup",e);}finally{if(Application.getProcessName().endsWith(":gesture"))android.os.Process.killProcess(android.os.Process.myPid());}};
  if(worker!=null)worker.post(cleanup);else cleanup.run();super.onDestroy();}
 @Override public IBinder onBind(Intent intent){return null;}
}
