package org.anon.companion;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.webkit.WebView;

public class RuntimeReceiver extends BroadcastReceiver {
 public static String versionName(Context context,String name){try{PackageInfo p=context.getPackageManager().getPackageInfo(name,0);return p.versionName==null?"":p.versionName;}catch(Exception e){return "";}}
 public static String webVersion(){try{PackageInfo p=WebView.getCurrentWebViewPackage();return p==null?"":p.versionName;}catch(Exception e){return "";}}
 public static boolean updateBaseline(Context context){
  String current=Build.MODEL+"|"+Build.VERSION.INCREMENTAL+"|"+versionName(context,"com.xiaomi.subscreencenter")+"|"+webVersion();
  android.content.SharedPreferences prefs=context.getSharedPreferences("compatibility",0);String previous=prefs.getString("baseline","");
  boolean pending=prefs.getBoolean("requiresTest",false)||(!previous.isEmpty()&&!previous.equals(current));
  prefs.edit().putString("baseline",current).putBoolean("requiresTest",pending).apply();return pending;
 }
 public static void publishPower(Context context){
  android.os.PowerManager power=context.getSystemService(android.os.PowerManager.class);int thermal=android.os.Build.VERSION.SDK_INT>=29?power.getCurrentThermalStatus():0;
  Intent battery=context.registerReceiver(null,new android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED));int temperature=battery==null?-1:battery.getIntExtra("temperature",-1);
  Intent packet=new Intent("org.anon.companion.POWER").putExtra("thermal",thermal).putExtra("temperature",temperature).putExtra("rearAwake",RearDisplayState.awake(context)).putExtra("epoch",(int)(System.currentTimeMillis()%2000000000L));
  for(String target:new String[]{"com.xiaomi.subscreencenter","com.android.thememanager"})context.sendBroadcast(new Intent(packet).setPackage(target));
 }
 public static void publish(Context context){
  updateBaseline(context);Diagnostics.publish(context);
  Intent packet=new Intent("org.anon.companion.RUNTIME");
  packet.putExtra("api",Build.VERSION.SDK_INT);packet.putExtra("host",versionName(context,"com.xiaomi.subscreencenter"));
  packet.putExtra("webview",webVersion());packet.putExtra("model",Build.MODEL);packet.putExtra("epoch",(int)(System.currentTimeMillis()%2000000000L));
  for(String target:new String[]{"com.xiaomi.subscreencenter","com.android.thememanager"}){try{context.sendBroadcast(new Intent(packet).setPackage(target));}catch(Exception e){android.util.Log.w("AnonCompatibility","Cannot publish runtime metadata",e);}}
 }
 @Override public void onReceive(Context context,Intent intent){if(intent==null)return;if("org.anon.companion.HOST_LIFECYCLE".equals(intent.getAction())){boolean active=intent.getIntExtra("active",0)==1;android.util.Log.i("AnonPower","host lifecycle "+(active?"resume":"pause"));try{Diagnostics.event(context,"host","lifecycle",new org.json.JSONObject().put("stage",active?"resume":"pause").put("rearAwake",RearDisplayState.awake(context)));}catch(Exception ignored){}if(!active)context.sendBroadcast(new Intent("org.anon.companion.GESTURE_CONTROL").setPackage(context.getPackageName()).putExtra("stop",true));}else if("org.anon.companion.POWER_REQUEST".equals(intent.getAction()))publishPower(context);else if("org.anon.companion.RUNTIME_REQUEST".equals(intent.getAction()))publish(context);else if("org.anon.companion.GESTURE_HEARTBEAT".equals(intent.getAction())||"org.anon.companion.GESTURE_STOP".equals(intent.getAction()))context.sendBroadcast(new Intent("org.anon.companion.GESTURE_CONTROL").setPackage(context.getPackageName()).putExtra("stop",intent.getAction().endsWith("STOP")));}
}
