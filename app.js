/* maquina.js — live JavaScript scratchpad by maquina.Earth.
 * Code runs in a disposable Web Worker; console output and top-level
 * expression values are shown on the matching line in the right pane. */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const STORE = { code: 'maquina.js.code', settings: 'maquina.js.settings' };
  const MAX_PER_LINE = 50;

  const EXAMPLE = [
    '// maquina.js: results appear next to each line as you type.',
    '// Ctrl+Enter runs manually · Ctrl+S copies a share link.',
    'console.log("Hello, world!")',
    '',
    'const nums = [1, 2, 3, 4, 5]',
    'nums.map(n => n * n)',
    '',
    'const sum = nums.reduce((a, b) => a + b, 0)',
    'sum',
    '',
    'for (let i = 0; i < 3; i++) console.log("i =", i)',
    '',
    'const user = { name: "Ada", born: 1815, tags: new Set(["math", "code"]) }',
    'user',
    '',
    'const wait = (ms) => new Promise((r) => setTimeout(r, ms))',
    'await wait(500)',
    '"waited 500ms"',
    '',
    'fetch("https://api.github.com/zen").then((r) => r.text())',
    '',
  ].join('\n');

  // ---------------------------------------------------------------- settings
  const DEFAULTS = { autoRun: true, showExpr: true, lineNumbers: true, fontSize: 14, timeout: 5, split: 58 };
  const settings = { ...DEFAULTS };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(STORE.settings) || '{}')); } catch { /* ignore */ }
  const saveSettings = () => localStorage.setItem(STORE.settings, JSON.stringify(settings));

  // ------------------------------------------------------------------ worker
  // Serialized with toString() and run inside a Blob worker, so it must not
  // reference anything from the enclosing scope.
  function workerMain() {
    const FILE = 'playground.js';
    const LINE_RE = /playground\.js:(\d+)/;
    const lineOf = (stack) => { const m = LINE_RE.exec(stack || ''); return m ? +m[1] : null; };
    const here = () => lineOf(new Error().stack);

    const post = (msg) => {
      try { postMessage(msg); }
      catch { postMessage({ type: 'out', line: msg.line, kind: 'error', text: '[unserializable output]' }); }
    };

    const typeOf = (v) => (v === null ? 'null' : typeof v === 'object' ? 'object' : typeof v);

    const fmtKey = (k) => typeof k === 'symbol' ? `[${k.toString()}]`
      : /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);

    function fmt(v, depth = 0, seen = new Set()) {
      const t = typeof v;
      if (v === null) return 'null';
      if (t === 'undefined') return 'undefined';
      if (t === 'string') return JSON.stringify(v);
      if (t === 'number') return Object.is(v, -0) ? '-0' : String(v);
      if (t === 'bigint') return v + 'n';
      if (t === 'boolean') return String(v);
      if (t === 'symbol') return v.toString();
      if (t === 'function') {
        const src = Function.prototype.toString.call(v);
        return /^class\b/.test(src) ? `[class ${v.name || '(anonymous)'}]` : `[Function: ${v.name || '(anonymous)'}]`;
      }
      if (seen.has(v)) return '[Circular]';
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      if (v instanceof Date) return isNaN(v) ? 'Invalid Date' : v.toISOString();
      if (v instanceof RegExp) return String(v);
      if (v instanceof Promise) return 'Promise { … }';
      if (v instanceof WeakMap) return 'WeakMap { <items unknown> }';
      if (v instanceof WeakSet) return 'WeakSet { <items unknown> }';
      if (depth > 3) return Array.isArray(v) ? '[Array]' : '[Object]';

      const MAX = 100;
      const inner = (x) => fmt(x, depth + 1, seen);
      const more = (n) => (n > MAX ? [`… ${n - MAX} more`] : []);
      seen.add(v);
      try {
        if (Array.isArray(v)) {
          const items = [];
          for (let i = 0; i < Math.min(v.length, MAX); i++) items.push(i in v ? inner(v[i]) : '<empty>');
          items.push(...more(v.length));
          return items.length ? `[ ${items.join(', ')} ]` : '[]';
        }
        if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
          const items = Array.from(v.slice(0, MAX), (x) => fmt(x)).concat(more(v.length));
          return `${v.constructor.name}(${v.length}) [ ${items.join(', ')} ]`;
        }
        if (v instanceof Map) {
          const items = [...v].slice(0, MAX).map(([k, x]) => `${inner(k)} => ${inner(x)}`).concat(more(v.size));
          return `Map(${v.size}) {${items.length ? ` ${items.join(', ')} ` : ''}}`;
        }
        if (v instanceof Set) {
          const items = [...v].slice(0, MAX).map(inner).concat(more(v.size));
          return `Set(${v.size}) {${items.length ? ` ${items.join(', ')} ` : ''}}`;
        }
        const proto = Object.getPrototypeOf(v);
        const name = proto === null ? '[Object: null prototype] '
          : proto.constructor && proto.constructor.name && proto.constructor.name !== 'Object' ? proto.constructor.name + ' ' : '';
        const keys = Reflect.ownKeys(v).filter((k) => Object.prototype.propertyIsEnumerable.call(v, k));
        const items = keys.slice(0, MAX).map((k) => {
          let val;
          try { val = inner(v[k]); } catch { val = '[Getter threw]'; }
          return `${fmtKey(k)}: ${val}`;
        }).concat(more(keys.length));
        return items.length ? `${name}{ ${items.join(', ')} }` : `${name}{}`;
      } finally {
        seen.delete(v);
      }
    }

    const out = (line, kind, args, vtype) =>
      post({ type: 'out', line, kind, vtype, text: args.map((a) => (typeof a === 'string' ? a : fmt(a))).join(' ') });

    for (const k of ['log', 'debug', 'dir', 'trace']) console[k] = (...a) => out(here(), 'log', a);
    console.info = (...a) => out(here(), 'info', a);
    console.warn = (...a) => out(here(), 'warn', a);
    console.error = (...a) => out(here(), 'error', a);
    console.table = (...a) => out(here(), 'log', a);
    console.assert = (cond, ...a) => { if (!cond) out(here(), 'error', ['Assertion failed:', ...a]); };
    const counts = {};
    console.count = (l = 'default') => out(here(), 'log', [`${l}: ${(counts[l] = (counts[l] || 0) + 1)}`]);
    console.countReset = (l = 'default') => { counts[l] = 0; };
    const timers = {};
    console.time = (l = 'default') => { timers[l] = performance.now(); };
    console.timeLog = (l = 'default') => out(here(), 'log', [`${l}: ${(performance.now() - timers[l]).toFixed(3)} ms`]);
    console.timeEnd = (l = 'default') => { console.timeLog(l); delete timers[l]; };
    console.clear = () => post({ type: 'clear' });

    const errText = (e) => (e instanceof Error || (e && e.name && 'message' in e))
      ? `${e.name}: ${e.message}` : `Uncaught ${fmt(e)}`;
    const report = (e, fallbackLine = null) =>
      post({ type: 'out', line: lineOf(e && e.stack) ?? fallbackLine, kind: 'error', text: errText(e) });

    // Called by instrumented code for every top-level expression statement.
    self.__expr = (line, v, isCall) => {
      if (isCall && v === undefined) return v;
      if (v && typeof v.then === 'function') {
        Promise.resolve(v).then(
          (r) => post({ type: 'out', line, kind: 'expr', vtype: typeOf(r), text: fmt(r) }),
          (e) => report(e, line),
        );
        return v;
      }
      post({ type: 'out', line, kind: 'expr', vtype: typeOf(v), text: fmt(v) });
      return v;
    };

    self.addEventListener('error', (e) => { e.preventDefault(); report(e.error ?? { name: 'Error', message: e.message }); });
    self.addEventListener('unhandledrejection', (e) => { e.preventDefault(); report(e.reason); });

    self.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'ping') return post({ type: 'pong' });
      if (m.type === 'run') {
        try { (0, eval)(m.code + '\n//# sourceURL=' + FILE); }
        catch (err) { report(err); }
        post({ type: 'ready' });
      }
    };
  }

  const workerURL = URL.createObjectURL(
    new Blob([`(${workerMain.toString()})()`], { type: 'text/javascript' }),
  );

  // ----------------------------------------------------------- instrumenting
  const isConsoleCall = (ex) => ex.type === 'CallExpression' && ex.callee.type === 'MemberExpression'
    && ex.callee.object.type === 'Identifier' && ex.callee.object.name === 'console';

  const isTimerCall = (ex) => ex.type === 'CallExpression' && ex.callee.type === 'Identifier'
    && /^(setTimeout|setInterval|clearTimeout|clearInterval|queueMicrotask)$/.test(ex.callee.name);

  /** Wrap top-level expression statements with __expr(line, (expr)).
   *  Only inserts text on the same line, so line numbers are preserved. */
  function instrument(src) {
    if (typeof acorn === 'undefined') return { code: src };
    let ast;
    try {
      ast = acorn.parse(src, {
        ecmaVersion: 'latest', sourceType: 'script', locations: true,
        allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, allowHashBang: true,
      });
    } catch (error) {
      return { error };
    }
    if (!settings.showExpr) return { code: src };

    const edits = [];
    for (const node of ast.body) {
      if (node.type !== 'ExpressionStatement' || node.directive) continue;
      const ex = node.expression;
      if (isConsoleCall(ex) || isTimerCall(ex)) continue;
      const isCall = ex.type === 'CallExpression'
        || (ex.type === 'AwaitExpression' && ex.argument && ex.argument.type === 'CallExpression');
      edits.push({ start: ex.start, end: ex.end, line: ex.loc.end.line, isCall });
    }
    let code = src;
    for (const e of edits.reverse()) {
      code = code.slice(0, e.start) + `__expr(${e.line},(` + code.slice(e.start, e.end)
        + `),${e.isCall ? 1 : 0})` + code.slice(e.end);
    }
    return { code };
  }

  // ------------------------------------------------------------------ editor
  const playground = $('#playground');
  const outputPane = $('#outputPane');
  const outputEl = $('#output');
  const statusEl = $('#status');
  const stopBtn = $('#stopBtn');

  const cm = CodeMirror($('#editorPane'), {
    value: localStorage.getItem(STORE.code) ?? EXAMPLE,
    mode: 'javascript',
    theme: 'maquina',
    styleActiveLine: true,
    lineNumbers: settings.lineNumbers,
    indentUnit: 2,
    tabSize: 2,
    autoCloseBrackets: true,
    matchBrackets: true,
    autofocus: true,
    extraKeys: {
      'Ctrl-Enter': () => run(),
      'Cmd-Enter': () => run(),
      'Ctrl-/': 'toggleComment',
      'Cmd-/': 'toggleComment',
      'Ctrl-S': () => share(),
      'Cmd-S': () => share(),
      'Shift-Ctrl-S': () => saveCode(),
      'Shift-Cmd-S': () => saveCode(),
      Tab: (ed) => (ed.somethingSelected() ? ed.indentSelection('add') : ed.replaceSelection('  ')),
      'Shift-Tab': (ed) => ed.indentSelection('subtract'),
    },
  });

  // ----------------------------------------------------------------- results
  let results = new Map();   // line (or 'tail') -> [{kind, vtype, text}]
  let expanded = null;
  let errorLine = null;

  function addEntry(line, kind, text, vtype) {
    const key = Number.isInteger(line) && line >= 1 ? line : 'tail';
    let list = results.get(key);
    if (!list) results.set(key, (list = []));
    list.push({ kind, vtype, text: String(text).slice(0, 5000) });
    if (list.length > MAX_PER_LINE) list.splice(0, list.length - MAX_PER_LINE);
    if (kind === 'error' && key !== 'tail') markErrorLine(key);
    scheduleRender();
  }

  function markErrorLine(line) {
    if (errorLine != null) cm.removeLineClass(errorLine - 1, 'background', 'err-line');
    errorLine = line;
    if (line != null && line <= cm.lineCount()) cm.addLineClass(line - 1, 'background', 'err-line');
  }

  function clearResults() {
    results = new Map();
    expanded = null;
    markErrorLine(null);
    scheduleRender();
  }

  let rafId = 0;
  function scheduleRender() {
    if (!rafId) rafId = requestAnimationFrame(render);
  }

  function render() {
    rafId = 0;
    const paneTop = outputPane.getBoundingClientRect().top;
    const paneH = outputPane.clientHeight;
    const lh = cm.defaultTextHeight();
    const last = cm.lineCount();
    const frag = document.createDocumentFragment();

    for (const [key, list] of results) {
      const line = key === 'tail' ? last : Math.min(key, last);
      const c = cm.charCoords({ line: line - 1, ch: 0 }, 'window');
      const top = (key === 'tail' ? c.bottom : c.top) - paneTop;
      if (top < -lh * 2 || top > paneH + lh) continue;

      const row = document.createElement('div');
      row.className = 'row' + (expanded === key ? ' expanded' : '');
      row.style.top = `${top}px`;
      row.style.height = `${lh}px`;
      row.style.lineHeight = `${lh}px`;
      row.dataset.key = key;
      row.title = list.map((e) => e.text).join('\n');

      for (const e of list) {
        const span = document.createElement('span');
        span.className = `e k-${e.kind}` + (e.kind === 'expr' && e.vtype ? ` t-${e.vtype}` : '');
        span.textContent = e.text;
        row.appendChild(span);
      }
      frag.appendChild(row);
    }
    outputEl.replaceChildren(frag);
  }

  outputEl.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    const key = row.dataset.key === 'tail' ? 'tail' : +row.dataset.key;
    expanded = expanded === key ? null : key;
    scheduleRender();
  });
  outputPane.addEventListener('wheel', (e) => {
    if (e.target.closest('.row.expanded')) return;
    cm.scrollTo(null, cm.getScrollInfo().top + e.deltaY);
  }, { passive: true });

  cm.on('scroll', scheduleRender);
  cm.on('cursorActivity', () => {
    const c = cm.getCursor();
    $('#cursorPos').textContent = `Ln ${c.line + 1}, Col ${c.ch + 1}`;
  });
  cm.on('refresh', scheduleRender);
  window.addEventListener('resize', scheduleRender);

  // ----------------------------------------------------------------- running
  let worker = null;
  let heartbeat = 0;
  let lastPong = 0;
  let runId = 0;

  const statusBar = $('#statusbar');
  const dot = $('#dot');
  function setStatus(text, isError = false, state = isError ? 'err' : 'ok') {
    statusEl.textContent = text;
    statusBar.classList.toggle('error', isError);
    dot.className = 'dot ' + (text ? state : '');
  }

  function stop(silent = false) {
    if (worker) { worker.terminate(); worker = null; }
    clearInterval(heartbeat);
    stopBtn.classList.remove('active');
    if (!silent) setStatus('stopped', false, '');
  }

  function run() {
    stop(true);
    const src = cm.getValue();
    localStorage.setItem(STORE.code, src);
    const id = ++runId;

    const inst = instrument(src);
    if (inst.error) {
      clearResults();
      const msg = inst.error.message.replace(/\s*\(\d+:\d+\)$/, '');
      addEntry(inst.error.loc ? inst.error.loc.line : null, 'error', `SyntaxError: ${msg}`);
      setStatus('syntax error', true);
      return;
    }

    // Keep old output on screen until the new run produces something (no flicker).
    let fresh = false;
    const takeOver = () => { if (!fresh && id === runId) { fresh = true; clearResults(); } };
    setTimeout(takeOver, 250);

    const t0 = performance.now();
    lastPong = Date.now();
    worker = new Worker(workerURL);
    stopBtn.classList.add('active');
    setStatus('running…', false, 'busy');

    worker.onmessage = ({ data: m }) => {
      if (id !== runId) return;
      switch (m.type) {
        case 'out': takeOver(); addEntry(m.line, m.kind, m.text, m.vtype); break;
        case 'clear': takeOver(); clearResults(); break;
        case 'pong': lastPong = Date.now(); break;
        case 'ready':
          takeOver();
          lastPong = Date.now();
          stopBtn.classList.remove('active');
          setStatus(`ran in ${(performance.now() - t0).toFixed(1)} ms`);
          break;
      }
    };
    worker.onerror = (e) => { e.preventDefault(); takeOver(); addEntry(null, 'error', e.message || 'Worker error'); };

    // Async IIFE on line 1 enables top-level await without shifting line numbers.
    worker.postMessage({ type: 'run', code: `(async () => {${inst.code}\n})()` });

    heartbeat = setInterval(() => {
      if (!worker) return;
      if (Date.now() - lastPong > settings.timeout * 1000) {
        stop(true);
        takeOver();
        addEntry(null, 'error', `Execution stopped: no response for ${settings.timeout}s (infinite loop?)`);
        setStatus('timed out', true);
        return;
      }
      worker.postMessage({ type: 'ping' });
    }, 250);
  }

  let debounce = 0;
  cm.on('change', () => {
    localStorage.setItem(STORE.code, cm.getValue());
    scheduleRender();
    if (!settings.autoRun) return;
    clearTimeout(debounce);
    debounce = setTimeout(run, 450);
  });

  $('#runBtn').onclick = () => { run(); cm.focus(); };
  stopBtn.onclick = () => { stop(); cm.focus(); };
  $('#clearBtn').onclick = () => { clearResults(); setStatus('ready', false, ''); cm.focus(); };

  // --------------------------------------------------------------- local file
  function saveCode() {
    const link = document.createElement('a');
    let url;
    try {
      const file = new Blob([cm.getValue()], { type: 'text/javascript;charset=utf-8' });
      url = URL.createObjectURL(file);
      link.href = url;
      link.download = 'maquina-snippet.js';
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      toast('Download requested · maquina-snippet.js');
    } catch {
      toast('Could not start the download. Please try again.');
    } finally {
      link.remove();
      // Give the browser time to consume the URL before releasing the Blob.
      if (url) setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }
  $('#saveBtn').onclick = saveCode;

  // ------------------------------------------------------------------- share
  const b64url = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64url = (str) => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const pipe = async (bytes, stream) =>
    new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

  async function encodeCode(str) {
    const bytes = new TextEncoder().encode(str);
    if ('CompressionStream' in window) return 'z' + b64url(await pipe(bytes, new CompressionStream('deflate-raw')));
    return 'r' + b64url(bytes);
  }
  async function decodeCode(str) {
    const bytes = unb64url(str.slice(1));
    return new TextDecoder().decode(str[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes);
  }

  async function share() {
    const url = `${location.origin === 'null' ? 'file://' : location.origin}${location.pathname}#code=${await encodeCode(cm.getValue())}`;
    history.replaceState(null, '', url);
    try {
      await Promise.race([
        navigator.clipboard.writeText(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('clipboard timeout')), 1500)),
      ]);
      toast('Share link copied to clipboard');
    } catch {
      prompt('Copy this link:', url);
    }
  }
  $('#shareBtn').onclick = share;

  let toastTimer = 0;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // -------------------------------------------------------------- fullscreen
  function toggleFullscreen(force) {
    playground.classList.toggle('fullscreen', force);
    cm.refresh();
    cm.focus();
  }
  $('#fullscreenBtn').onclick = () => toggleFullscreen();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!settingsForm.hidden) settingsForm.hidden = true;
      else if (playground.classList.contains('fullscreen')) toggleFullscreen(false);
    }
  });

  // ------------------------------------------------------------ split pane
  const editorPane = $('#editorPane');
  const divider = $('#divider');
  const applySplit = () => { editorPane.style.flexBasis = `${settings.split}%`; cm.refresh(); };
  divider.addEventListener('pointerdown', (e) => {
    divider.setPointerCapture(e.pointerId);
    divider.classList.add('dragging');
    document.body.classList.add('resizing');
    const box = $('.panes').getBoundingClientRect();
    const move = (ev) => {
      settings.split = Math.max(15, Math.min(85, ((ev.clientX - box.left) / box.width) * 100));
      editorPane.style.flexBasis = `${settings.split}%`;
      scheduleRender();
    };
    const up = () => {
      divider.removeEventListener('pointermove', move);
      divider.classList.remove('dragging');
      document.body.classList.remove('resizing');
      saveSettings();
      cm.refresh();
    };
    divider.addEventListener('pointermove', move);
    divider.addEventListener('pointerup', up, { once: true });
  });
  divider.addEventListener('dblclick', () => { settings.split = DEFAULTS.split; applySplit(); saveSettings(); });

  // ---------------------------------------------------------------- settings
  const settingsForm = $('#settings');
  const applySettings = () => {
    playground.style.setProperty('--font-size', `${settings.fontSize}px`);
    cm.setOption('lineNumbers', !!settings.lineNumbers);
    cm.refresh();
  };
  for (const input of settingsForm.elements) {
    if (!input.name) continue;
    if (input.type === 'checkbox') input.checked = !!settings[input.name];
    else input.value = settings[input.name];
    input.addEventListener('change', () => {
      settings[input.name] = input.type === 'checkbox' ? input.checked
        : Math.max(+input.min, Math.min(+input.max, +input.value || DEFAULTS[input.name]));
      if (input.type !== 'checkbox') input.value = settings[input.name];
      saveSettings();
      applySettings();
      if (input.name === 'showExpr') run();
    });
  }
  $('#settingsBtn').onclick = (e) => { e.stopPropagation(); settingsForm.hidden = !settingsForm.hidden; };
  document.addEventListener('click', (e) => {
    if (!settingsForm.hidden && !settingsForm.contains(e.target)) settingsForm.hidden = true;
  });
  $('#resetBtn').onclick = () => { cm.setValue(EXAMPLE); settingsForm.hidden = true; run(); };

  // -------------------------------------------------------------------- init
  async function init() {
    applySplit();
    applySettings();
    const m = /#code=([\w-]+)/.exec(location.hash);
    if (m) {
      try { cm.setValue(await decodeCode(m[1])); }
      catch { toast('Could not read the shared code link'); }
    }
    cm.setCursor(cm.lineCount(), 0);
    run();
  }
  init();
})();
