/* notepadly.app — editor logic.
 * Everything here reads/writes localStorage only. Nothing is ever sent to
 * a server — there is no server. Autosave = a write to localStorage on
 * every change (debounced ~150ms so a fast paste doesn't thrash disk I/O),
 * plus an immediate flush on blur/visibilitychange/unload so nothing is
 * ever lost.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "notepadly:v1";
  var THEME_KEY = "notepadly-theme";

  var els = {
    tabs: document.getElementById("note-tabs"),
    addTab: document.getElementById("note-tab-add"),
    editor: document.getElementById("editor"),
    editorBody: document.getElementById("editor-body"),
    preview: document.getElementById("preview"),
    markdownToggle: document.getElementById("markdown-toggle"),
    downloadTxt: document.getElementById("download-txt"),
    downloadMd: document.getElementById("download-md"),
    clearBtn: document.getElementById("clear-btn"),
    wordCount: document.getElementById("word-count"),
    charCount: document.getElementById("char-count"),
    autosave: document.getElementById("autosave-status"),
    autosaveText: document.getElementById("autosave-text"),
    autosaveDot: document.getElementById("autosave-dot"),
    themeToggle: document.getElementById("theme-toggle"),
    year: document.getElementById("year"),
  };

  // ---------- persistence ----------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaultState() {
    var id = uid();
    return {
      notes: [{ id: id, name: "Note 1", mode: "plain", content: "" }],
      activeId: id,
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.notes) || !parsed.notes.length) return defaultState();
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  var state = loadState();

  function getActiveNote() {
    var note = state.notes.filter(function (n) { return n.id === state.activeId; })[0];
    return note || state.notes[0];
  }

  var saveTimer = null;
  function persist(immediate) {
    var write = function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        markSaved();
      } catch (e) {
        /* localStorage unavailable (private mode / quota) — fail quietly */
      }
    };
    if (immediate) {
      clearTimeout(saveTimer);
      write();
      return;
    }
    markSaving();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(write, 150);
  }

  function markSaving() {
    if (els.autosave) els.autosave.classList.add("is-saving");
    if (els.autosaveText) els.autosaveText.textContent = "Saving…";
  }

  function markSaved() {
    if (!els.autosave) return;
    els.autosave.classList.remove("is-saving");
    els.autosaveText.textContent = "Saved";
    // retrigger the ink-pulse animation even if it just played
    els.autosaveDot.classList.remove("is-pulsing");
    // eslint-disable-next-line no-unused-expressions
    void els.autosaveDot.offsetWidth; // force reflow
    els.autosaveDot.classList.add("is-pulsing");
  }

  // ---------- rendering ----------

  function slugify(name) {
    var s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "note";
  }

  function nextNoteName() {
    var n = state.notes.length + 1;
    var existing = state.notes.map(function (nt) { return nt.name; });
    while (existing.indexOf("Note " + n) !== -1) n++;
    return "Note " + n;
  }

  // Builds the "select" button for one tab. Extracted so a rename-commit
  // can patch a single tab in place instead of rebuilding the whole list —
  // rebuilding everything from a `blur` handler would detach the very tab
  // node the user's click/mousedown gesture is mid-flight on if they
  // clicked a *different* tab to end the rename, silently swallowing that
  // click.
  function buildSelectButton(note, tab) {
    var select = document.createElement("button");
    select.type = "button";
    select.className = "note-tab-name";
    select.textContent = note.name;
    select.title = note.name + " (double-click to rename)";
    if (note.id === state.activeId) select.setAttribute("aria-current", "true");
    select.addEventListener("click", function () {
      if (note.id !== state.activeId) switchNote(note.id);
    });
    select.addEventListener("dblclick", function (e) {
      e.stopPropagation();
      startRename(note, tab, select);
    });
    return select;
  }

  function renderTabs() {
    if (!els.tabs) return;
    els.tabs.innerHTML = "";
    state.notes.forEach(function (note) {
      var tab = document.createElement("div");
      tab.className = "note-tab" + (note.id === state.activeId ? " is-active" : "");
      tab.dataset.id = note.id;
      tab.appendChild(buildSelectButton(note, tab));

      if (state.notes.length > 1) {
        var close = document.createElement("button");
        close.type = "button";
        close.className = "note-tab-close";
        close.setAttribute("aria-label", "Delete " + note.name);
        close.textContent = "×";
        close.addEventListener("click", function (e) {
          e.stopPropagation();
          deleteNote(note.id);
        });
        tab.appendChild(close);
      }

      els.tabs.appendChild(tab);
    });
    if (els.addTab) els.tabs.appendChild(els.addTab);
  }

  function startRename(note, tab, selectBtn) {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "note-tab-rename";
    input.value = note.name;
    input.maxLength = 60;
    input.setAttribute("aria-label", "Rename note");
    tab.replaceChild(input, selectBtn);
    input.focus();
    input.select();

    var done = false;
    function commit(save) {
      if (done) return;
      done = true;
      var val = input.value.trim();
      if (save && val) {
        note.name = val.slice(0, 60);
        persist(true);
      }
      // Patch just this tab's button back in — never a full renderTabs()
      // here, so sibling tabs (and any in-flight click on one of them)
      // are left untouched.
      if (input.parentNode === tab) tab.replaceChild(buildSelectButton(note, tab), input);
    }

    input.addEventListener("blur", function () { commit(true); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(true); }
      if (e.key === "Escape") { e.preventDefault(); commit(false); }
    });
  }

  function switchNote(id) {
    state.activeId = id;
    persist(true);
    renderTabs();
    loadEditor();
  }

  function addNote() {
    var note = { id: uid(), name: nextNoteName(), mode: "plain", content: "" };
    state.notes.push(note);
    state.activeId = note.id;
    persist(true);
    renderTabs();
    loadEditor();
    els.editor.focus();
  }

  function deleteNote(id) {
    if (state.notes.length <= 1) return;
    var note = state.notes.filter(function (n) { return n.id === id; })[0];
    if (!note) return;
    if (note.content.trim() && !window.confirm('Delete "' + note.name + '"? This can’t be undone.')) {
      return;
    }
    var idx = state.notes.indexOf(note);
    state.notes.splice(idx, 1);
    if (state.activeId === id) {
      var next = state.notes[idx] || state.notes[idx - 1] || state.notes[0];
      state.activeId = next.id;
    }
    persist(true);
    renderTabs();
    loadEditor();
  }

  function updateCounts(text) {
    var trimmed = text.trim();
    var words = trimmed ? trimmed.split(/\s+/).length : 0;
    if (els.wordCount) els.wordCount.textContent = words + (words === 1 ? " word" : " words");
    if (els.charCount) els.charCount.textContent = text.length + (text.length === 1 ? " character" : " characters");
  }

  function updatePreview(text) {
    if (!els.preview) return;
    if (!text.trim()) {
      els.preview.innerHTML = '<p class="preview-empty">Nothing to preview yet — start typing on the left.</p>';
      return;
    }
    els.preview.innerHTML = window.renderMarkdown(text);
  }

  function loadEditor() {
    var note = getActiveNote();
    els.editor.value = note.content;
    els.editor.placeholder = "Start typing — " + note.name + " autosaves as you go.";
    updateCounts(note.content);
    setMarkdownUI(note.mode === "markdown");
  }

  function setMarkdownUI(on) {
    if (els.editorBody) els.editorBody.classList.toggle("is-split", on);
    if (els.markdownToggle) {
      els.markdownToggle.classList.toggle("is-active", on);
      els.markdownToggle.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (on) updatePreview(els.editor.value);
  }

  // ---------- events ----------

  if (els.editor) {
    els.editor.addEventListener("input", function () {
      var note = getActiveNote();
      note.content = els.editor.value;
      updateCounts(note.content);
      if (note.mode === "markdown") updatePreview(note.content);
      persist(false);
    });

    els.editor.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        e.preventDefault();
        var start = els.editor.selectionStart;
        var end = els.editor.selectionEnd;
        var val = els.editor.value;
        els.editor.value = val.slice(0, start) + "\t" + val.slice(end);
        els.editor.selectionStart = els.editor.selectionEnd = start + 1;
        els.editor.dispatchEvent(new Event("input"));
      }
    });

    els.editor.addEventListener("blur", function () { persist(true); });
  }

  if (els.markdownToggle) {
    els.markdownToggle.addEventListener("click", function () {
      var note = getActiveNote();
      note.mode = note.mode === "markdown" ? "plain" : "markdown";
      setMarkdownUI(note.mode === "markdown");
      persist(true);
    });
  }

  if (els.addTab) els.addTab.addEventListener("click", addNote);

  function download(ext) {
    var note = getActiveNote();
    var blob = new Blob([note.content], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = slugify(note.name) + "." + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  if (els.downloadTxt) els.downloadTxt.addEventListener("click", function () { download("txt"); });
  if (els.downloadMd) els.downloadMd.addEventListener("click", function () { download("md"); });

  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", function () {
      var note = getActiveNote();
      if (!note.content.trim()) return;
      if (!window.confirm("Clear this note? This can’t be undone.")) return;
      note.content = "";
      els.editor.value = "";
      updateCounts("");
      if (note.mode === "markdown") updatePreview("");
      persist(true);
      els.editor.focus();
    });
  }

  // flush on tab hide / close so nothing is ever lost to a debounce window
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") persist(true);
  });
  window.addEventListener("beforeunload", function () { persist(true); });

  // ---------- theme toggle ----------
  if (els.themeToggle) {
    els.themeToggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      if (!current) {
        current = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    });
  }

  if (els.year) els.year.textContent = new Date().getFullYear();

  // ---------- boot ----------
  renderTabs();
  loadEditor();
})();
