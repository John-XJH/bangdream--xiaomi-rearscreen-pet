import xml.etree.ElementTree as ET
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def bootstrap_html(html):
    bridge=(ROOT/'phone-test/web/legacy-resources.js').read_text(encoding='utf8')
    html=html.replace('<head>','<head><base href="file:///anon-assets/web/"><script>'+bridge.replace('</script','<\\/script')+'</script>',1)
    def inline(match):
        code=(ROOT/'phone-test/web'/match[1]).read_text(encoding='utf8').replace('</script','<\\/script')
        return '<script>'+code+'</script>'
    return re.sub(r'<script src="([^"]+)"></script>',inline,html)

def update_loader(raw):
    root=ET.fromstring(raw);web=root.find("./WebView[@name='wv']")
    web.attrib.pop('uri',None);web.set('uriExp','@compat_page_url')
    for name,kind,expression in [('compat_page_url','string',"''"),('compat_local_api','number','0'),('compat_requested_id','number','0'),('compat_requested_path','string',"''")]:
        attrs={'name':name,'expression':expression,'const':'true'}
        if kind=='string':attrs['type']='string'
        root.insert(0,ET.Element('Var',attrs))
    def field(parent,target,cls,name,out):
        ET.SubElement(parent,'FieldCommand',{'target':target,'targetType':'var','class':cls,'field':name,'method':'get','return':out,'returnType':'object'})
    def method(parent,target,cls,name,out=None,params=None,types=None,kind='object',**extra):
        attrs={'target':target,'targetType':'var','class':cls,'method':name,**extra}
        if out:attrs.update({'return':out,'returnType':kind})
        if params is not None:attrs.update({'params':params,'paramTypes':types})
        ET.SubElement(parent,'MethodCommand',attrs)
    triggers=root.find('Triggers');init=ET.SubElement(triggers,'Trigger',{'action':'postInit'})
    ET.SubElement(init,'MethodCommand',{'target':'wv','class':'java.lang.Object','method':'getClass','return':'compat_web_class','returnType':'object'})
    method(init,'compat_web_class','java.lang.Class','getDeclaredField','compat_local_field',"'mLocal'",'java.lang.String',errorVar='compat_local_api')
    ET.SubElement(init,'VariableCommand',{'name':'compat_page_url','type':'string','expression':"'web/index.html'",'condition':'eq(#compat_local_api,1)'})
    legacy=ET.SubElement(init,'MultiCommand',{'condition':'ne(#compat_local_api,1)'})
    field(legacy,'__objContext','com.miui.maml.ScreenContext','mContext','compat_android_context')
    field(legacy,'__objContext','com.miui.maml.ScreenContext','mResourceManager','compat_manager')
    method(legacy,'compat_manager','com.miui.maml.ResourceManager','getResourceLoader','compat_loader')
    field(legacy,'compat_file_utils','com.miui.maml.util.FileUtils','Companion','compat_file_utils')
    method(legacy,'compat_android_context','android.content.Context','getCacheDir','compat_cache_file')
    method(legacy,'compat_cache_file','java.io.File','getAbsolutePath','compat_cache_base',kind='string')
    ET.SubElement(legacy,'VariableCommand',{'name':'compat_cache_dir','type':'string','expression':"@compat_cache_base+'/anon-legacy-web/'"})
    method(legacy,'compat_file_utils','com.miui.maml.util.FileUtils$Companion','createTempFile','compat_boot_path',"'compat_loader','web/compat-index.html',@compat_cache_dir",'com.miui.maml.ResourceLoader,java.lang.String,java.lang.String',kind='string')
    ET.SubElement(legacy,'VariableCommand',{'name':'compat_page_url','type':'string','expression':"'file://'+@compat_boot_path"})
    action=ET.SubElement(web.find('Triggers'),'Trigger',{'action':'resolveLegacyResource'})
    method(action,'compat_file_utils','com.miui.maml.util.FileUtils$Companion','createTempFile','compat_file_path',"'compat_loader',@compat_requested_path,@compat_cache_dir",'com.miui.maml.ResourceLoader,java.lang.String,java.lang.String',kind='string')
    # FileUtils generates ASCII temp names within the host cache directory.
    ET.SubElement(action,'WebViewCommand',{'target':'wv','command':'runjs','params':"'window.petLegacyResourceReady('+ #compat_requested_id +',\"'+@compat_file_path+'\");'"})
    # The old factory lacks WebViewCommand; both hosts expose these public methods.
    for command in root.iter('WebViewCommand'):
        attrs=dict(command.attrib);kind=attrs.pop('command');command.tag='MethodCommand'
        attrs.update({'class':'com.miui.maml.elements.WebViewScreenElement','method':{'runjs':'runjs','reload':'reload','goback':'goBack'}[kind]})
        if kind=='runjs':attrs['paramTypes']='java.lang.String'
        command.attrib.clear();command.attrib.update(attrs)
    return ET.tostring(root,encoding='unicode')
