import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    // Spelled out rather than left to Vite's default, which moves with each
    // Vite release and would quietly raise or lower what the game runs on.
    //
    // This is the floor public/boot.js checks for and the README states. Chrome
    // and Safari are set by the JavaScript the simulation and interface use
    // directly; Firefox is set by CSS :has(), which hides panels that would
    // otherwise overlap and has no workaround short of rewriting the layout.
    target: ["chrome108", "edge108", "firefox121", "safari16"],
  },
});
