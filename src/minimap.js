import "./minimap.css";
import { mapPoint, worldPoint, visibleMapPolygon } from './minimap-geometry.js';

const colors = {
  road: "#647b75",
  highway: "#4f5d63",
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
  const terrain = document.createElement('canvas'); terrain.width = terrain.height = 160;
  const map = terrain.getContext('2d');
  let city, mapCity, mapRevision, lastKey = "";
  canvas.addEventListener("pointerdown", (event) => {
    if (!city) return;
    const rect = canvas.getBoundingClientRect();
    const world = worldPoint((event.clientX - rect.left) / rect.width * 160, (event.clientY - rect.top) / rect.height * 160, city.size);
    if (!world) return;
    const p = renderer.project(world.x, world.y);
    renderer.pan(renderer.cx - p.x, renderer.cy - p.y);
  });
  return {
    update(nextCity) {
      city = nextCity;
      const key = [city.seed, city.revision, renderer.panX, renderer.panY, renderer.zoom, renderer.rotation, renderer.w, renderer.h].join(":");
      if (key === lastKey && mapCity === city) return;
      lastKey = key;
      const s = 160 / city.size;
      if (mapCity !== city || mapRevision !== city.revision) {
      for (const tile of city.tiles) {
        let c = colors[tile.type];
        if (!c) {
          if (tile.type === "empty") c = tile.terrain === "water" ? "#94bfbe" : tile.terrain === "sand" ? "#ccc9a8" : tile.terrain === "rock" ? "#7a736c" : tile.trees ? "#a3b58c" : "#bdc9a3";
          else c = UTILITIES.has(tile.type) ? utilityColor : civicColor;
        }
        if (tile.abandoned) c = "#6c6a5e";
        map.fillStyle = c;
        map.fillRect(tile.x * s, tile.y * s, s, s);
        if (tile.elev && tile.terrain !== "water") { map.fillStyle = `rgba(255,255,255,${Math.min(0.5, tile.elev * 0.06)})`; map.fillRect(tile.x * s, tile.y * s, s, s); }
      }
        mapCity = city; mapRevision = city.revision;
      }
      ctx.clearRect(0, 0, 160, 160);
      ctx.save();
      ctx.setTransform(0.4, 0.4, -0.4, 0.4, 80, 16);
      ctx.drawImage(terrain, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(80, 16); ctx.lineTo(144, 80); ctx.lineTo(80, 144); ctx.lineTo(16, 80);
      ctx.closePath(); ctx.clip();
      ctx.beginPath();
      const view = [[0, 0], [renderer.w, 0], [renderer.w, renderer.h], [0, renderer.h]].map(([x, y]) => renderer.pick(x, y));
      visibleMapPolygon(view, city.size).forEach((p, i) => {
        const m = mapPoint(p.x, p.y, city.size);
        if (i) ctx.lineTo(m.x, m.y); else ctx.moveTo(m.x, m.y);
      });
      ctx.closePath();
      ctx.strokeStyle = "#fff9e9";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#e8e2ce'; ctx.font = '600 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [label, x, y] of [['N', 119, 39], ['E', 121, 121], ['S', 39, 121], ['W', 39, 39]]) ctx.fillText(label, x, y);
    },
  };
}
