package org.anon.companion;
import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import android.widget.*;

public class GestureActivity extends MainActivity {
 private TextView cameraStatus;private boolean engineStarted=false;
 private final BroadcastReceiver receiver=new BroadcastReceiver(){@Override public void onReceive(Context context,Intent intent){cameraStatus.setText(intent.getStringExtra("message")+"\n"+intent.getStringExtra("profile")+"\n采集 "+intent.getIntExtra("frames",0)+" 帧 · 触发 "+intent.getIntExtra("events",0)+" 次\n最近："+intent.getStringExtra("last")+" · 处理 "+Math.round(intent.getDoubleExtra("latency",0))+"ms");if(getIntent().getBooleanExtra("autoStart",false)&&intent.getBooleanExtra("active",false)&&intent.getStringExtra("message").startsWith("已开启"))finish();}};
 @Override public void onCreate(Bundle state){super.onCreate(state);content.removeAllViews();content.addView(text("手势互动",27,accent,true));content.addView(text("比耶 · 单手比心",15,muted,false));
  section("手势测试");LinearLayout card=card();cameraStatus=text("尚未开启\n闲置30秒或最多5分钟后自动释放识别进程。",15,ink,false);cameraStatus.setPadding(dp(3),dp(8),dp(3),dp(12));card.addView(cameraStatus);
  row(card,"开启手势互动",()->begin());row(card,"停止并释放资源",()->{startService(new Intent(this,GestureService.class).setAction("STOP"));cameraStatus.setText("正在停止…");});
  row(card,"检查识别引擎（不调用摄像头）",()->{cameraStatus.setText("正在检查识别引擎…");startService(new Intent(this,GestureService.class).setAction("SELFTEST"));});
  section("如何测试");LinearLayout guide=card();guide.addView(text("可直接从背屏设置的手势开关启动；首次需在此页面授予相机权限。\n\n把手放到后置主摄前，保持比耶或单手拇指食指比心约半秒。保持同一姿势只触发一次；两次识别至少间隔2.5秒，语音结束后再等待1秒。\n\n开启后可转到背屏观察。若系统关闭相机，请返回主屏重新开启。切勿遮住镜头；使用系统相机前先停止本会话。\n\n全部识别在手机本地完成，不录制或保存摄像头画面。规则版比心效果仍需实机调试。",14,muted,false));row(guide,"返回助手",()->finish());}
 private void begin(){if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){if(Build.VERSION.SDK_INT>=33)requestPermissions(new String[]{Manifest.permission.CAMERA,Manifest.permission.POST_NOTIFICATIONS},20);else requestPermissions(new String[]{Manifest.permission.CAMERA},20);return;}cameraStatus.setText("正在开启后置摄像头…");try{startForegroundService(new Intent(this,GestureService.class).setAction("START"));}catch(Exception e){cameraStatus.setText("启动受系统限制，请在主屏开启："+e.getClass().getSimpleName());}}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==20){if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)begin();else cameraStatus.setText("相机权限未授予，手势功能未开启。");}}
 @Override protected void onStart(){super.onStart();IntentFilter filter=new IntentFilter(GestureService.STATE);if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED);else registerReceiver(receiver,filter);}
 @Override protected void onResume(){super.onResume();if(getIntent().getBooleanExtra("autoStart",false)&&!engineStarted){engineStarted=true;getWindow().getDecorView().postDelayed(this::begin,300);}if(getIntent().getBooleanExtra("engineTest",false)&&!engineStarted){engineStarted=true;getWindow().getDecorView().postDelayed(()->startService(new Intent(this,GestureService.class).setAction("SELFTEST")),300);}}
 @Override protected void onStop(){unregisterReceiver(receiver);super.onStop();}
}
