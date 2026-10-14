package org.anon.companion;
public class GestureRulesTest {
 static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 static float[][] hand(boolean open){float[][] p=new float[21][3];p[0]=new float[]{.5f,.9f,0};p[1]=new float[]{.4f,.82f,0};p[2]=new float[]{.34f,.72f,0};p[3]=new float[]{.3f,.6f,0};p[4]=new float[]{.26f,.5f,0};float[] x={.44f,.5f,.56f,.62f};for(int i=0;i<4;i++){int b=5+i*4;p[b]=new float[]{x[i],.67f,0};p[b+1]=new float[]{x[i],.5f,0};p[b+2]=new float[]{x[i],open?.37f:.69f,0};p[b+3]=new float[]{x[i],open?.25f:.75f,0};}return p;}
 public static void main(String[] args){
  float[][] v=hand(false);v[7][1]=.37f;v[8][1]=.25f;v[11][1]=.37f;v[12][1]=.25f;check(GestureRules.pose(v)==1,"V pose");
  float[][] heart=hand(false);heart[6]=new float[]{.44f,.53f,0};heart[7]=new float[]{.43f,.46f,0};heart[8]=new float[]{.49f,.43f,0};heart[3]=new float[]{.42f,.56f,0};heart[4]=new float[]{.45f,.46f,0};check(GestureRules.pose(heart)==2,"finger heart");for(float[] p:heart)p[0]=1-p[0];check(GestureRules.pose(heart)==2,"mirrored heart");
  float[][] pinch=hand(false);pinch[7]=new float[]{.4f,.42f,0};pinch[8]=new float[]{.42f,.53f,0};pinch[3]=new float[]{.42f,.64f,0};pinch[4]=new float[]{.42f,.53f,0};check(GestureRules.pose(pinch)==0,"pinch must not be heart");check(GestureRules.pose(hand(false))==0,"fist");
  GestureRules stable=new GestureRules();check(stable.update(v,1000)==0,"initial stability");check(stable.update(v,1250)==0,"short hold");check(stable.update(v,1375)==1,"confirmed V");check(stable.update(v,5000)==0,"held gesture repeated");stable.update(null,5100);stable.update(null,5600);stable.update(v,6000);check(stable.update(v,6375)==1,"release and repeat");
  GestureRules removed=new GestureRules();for(int i=0;i<24;i++){float[][] p=hand(true);for(float[] point:p)point[0]+=(i%4-2)*.1f;check(removed.update(p,1000+i*125)==0,"wave must be removed");}
  GestureRules switching=new GestureRules();switching.update(v,1000);check(switching.update(v,1375)==1,"first V");switching.update(heart,1600);check(switching.update(heart,2000)==0,"heart during cooldown");check(switching.update(heart,3875)==2,"heart after 2.5 seconds");check(switching.update(heart,8000)==0,"held heart repeated");
  System.out.println("PASS: V, heart, mirrored heart, pinch rejection, fist rejection, hold confirmation, no repeats, wave removed, 2.5 second cooldown, V to heart");
 }
}
