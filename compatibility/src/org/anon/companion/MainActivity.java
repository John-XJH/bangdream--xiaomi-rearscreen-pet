package org.anon.companion;
import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.os.Build;
import android.content.Intent;
import android.content.res.Configuration;
import android.content.pm.PackageInfo;
import android.provider.Settings;
import android.net.Uri;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.*;

public class MainActivity extends Activity {
 TextView status,details;boolean dark;int ink,muted,accent,cardColor;LinearLayout content;
 int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
 int color(String value){return Color.parseColor(value);}
 GradientDrawable surface(int color,int radius){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(radius));g.setStroke(dp(1),dark?0x22ffffff:0x0d20243a);return g;}
 TextView text(String value,int size,int tint,boolean bold){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(tint);t.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));t.setLineSpacing(dp(3),1);return t;}
 void section(String title){TextView t=text(title,13,muted,true);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(dp(5),dp(24),0,dp(9));content.addView(t,p);}
 LinearLayout card(){LinearLayout c=new LinearLayout(this);c.setOrientation(1);c.setPadding(dp(16),dp(12),dp(16),dp(12));c.setBackground(surface(cardColor,22));content.addView(c,new LinearLayout.LayoutParams(-1,-2));return c;}
 void row(LinearLayout group,String label,Runnable action){if(group.getChildCount()>0){View line=new View(this);line.setBackgroundColor(dark?0x12ffffff:0x0d20243a);group.addView(line,new LinearLayout.LayoutParams(-1,dp(1)));}TextView item=text(label+"  ›",16,ink,false);item.setPadding(dp(3),dp(15),dp(3),dp(15));item.setMinHeight(dp(52));item.setGravity(Gravity.CENTER_VERTICAL);item.setFocusable(true);item.setClickable(true);item.setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(dark?0x22F8A2C9:0x15CF4A87),null,surface(Color.WHITE,12)));group.addView(item,new LinearLayout.LayoutParams(-1,-2));item.setOnClickListener(v->{try{Diagnostics.event(this,"helper","ui_action",new org.json.JSONObject().put("control",label));}catch(Exception ignored){}action.run();});}
 @Override protected void onResume(){super.onResume();refresh();RuntimeReceiver.publish(this);}
 @Override public void onCreate(Bundle state){super.onCreate(state);
  if(getClass()==MainActivity.class&&"org.anon.companion.GESTURE_START".equals(getIntent().getAction())){startActivity(new Intent(this,GestureActivity.class).putExtra("autoStart",true));finish();return;}
  dark=(getResources().getConfiguration().uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;
  ink=color(dark?"#F4F4FA":"#22263A");muted=color(dark?"#B2B8CC":"#737C92");accent=color(dark?"#F8A2C9":"#CF4A87");cardColor=dark?0xe62c2e40:0xe6ffffff;
  getWindow().setStatusBarColor(color(dark?"#1D1E2E":"#F9EDF5"));getWindow().setNavigationBarColor(color(dark?"#191B2A":"#F4F6FC"));if(!dark)getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});GradientDrawable background=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{color(dark?"#272236":"#FCEBF4"),color(dark?"#191D2E":"#ECF4FE")});scroll.setBackground(background);
  content=new LinearLayout(this);content.setOrientation(1);content.setPadding(dp(22),dp(24),dp(22),dp(30));scroll.addView(content);setContentView(scroll);
  LinearLayout hero=new LinearLayout(this);hero.setGravity(Gravity.CENTER_VERTICAL);ImageView portrait=new ImageView(this);portrait.setImageResource(org.anon.companion.R.drawable.anon_stamp);portrait.setScaleType(ImageView.ScaleType.FIT_CENTER);portrait.setContentDescription("千早爱音 Nice to meet you 印章");hero.addView(portrait,new LinearLayout.LayoutParams(dp(90),dp(90)));
  LinearLayout titles=new LinearLayout(this);titles.setOrientation(1);titles.setPadding(dp(16),0,0,0);titles.addView(text("BanG Dream!",27,accent,true));titles.addView(text("背屏桌宠助手",20,ink,true));titles.addView(text("版本检查 · 应用入口 · 异常恢复",11,muted,false));hero.addView(titles,new LinearLayout.LayoutParams(0,-2,1));content.addView(hero);
  section("互动玩法");LinearLayout play=card();row(play,"手势互动 · 测试版",()->startActivity(new Intent(this,GestureActivity.class)));
  section("兼容检查");LinearLayout check=card();status=text("正在检查版本…",15,ink,false);status.setPadding(dp(3),dp(4),dp(3),dp(14));check.addView(status);
  row(check,"检查版本与入口",()->{refresh();RuntimeReceiver.publish(this);Toast.makeText(this,"已发送版本信息，请在背屏机型适配页查看",Toast.LENGTH_SHORT).show();});
  row(check,"版本详情",()->details.setVisibility(details.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE));details=text("",13,muted,false);details.setPadding(dp(3),dp(12),dp(3),dp(12));details.setVisibility(View.GONE);check.addView(details);
  row(check,"已确认当前版本桌宠显示正常",()->{getSharedPreferences("compatibility",0).edit().putBoolean("requiresTest",false).apply();refresh();});
  section("重新应用与恢复");LinearLayout launch=card();row(launch,"打开系统设置",()->open(new Intent(Settings.ACTION_SETTINGS)));row(launch,"妙享背屏应用详情",()->open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:com.xiaomi.subscreencenter"))));row(launch,"加载失败？查看恢复步骤",()->recovery());
  section("测试与反馈");LinearLayout feedback=card();row(feedback,"诊断与反馈 · 导出日志",()->startActivity(new Intent(this,DiagnosticActivity.class)));
  section("使用说明");LinearLayout help=card();TextView guide=text("从 设置 → 妙享背屏 → AI 壁纸 → 唯美动漫 重新应用桌宠。\n\n助手负责版本检测和入口指引，角色由系统背屏宿主渲染。更新系统前请保留电脑上的资源包。日常使用无需开启 USB 调试，电脑恢复资源时才需要。",13,muted,false);guide.setPadding(dp(3),dp(4),dp(3),dp(4));help.addView(guide);refresh();if(getIntent().getBooleanExtra("gestureEngineTest",false))getWindow().getDecorView().post(()->startActivity(new Intent(this,GestureActivity.class).putExtra("engineTest",true)));
 }
 String version(String pkg){try{PackageInfo p=getPackageManager().getPackageInfo(pkg,0);return p.versionName+" ("+p.getLongVersionCode()+")";}catch(Exception e){return "未找到 / 不可查询";}}
 void refresh(){if(status==null)return;String rear=version("com.xiaomi.subscreencenter");boolean pending=RuntimeReceiver.updateBaseline(this),known=RuntimeReceiver.versionName(this,"com.xiaomi.subscreencenter").equals("RELEASE-1.0.2608211912");String model=Build.MODEL.equals("2509FPN0BC")?"小米 17 Pro Max":Build.MANUFACTURER+" "+Build.MODEL;
  status.setText(model+" · Android API "+Build.VERSION.SDK_INT+"\n"+(pending?"系统或应用版本变化，请重新验收。":known?"背屏版本与测试基线一致。":"当前背屏版本未验证，请检查入口。"));
  details.setText("系统构建："+Build.VERSION.INCREMENTAL+"\n妙享背屏："+rear+"\n主题应用："+version("com.android.thememanager")+"\nWebView："+RuntimeReceiver.webVersion()+"\n\n未知版本不代表已兼容。助手不能接收宿主的内存回收回调，也不能重建被系统杀掉的宿主 WebView。");
 }
 void dialog(String title,String message,String action,Runnable callback){AlertDialog.Builder builder=new AlertDialog.Builder(this,dark?android.R.style.Theme_Material_Dialog_Alert:android.R.style.Theme_Material_Light_Dialog_Alert).setTitle(title).setMessage(message).setNegativeButton("关闭",null);if(callback!=null)builder.setPositiveButton(action,(d,w)->callback.run());AlertDialog d=builder.create();d.setOnShowListener(v->{if(d.getWindow()!=null)d.getWindow().setBackgroundDrawable(surface(dark?color("#2C2E40"):color("#FAFAFE"),24));d.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(accent);if(callback!=null)d.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(accent);});d.show();}
 void recovery(){dialog("恢复背屏宿主","进入妙享背屏应用详情，使用系统提供的‘结束运行’或‘强行停止’，然后唤醒背屏，再重新应用唯美动漫。\n\n不要清除应用数据。若系统不允许停止，或仍未恢复，请连接电脑运行‘重启背屏宿主.cmd’。\n\n此入口用于异常恢复，尚未解决开机后宿主初始化失败。","打开应用详情",()->open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:com.xiaomi.subscreencenter"))));}
 void open(Intent intent){try{startActivity(intent);}catch(Exception e){dialog("入口暂不可用","当前系统无法打开此入口，请手动进入系统设置。",null,null);}}
}
