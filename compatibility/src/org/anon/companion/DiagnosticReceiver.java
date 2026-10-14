package org.anon.companion;
import android.content.*;
import org.json.JSONObject;
public class DiagnosticReceiver extends BroadcastReceiver {
 private static final java.util.concurrent.ExecutorService IO=java.util.concurrent.Executors.newSingleThreadExecutor();
 @Override public void onReceive(Context c,Intent i){if(i==null)return;PendingResult pending=goAsync();IO.execute(()->{try{if("org.anon.companion.DIAGNOSTIC_REQUEST".equals(i.getAction()))Diagnostics.publish(c);else Diagnostics.receive(c,i.getStringExtra("session"),i.getStringExtra("payload"));}finally{pending.finish();}});}
}
