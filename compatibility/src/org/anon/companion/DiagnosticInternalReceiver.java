package org.anon.companion;
import android.content.*;
public class DiagnosticInternalReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent i){if(i==null||!Diagnostics.active(c))return;try{Diagnostics.event(c,"gesture",i.getStringExtra("event"),new org.json.JSONObject().put("stage",Diagnostics.clean(i.getStringExtra("stage"))));}catch(Exception ignored){}}
}
