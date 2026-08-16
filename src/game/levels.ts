export type TileKind = "road" | "walk" | "high" | "low" | "building" | "debris";

export const TILE = 44;
export const MAP_W = 34;
export const MAP_H = 24;

export interface Tile {
  kind: TileKind;
  elev: number;
  solid: boolean;
  v: number; // visual variation 0..1
}

export interface LevelDef {
  id: number;
  name: string;
  intro: string;
  seconds: number;
  waterStart: number;
  waterRate: number; // units per second
  waterAccel: number;
  debrisChance: number;
  npcCount: number;
  itemCount: number;
  requiredSupplies: number;
  requiredRescues: number;
  needsKit: boolean;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "THE RISING",
    intro: "The water is rising. Find supplies and get to the shelter.",
    seconds: 210,
    waterStart: -0.35,
    waterRate: 0.0075,
    waterAccel: 0.000018,
    debrisChance: 0.0,
    npcCount: 2,
    itemCount: 7,
    requiredSupplies: 1,
    requiredRescues: 0,
    needsKit: false,
  },
  {
    id: 2,
    name: "CUT OFF",
    intro: "Roads are blocked. Choose your route — short and deep, or long and dry.",
    seconds: 180,
    waterStart: 0.05,
    waterRate: 0.011,
    waterAccel: 0.00003,
    debrisChance: 0.16,
    npcCount: 4,
    itemCount: 7,
    requiredSupplies: 1,
    requiredRescues: 1,
    needsKit: true,
  },
  {
    id: 3,
    name: "LAST EXIT",
    intro: "The city is going under. Reach the extraction point before the water wins.",
    seconds: 150,
    waterStart: 0.32,
    waterRate: 0.017,
    waterAccel: 0.00006,
    debrisChance: 0.24,
    npcCount: 5,
    itemCount: 6,
    requiredSupplies: 2,
    requiredRescues: 2,
    needsKit: true,
  },
];

export const WATER_MAX = 1.45;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function elevFor(kind: TileKind): number {
  switch (kind) {
    case "road":
      return 0;
    case "walk":
      return 0.26;
    case "high":
      return 1.05;
    case "low":
      return -0.42;
    default:
      return 3;
  }
}

export function buildMap(level: LevelDef): Tile[] {
  const rnd = mulberry32(1337 * level.id + 7);
  const tiles: Tile[] = new Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const mx = x % 6;
      const my = y % 6;
      const roadAxis = mx === 0 || my === 0;
      const walkAxis = mx === 1 || mx === 5 || my === 1 || my === 5;
      let kind: TileKind;
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) kind = "building";
      else if (roadAxis) kind = "road";
      else if (walkAxis) kind = "walk";
      else kind = "building";

      if (kind === "road" && rnd() < 0.05) kind = "low"; // drainage channel
      if (kind === "building" && rnd() < 0.13) kind = "high"; // courtyards / raised ground
      if (kind === "road" && rnd() < level.debrisChance && x > 3 && y > 3) kind = "debris";

      tiles[y * MAP_W + x] = {
        kind,
        elev: elevFor(kind),
        solid: kind === "building" || kind === "debris",
        v: rnd(),
      };
    }
  }
  // guarantee spawn + evac areas
  const clear = (cx: number, cy: number, kind: TileKind) => {
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - 1; x <= cx + 1; x++) {
        const t = tiles[y * MAP_W + x];
        if (!t) continue;
        t.kind = kind;
        t.elev = elevFor(kind);
        t.solid = false;
      }
  };
  clear(2, 2, "walk");
  clear(MAP_W - 4, MAP_H - 4, "high");
  return tiles;
}

export function reachable(tiles: Tile[], from: [number, number], to: [number, number]) {
  const seen = new Uint8Array(MAP_W * MAP_H);
  const q: number[] = [from[1] * MAP_W + from[0]];
  seen[q[0]] = 1;
  const target = to[1] * MAP_W + to[0];
  while (q.length) {
    const i = q.shift()!;
    if (i === target) return true;
    const x = i % MAP_W;
    const y = (i / MAP_W) | 0;
    const nb: Array<[number, number]> = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const j = ny * MAP_W + nx;
      if (seen[j] || tiles[j]!.solid) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return false;
}

export function ensureRoute(tiles: Tile[], from: [number, number], to: [number, number]) {
  let guard = 400;
  while (!reachable(tiles, from, to) && guard-- > 0) {
    const i = tiles.findIndex((t) => t.kind === "debris");
    if (i < 0) break;
    const t = tiles[i]!;
    t.kind = "road";
    t.elev = elevFor("road");
    t.solid = false;
  }
}