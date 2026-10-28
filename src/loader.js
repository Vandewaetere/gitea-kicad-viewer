// gitea-kicad-viewer loader: runs inside Gitea's render iframe and then starts ecad-viewer.js.
// https://github.com/Vandewaetere/gitea-kicad-viewer — MIT
(function () {
  "use strict";
  // The ecad-viewer logo in the corner links here: credit to the authors of the viewer.
  window.ai_url = "https://github.com/Huaqiu-Electronics/ecad-viewer";

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
  var renderPrefix = cfg.src.replace(/\/src\//, "/render/");
  var path = decodeURIComponent(location.pathname.slice(renderPrefix.length + 1));
  var dir = path.indexOf("/") >= 0 ? path.slice(0, path.lastIndexOf("/")) : "";
  var name = path.slice(path.lastIndexOf("/") + 1);
  var viewer = document.createElement("ecad-viewer");

  function addSource(url) { var s = document.createElement("ecad-source"); s.setAttribute("src", url); viewer.appendChild(s); }
  function inline() {
    var b64 = document.getElementById("kv-inline").textContent;
    var bytes = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
    var blob = document.createElement("ecad-blob");
    blob.setAttribute("filename", name);
    blob.setAttribute("content", new TextDecoder().decode(bytes));
    viewer.appendChild(blob);
  }
  function rawUrl(p) { return cfg.raw + "/" + p.split("/").map(encodeURIComponent).join("/"); }

  // With allow-same-origin we may read the other files of the project (same folder) with the user's session.
  // Gitea's API ignores the session cookie, so use the web route behind "Go to file": /<owner>/<repo>/tree-list/<ref>.
  function project() {
    var list = cfg.raw.replace(/\/raw\//, "/tree-list/");
    return fetch(list, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("tree-list " + r.status);
      return r.json();
    }).then(function (paths) {
      var files = paths.filter(function (p) {
        var d = p.indexOf("/") >= 0 ? p.slice(0, p.lastIndexOf("/")) : "";
        return d === dir && /\.(kicad_sch|kicad_pcb|kicad_pro)$/.test(p);
      });
      if (!files.length) throw new Error("no files");
      files.forEach(function (p) { addSource(rawUrl(p)); });
    });
  }

  // The viewer starts its parser as a module worker from /assets/. A sandboxed page (origin "null") may not do that,
  // so fetch the worker (Gitea serves assets with CORS *) and hand the viewer a blob: URL instead.
  var base = document.currentScript.src.replace(/[^/]*$/, "");
  function patchWorker() {
    if (sameOrigin) return Promise.resolve();
    return fetch(base + "parser.worker.js").then(function (r) { return r.text(); }).then(function (code) {
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
    s.type = "module"; s.src = base + "ecad-viewer.js";
    document.head.appendChild(s);
  }

  var files = sameOrigin ? project().catch(function () { inline(); }) : Promise.resolve(inline());
  Promise.all([files, patchWorker()]).then(function () {
    document.body.appendChild(viewer);
    loadViewer();
  });
})();
