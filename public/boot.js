// The one thing that runs even when the game does not.
//
// src/crash-guard.js catches everything the game throws, but it is inside the
// bundle: a bundle that fails to load, or a module that throws while being
// evaluated, never reaches it. The loading screen in index.html would then sit
// there saying "Laying out the streets…" for as long as the player is willing to
// wait, which is the worst of both worlds — it looks like progress.
//
// It also decides whether this browser can run the game at all. That check has
// to be here rather than in the bundle, because a browser too old to parse the
// bundle never reaches anything inside it.
//
// This is a plain classic script: var, function expressions, no arrow functions,
// no template literals, no optional chaining. It has to parse in the browsers it
// exists to turn away.

(function () {
  var GIVE_UP_MS = 25000;
  var failed = false;

  function screen() { return document.getElementById("booting"); }

  // What the game is built out of. Each of these is used somewhere it cannot be
  // worked around, and the versions below are what the last of them needs.
  //
  // :has() is the one that decides Firefox. It hides panels that would
  // otherwise sit on top of each other, so without it the interface is not
  // slightly wrong, it is unusable. dvh keeps the game inside a phone window
  // with a browser bar. The rest are JavaScript the simulation and the
  // interface call directly, and vite.config.js compiles for the same floor.
  function missing() {
    var absent = [];
    if (typeof WeakRef !== "function") absent.push("WeakRef");
    if (typeof structuredClone !== "function") absent.push("structuredClone");
    if (typeof ResizeObserver !== "function") absent.push("ResizeObserver");
    if (typeof Object.hasOwn !== "function") absent.push("Object.hasOwn");
    if (typeof String.prototype.replaceAll !== "function") absent.push("String.replaceAll");
    if (typeof Array.prototype.at !== "function") absent.push("Array.at");
    if (!window.HTMLDialogElement || typeof HTMLDialogElement.prototype.showModal !== "function") absent.push("dialog.showModal");
    if (!window.CSS || typeof CSS.supports !== "function") absent.push("CSS.supports");
    else {
      if (!CSS.supports("selector(:has(*))")) absent.push("CSS :has()");
      if (!CSS.supports("height", "100dvh")) absent.push("CSS dvh units");
    }
    return absent;
  }

  var absent = missing();
  if (absent.length) {
    // Marked on the root element straight away, before the bundle is fetched.
    // src/main.js reads it and stops, so the message below stays up instead of
    // being replaced by a canvas that never draws.
    document.documentElement.setAttribute("data-unsupported", "true");

    // Written as soon as the element exists, which is while the page is still
    // parsing. Waiting for DOMContentLoaded would be waiting for the deferred
    // module script as well, and a bundle that never arrives would leave this
    // browser reading "Laying out the streets…" for as long as it was willing.
    var tell = function () {
      var booting = screen();
      if (!booting) return false;
      booting.setAttribute("data-unsupported", "true");
      var title = booting.querySelector("b");
      if (title) title.textContent = "This browser is too old";
      var line = booting.querySelector("small");
      if (line) {
        line.textContent = "City Builder 3000 needs Chrome or Edge 108, Firefox 121, Safari 16, "
          + "or anything newer. Missing here: " + absent.join(", ") + ".";
      }
      var bar = booting.querySelector("i");
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      return true;
    };

    if (!tell()) {
      var waiting = setInterval(function () { if (tell()) clearInterval(waiting); }, 30);
      document.addEventListener("DOMContentLoaded", function () { tell(); clearInterval(waiting); });
    }
    return;
  }

  function giveUp(detail) {
    var booting = screen();
    // The game removes this element on its first frame. If it is gone, the game
    // started, and whatever happened afterwards belongs to the crash guard.
    if (failed || !booting) return;
    // An unsupported browser already has its message, and it is the more useful
    // of the two. The throw from src/main.js must not overwrite it.
    if (document.documentElement.hasAttribute("data-unsupported")) return;
    failed = true;
    booting.setAttribute("data-failed", "true");
    var line = booting.querySelector("small");
    if (line) line.textContent = detail || "The game could not start. Check your connection and reload the page.";
    var note = booting.querySelector("i");
    if (note) note.remove();
  }

  window.addEventListener("error", function (event) {
    // A failed <script> or <link> arrives here with the element as the target
    // and no message. That is exactly the case this exists for.
    if (event.target && event.target !== window && event.target.tagName) {
      giveUp("Part of the game could not be downloaded. Check your connection and reload the page.");
      return;
    }
    if (typeof event.message === "string") giveUp("The game could not start: " + event.message);
  }, true);

  setTimeout(function () { giveUp(); }, GIVE_UP_MS);
})();
