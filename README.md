# maquina.js

A live JavaScript scratchpad by [maquina.Earth](https://maquina.earth): type code, see results line by line. Static site, no build step.

Brand: black background, amber `#F4A156`, Major Mono Display wordmark (same as maquina.Earth).

## Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8765
# http://127.0.0.1:8765
```

## Features

- Live evaluation while typing (debounced), or `Ctrl+Enter` to run manually
- Output aligned to the source line: `console.*` calls and bare top-level expressions (`nums.map(...)`, `sum`)
- Promises shown as their resolved value; top-level `await` works
- Code runs in a throwaway Web Worker, so the page never freezes; infinite loops are killed after a timeout
- Errors highlighted on the line that threw
- Share links (code compressed into the URL hash), `Ctrl+S` copies the link
- Toolbar (Run / Stop / Clear / Share), status bar with run state, timing and cursor position
- Settings: auto-run, expression results, line numbers, font size, timeout
- Resizable split pane (double-click the divider to reset), fullscreen mode, code saved in localStorage

Click an output row to expand long values.

## Stack

CodeMirror 5 (editor) and Acorn (parsing for expression results), both from CDN.
