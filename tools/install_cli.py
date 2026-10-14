from pathlib import Path
import json,subprocess,sys
root=Path(__file__).resolve().parents[1]
def path(prompt):return Path(input(prompt).strip().strip('"')).expanduser().resolve()
adb=path('ADB程序完整路径（例如 C:\\platform-tools\\adb.exe）：');package=path('有权使用的rearscreen资源包完整路径：')
if not adb.is_file() or not package.is_file():raise SystemExit('文件不存在；未修改手机。')
base=[sys.executable,str(root/'compatibility/check_phone.py'),'--adb-path',str(adb),'--package',str(package)]
subprocess.run(base,check=True)
report=json.loads((root/'outputs/兼容与恢复/手机兼容检查.json').read_text(encoding='utf8'));themes=report['themes']
if not themes:raise SystemExit('没有可用主题目录；请先从系统AI壁纸入口应用原壁纸。未推送资源。')
for i,item in enumerate(themes,1):print(i,item['id'])
print('必须自行确认目标对应原始AI壁纸入口，不能凭主题数量猜测。')
choice=input('输入已确认目标的序号；无法确认则直接回车退出：').strip()
if not choice:raise SystemExit('已退出，未推送资源。')
if not choice.isdigit() or not 1<=int(choice)<=len(themes):raise SystemExit('无效序号，未推送资源。')
theme=themes[int(choice)-1]['id']
if input('将先备份再替换该主题资源。输入 INSTALL 确认：').strip()!='INSTALL':raise SystemExit('未确认，未推送资源。')
subprocess.run(base+['--restore','--theme',theme],check=True)
print('校验完成。请从手机原AI壁纸入口重新应用，并按验收清单测试。')
