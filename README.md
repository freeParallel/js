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
- Download the current editor contents as `maquina-snippet.js` using **Save .js**, or `Ctrl+Shift+S` / `Cmd+Shift+S` while the editor is focused. Exact UTF-8 contents are preserved, including empty or unfinished code. The browser controls the download location; no upload is involved.
- **Load** (`Ctrl+O` / `Cmd+O` while the editor is focused) opens a local `.js`, `.mjs`, `.cjs` or `.txt` file, up to 1 MB. It confirms before replacing different nonempty code. Loading pauses auto-run and clears old results; press Run when ready, or re-enable Run while typing in Settings. Manual mode stays manual after reload and display-setting changes. No upload is involved; file extensions do not add module/import support to the script runner.
- Toolbar (Run / Stop / Clear / Load / Save .js / Share), status bar with run state, timing and cursor position
- **Clear** empties the code editor and stale output, stops the old run and preserves Undo (`Ctrl+Z` / `Cmd+Z`). It also removes any obsolete shared-code hash so a refresh cannot restore the cleared snippet.
- **Layout** opens three visual choices for the output: **Right**, **Below** or **Left**. The choice and separate horizontal/vertical split sizes are saved locally. The divider supports dragging, arrow keys, Home/End and double-click to reset. Below output has its own scrollbar and follows editor scrolling.
- Settings: auto-run, expression results, line numbers, font size, timeout
- Resizable split pane (double-click the divider to reset), fullscreen mode, code saved in localStorage

Click an output row to expand long values.

## Stack

CodeMirror 5 (editor) and Acorn (parsing for expression results), both from CDN.

## Browser regression checks

`tests/browser-save.py` runs in the browser harness and checks actual downloaded files, their exact bytes, the editor shortcut and narrow-screen action visibility. Invoke `run_save_checks(url, js, cdp, goto_url, wait_for_load)` with the browser helpers. Test downloads go into a unique folder under the Hermes scratch directory, and the test restores the editor, auto-run setting and default download behaviour afterward.

`tests/browser-load.py` checks native file-picker activation, accepted/cancelled replacement, Unicode, same-file reselection, empty/unfinished files, validation limits, manual-mode persistence and a real Load → Save file round trip. Invoke `run_load_checks(url, js, cdp, goto_url, wait_for_load)` with the same helpers.

`tests/browser-layout.py` checks editor clearing and Undo, stale-run cancellation, the three positions, preserved results, row visibility, pointer and keyboard resizing, saved layout choice, below-output scrolling, popup dismissal and phone-width bounds. Invoke `run_layout_checks(url, js, cdp, goto_url, wait_for_load)`.
