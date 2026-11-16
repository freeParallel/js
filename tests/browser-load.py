"""Browser-harness integration: run_load_checks(url, js, cdp, goto_url, wait_for_load)."""
import json
import time
import uuid
from pathlib import Path


def run_load_checks(url, js, cdp, goto_url, wait_for_load):
    passed = []
    root = Path.home() / 'AppData/Local/hermes/cache/scratch' / ('js-load-test-' + uuid.uuid4().hex[:8])
    root.mkdir(parents=True)
    def check(label, value):
        assert value, label
        passed.append(label)
        print('PASS', label)
    def code():
        return js('document.querySelector(".CodeMirror").CodeMirror.getValue()')
    def set_code(source):
        js('document.querySelector(".CodeMirror").CodeMirror.setValue(' + json.dumps(source) + ')')
    def auto(value):
        js('(()=>{const i=document.querySelector("input[name=autoRun]");i.checked=' + str(value).lower() + ';i.dispatchEvent(new Event("change",{bubbles:true}));})()')
    def click(selector):
        b=js(f"(()=>{{const b=document.querySelector('{selector}').getBoundingClientRect();return {{x:b.x+b.width/2,y:b.y+b.height/2}}}})()")
        for event in ['mousePressed','mouseReleased']:
            cdp('Input.dispatchMouseEvent',type=event,x=b['x'],y=b['y'],button='left',clickCount=1)
    def choose(name, text, confirmation=None, shortcut=False):
        target=root/name
        target.write_bytes(text.encode('utf-8'))
        js("(()=>{const el=document.querySelector('#loadFile');el.dataset.pickerOpened='no';el.addEventListener('click',()=>{el.dataset.pickerOpened='yes'},{once:true});})()")
        if shortcut:
            js('document.querySelector(".CodeMirror").CodeMirror.focus()')
            for event in ['keyDown','keyUp']:
                cdp('Input.dispatchKeyEvent',type=event,key='o',code='KeyO',windowsVirtualKeyCode=79,modifiers=2)
        else:
            click('#loadBtn')
        assert js("document.querySelector('#loadFile').dataset.pickerOpened==='yes'"), 'Button/shortcut must actually open the file picker'
        node=cdp('DOM.getDocument')['root']['nodeId']
        node=cdp('DOM.querySelector',nodeId=node,selector='#loadFile')['nodeId']
        cdp('DOM.setFileInputFiles',nodeId=node,files=[str(target)])
        time.sleep(.2)
        if confirmation is not None:
            cdp('Page.handleJavaScriptDialog',accept=confirmation)
        time.sleep(.5)
        return target
    goto_url(url);wait_for_load();cdp('Page.bringToFront')
    cdp('Emulation.setDeviceMetricsOverride',width=1400,height=900,deviceScaleFactor=1,mobile=False)
    cdp('Page.enable')
    cdp('Page.setInterceptFileChooserDialog',enabled=True)
    original=js("({code:localStorage.getItem('maquina.js.code'),settings:localStorage.getItem('maquina.js.settings')})")
    try:
        auto(False);set_code('const existing = 1;')
        check('Load button and file picker exist',js("!!document.querySelector('#loadBtn') && !!document.querySelector('#loadFile')"))
        choose('cancel.js','const replacement = 2;',False)
        check('cancel replacement preserves editor',code()=='const existing = 1;')
        marker='// café 🌍\nconsole.log("loaded · 世界");\n'
        auto(True);set_code('console.log("pending run should be cancelled")')
        js("history.replaceState(null,'',location.pathname+location.search+'#code=r'+btoa('console.log(\"old shared code\")'))")
        choose('unicode.js',marker,True)
        check('Unicode file loads exactly',code()==marker)
        check('loading turns auto-run off',not js('document.querySelector("input[name=autoRun]").checked'))
        check('load cancels pending execution and clears stale output',js("document.querySelectorAll('.row').length===0"))
        check('loaded code persists locally',js("localStorage.getItem('maquina.js.code')")==marker)
        check('file input resets for reselection',js("document.querySelector('#loadFile').value===''"))
        check('load button reenabled',not js("document.querySelector('#loadBtn').disabled"))
        check('load removes an obsolete shared-code hash',not js("location.hash.startsWith('#code=')"))
        goto_url(url);wait_for_load();cdp('Page.bringToFront');time.sleep(.6)
        check('reload retains loaded code',code()==marker)
        check('reload does not execute imported code',js("document.querySelectorAll('.row').length===0"))
        js('(()=>{const i=document.querySelector("input[name=showExpr]");i.checked=!i.checked;i.dispatchEvent(new Event("change",{bubbles:true}));})()')
        time.sleep(.3)
        check('display setting changes respect manual execution mode',js("document.querySelectorAll('.row').length===0"))
        click('#runBtn');time.sleep(.5)
        check('Run explicitly executes loaded source',js("[...document.querySelectorAll('.row')].some(r=>r.textContent.includes('loaded · 世界'))"))
        # Export after import is an actual round trip, not a synthetic Blob fixture.
        out=root/'roundtrip';out.mkdir()
        cdp('Browser.setDownloadBehavior',behavior='allow',downloadPath=str(out))
        click('#saveBtn')
        for _ in range(40):
            if (out/'maquina-snippet.js').exists():break
            time.sleep(.1)
        check('Load to Save round-trip preserves UTF-8 bytes',(out/'maquina-snippet.js').read_bytes()==marker.encode('utf-8'))
        choose('unicode.js',marker)
        check('same file can be selected again',code()==marker)
        choose('empty.txt','',True)
        check('empty text file can clear editor',code()=='')
        choose('unfinished.mjs','const = unfinished\n',shortcut=True)
        check('Ctrl+O loads unfinished .mjs without running it',code()=='const = unfinished\n' and js("document.querySelectorAll('.row').length===0"))
        before=code()
        choose('binary.js','abc\x00def')
        check('binary content rejected without losing code',code()==before and 'plain-text' in js("document.querySelector('#toast').textContent"))
        choose('not-code.png','not a code file')
        check('unsupported extension rejected',code()==before)
        choose('too-big.js','x'*(1024*1024+1))
        check('oversized file rejected',code()==before and '1 MB' in js("document.querySelector('#toast').textContent"))
        for width in [390,320]:
            cdp('Emulation.setDeviceMetricsOverride',width=width,height=844,deviceScaleFactor=1,mobile=True);time.sleep(.3)
            check(f'{width}px all toolbar actions remain reachable',js("[...document.querySelectorAll('.toolbar button')].every(a=>{const b=a.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth})"))
    finally:
        cdp('Page.setInterceptFileChooserDialog',enabled=False)
        cdp('Browser.setDownloadBehavior',behavior='default')
        auto(False)
        set_code(original['code'] or '')
        for key,value in [('maquina.js.code',original['code']),('maquina.js.settings',original['settings'])]:
            if value is None:js('localStorage.removeItem('+json.dumps(key)+')')
            else:js('localStorage.setItem('+json.dumps(key)+','+json.dumps(value)+')')
        cdp('Emulation.setDeviceMetricsOverride',width=1400,height=900,deviceScaleFactor=1,mobile=False)
    print('LOAD CHECKS PASSED',len(passed))
    return passed
