// What happens when the game throws.
//
// The render loop reschedules itself at the end of frame(). An exception
// anywhere inside it therefore ends the loop: the canvas holds its last picture,
// the clock stops, and nothing says why. The player sits in front of a city that
// no longer answers, and their unsaved afternoon is still in memory with no way
// out of the page.
//
// This catches what the page failed to, once, and hands it to the game so the
// city can be written somewhere safe and offered back as a file.

// A resource that failed to load also arrives as an "error" event on the window.
// A sprite that would not decode is not a crash; the artwork falls back and the
// game plays on. Only a real uncaught exception carries a message.
const isException = (event) => typeof event?.message === "string" || event?.error instanceof Error;

const describe = (error, fallback) => {
  if (error instanceof Error) return { message: error.message || String(error), stack: error.stack || null };
  if (typeof error === "string") return { message: error, stack: null };
  if (error && typeof error === "object") {
    try { return { message: JSON.stringify(error).slice(0, 300), stack: null }; } catch { /* circular */ }
  }
  return { message: fallback || "Something went wrong.", stack: null };
};

export function installCrashGuard({ target, report }) {
  // Only the first crash is reported. A loop that throws every frame would
  // otherwise bury the page in dialogs, and the first error is the one that
  // explains the rest.
  //
  // A report that throws is a different case: the player has been told nothing,
  // so the next crash is allowed to try again. Twice is the limit, because the
  // failing part is usually the interface itself and a third attempt would only
  // be the same failure once more.
  const ATTEMPTS = 2;
  const state = { crashes: 0, reported: false, attempts: 0 };

  const handle = (details) => {
    state.crashes++;
    if (state.reported || state.attempts >= ATTEMPTS) return;
    state.attempts++;
    // The handler cannot be allowed to throw. A crash inside the crash report
    // is how a recoverable freeze becomes a silent one.
    try { report(details); state.reported = true; } catch { /* let the next one try */ }
  };

  target.addEventListener("error", (event) => {
    if (!isException(event)) return;
    const { message, stack } = describe(event.error, event.message);
    handle({ message, stack, source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : null });
  });

  target.addEventListener("unhandledrejection", (event) => {
    const { message, stack } = describe(event.reason, "A background task failed.");
    handle({ message, stack, source: null, rejection: true });
  });

  return state;
}
