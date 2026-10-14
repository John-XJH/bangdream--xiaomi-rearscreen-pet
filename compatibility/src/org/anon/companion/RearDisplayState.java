package org.anon.companion;

import android.content.Context;
import android.graphics.Point;
import android.hardware.display.DisplayManager;
import android.view.Display;

public final class RearDisplayState {
 // Unknown (-1) is retained when more than one small secondary screen exists.
 public static int awake(Context context){int value=state(context);return value<0?-1:value==Display.STATE_ON?1:0;}
 public static int state(Context context){
  try{DisplayManager manager=context.getSystemService(DisplayManager.class);Display rear=null;
   for(Display display:manager.getDisplays()){if(display.getDisplayId()==Display.DEFAULT_DISPLAY)continue;Point size=new Point();display.getRealSize(size);int min=Math.min(size.x,size.y),max=Math.max(size.x,size.y);if(min<400||min>800||max<700||max>1400)continue;if(rear!=null)return -1;rear=display;}
   if(rear==null)return -1;int state=rear.getState();if(state==Display.STATE_UNKNOWN)return -1;return state;
  }catch(Exception e){return -1;}
 }
}
