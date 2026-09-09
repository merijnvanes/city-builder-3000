// The one thing that runs even when the game does not.
//
// src/crash-guard.js catches everything the game throws, but it is inside the
// bundle: a bundle that fails to load, or a module that throws while being
// evaluated, never reaches it. The loading screen in index.html would then sit
// there saying "Laying out the streets…" for as long as the player is willing to
// wait, which is the worst of both worlds — it looks like progress.
//
// This is a plain classic script, loaded ahead of the bundle, doing the least it
// can: notice that the game never started, and say so.

(function () {
  var GIVE_UP_MS = 25000;
  var failed = false;

  function screen() { return document.getElementById("booting"); }

  function giveUp(detail) {
    var booting = screen();
    // The game removes this element on its first frame. If it is gone, the game
    // started, and whatever happened afterwards belongs to the crash guard.
    if (failed || !booting) return;
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
