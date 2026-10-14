package org.anon.companion;
import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputFilter;
import android.widget.*;
import org.json.JSONObject;
import java.io.*;
public class DiagnosticActivity extends MainActivity {
 private TextView summary,attachment;private EditText expected,actual,steps;
 private String category="显示 / 黑屏",frequency="偶发";private Uri screenshot;private File lastZip;
 private final android.os.Handler handler=new android.os.Handler();
 private final Runnable poll=new Runnable(){public void run(){update();handler.postDelayed(this,2000);}};
 @Override public void onCreate(Bundle state){super.onCreate(state);content.removeAllViews();if(state!=null){category=state.getString("category",category);frequency=state.getString("frequency",frequency);String u=state.getString("image");if(u!=null)screenshot=Uri.parse(u);String f=state.getString("zip");if(f!=null&&f.matches("report-[0-9]+\\.zip"))lastZip=new File(new File(getCacheDir(),"diagnostic-exports"),f);}
  TextView back=text("‹ 返回助手",16,accent,false);back.setPadding(0,dp(6),0,dp(20));back.setOnClickListener(v->finish());content.addView(back);content.addView(text("诊断与反馈",26,ink,true));content.addView(text("本地记录 · 手动导出",13,muted,false));
  section("复现记录");LinearLayout controls=card();summary=text("",14,ink,false);controls.addView(summary);
  row(controls,"开始新记录（替换旧日志）",()->{try{Diagnostics.start(this);update();Toast.makeText(this,"记录已开启，请返回背屏复现问题",Toast.LENGTH_LONG).show();}catch(Exception e){error(e);}});
  row(controls,"停止记录",()->{Diagnostics.stop(this);update();});
  row(controls,"清空本地日志",()->{try{Diagnostics.clear(this);update();}catch(Exception e){error(e);}});
  section("问题说明");LinearLayout form=card();choice(form,"问题类型",new String[]{"显示 / 黑屏","角色 / 服装","动作 / 语音","设置 / 交互","卡顿 / 发热","手势","其他"},true);choice(form,"发生频率",new String[]{"每次","偶发","只发生一次"},false);
  expected=field(form,"预期效果",101);actual=field(form,"实际问题（必填）",102);steps=field(form,"复现步骤",103);
  section("可选截图");LinearLayout images=card();attachment=text("未选择截图；不会自动截屏",13,muted,false);images.addView(attachment);
  row(images,"选择截图（最多2 MiB）",()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,20);});row(images,"移除截图",()->{screenshot=null;attachment.setText("未选择截图；不会自动截屏");});
  section("导出诊断包");LinearLayout export=card();row(export,"停止并导出到文件",()->export(false));row(export,"停止并打开分享菜单",()->export(true));
  export.addView(text("最长记录15分钟，日志最多512 KiB。仅记录本程序操作和错误，不读取系统完整日志。\n\n默认不采集相机、音频、账号、设备唯一标识或名字框自定义文字。问题说明与手动截图可能含个人信息，请分享前检查。\n\n诊断包不会自动上传；分享给项目作者后，可转交用于分析。",13,muted,false));update();
 }
 private EditText field(LinearLayout group,String label,int id){group.addView(text(label,13,muted,false));EditText e=new EditText(this);e.setId(id);e.setTextColor(ink);e.setHintTextColor(muted);e.setTextSize(15);e.setGravity(android.view.Gravity.TOP);e.setMinLines(2);e.setFilters(new InputFilter[]{new InputFilter.LengthFilter(1500)});e.setBackground(surface(dark?0x3320243a:0x33dce3f0,12));e.setPadding(dp(12),dp(10),dp(12),dp(10));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,dp(6),0,dp(16));group.addView(e,p);return e;}
 private void choice(LinearLayout group,String label,String[] values,boolean type){final TextView[] item=new TextView[1];row(group,label+"："+(type?category:frequency),()->{int selected=java.util.Arrays.asList(values).indexOf(type?category:frequency);AlertDialog d=new AlertDialog.Builder(this,dark?android.R.style.Theme_Material_Dialog_Alert:android.R.style.Theme_Material_Light_Dialog_Alert).setTitle(label).setSingleChoiceItems(values,selected,(dialog,index)->{if(type)category=values[index];else frequency=values[index];item[0].setText(label+"："+values[index]+"  ›");dialog.dismiss();}).setNegativeButton("关闭",null).create();d.show();d.getWindow().setBackgroundDrawable(surface(cardColor,22));});item[0]=(TextView)group.getChildAt(group.getChildCount()-1);}
 private void update(){if(summary==null)return;boolean on=Diagnostics.active(this);long minutes=Math.max(0,(Diagnostics.until(this)-System.currentTimeMillis()+59999)/60000);int count=Diagnostics.received(this);summary.setText((on?"正在记录 · 剩余约 "+minutes+" 分钟":"记录已关闭")+"\n已收到 "+count+" 条背屏事件"+(count==0?"\n尚未收到背屏日志，请使用新版壁纸并点亮背屏复现。":""));}
 private void error(Exception e){Toast.makeText(this,"操作失败："+Diagnostics.clean(e.getMessage()),Toast.LENGTH_LONG).show();}
 private void export(boolean share){if(actual.getText().toString().trim().isEmpty()){actual.setError("请填写实际问题");return;}Diagnostics.stop(this);update();try{JSONObject report=new JSONObject().put("category",category).put("frequency",frequency).put("expected",expected.getText().toString()).put("actual",actual.getText().toString()).put("steps",steps.getText().toString());Uri image=screenshot;Toast.makeText(this,"正在生成诊断包…",Toast.LENGTH_SHORT).show();new Thread(()->{try{File f=Diagnostics.export(this,report,image);runOnUiThread(()->{lastZip=f;if(share){Uri uri=Uri.parse("content://org.anon.companion.diagnostics/exports/"+f.getName());Intent i=new Intent(Intent.ACTION_SEND).setType("application/zip").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);i.setClipData(ClipData.newRawUri("diagnostics",uri));startActivity(Intent.createChooser(i,"分享诊断包"));}else startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/zip").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,f.getName()),21);});}catch(Exception e){runOnUiThread(()->error(e));}},"DiagnosticExport").start();}catch(Exception e){error(e);}}
 @Override protected void onActivityResult(int code,int result,Intent data){super.onActivityResult(code,result,data);if(result!=RESULT_OK||data==null||data.getData()==null)return;if(code==20){screenshot=data.getData();attachment.setText("已选择一张截图（导出时检查2 MiB上限）");}else if(code==21&&lastZip!=null){File file=lastZip;Uri target=data.getData();new Thread(()->{try(InputStream in=new FileInputStream(file);OutputStream stream=getContentResolver().openOutputStream(target,"w")){if(stream==null)throw new IOException("无法打开目标文件");byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)stream.write(buffer,0,n);runOnUiThread(()->Toast.makeText(this,"诊断包已保存",Toast.LENGTH_LONG).show());}catch(Exception e){runOnUiThread(()->error(e));}},"DiagnosticSave").start();}}
 @Override protected void onResume(){super.onResume();handler.post(poll);}
 @Override protected void onPause(){handler.removeCallbacks(poll);super.onPause();}
 @Override protected void onSaveInstanceState(Bundle b){super.onSaveInstanceState(b);b.putString("category",category);b.putString("frequency",frequency);if(screenshot!=null)b.putString("image",screenshot.toString());if(lastZip!=null)b.putString("zip",lastZip.getName());}
}
