import {
  LEVELS,
  MAP_H,
  MAP_W,
  TILE,
  WATER_MAX,
  buildMap,
  ensureRoute,
  mulberry32,
  type LevelDef,
  type Tile,
} from "./levels";
import { sfx } from "./audio";

export type ItemType = "water" | "aid" | "kit";
export type Status = "playing" | "won" | "lost";

export interface Objective {
  id: string;
  text: string;
  done: boolean;
}

export interface Npc {
  id: number;
  x: number;
  y: number;
  name: string;
  line: string;
  helped: boolean;
  refused: boolean;
  bob: number;
}

export interface Item {
  x: number;
  y: number;
  type: ItemType;
  taken: boolean;
  bob: number;
}

export interface Results {
  timeLeft: number;
  rescues: number;
  supplies: number;
  health: number;
  score: number;
  rank: string;
  reason: string;
}

export interface HudState {
  level: number;
  levelName: string;
  health: number;
  stamina: number;
  floodPct: number;
  timeLeft: number;
  objectives: Objective[];
  inventory: { water: number; aid: number; kit: number; token: number };
  prompt: string | null;
  dialog: { name: string; line: string; cost: string } | null;
  status: Status;
  results: Results | null;
  raft: boolean;
  tip: string | null;
  danger: number;
}

const NPC_NAMES = [
  ["Amina", "I can't get across the flooded road. Can you help me?"],
  ["Mr. Okoro", "My legs won't carry me through this water, please."],
  ["Dayo", "My little brother is on the roof. I can't reach him alone."],
  ["Shopkeeper Bala", "Help me shut the shop and I'll show you a dry route."],
  ["Injured runner", "I twisted my ankle in the drain. I need a hand."],
];

export class Game {
  level: LevelDef;
  tiles: Tile[];
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  facing = 1;
  animT = 0;
  moving = false;
  sprinting = false;
  health = 100;
  stamina = 100;
  water: number;
  time: number;
  status: Status = "playing";
  npcs: Npc[] = [];
  items: Item[] = [];
  evac = { x: 0, y: 0 };
  inventory = { water: 0, aid: 0, kit: 0, token: 0 };
  objectives: Objective[] = [];
  raft = false;
  damageTaken = 0;
  supplies = 0;
  rescues = 0;
  refusals = 0;
  results: Results | null = null;
  dialogNpc: Npc | null = null;
  prompt: string | null = null;
  tip: string | null = null;
  tipT = 0;
  paused = false;
  keys = new Set<string>();
  t = 0;
  stepT = 0;
  warnT = 0;
  shake = 0;
  camX = 0;
  camY = 0;
  ripples: { x: number; y: number; t: number }[] = [];
  debris: { x: number; y: number; a: number; s: number }[] = [];

  constructor(levelIndex: number) {
    this.level = LEVELS[Math.min(levelIndex, LEVELS.length - 1)] as LevelDef;
    this.tiles = buildMap(this.level);
    this.water = this.level.waterStart;
    this.time = this.level.seconds;
    this.evac = { x: (MAP_W - 4) * TILE + TILE / 2, y: (MAP_H - 4) * TILE + TILE / 2 };
    ensureRoute(this.tiles, [2, 2], [MAP_W - 4, MAP_H - 4]);
    this.px = 2 * TILE + TILE / 2;
    this.py = 2 * TILE + TILE / 2;
    this.spawnEntities();
    this.buildObjectives();
    this.setTip("WASD move · SHIFT sprint · E interact");
  }

  tileAt(tx: number, ty: number): Tile | undefined {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return undefined;
    return this.tiles[ty * MAP_W + tx];
  }

  elevAtPx(x: number, y: number): number {
    const t = this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
    return t ? t.elev : 3;
  }

  depthAt(x: number, y: number): number {
    return this.water - this.elevAtPx(x, y);
  }

  private spawnEntities() {
    const rnd = mulberry32(99 * this.level.id + 3);
    const free: Array<[number, number]> = [];
    for (let y = 2; y < MAP_H - 2; y++)
      for (let x = 2; x < MAP_W - 2; x++) {
        const t = this.tileAt(x, y);
        if (t && !t.solid) free.push([x, y]);
      }
    const pick = () => {
      for (let i = 0; i < 60; i++) {
        const c = free[Math.floor(rnd() * free.length)];
        if (!c) continue;
        const dx = c[0] * TILE - this.px;
        const dy = c[1] * TILE - this.py;
        if (Math.hypot(dx, dy) > 220) return c;
      }
      return free[Math.floor(rnd() * free.length)] ?? [5, 5];
    };
    const kinds: ItemType[] = ["water", "aid", "kit"];
    for (let i = 0; i < this.level.itemCount; i++) {
      const c = pick();
      const type = (i === 0 && this.level.needsKit ? "kit" : kinds[Math.floor(rnd() * 3)]) as ItemType;
      this.items.push({ x: c[0] * TILE + TILE / 2, y: c[1] * TILE + TILE / 2, type, taken: false, bob: rnd() * 6 });
    }
    for (let i = 0; i < this.level.npcCount; i++) {
      const c = pick();
      const n = NPC_NAMES[i % NPC_NAMES.length] as [string, string];
      this.npcs.push({
        id: i,
        x: c[0] * TILE + TILE / 2,
        y: c[1] * TILE + TILE / 2,
        name: n[0],
        line: n[1],
        helped: false,
        refused: false,
        bob: rnd() * 6,
      });
    }
    for (let i = 0; i < 90; i++) {
      this.debris.push({
        x: rnd() * MAP_W * TILE,
        y: rnd() * MAP_H * TILE,
        a: rnd() * Math.PI * 2,
        s: 3 + rnd() * 6,
      });
    }
  }

  private buildObjectives() {
    const l = this.level;
    const obj: Objective[] = [];
    obj.push({
      id: "supplies",
      text: `Collect ${l.requiredSupplies} emergency suppl${l.requiredSupplies > 1 ? "ies" : "y"}`,
      done: false,
    });
    if (l.needsKit) obj.push({ id: "kit", text: "Find an emergency kit", done: false });
    if (l.requiredRescues > 0)
      obj.push({ id: "rescue", text: `Help ${l.requiredRescues} stranded survivor(s)`, done: false });
    obj.push({ id: "evac", text: "Reach the evacuation point", done: false });
    this.objectives = obj;
  }

  private setObjDone(id: string) {
    const o = this.objectives.find((x) => x.id === id);
    if (o && !o.done) {
      o.done = true;
      sfx.objective();
      this.setTip(`Objective complete: ${o.text}`);
    }
  }

  setTip(text: string) {
    this.tip = text;
    this.tipT = 4.5;
  }

  get requirementsMet() {
    return this.objectives.filter((o) => o.id !== "evac").every((o) => o.done);
  }

  useItem(type: "water" | "aid") {
    if (type === "water" && this.inventory.water > 0) {
      this.inventory.water--;
      this.stamina = Math.min(100, this.stamina + 45);
      sfx.pickup();
      this.setTip("Drank water. Stamina restored.");
    } else if (type === "aid" && this.inventory.aid > 0) {
      this.inventory.aid--;
      this.health = Math.min(100, this.health + 35);
      sfx.pickup();
      this.setTip("First aid used. Health restored.");
    }
  }

  nearestNpc(): Npc | null {
    let best: Npc | null = null;
    let bd = 52;
    for (const n of this.npcs) {
      if (n.helped || n.refused) continue;
      const d = Math.hypot(n.x - this.px, n.y - this.py);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  interact() {
    if (this.status !== "playing" || this.dialogNpc) return;
    const n = this.nearestNpc();
    if (n) {
      this.dialogNpc = n;
      sfx.interact();
      return;
    }
    if (Math.hypot(this.evac.x - this.px, this.evac.y - this.py) < 60) this.tryEvac();
  }

  answerDialog(help: boolean) {
    const n = this.dialogNpc;
    if (!n) return;
    this.dialogNpc = null;
    if (help) {
      n.helped = true;
      this.rescues++;
      this.inventory.token++;
      this.time = Math.max(5, this.time - 15);
      this.raft = true;
      sfx.objective();
      this.setTip(`${n.name} is safe. −15s, +1 rescue token, you found a raft.`);
      if (this.rescues >= this.level.requiredRescues && this.level.requiredRescues > 0)
        this.setObjDone("rescue");
    } else {
      n.refused = true;
      this.refusals++;
      sfx.warn();
      this.setTip(`You leave ${n.name} behind. Time saved, conscience not.`);
    }
  }

  tryEvac() {
    if (this.requirementsMet) {
      this.setObjDone("evac");
      this.finish(true, "You made it out.");
    } else {
      this.setTip("Evacuation refused — complete your objectives first.");
      sfx.warn();
    }
  }

  finish(won: boolean, reason: string) {
    if (this.status !== "playing") return;
    this.status = won ? "won" : "lost";
    const objDone = this.objectives.filter((o) => o.done).length;
    let score = 1000;
    if (won) {
      score += Math.round(this.time) * 10;
      score += Math.round(this.health) * 6;
      score += objDone * 250;
    }
    score += this.rescues * 400;
    score += this.supplies * 120;
    score -= Math.round(this.damageTaken) * 3;
    score -= this.refusals * 150;
    if (!won) score = Math.round(score * 0.35);
    score = Math.max(0, score);
    const rank = !won ? "D" : score > 4200 ? "S" : score > 3400 ? "A" : score > 2600 ? "B" : score > 1800 ? "C" : "D";
    this.results = {
      timeLeft: Math.max(0, Math.round(this.time)),
      rescues: this.rescues,
      supplies: this.supplies,
      health: Math.max(0, Math.round(this.health)),
      score,
      rank,
      reason,
    };
    if (won) sfx.win();
    else sfx.lose();
  }

  private collide(nx: number, ny: number) {
    const r = 12;
    const minX = Math.floor((nx - r) / TILE);
    const maxX = Math.floor((nx + r) / TILE);
    const minY = Math.floor((ny - r) / TILE);
    const maxY = Math.floor((ny + r) / TILE);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const t = this.tileAt(x, y);
        if (!t || t.solid) return true;
      }
    return false;
  }

  update(dt: number) {
    if (this.status !== "playing" || this.paused || this.dialogNpc) return;
    this.t += dt;
    this.tipT = Math.max(0, this.tipT - dt);
    if (this.tipT === 0) this.tip = null;

    // input
    const k = this.keys;
    let ix = 0;
    let iy = 0;
    if (k.has("KeyA") || k.has("ArrowLeft")) ix -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) ix += 1;
    if (k.has("KeyW") || k.has("ArrowUp")) iy -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) iy += 1;
    const len = Math.hypot(ix, iy) || 1;
    ix /= len;
    iy /= len;
    this.moving = ix !== 0 || iy !== 0;
    if (ix !== 0) this.facing = ix > 0 ? 1 : -1;

    const wantSprint = (k.has("ShiftLeft") || k.has("ShiftRight")) && this.moving && this.stamina > 1;
    this.sprinting = wantSprint;
    if (wantSprint) this.stamina = Math.max(0, this.stamina - 26 * dt);
    else this.stamina = Math.min(100, this.stamina + (this.moving ? 9 : 17) * dt);

    const depth = this.depthAt(this.px, this.py);
    const eff = this.raft ? depth * 0.55 : depth;
    let mult = 1;
    if (eff > 0.75) mult = 0.38;
    else if (eff > 0.35) mult = 0.62;
    else if (eff > 0) mult = 0.85;
    const speed = (this.sprinting ? 215 : 132) * mult;

    const nx = this.px + ix * speed * dt;
    const ny = this.py + iy * speed * dt;
    if (!this.collide(nx, this.py)) this.px = nx;
    if (!this.collide(this.px, ny)) this.py = ny;

    // footsteps / ripples
    if (this.moving) {
      this.animT += dt * (this.sprinting ? 13 : 8);
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = this.sprinting ? 0.26 : 0.4;
        if (depth > 0) {
          sfx.splash();
          this.ripples.push({ x: this.px, y: this.py, t: 0 });
        } else sfx.step();
      }
    }
    this.ripples = this.ripples.filter((r) => (r.t += dt) < 1.1);

    // flood
    this.water += (this.level.waterRate + this.level.waterAccel * this.t) * dt * 10;
    if (this.water >= WATER_MAX) this.finish(false, "The city was overwhelmed before you reached safety.");

    // damage
    const dangerDepth = this.raft ? 1.15 : 0.75;
    if (depth > dangerDepth) {
      const dmg = 12 * dt;
      this.health -= dmg;
      this.damageTaken += dmg;
      this.shake = 4;
      if (this.health <= 0) {
        this.health = 0;
        this.finish(false, "The current pulled you under.");
      }
    }
    this.shake = Math.max(0, this.shake - dt * 12);

    // timer
    this.time -= dt;
    if (this.time <= 30) {
      this.warnT -= dt;
      if (this.warnT <= 0) {
        this.warnT = this.time <= 10 ? 1 : 5;
        sfx.warn();
      }
    }
    if (this.time <= 0) {
      this.time = 0;
      this.finish(false, "The evacuation window closed.");
    }

    // pickups
    for (const it of this.items) {
      if (it.taken) continue;
      if (Math.hypot(it.x - this.px, it.y - this.py) < 26) {
        it.taken = true;
        this.supplies++;
        this.inventory[it.type]++;
        sfx.pickup();
        this.setTip(
          it.type === "kit" ? "Emergency kit secured." : it.type === "aid" ? "First aid collected." : "Clean water collected.",
        );
        if (this.supplies >= this.level.requiredSupplies) this.setObjDone("supplies");
        if (it.type === "kit") this.setObjDone("kit");
      }
    }

    // prompts
    const n = this.nearestNpc();
    if (n) this.prompt = `E — Talk to ${n.name}`;
    else if (Math.hypot(this.evac.x - this.px, this.evac.y - this.py) < 60)
      this.prompt = this.requirementsMet ? "E — Board the evacuation boat" : "Objectives incomplete";
    else this.prompt = null;
  }

  hud(): HudState {
    return {
      level: this.level.id,
      levelName: this.level.name,
      health: Math.max(0, this.health),
      stamina: this.stamina,
      floodPct: Math.max(0, Math.min(100, Math.round(((this.water + 0.5) / (WATER_MAX + 0.5)) * 100))),
      timeLeft: Math.max(0, this.time),
      objectives: this.objectives,
      inventory: this.inventory,
      prompt: this.prompt,
      dialog: this.dialogNpc
        ? { name: this.dialogNpc.name, line: this.dialogNpc.line, cost: "Helping costs 15 seconds" }
        : null,
      status: this.status,
      results: this.results,
      raft: this.raft,
      tip: this.tip,
      danger: Math.max(0, Math.min(1, this.depthAt(this.px, this.py) / 1.1)),
    };
  }
}