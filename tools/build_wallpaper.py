from pathlib import Path
import argparse,hashlib,json,zipfile,xml.etree.ElementTree as E
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--web',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();web=a.web.resolve();target=a.output.resolve()
if target.exists():raise SystemExit('Output already exists; choose a new output path')
if target.is_relative_to(web):raise SystemExit('Output must be outside the input directory')
for name in ['catalog.js','models','resources','vendor/pixi.min.js','vendor/live2d-display.min.js','vendor/live2d.min.js','vendor/live2dcubismcore.min.js']:
 if not (web/name).exists():raise SystemExit('Missing licensed web resource: '+name)
catalog=json.loads((web/'catalog.js').read_text(encoding='utf8').split('=',1)[1].rstrip(';\n '))
if not catalog:raise SystemExit('Empty catalog; prepare authorized models and metadata first')
programs=['app.js', 'index.html', 'settings.js', 'interface.css', 'backgrounds.js', 'device-profiles.js', 'runtime-compat.js', 'diagnostics.js', 'render-loop.js', 'voices.js', 'legacy-resources.js']
entries={}
for file in web.rglob('*'):
 if file.is_file() and file.suffix.lower() in {'.js','.html','.css','.json','.gz','.mtn','.moc','.moc3','.webp','.png','.jpg','.jpeg','.mp3','.opus','.wav','.bin'} and not any(part in {'.git','.idea','__pycache__'} for part in file.relative_to(web).parts):entries['web/'+file.relative_to(web).as_posix()]=file
for name in programs:entries['web/'+name]=root/'phone-test/web'/name
for name in ['band-logos.js','background-catalog.js','dialogues.js']:
 if 'web/'+name not in entries:entries['web/'+name]=root/'phone-test/web'/name
for member in catalog:
 for outfit in member['outfits']:
  if 'web/'+outfit['script'] not in entries:raise SystemExit('Missing model metadata: '+outfit['script'])
manifest=(root/'phone-test/manifest.xml').read_bytes();E.fromstring(manifest)
html=entries['web/index.html'].read_text(encoding='utf8');bridge=entries['web/legacy-resources.js'].read_text(encoding='utf8');html=html.replace('<head>','<head><base href="file:///anon-assets/web/"><script>'+bridge.replace('</script','<\\/script')+'</script>',1)
import re
def inline(match):return '<script>'+entries['web/'+match[1]].read_text(encoding='utf8').replace('</script','<\\/script')+'</script>'
bootstrap=re.sub(r'<script src="([^"]+)"></script>',inline,html)
target.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('manifest.xml',manifest)
 z.writestr('web/compat-index.html',bootstrap)
 for name,file in sorted(entries.items()):
  if name!='web/compat-index.html':z.write(file,name)
record={'file':target.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'characters':len(catalog),'outfits':sum(len(c['outfits']) for c in catalog),'resourceRights':'supplied and verified by the builder'}
target.with_suffix('.build.json').write_text(json.dumps(record,indent=2),encoding='utf8');print(json.dumps(record))
