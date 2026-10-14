package org.anon.companion;

public final class GestureRules {
 public static final int NONE=0,VICTORY=1,HEART=2;
 public int candidate=0;private int previous=0,lastSent=0;private long since=0,lastAt=-10000,noneSince=0;
 static float distance(float[][] p,int a,int b){return (float)Math.hypot(p[a][0]-p[b][0],p[a][1]-p[b][1]);}
 static boolean extended(float[][] p,int base,int pip,int tip){return distance(p,tip,0)>distance(p,pip,0)*1.13f&&distance(p,tip,base)>distance(p,pip,base)*1.4f;}
 static float directionDot(float[][] p,int a,int b,int c,int d){float x=p[b][0]-p[a][0],y=p[b][1]-p[a][1],u=p[d][0]-p[c][0],v=p[d][1]-p[c][1];return (x*u+y*v)/(float)Math.max(.00001,Math.hypot(x,y)*Math.hypot(u,v));}
 public static int pose(float[][] p){
  if(p==null||p.length!=21)return NONE;
  float width=distance(p,5,17);if(width<.035f)return NONE;
  boolean index=extended(p,5,6,8),middle=extended(p,9,10,12),ring=extended(p,13,14,16),little=extended(p,17,18,20);
  if(index&&middle&&!ring&&!little&&distance(p,8,12)>width*.22f)return VICTORY;
  if(!middle&&!ring&&!little&&distance(p,8,0)>distance(p,6,0)*.92f&&distance(p,4,7)<width*.40f&&distance(p,4,8)<width*.65f&&directionDot(p,3,4,7,8)>-.60f&&distance(p,4,2)>width*.35f)return HEART;
  return NONE;
 }
 public static String name(int code){return code==VICTORY?"比耶":code==HEART?"单手比心":"等待手势";}
 public boolean cooling(long now){return now-lastAt<2500;}
 public int update(float[][] p,long now){
  candidate=pose(p);
  if(candidate==NONE){if(noneSince==0)noneSince=now;if(now-noneSince>=400)lastSent=NONE;}else noneSince=0;
  if(candidate!=previous){previous=candidate;since=now;}
  if(candidate!=NONE&&now-since>=350&&now-lastAt>=2500&&candidate!=lastSent){lastSent=candidate;lastAt=now;return candidate;}
  return NONE;
 }
}
