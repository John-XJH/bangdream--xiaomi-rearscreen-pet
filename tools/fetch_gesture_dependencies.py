from pathlib import Path
import urllib.request,urllib.error,xml.etree.ElementTree as E,json,zipfile
root=Path(__file__).resolve().parents[1];dest=root/'work/gesture-deps';dest.mkdir(exist_ok=True)
repos=['https://dl.google.com/dl/android/maven2/','https://repo.maven.apache.org/maven2/'];ns={'m':'http://maven.apache.org/POM/4.0.0'}
effective={};artifacts={}
def download(path,target):
 if target.exists():return
 for repo in repos:
  try:
   data=urllib.request.urlopen(repo+path,timeout=40).read();target.write_bytes(data);return
  except urllib.error.HTTPError as e:
   if e.code!=404:raise
 raise RuntimeError('Artifact not found: '+path)
def resolve(value,props):
 for _ in range(12):
  old=value
  for k,v in props.items():value=value.replace('${'+k+'}',v)
  if value==old:break
 return value
def pom(g,a,v):
 key=(g,a,v)
 if key in effective:return effective[key]
 stem=g.replace('.','/')+'/'+a+'/'+v+'/'+a+'-'+v
 file=dest/(g+'-'+a+'-'+v+'.pom');download(stem+'.pom',file);x=E.fromstring(file.read_bytes());props={};managed={}
 parent=x.find('m:parent',ns)
 if parent is not None:
  pg=parent.findtext('m:groupId',namespaces=ns);pa=parent.findtext('m:artifactId',namespaces=ns);pv=parent.findtext('m:version',namespaces=ns)
  base=pom(pg,pa,pv);props.update(base['props']);managed.update(base['managed'])
 for child in x.findall('m:properties/*',ns):props[child.tag.split('}')[-1]]=child.text or ''
 props.update({'project.version':v,'project.groupId':g,'project.artifactId':a,'pom.version':v})
 for d in x.findall('m:dependencyManagement/m:dependencies/m:dependency',ns):
  dg=d.findtext('m:groupId',namespaces=ns);da=d.findtext('m:artifactId',namespaces=ns);dv=d.findtext('m:version',namespaces=ns)
  if dv:managed[(dg,da)]=resolve(dv,props)
 deps=[]
 for d in x.findall('m:dependencies/m:dependency',ns):
  if d.findtext('m:scope','compile',ns) not in ['compile','runtime'] or d.findtext('m:optional','false',ns)=='true':continue
  dg=d.findtext('m:groupId',namespaces=ns);da=d.findtext('m:artifactId',namespaces=ns);dv=d.findtext('m:version',namespaces=ns) or managed.get((dg,da))
  if not dv:raise RuntimeError('Missing dependency version '+str((g,a,dg,da)))
  dv=resolve(dv,props)
  if '${' in dv:raise RuntimeError('Unresolved version '+dv)
  deps.append((dg,da,dv))
 result={'props':props,'managed':managed,'deps':deps,'packaging':x.findtext('m:packaging','jar',ns),'stem':stem};effective[key]=result;return result
def fetch(g,a,v):
 if (g,a) in artifacts:return
 p=pom(g,a,v);ext='jar' if p['packaging']=='bundle' else p['packaging'];artifacts[(g,a)]={'group':g,'artifact':a,'version':v,'kind':ext}
 if ext not in ['aar','jar']:raise RuntimeError('Unexpected package '+ext)
 file=dest/(a+'-'+v+'.'+ext);download(p['stem']+'.'+ext,file);print(a,v,file.stat().st_size,flush=True)
 for dep in p['deps']:fetch(*dep)
fetch('com.google.mediapipe','tasks-vision','1.1.0')
lib=dest/'libs';lib.mkdir(exist_ok=True);jni=dest/'jni/arm64-v8a';jni.mkdir(parents=True,exist_ok=True)
for item in artifacts.values():
 file=dest/(item['artifact']+'-'+item['version']+'.'+item['kind'])
 if item['kind']=='jar':(lib/file.name).write_bytes(file.read_bytes())
 else:
  with zipfile.ZipFile(file) as z:
   if 'classes.jar' in z.namelist():(lib/(file.stem+'.jar')).write_bytes(z.read('classes.jar'))
   for name in z.namelist():
    if name.startswith('jni/arm64-v8a/') and name.endswith('.so'):(jni/Path(name).name).write_bytes(z.read(name))
asset=root/'compatibility/assets/hand_landmarker.task';asset.parent.mkdir(exist_ok=True)
if not asset.exists():asset.write_bytes(urllib.request.urlopen('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',timeout=60).read())
(dest/'dependencies.json').write_text(json.dumps(list(artifacts.values()),indent=2),encoding='utf8')
print('READY',len(artifacts),'model',asset.stat().st_size,flush=True)
