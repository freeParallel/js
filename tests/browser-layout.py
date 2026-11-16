"""Browser harness: run_layout_checks(url, js, cdp, goto_url, wait_for_load)."""
import json
import time


def run_layout_checks(url, js, cdp, goto_url, wait_for_load):
    passed=[]
    def check(name, condition):
        assert condition,name
        passed.append(name);print('PASS',name)
    def click(selector):
        b=js(f"(()=>{{const b=document.querySelector('{selector}').getBoundingClientRect();return {{x:b.x+b.width/2,y:b.y+b.height/2}}}})()")
        for event in ['mousePressed','mouseReleased']:
            cdp('Input.dispatchMouseEvent',type=event,x=b['x'],y=b['y'],button='left',clickCount=1)
    def key(name,vk,mod=0,code=None):
        for event in ['keyDown','keyUp']:
            cdp('Input.dispatchKeyEvent',type=event,key=name,code=code or name,windowsVirtualKeyCode=vk,modifiers=mod)
    def code():return js("document.querySelector('.CodeMirror').CodeMirror.getValue()")
    def set_code(source):js('document.querySelector(".CodeMirror").CodeMirror.setValue('+json.dumps(source)+')')
    def auto(value):js('(()=>{const i=document.querySelector("input[name=autoRun]");i.checked='+str(value).lower()+';i.dispatchEvent(new Event("change",{bubbles:true}));})()')
    def box(selector):return js(f"document.querySelector('{selector}').getBoundingClientRect().toJSON()")
    def choose(layout):
        click('#layoutBtn');click('[data-layout-option='+layout+']');time.sleep(.15)
    goto_url(url);wait_for_load();cdp('Page.bringToFront')
    cdp('Emulation.setDeviceMetricsOverride',width=1400,height=900,deviceScaleFactor=1,mobile=False)
    saved=js("({code:localStorage.getItem('maquina.js.code'),settings:localStorage.getItem('maquina.js.settings'),hash:location.hash})")
    try:
        auto(False)
        source='// clear regression\nconst x = "café 🌍";\nconsole.log(x);\n'
        set_code(source);click('#clearBtn')
        check('Clear empties the code editor',code()=='')
        check('Clear persists an empty editor',js("localStorage.getItem('maquina.js.code')")== '')
        key('z',90,2,'KeyZ')
        check('Ctrl+Z restores exact cleared source',code()==source)
        set_code('setTimeout(()=>console.log("late"),700)');click('#runBtn');time.sleep(.1);click('#clearBtn');time.sleep(.8)
        check('Clear stops old asynchronous output',js("document.querySelectorAll('.row').length===0"))
        auto(True);set_code('console.log("pending")');click('#clearBtn');time.sleep(.6)
        check('Clear cancels pending auto-run',code()=='' and js("document.querySelectorAll('.row').length===0"))
        js("history.replaceState(null,'',location.pathname+location.search+'#code=rold')")
        click('#clearBtn');check('Clear removes stale share state',js("location.hash===''"))
        auto(False);set_code('console.log("layout output");\n[2,3].map(x=>x*x)');click('#runBtn');time.sleep(.5)
        check('exactly three layout options exist',js("document.querySelectorAll('[data-layout-option]').length===3"))
        for layout in ['right','below','left']:
            before=code();choose(layout)
            e,o=box('#editorPane'),box('#outputPane')
            placed=(o['left']>=e['right']-.5) if layout=='right' else (o['top']>=e['bottom']-.5) if layout=='below' else (o['right']<=e['left']+.5)
            check(layout+' output is correctly positioned',placed)
            check(layout+' preserves editor content',code()==before)
            check(layout+' preserves and displays output',js("[...document.querySelectorAll('.row')].some(r=>r.textContent==='[ 4, 9 ]')"))
            check(layout+' row stays inside output pane',js("(()=>{const r=document.querySelector('.row').getBoundingClientRect(),o=document.querySelector('#outputPane').getBoundingClientRect();return r.top>=o.top&&r.bottom<=o.bottom})()"))
            check(layout+' has one selected option',js("document.querySelectorAll('[data-layout-option][aria-pressed=true]').length===1"))
            check(layout+' closes chooser and returns focus',js("document.querySelector('#layoutMenu').hidden&&document.activeElement.id==='layoutBtn'"))
            # Pointer resizing must invert its horizontal fraction for a left output.
            d=box('#divider');x,y=d['x']+d['width']/2,d['y']+d['height']/2
            cdp('Input.dispatchMouseEvent',type='mousePressed',x=x,y=y,button='left',clickCount=1)
            cdp('Input.dispatchMouseEvent',type='mouseMoved',x=x+(0 if layout=='below' else 55),y=y+(45 if layout=='below' else 0),button='left',buttons=1)
            cdp('Input.dispatchMouseEvent',type='mouseReleased',x=x+(0 if layout=='below' else 55),y=y+(45 if layout=='below' else 0),button='left',clickCount=1)
            time.sleep(.15);after=box('#editorPane')
            changed=after['height']>e['height']+20 if layout=='below' else after['width']<e['width']-20 if layout=='left' else after['width']>e['width']+20
            check(layout+' pointer divider resizes in the correct direction',changed)
            js("document.querySelector('#divider').focus()")
            key('ArrowDown' if layout=='below' else 'ArrowLeft' if layout=='left' else 'ArrowRight',40 if layout=='below' else 37 if layout=='left' else 39)
            newer=box('#editorPane')
            check(layout+' divider supports keyboard resizing',newer['height']>after['height'] if layout=='below' else newer['width']>after['width'])
            goto_url(url);wait_for_load();cdp('Page.bringToFront')
            check(layout+' persists after reload',js("document.querySelector('.panes').dataset.layout")==layout)
            click('#runBtn');time.sleep(.4)
        choose('below')
        set_code('\n'.join('console.log("line '+str(i)+'")' for i in range(60)));click('#runBtn');time.sleep(.4)
        js("document.querySelector('.CodeMirror').CodeMirror.scrollTo(null,99999)");time.sleep(.2)
        check('below output follows editor scrolling',js("[...document.querySelectorAll('.row')].some(r=>r.textContent==='line 59')"))
        click('#layoutBtn');key('Escape',27)
        check('Escape closes layout popup',js("document.querySelector('#layoutMenu').hidden&&document.activeElement.id==='layoutBtn'"))
        click('#layoutBtn');click('#runBtn');time.sleep(.1)
        check('outside click dismisses layout popup',js("document.querySelector('#layoutMenu').hidden"))
        for width in [390,320]:
            cdp('Emulation.setDeviceMetricsOverride',width=width,height=844,deviceScaleFactor=1,mobile=True);time.sleep(.2)
            for layout in ['right','below','left']:
                choose(layout)
                check(f'{width}px {layout} panes fit',js("(()=>{const p=document.querySelector('.panes').getBoundingClientRect();return ['editorPane','outputPane'].every(id=>{const b=document.getElementById(id).getBoundingClientRect();return b.left>=p.left-.5&&b.right<=p.right+.5&&b.top>=p.top-.5&&b.bottom<=p.bottom+.5})})()"))
            click('#layoutBtn')
            check(f'{width}px layout chooser fits',js("(()=>{const b=document.querySelector('#layoutMenu').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth})()"))
            key('Escape',27)
    finally:
        auto(False);set_code(saved['code'] or '')
        for k,v in [('maquina.js.code',saved['code']),('maquina.js.settings',saved['settings'])]:
            if v is None:js('localStorage.removeItem('+json.dumps(k)+')')
            else:js('localStorage.setItem('+json.dumps(k)+','+json.dumps(v)+')')
        js('history.replaceState(null,"",location.pathname+location.search+'+json.dumps(saved['hash'])+')')
        cdp('Emulation.setDeviceMetricsOverride',width=1400,height=900,deviceScaleFactor=1,mobile=False)
    print('LAYOUT/CLEAR CHECKS PASSED',len(passed))
    return passed
