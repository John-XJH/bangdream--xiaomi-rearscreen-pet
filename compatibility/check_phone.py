import argparse,subprocess,json,re,hashlib,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ADB=ROOT/'work/android-tools/platform-tools/adb.exe'
BASE='/sdcard/Android/data/com.android.thememanager/files/MIUI/.ai_wallpaper/maml'
OUT=ROOT/'outputs/兼容与恢复';OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--restore',action='store_true');parser.add_argument('--theme');parser.add_argument('--restart-host',action='store_true');parser.add_argument('--adb-path',type=Path);parser.add_argument('--package',type=Path);args=parser.parse_args()
if args.adb_path:ADB=args.adb_path.resolve()
def call(*words,allow_fail=False,cwd=None):
 r=subprocess.run([str(ADB),*words],capture_output=True,text=True,encoding='utf-8',errors='replace',cwd=cwd)
 if r.returncode and not allow_fail:raise RuntimeError((r.stderr or r.stdout).strip())
 return r.stdout.strip()
devices=[line.split()[0] for line in call('devices').splitlines()[1:] if line.endswith('\tdevice')]
if len(devices)!=1:raise SystemExit('请连接一台已授权 USB 调试的手机。')
serial=devices[0]
def adb(*words,**kwargs):return call('-s',serial,*words,**kwargs)
def shell(*words,**kwargs):return adb('shell',*words,**kwargs)
def version(pkg):
 text=shell('dumpsys','package',pkg,allow_fail=True)
 return {k:(re.search(r'\b'+k+r'=([^\s]+)',text).group(1) if re.search(r'\b'+k+r'=([^\s]+)',text) else None) for k in ['versionName','versionCode']}
state={'model':shell('getprop','ro.product.model'),'system':shell('getprop','ro.build.version.incremental'),'api':shell('getprop','ro.build.version.sdk'),'host':version('com.xiaomi.subscreencenter'),'themeManager':version('com.android.thememanager')}
display_text=shell('dumpsys','display',allow_fail=True);displays={}
for line in display_text.splitlines():
 if 'DisplayInfo{' not in line:continue
 identity=re.search(r'displayId[ =]+(\d+)',line);size=re.search(r'real (\d+) x (\d+)',line)
 if identity and size:displays[int(identity[1])]={'id':int(identity[1]),'width':int(size[1]),'height':int(size[2])}
profiles=json.loads((ROOT/'compatibility/device_profiles.json').read_text(encoding='utf-8'))
known=next((item for item in profiles if state['model'] in item['modelIds']),None)
web=shell('dumpsys','webviewupdate',allow_fail=True);state['webview']=next((x.strip() for x in web.splitlines() if 'Current WebView package' in x),'未找到')
local=args.package.resolve() if args.package else ROOT/'outputs/爱音背屏测试/rearscreen';local_hash=hashlib.sha256(local.read_bytes()).hexdigest() if local.is_file() else None
if args.restore and local_hash is None:raise SystemExit('请先用 --package 指定已准备好的桌宠资源包。')
folders=shell('ls','-1',BASE,allow_fail=True).splitlines();themes=[]
for folder in folders:
 if not re.fullmatch('[a-fA-F0-9-]{32,36}',folder):continue
 remote=BASE+'/'+folder+'/rearscreen';raw=shell('sha256sum',remote,allow_fail=True);match=re.match('[a-fA-F0-9]{64}',raw)
 if match:themes.append({'id':folder,'sha256':match.group(0),'matchesLocal':match.group(0)==local_hash})
pid=shell('pidof','com.xiaomi.subscreencenter',allow_fail=True).split()
errors=[]
if pid:
 logs=adb('logcat','-d','--pid='+pid[0],allow_fail=True)
 error_markers = ('WebViewScreenElement init error', 'Already registered a list of actions', 'ERR_CLEARTEXT_NOT_PERMITTED', 'loadUrl blocked', 'Resource not found:', 'Error serving resource:', 'net::ERR_')
 errors=[line[:400] for line in logs.splitlines() if any(marker in line for marker in error_markers)]
report={'time':datetime.datetime.now().isoformat(),'state':state,'themes':themes,'localSha256':local_hash,'hostWebViewErrors':errors[-8:],'scope':'只读版本、入口和文件检查；不证明画面/触摸/重启兼容'}
report['displays']=list(displays.values());report['deviceProfile']=known['id'] if known else None
report['compatibilityStatus']='当前测试机型；系统版本变化仍需复测' if known and known['deviceTested'] else '机型未实测；尺寸预适配不代表系统接入已兼容'
baseline_path=OUT/'当前检查基线.json'
if baseline_path.exists():
 baseline=json.loads(baseline_path.read_text(encoding='utf-8'));report['versionChanges']={k:{'before':baseline.get(k),'now':v} for k,v in state.items() if baseline.get(k)!=v}
report['result']='资源未找到，需要重新建立壁纸入口' if not themes else '资源与电脑版本一致，仍需实机功能验证' if any(t['matchesLocal'] for t in themes) else '手机资源与电脑版本不同，检查所选壁纸后恢复'
if args.restart_host:
 if state['model']!='2509FPN0BC':raise SystemExit('宿主重启目前仅验证小米 17 Pro Max 2509FPN0BC；其他机型先检查背屏显示 ID。')
 shell('am','force-stop','com.xiaomi.subscreencenter')
 report['restartOutput']=shell('am','start','--display','1','-a','android.intent.action.MAIN','-c','android.intent.category.SECONDARY_HOME','-n','com.xiaomi.subscreencenter/.SubScreenLauncher')
 report['result']='已请求重启背屏宿主；请唤醒实体背屏检查角色，必要时重新应用唯美动漫。没有清除应用数据。'
if args.restore:
 if not args.theme or not any(t['id']==args.theme for t in themes):raise SystemExit('恢复必须指定检查报告中存在的 --theme ID；不自动猜测目录，不新建失效入口。')
 remote=BASE+'/'+args.theme+'/rearscreen';backup=OUT/'手机资源备份'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S');backup.mkdir(parents=True,exist_ok=True)
 adb('pull',remote,'rearscreen',cwd=str(backup));adb('push',str(local),remote)
 if not shell('sha256sum',remote).startswith(local_hash):raise RuntimeError('推送后校验失败')
 report['restored']=args.theme;report['backup']=str(backup);report['result']='文件恢复校验通过；请在手机重新应用壁纸，尚未确认运行恢复'
(OUT/'手机兼容检查.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True,indent=2))
