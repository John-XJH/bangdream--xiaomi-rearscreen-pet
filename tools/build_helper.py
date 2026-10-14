from pathlib import Path
import argparse,hashlib,json,os,subprocess,zipfile,shutil,tempfile
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--android-jar',type=Path,required=True);p.add_argument('--build-tools',type=Path,required=True);p.add_argument('--jdk-bin',type=Path,required=True);p.add_argument('--deps-dir',type=Path);args=p.parse_args()
sdk=args.android_jar.resolve();bt=args.build_tools.resolve();jdk=args.jdk_bin.resolve();deps=(args.deps_dir or root/'work/gesture-deps').resolve()
for file in [sdk,bt/'aapt2.exe',bt/'zipalign.exe',jdk/'javac.exe',jdk/'java.exe',root/'compatibility/assets/hand_landmarker.task']:
 if not file.is_file():raise SystemExit('Required file missing: '+str(file))
libs=list((deps/'libs').glob('*.jar'))
if not libs:raise SystemExit('Run tools/fetch_gesture_dependencies.py first')
output=root/'build';output.mkdir(exist_ok=True)
workspace=tempfile.TemporaryDirectory(prefix='rear_build_');build=Path(workspace.name)
if not str(build).isascii():raise SystemExit('Please set TEMP to an ASCII directory for Android build tools')
src=build/'input';shutil.copytree(root/'compatibility',src/'compatibility');shutil.copy2(sdk,build/'android.jar');sdk=build/'android.jar'
def run(words):subprocess.run([str(w) for w in words],check=True)
generated=build/'generated';generated.mkdir(exist_ok=True);classes=build/'classes';classes.mkdir(exist_ok=True);dex=build/'dex';dex.mkdir(exist_ok=True)
run([bt/'aapt2.exe','compile','--dir',src/'compatibility/res','-o',build/'resources.zip'])
run([bt/'aapt2.exe','link','-I',sdk,'--manifest',src/'compatibility/AndroidManifest.xml','--java',generated,'-o',build/'unsigned.apk',build/'resources.zip'])
run([jdk/'javac.exe','-encoding','UTF-8','-source','8','-target','8','-classpath',os.pathsep.join(map(str,[sdk,*libs])),'-d',classes,*list((src/'compatibility/src').rglob('*.java')),*list(generated.rglob('*.java'))])
jar=build/'classes.jar'
with zipfile.ZipFile(jar,'w') as z:
 for file in classes.rglob('*.class'):z.write(file,file.relative_to(classes).as_posix())
run([jdk/'java.exe','-cp',bt/'lib/d8.jar','com.android.tools.r8.D8','--lib',sdk,'--min-api','29','--output',dex,jar,*libs])
with zipfile.ZipFile(build/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:
 for file in dex.glob('classes*.dex'):z.write(file,file.name)
 for file in (deps/'jni/arm64-v8a').glob('*.so'):z.write(file,'lib/arm64-v8a/'+file.name)
 z.write(root/'compatibility/assets/hand_landmarker.task','assets/hand_landmarker.task')
run([bt/'zipalign.exe','-f','4',build/'unsigned.apk',build/'aligned.apk'])
key=build/'local-development.keystore'
if (output/key.name).exists():shutil.copy2(output/key.name,key)
if not key.exists():run([jdk/'keytool.exe','-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=RearScreen Local Development'])
target=build/'背屏桌宠助手-源码示例.apk'
run([jdk/'java.exe','-jar',bt/'lib/apksigner.jar','sign','--ks',key,'--ks-pass','pass:android','--out',target,build/'aligned.apk'])
run([jdk/'java.exe','-jar',bt/'lib/apksigner.jar','verify',target])
(build/'helper-build.json').write_text(json.dumps({'file':target.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'abi':'arm64-v8a','minAPI':29,'targetAPI':35,'version':'0.14'},indent=2),encoding='utf8')
shutil.copy2(target,output/target.name);shutil.copy2(key,output/key.name);shutil.copy2(build/'helper-build.json',output/'helper-build.json');print(output/target.name);workspace.cleanup()
