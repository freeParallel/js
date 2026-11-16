"""Browser harness: run_undo_checks(url, js, cdp, goto_url, wait_for_load)."""
import json
import time


def run_undo_checks(url, js, cdp, goto_url, wait_for_load):
    passed=[]
    def check(label, value):
        assert value,label
        passed.append(label);print('PASS',label)
    def click(selector):
        b=js(f"(()=>{{const b=document.querySelector('{selector}').getBoundingClientRect();return {{x:b.x+b.width/2,y:b.y+b.height/2}}}})()")
        for event in ['mousePressed','mouseReleased']:
            cdp('Input.dispatchMouseEvent',type=event,x=b['x'],y=b['y'],button='left',clickCount=1)
    def key(char,code,vk,modifiers=0):
        for event in ['keyDown','keyUp']:
            cdp('Input.dispatchKeyEvent',type=event,key=char,code=code,windowsVirtualKeyCode=vk,modifiers=modifiers)
    goto_url(url);wait_for_load();cdp('Page.bringToFront')
    cdp('Emulation.setDeviceMetricsOverride',width=1400,height=900,deviceScaleFactor=1,mobile=False)
    original=js("({code:localStorage.getItem('maquina.js.code'),settings:localStorage.getItem('maquina.js.settings')})")
    try:
        js('(()=>{const i=document.querySelector("input[name=autoRun]");i.checked=false;i.dispatchEvent(new Event("change",{bubbles:true}));})()')
        check('Undo begins disabled without edit history',js("document.querySelector('#undoBtn').disabled"))
        source='// café 🌍\nconst example = 42;\n'
        js('document.querySelector(".CodeMirror").CodeMirror.setValue('+json.dumps(source)+')')
        check('edit enables Undo',not js("document.querySelector('#undoBtn').disabled"))
        click('#clearBtn')
        check('Clear code empties editor',js("document.querySelector('.CodeMirror').CodeMirror.getValue()===''"))
        click('#undoBtn')
        check('Undo button restores cleared source exactly',js("document.querySelector('.CodeMirror').CodeMirror.getValue()") == source)
        check('Undo updates browser autosave',js("localStorage.getItem('maquina.js.code')")==source)
        check('Undo returns focus to editor',js("document.querySelector('.CodeMirror').CodeMirror.hasFocus()"))
        key('z','KeyZ',90,2)
        check('keyboard Undo still works and disables exhausted history',js("document.querySelector('#undoBtn').disabled"))
        js("document.querySelector('.CodeMirror').CodeMirror.replaceSelection('x','end','+input')")
        click('#undoBtn')
        check('button undoes ordinary edits too',js("document.querySelector('#undoBtn').disabled"))
        for width in [1400,800,390,320]:
            cdp('Emulation.setDeviceMetricsOverride',width=width,height=900,deviceScaleFactor=1,mobile=width<500);time.sleep(.2)
            check(f'{width}px action order is Undo, Clear code, Clear output',js("document.querySelector('#undoBtn').nextElementSibling?.id==='clearBtn'&&document.querySelector('#clearBtn').nextElementSibling?.id==='clearOutputBtn'"))
            check(f'{width}px three actions stay side-by-side and visible',js("(()=>{const b=['undoBtn','clearBtn','clearOutputBtn'].map(id=>document.getElementById(id).getBoundingClientRect());return b.every(x=>x.left>=0&&x.right<=innerWidth&&Math.abs(x.top-b[0].top)<1)&&b[1].left>b[0].right&&b[2].left>b[1].right})()"))
    finally:
        for k,v in [('maquina.js.code',original['code']),('maquina.js.settings',original['settings'])]:
            if v is None:js('localStorage.removeItem('+json.dumps(k)+')')
            else:js('localStorage.setItem('+json.dumps(k)+','+json.dumps(v)+')')
        cdp('Emulation.setDeviceMetricsOverride',width=1400,height=900,deviceScaleFactor=1,mobile=False)
    print('UNDO CHECKS PASSED',len(passed))
    return passed
