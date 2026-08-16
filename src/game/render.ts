import { MAP_H, MAP_W, TILE, type Tile } from "./levels";
import type { Game } from "./engine";

const C = {
  road: "#2a2f36",
  roadAlt: "#31363e",
  walk: "#3b4149",
  high: "#4a4438",
  low: "#20242a",
  building: "#171a1f",
  buildingTop: "#252a31",
  debris: "#5a4632",
  line: "#6b7178",
  water: "#0e3a4d",
  waterHi: "#1d6f86",
};

function tileColor(t: Tile) {
  switch (t.kind) {
    case "road":
      return t.v > 0.5 ? C.road : C.roadAlt;
    case "walk":
      return C.walk;
    case "high":
      return C.high;
    case "low":
      return C.low;
    case "debris":
      return C.debris;
    default:
      return C.building;
  }
}

export function render(ctx: CanvasRenderingContext2D, g: Game, W: number, H: number) {
  const t = g.t;
  // camera
  const shake = g.shake;
  const tx = Math.max(0, Math.min(MAP_W * TILE - W, g.px - W / 2));
  const ty = Math.max(0, Math.min(MAP_H * TILE - H, g.py - H / 2));
  g.camX += (tx - g.camX) * 0.12;
  g.camY += (ty - g.camY) * 0.12;
  const ox = -g.camX + (Math.random() - 0.5) * shake;
  const oy = -g.camY + (Math.random() - 0.5) * shake;

  ctx.fillStyle = "#0b0e12";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(Math.round(ox), Math.round(oy));

  const x0 = Math.max(0, Math.floor(g.camX / TILE) - 1);
  const y0 = Math.max(0, Math.floor(g.camY / TILE) - 1);
  const x1 = Math.min(MAP_W - 1, Math.ceil((g.camX + W) / TILE));
  const y1 = Math.min(MAP_H - 1, Math.ceil((g.camY + H) / TILE));

  // ground
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tl = g.tileAt(x, y);
      if (!tl) continue;
      const px = x * TILE;
      const py = y * TILE;
      ctx.fillStyle = tileColor(tl);
      ctx.fillRect(px, py, TILE, TILE);
      if (tl.kind === "road") {
        ctx.fillStyle = "rgba(230,230,230,0.10)";
        if (x % 6 === 0) ctx.fillRect(px + TILE / 2 - 1, py + 10, 2, TILE - 20);
        if (y % 6 === 0) ctx.fillRect(px + 10, py + TILE / 2 - 1, TILE - 20, 2);
      }
      if (tl.kind === "walk") {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        if (tl.v > 0.9) {
          // street light
          ctx.fillStyle = "#565c64";
          ctx.fillRect(px + TILE / 2 - 2, py + 8, 4, 24);
          const grd = ctx.createRadialGradient(px + TILE / 2, py + 8, 2, px + TILE / 2, py + 8, 60);
          grd.addColorStop(0, "rgba(255,180,90,0.28)");
          grd.addColorStop(1, "rgba(255,180,90,0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + 8, 60, 0, Math.PI * 2);
          ctx.fill();
        } else if (tl.v > 0.78) {
          // tree
          ctx.fillStyle = "#20361f";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 13, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (tl.kind === "high") {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(px, py, TILE, 4);
      }
      if (tl.kind === "low") {
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py + TILE / 2);
        ctx.lineTo(px + TILE, py + TILE / 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (tl.kind === "debris") {
        ctx.fillStyle = "#3a2f22";
        ctx.fillRect(px + 3, py + 12, TILE - 6, TILE - 24);
        ctx.fillStyle = "#c1741f";
        for (let i = 0; i < 3; i++) ctx.fillRect(px + 5 + i * 12, py + 14, 6, TILE - 28);
      }
    }
  }

  // buildings (drawn with fake height)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tl = g.tileAt(x, y);
      if (!tl || tl.kind !== "building") continue;
      const px = x * TILE;
      const py = y * TILE;
      const h = 8 + Math.floor(tl.v * 14);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(px + 3, py + 3, TILE, TILE);
      ctx.fillStyle = C.building;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = C.buildingTop;
      ctx.fillRect(px + 2, py + 2 - h * 0.15, TILE - 4, TILE - 4);
      // windows
      ctx.fillStyle = tl.v > 0.6 ? "rgba(255,196,120,0.30)" : "rgba(140,190,220,0.16)";
      for (let i = 0; i < 4; i++) {
        const wx = px + 7 + (i % 2) * 16;
        const wy = py + 8 + Math.floor(i / 2) * 16;
        ctx.fillRect(wx, wy, 9, 9);
      }
    }
  }

  // evacuation zone
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.save();
  ctx.globalAlpha = 0.25 + pulse * 0.35;
  ctx.fillStyle = "#ff8a2b";
  ctx.beginPath();
  ctx.arc(g.evac.x, g.evac.y, 44 + pulse * 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#ffb066";
  ctx.lineWidth = 2;
  ctx.strokeRect(g.evac.x - 26, g.evac.y - 26, 52, 52);
  ctx.fillStyle = "#ffd9b0";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("EVAC", g.evac.x, g.evac.y + 4);

  // items
  for (const it of g.items) {
    if (it.taken) continue;
    const by = Math.sin(t * 3 + it.bob) * 3;
    ctx.save();
    ctx.translate(it.x, it.y + by);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    if (it.type === "water") {
      ctx.fillStyle = "#4fc3e8";
      ctx.fillRect(-5, -9, 10, 18);
    } else if (it.type === "aid") {
      ctx.fillStyle = "#e8f1f5";
      ctx.fillRect(-9, -7, 18, 14);
      ctx.fillStyle = "#e33b3b";
      ctx.fillRect(-2, -5, 4, 10);
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillStyle = "#f0a63c";
      ctx.fillRect(-10, -8, 20, 16);
      ctx.fillStyle = "#2a2f36";
      ctx.fillRect(-10, -2, 20, 4);
    }
    ctx.restore();
  }

  // NPCs
  for (const n of g.npcs) {
    const by = Math.sin(t * 2 + n.bob) * 2;
    drawPerson(ctx, n.x, n.y + by, n.helped ? "#7fd18a" : n.refused ? "#7c8288" : "#e0574f", 0, 1);
    if (!n.helped && !n.refused) {
      ctx.fillStyle = "#ffcf5c";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", n.x, n.y - 24 + Math.sin(t * 5) * 2);
    }
  }

  // player
  drawPerson(ctx, g.px, g.py, "#ffd166", g.moving ? Math.sin(g.animT) : 0, g.facing);

  // water layer
  drawWater(ctx, g, x0, y0, x1, y1, t);

  ctx.restore();

  // rain
  ctx.strokeStyle = "rgba(160,200,220,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const rx = (i * 137.5 + t * 260) % W;
    const ry = (i * 71.3 + t * 900) % H;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 3, ry + 12);
    ctx.stroke();
  }

  // vignette + danger tint
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  const danger = Math.max(0, Math.min(1, g.depthAt(g.px, g.py) / 1.1));
  if (danger > 0.6) {
    ctx.fillStyle = `rgba(190,40,40,${(danger - 0.6) * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawMinimap(ctx, g, W);
}

function drawWater(
  ctx: CanvasRenderingContext2D,
  g: Game,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tl = g.tileAt(x, y);
      if (!tl || tl.kind === "building") continue;
      const d = g.water - tl.elev;
      if (d <= 0) continue;
      const px = x * TILE;
      const py = y * TILE;
      const wave = 0.5 + 0.5 * Math.sin(t * 1.8 + x * 0.6 + y * 0.45);
      const alpha = Math.min(0.86, 0.24 + d * 0.55);
      ctx.fillStyle = `rgba(12,58,78,${alpha})`;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = `rgba(60,170,205,${0.05 + wave * 0.09})`;
      ctx.fillRect(px, py + (wave * TILE) / 2, TILE, 4);
      if (d > 0.75) {
        ctx.fillStyle = `rgba(200,60,50,${0.06 + wave * 0.05})`;
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }
  // floating debris
  ctx.fillStyle = "rgba(120,100,70,0.55)";
  for (const d of g.debris) {
    const dx = d.x + Math.sin(t * 0.4 + d.a) * 16;
    const dy = d.y + Math.cos(t * 0.33 + d.a) * 12;
    if (dx < g.camX - 40 || dy < g.camY - 40) continue;
    if (g.water - g.elevAtPx(dx, dy) <= 0.2) continue;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(d.a + t * 0.2);
    ctx.fillRect(-d.s, -d.s / 3, d.s * 2, d.s / 1.5);
    ctx.restore();
  }
  // ripples
  ctx.strokeStyle = "rgba(180,230,245,0.5)";
  for (const r of g.ripples) {
    ctx.globalAlpha = 1 - r.t;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 6 + r.t * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, phase: number, face: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.strokeStyle = "#2b3038";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-3, 6);
  ctx.lineTo(-3 + phase * 5, 14);
  ctx.moveTo(3, 6);
  ctx.lineTo(3 - phase * 5, 14);
  ctx.stroke();
  // body
  ctx.fillStyle = color;
  ctx.fillRect(-7, -6, 14, 14);
  // arms
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-7, -3);
  ctx.lineTo(-11, 2 + phase * 3);
  ctx.moveTo(7, -3);
  ctx.lineTo(11, 2 - phase * 3);
  ctx.stroke();
  // head
  ctx.fillStyle = "#e8c9a0";
  ctx.beginPath();
  ctx.arc(face * 1.5, -12, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMinimap(ctx: CanvasRenderingContext2D, g: Game, W: number) {
  const size = 150;
  const pad = 16;
  const sx = W - size - pad;
  const sy = pad;
  const scale = size / (MAP_W * TILE);
  const h = MAP_H * TILE * scale;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(8,12,16,0.85)";
  ctx.fillRect(sx - 4, sy - 4, size + 8, h + 8);
  ctx.strokeStyle = "rgba(120,170,190,0.45)";
  ctx.strokeRect(sx - 4.5, sy - 4.5, size + 9, h + 9);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const tl = g.tileAt(x, y);
      if (!tl) continue;
      const d = g.water - tl.elev;
      let col = tl.solid ? "#1b1f25" : tl.kind === "high" ? "#5d5540" : "#39404a";
      if (!tl.solid && d > 0.75) col = "#8d2f2c";
      else if (!tl.solid && d > 0) col = "#155066";
      ctx.fillStyle = col;
      ctx.fillRect(sx + x * TILE * scale, sy + y * TILE * scale, TILE * scale + 0.5, TILE * scale + 0.5);
    }
  // evac
  ctx.fillStyle = "#ff8a2b";
  ctx.fillRect(sx + g.evac.x * scale - 3, sy + g.evac.y * scale - 3, 6, 6);
  // npcs
  for (const n of g.npcs) {
    if (n.helped || n.refused) continue;
    ctx.fillStyle = "#ffcf5c";
    ctx.fillRect(sx + n.x * scale - 2, sy + n.y * scale - 2, 4, 4);
  }
  // player
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(sx + g.px * scale, sy + g.py * scale, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}