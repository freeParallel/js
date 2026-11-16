"""Run in browser_exec: run_save_checks(url, js, cdp, goto_url, wait_for_load)."""
import json
import time
import uuid
from pathlib import Path


def run_save_checks(url, js, cdp, goto_url, wait_for_load):
    checks = []
    root = Path.home() / 'AppData/Local/hermes/cache/scratch' / ('js-download-test-' + uuid.uuid4().hex[:8])
    root.mkdir(parents=True)
    def check(name, passed):
        assert passed, name
        checks.append(name)
        print('PASS', name)
    def editor_set(value):
        js('document.querySelector(".CodeMirror").CodeMirror.setValue(' + json.dumps(value) + ')')
    def click(selector):
        b = js(f"(()=>{{const b=document.querySelector('{selector}').getBoundingClientRect();return {{x:b.x+b.width/2,y:b.y+b.height/2}}}})()")
        for event in ['mousePressed', 'mouseReleased']:
            cdp('Input.dispatchMouseEvent',type=event,x=b['x'],y=b['y'],button='left',clickCount=1)
    def download(label, code, shortcut=False):
        folder = root / label
        folder.mkdir()
        cdp('Browser.setDownloadBehavior',behavior='allow',downloadPath=str(folder))
        editor_set(code)
        if shortcut:
            js('document.querySelector(".CodeMirror").CodeMirror.focus()')
            cdp('Input.dispatchKeyEvent',type='keyDown',key='S',code='KeyS',windowsVirtualKeyCode=83,modifiers=10)
            cdp('Input.dispatchKeyEvent',type='keyUp',key='S',code='KeyS',windowsVirtualKeyCode=83,modifiers=10)
        else:
            click('#saveBtn')
        target = folder / 'maquina-snippet.js'
        for _ in range(40):
            if target.exists():
                break
            time.sleep(.1)
        check(label + ' creates a real .js download', target.exists())
        check(label + ' preserves exact UTF-8 contents', target.read_bytes() == code.encode('utf-8'))
        check(label + ' leaves editor unchanged', js('document.querySelector(".CodeMirror").CodeMirror.getValue()') == code)
    goto_url(url)
    wait_for_load()
    cdp('Page.bringToFront')
    cdp('Emulation.setDeviceMetricsOverride',width=1400,height=900,deviceScaleFactor=1,mobile=False)
    time.sleep(.8)
    check('Save action is present', js("!!document.querySelector('#saveBtn')"))
    original = js('document.querySelector(".CodeMirror").CodeMirror.getValue()')
    auto = js('document.querySelector("input[name=autoRun]").checked')
    js('(()=>{const i=document.querySelector("input[name=autoRun]");i.checked=false;i.dispatchEvent(new Event("change",{bubbles:true}));})()')
    try:
        download('unicode', '// café 🌍\nconst greeting = "héllo · 世界";\n\n')
        download('empty', '')
        download('invalid-syntax-shortcut', 'const = unfinished\n', True)
        check('Ctrl+S still has the Share binding', js('typeof document.querySelector(".CodeMirror").CodeMirror.getOption("extraKeys")["Ctrl-S"] === "function"'))
        for width in [390, 320]:
            cdp('Emulation.setDeviceMetricsOverride',width=width,height=844,deviceScaleFactor=1,mobile=True)
            time.sleep(.3)
            check(f'{width}px save button reachable', js("(()=>{const b=document.querySelector('#saveBtn').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.width>0})()"))
            check(f'{width}px settings/fullscreen stay visible', js("['settingsBtn','fullscreenBtn'].every(id=>{const b=document.getElementById(id).getBoundingClientRect();return b.left>=0&&b.right<=innerWidth})"))
    finally:
        editor_set(original)
        js(f'(()=>{{const i=document.querySelector("input[name=autoRun]");i.checked={str(auto).lower()};i.dispatchEvent(new Event("change",{{bubbles:true}}));}})()')
        cdp('Browser.setDownloadBehavior',behavior='default')
        cdp('Emulation.setDeviceMetricsOverride',width=1400,height=900,deviceScaleFactor=1,mobile=False)
    print('SAVE CHECKS PASSED',len(checks),'download files:',str(root))
    return checks
