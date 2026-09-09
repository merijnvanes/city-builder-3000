import "./minimap.css";
import { mapPoint, worldPoint, visibleMapPolygon, cameraMarker, minimapView } from './minimap-geometry.js';

const colors = {
  road: "#8393aa",
  highway: "#4f5d63",
  rail: "#5a5a4c",
  residential: "#81b46a",
  commercial: "#648fc3",
  industrial: "#d5b767",
  park: "#466f53",
  largepark: "#466f53",
  zoo: "#4f7a55",
  landfill: "#8d8560",
};
const civicColor = "#8a8fa5";
const utilityColor = "#a47965";
const UTILITIES = new Set(["coal", "oil", "gas", "nuclear", "wind", "solar", "waterpump", "watertower", "treatment"]);

export function createMinimap(renderer) {
  const panel = document.createElement("div");
  panel.className = "district-map";
  panel.innerHTML = '<canvas width="480" height="480" tabindex="0" role="img" aria-label="City overview. Click or drag to move the camera. Arrow keys pan the view."></canvas>';
  document.querySelector("#navigator").prepend(panel);
  const canvas = panel.querySelector("canvas"), ctx = canvas.getContext("2d");
  canvas.title = 'Click or drag to move around your city. The gold dot marks the camera side of the view.';
  const terrain = document.createElement('canvas'); terrain.width = terrain.height = 160;
  const map = terrain.getContext('2d');
  let city, mapCity, mapRevision, lastKey = "";
  function moveCamera(event) {
    if (!city) return;
    const rect = canvas.getBoundingClientRect();
    const world = worldPoint((event.clientX - rect.left) / rect.width * 160, (event.clientY - rect.top) / rect.height * 160, city.size);
    if (!world) return;
    const p = renderer.project(world.x, world.y);
    renderer.pan(renderer.cx - p.x, renderer.cy - p.y);
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    moveCamera(event);
  });
  canvas.addEventListener('pointermove', event => {
    if (canvas.hasPointerCapture(event.pointerId)) moveCamera(event);
  });
  canvas.addEventListener('keydown', event => {
    const delta = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key];
    if (!delta) return;
    event.preventDefault(); event.stopPropagation();
    renderer.pan(...delta);
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
      ctx.setTransform(3, 0, 0, 3, 0, 0);
      ctx.clearRect(0, 0, 160, 160);
      ctx.beginPath();
      ctx.moveTo(80, 15); ctx.lineTo(145, 80); ctx.lineTo(80, 145); ctx.lineTo(15, 80);
      ctx.closePath();
      ctx.fillStyle = '#879ac0'; ctx.fill();
      ctx.strokeStyle = '#f5f7ff'; ctx.lineWidth = 2;
      ctx.save();
      ctx.transform(0.4, 0.4, -0.4, 0.4, 80, 16);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(terrain, 0, 0);
      ctx.restore();
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(80, 16); ctx.lineTo(144, 80); ctx.lineTo(80, 144); ctx.lineTo(16, 80);
      ctx.closePath(); ctx.clip();
      ctx.beginPath();
      const view = minimapView(renderer);
      visibleMapPolygon(view, city.size).forEach((p, i) => {
        const m = mapPoint(p.x, p.y, city.size);
        if (i) ctx.lineTo(m.x, m.y); else ctx.moveTo(m.x, m.y);
      });
      ctx.closePath();
      ctx.strokeStyle = "#fff9e9";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      const marker = cameraMarker(view, city.size);
      if (marker) {
        ctx.save();
        ctx.beginPath(); ctx.arc(marker.x, marker.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe5a0'; ctx.fill();
        ctx.strokeStyle = '#344364'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#4b628e'; ctx.font = '700 7px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const compass = [['N', 80, 7]];
      for (const [label, x, y] of compass) ctx.fillText(label, x, y);
    },
  };
}
