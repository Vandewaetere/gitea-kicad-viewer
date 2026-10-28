// gitea-kicad-viewer loader: runs inside Gitea's render iframe and then starts ecad-viewer.js.
// Version 1.0.0 — https://github.com/Vandewaetere/gitea-kicad-viewer (changes: CHANGELOG.md) — MIT
(function () {
  "use strict";

  // In Gitea's default sandbox (no allow-same-origin) localStorage throws; give the viewer an in-memory one.
  var sameOrigin = true;
  try { window.localStorage.getItem("kv"); } catch (e) {
    sameOrigin = false;
    var mem = {};
    var store = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = {}; }, key: function (i) { return Object.keys(mem)[i] || null; },
      get length() { return Object.keys(mem).length; }
    };
    Object.defineProperty(window, "localStorage", { value: store, configurable: true });
    Object.defineProperty(window, "sessionStorage", { value: store, configurable: true });
  }

  var cfg = JSON.parse(document.getElementById("kv-config").textContent);
  // Gitea passes the prefixes of the folder the file is in (e.g. /owner/repo/raw/branch/main/hw/board), and the
  // render URL ends in the file name.
  var name = decodeURIComponent(location.pathname.slice(location.pathname.lastIndexOf("/") + 1));
  var viewer = document.createElement("ecad-viewer");
  var has3d = false;

  function addSource(url) { var s = document.createElement("ecad-source"); s.setAttribute("src", url); viewer.appendChild(s); }
  function inline() {
    var b64 = document.getElementById("kv-inline").textContent;
    var bytes = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
    var blob = document.createElement("ecad-blob");
    blob.setAttribute("filename", name);
    blob.setAttribute("content", new TextDecoder().decode(bytes));
    viewer.appendChild(blob);
  }
  function dirname(p) { return p.indexOf("/") >= 0 ? p.slice(0, p.lastIndexOf("/")) : ""; }
  function basename(p) { return p.slice(p.lastIndexOf("/") + 1); }

  // With allow-same-origin we may read the other files of the project (same folder) with the user's session.
  // Gitea's API ignores the session cookie, so use the web route behind "Go to file" (/<owner>/<repo>/tree-list/<ref>),
  // which lists every file of the repository. The folder of our file is the one that contains a file with our name and
  // whose path is the end of the raw prefix (the longest one, if several match).
  function project() {
    return fetch(cfg.raw.replace(/\/raw\//, "/tree-list/"), { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("tree-list " + r.status);
      return r.json();
    }).then(function (paths) {
      var dir = null;
      paths.forEach(function (p) {
        var d = dirname(p);
        if (basename(p) === name && (d === "" || cfg.raw.slice(-(d.length + 1)) === "/" + d) && (dir === null || d.length > dir.length)) dir = d;
      });
      if (dir === null) throw new Error("file not found in tree-list");
      var files = paths.filter(function (p) { return dirname(p) === dir && /\.(kicad_sch|kicad_pcb|kicad_pro)$/.test(p); });
      files.forEach(function (p) { addSource(cfg.raw + "/" + encodeURIComponent(basename(p))); });
      // 3D: a .glb next to the project (KiCad: File > Export > GLB). Prefer the one named like the board/project.
      var stem = name.replace(/\.kicad_(sch|pcb|pro)$/, "");
      var glbs = paths.filter(function (p) { return dirname(p) === dir && /\.glb$/i.test(p); });
      var glb = glbs.filter(function (p) { return basename(p).replace(/\.glb$/i, "") === stem; })[0] || glbs[0];
      if (glb) {
        has3d = true;
        var g = document.createElement("ecad-3d-source");
        g.setAttribute("src", cfg.raw + "/" + encodeURIComponent(basename(glb)));
        viewer.appendChild(g);
      }
    });
  }

  // The viewer starts its parser as a module worker from /assets/. A sandboxed page (origin "null") may not do that,
  // so fetch the worker (Gitea serves assets with CORS *) and hand the viewer a blob: URL instead.
  var base = document.currentScript.src.replace(/[^/]*$/, "");
  var version = document.currentScript.src.split("?")[1] || "";  // "v=<build>", passed on to the other files
  function asset(f) { return base + f + (version ? "?" + version : ""); }
  function patchWorker() {
    if (sameOrigin) return Promise.resolve();
    return fetch(asset("parser.worker.js")).then(function (r) { return r.text(); }).then(function (code) {
      // Drop the trailing ES module export so the bundle also runs as a classic worker (see below).
      code = code.replace(/\bexport\s*\{[^}]*\};?/, "");
      var blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      var Orig = window.Worker;
      window.Worker = function (url, opts) {
        // Module workers from blob: URLs fail in an opaque origin; the parser bundle has no imports, so run it as a classic worker.
        if (/parser\.worker\.js$/.test(String(url))) return new Orig(blobUrl);
        return new Orig(url, opts);
      };
      window.Worker.prototype = Orig.prototype;
    });
  }
  function loadViewer() {
    var s = document.createElement("script");
    s.type = "module"; s.src = asset("ecad-viewer.js");
    document.head.appendChild(s);
  }

  var files = sameOrigin ? project().catch(function () { inline(); }) : Promise.resolve(inline());
  // Without a .glb, ecad-viewer would ask its own conversion server (which Gitea doesn't have) for a 3D model and show
  // a spinner forever. Hide the 3D tab instead. The tab buttons live in nested shadow roots, so search through them.
  function hide3dTab() {
    var found = false;
    (function walk(root) {
      root.querySelectorAll("*").forEach(function (el) {
        if (el.tagName === "TAB-BUTTON" && el.classList.contains("tab") && el.textContent.trim() === "3D") {
          el.style.display = "none";
          found = true;
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      });
    })(viewer.shadowRoot || viewer);
    return found;
  }

  // ecad-viewer puts its maker's logo (a link) in the bottom-left corner; we don't show it inside Gitea.
  // The credits are in the README. The logo lives in the viewer's shadow DOM, so add a style rule there.
  function hideLogo() {
    var root = viewer.shadowRoot;
    if (!root) return false;
    if (!root.querySelector("style[data-kv]")) {
      var st = document.createElement("style");
      st.setAttribute("data-kv", "");
      st.textContent = ".bottom-left-icon{display:none!important}";
      root.appendChild(st);
    }
    return true;
  }

  Promise.all([files, patchWorker()]).then(function () {
    document.body.appendChild(viewer);
    loadViewer();
    var timer = setInterval(function () {
      if (hideLogo()) {
        clearInterval(timer);
        new MutationObserver(hideLogo).observe(viewer.shadowRoot, { childList: true });
      }
    }, 50);
    if (!has3d) {
      // The tab bar is built (and rebuilt) after the project has loaded; keep hiding the 3D tab for a while.
      var tries = 0;
      var tabTimer = setInterval(function () {
        hide3dTab();
        if (++tries > 600) clearInterval(tabTimer);
      }, 100);
    }
  });
})();
