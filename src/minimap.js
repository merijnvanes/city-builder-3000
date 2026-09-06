import "./minimap.css";

const colors = {
  road: "#647b75",
  rail: "#5a5a4c",
  residential: "#73936d",
  commercial: "#6192a0",
  industrial: "#b59864",
  park: "#466f53",
  largepark: "#466f53",
  zoo: "#4f7a55",
  landfill: "#8d8560",
};
const civicColor = "#8a8fa5";
const utilityColor = "#a47965";
const UTILITIES = new Set(["coal", "oil", "gas", "nuclear", "wind", "solar", "waterpump", "watertower", "treatment"]);

export function createMinimap(renderer) {
  const panel = document.createElement("section");
  panel.className = "district-map";
  panel.innerHTML = '<div class="district-map-label">REGION OVERVIEW <span>↗</span></div><canvas width="160" height="160" role="img" aria-label="City overview. Click to move the camera."></canvas>';
  document.querySelector("#navigator").prepend(panel);
  const canvas = panel.querySelector("canvas"), ctx = canvas.getContext("2d");
  let city, lastKey = "";
  canvas.addEventListener("pointerdown", (event) => {
    if (!city) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * city.size;
    const y = ((event.clientY - rect.top) / rect.height) * city.size;
    const p = renderer.project(x, y);
    renderer.pan(renderer.w * 0.45 - p.x, renderer.h * 0.47 - p.y);
  });
  return {
    update(nextCity) {
      city = nextCity;
      const key = [city.seed, city.revision, renderer.panX, renderer.panY, renderer.zoom, renderer.rotation, renderer.w, renderer.h].join(":");
      if (key === lastKey) return;
      lastKey = key;
      const s = 160 / city.size;
      for (const tile of city.tiles) {
        let c = colors[tile.type];
        if (!c) {
          if (tile.type === "empty") c = tile.terrain === "water" ? "#94bfbe" : tile.terrain === "sand" ? "#ccc9a8" : tile.trees ? "#a3b58c" : "#bdc9a3";
          else c = UTILITIES.has(tile.type) ? utilityColor : civicColor;
        }
        if (tile.abandoned) c = "#6c6a5e";
        ctx.fillStyle = c;
        ctx.fillRect(tile.x * s, tile.y * s, s, s);
        if (tile.elev && tile.terrain !== "water") { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, tile.elev * 0.06)})`; ctx.fillRect(tile.x * s, tile.y * s, s, s); }
      }
      ctx.beginPath();
      [[0, 40], [renderer.w - 200, 40], [renderer.w - 200, renderer.h - 78], [0, renderer.h - 78]].forEach(([x, y], i) => {
        const p = renderer.pick(x, y);
        if (i) ctx.lineTo(p.x * s, p.y * s); else ctx.moveTo(p.x * s, p.y * s);
      });
      ctx.closePath();
      ctx.strokeStyle = "#fff9e9";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    },
  };
}
