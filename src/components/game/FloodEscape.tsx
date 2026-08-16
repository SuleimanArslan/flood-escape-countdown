import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type HudState } from "@/game/engine";
import { render } from "@/game/render";
import { LEVELS } from "@/game/levels";
import { isAudioEnabled, setAudioEnabled, sfx, startMusic, stopMusic } from "@/game/audio";

type Screen = "menu" | "howto" | "credits" | "intro" | "play";

const INTRO = [
  "FLASH FLOOD WARNING",
  "The evacuation window is closing.",
  "GET TO HIGHER GROUND.",
];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function bestKey(level: number) {
  return `flood-escape-best-${level}`;
}

export default function FloodEscape() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [levelIndex, setLevelIndex] = useState(0);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [audio, setAudio] = useState(true);
  const [best, setBest] = useState<number[]>([0, 0, 0]);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);

  useEffect(() => {
    setBest(LEVELS.map((l) => Number(localStorage.getItem(bestKey(l.id)) ?? 0)));
  }, []);

  const startLevel = useCallback((idx: number) => {
    gameRef.current = new Game(idx);
    setLevelIndex(idx);
    setPaused(false);
    setShowHelpOverlay(false);
    setHud(gameRef.current.hud());
    setScreen("play");
    startMusic();
  }, []);

  // intro sequence
  useEffect(() => {
    if (screen !== "intro") return;
    setIntroStep(0);
    const t1 = window.setTimeout(() => setIntroStep(1), 3000);
    const t2 = window.setTimeout(() => setIntroStep(2), 6000);
    const t3 = window.setTimeout(() => startLevel(levelIndex), 9500);
    return () => [t1, t2, t3].forEach(window.clearTimeout);
  }, [screen, levelIndex, startLevel]);

  // game loop
  useEffect(() => {
    if (screen !== "play") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let hudT = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (now: number) => {
      const g = gameRef.current;
      raf = requestAnimationFrame(frame);
      if (!g) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.update(dt);
      render(ctx, g, canvas.clientWidth, canvas.clientHeight);
      hudT += dt;
      if (hudT > 0.08) {
        hudT = 0;
        setHud(g.hud());
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [screen]);

  // input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (screen === "intro" && (e.code === "Escape" || e.code === "Space")) {
        startLevel(levelIndex);
        return;
      }
      if (!g || screen !== "play") return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code))
        e.preventDefault();
      g.keys.add(e.code);
      if (e.code === "KeyE") g.interact();
      if (e.code === "Digit1") g.useItem("water");
      if (e.code === "Digit2") g.useItem("aid");
      if (e.code === "Escape" && g.status === "playing") {
        setPaused((p) => {
          const next = !p;
          g.paused = next;
          return next;
        });
      }
    };
    const up = (e: KeyboardEvent) => gameRef.current?.keys.delete(e.code);
    const blur = () => gameRef.current?.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [screen, levelIndex, startLevel]);

  // save best score
  useEffect(() => {
    const r = hud?.results;
    if (!r || hud?.status !== "won") return;
    const id = LEVELS[levelIndex]?.id ?? 1;
    const prev = Number(localStorage.getItem(bestKey(id)) ?? 0);
    if (r.score > prev) {
      localStorage.setItem(bestKey(id), String(r.score));
      setBest((b) => b.map((v, i) => (i === levelIndex ? r.score : v)));
    }
  }, [hud?.status, hud?.results, levelIndex]);

  useEffect(() => () => stopMusic(), []);

  const toMenu = () => {
    gameRef.current = null;
    setPaused(false);
    setHud(null);
    stopMusic();
    setScreen("menu");
  };

  const toggleAudio = () => {
    const next = !isAudioEnabled();
    setAudioEnabled(next);
    setAudio(next);
  };

  const dialog = hud?.dialog ?? null;
  const finished = hud && hud.status !== "playing";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {screen === "play" ? (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      ) : (
        <WaterBackdrop />
      )}

      {screen === "play" && hud && !finished && (
        <Hud hud={hud} onUse={(t) => gameRef.current?.useItem(t)} />
      )}

      {/* NPC dialog */}
      {screen === "play" && dialog && (
        <Overlay>
          <div className="w-full max-w-lg rounded-lg border border-accent/40 bg-card/95 p-6 shadow-2xl">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-accent">{dialog.name}</p>
            <p className="mt-3 text-lg leading-relaxed">"{dialog.line}"</p>
            <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">{dialog.cost}</p>
            <div className="mt-6 flex gap-3">
              <GameButton
                onClick={() => {
                  sfx.click();
                  gameRef.current?.answerDialog(true);
                }}
              >
                HELP
              </GameButton>
              <GameButton
                variant="ghost"
                onClick={() => {
                  sfx.click();
                  gameRef.current?.answerDialog(false);
                }}
              >
                LEAVE
              </GameButton>
            </div>
          </div>
        </Overlay>
      )}

      {/* Pause */}
      {screen === "play" && paused && !finished && (
        <Overlay>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card/95 p-8 text-center">
            <h2 className="font-display text-3xl tracking-[0.25em]">PAUSED</h2>
            <div className="mt-6 flex flex-col gap-3">
              <GameButton
                onClick={() => {
                  setPaused(false);
                  if (gameRef.current) gameRef.current.paused = false;
                }}
              >
                RESUME
              </GameButton>
              <GameButton variant="ghost" onClick={() => startLevel(levelIndex)}>
                RESTART LEVEL
              </GameButton>
              <GameButton variant="ghost" onClick={() => setShowHelpOverlay((s) => !s)}>
                HOW TO PLAY
              </GameButton>
              <GameButton variant="ghost" onClick={toMenu}>
                MAIN MENU
              </GameButton>
            </div>
            {showHelpOverlay && (
              <div className="mt-6 text-left">
                <Controls compact />
              </div>
            )}
          </div>
        </Overlay>
      )}

      {/* Results */}
      {screen === "play" && finished && hud?.results && (
        <Overlay>
          <div className="w-full max-w-md rounded-lg border border-border bg-card/95 p-8 text-center">
            <h2
              className={`font-display text-4xl tracking-[0.2em] ${hud.status === "won" ? "text-accent" : "text-destructive"}`}
            >
              {hud.status === "won" ? "ESCAPED" : "THE WATER WON"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{hud.results.reason}</p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Stat label="Time remaining" value={fmt(hud.results.timeLeft)} />
              <Stat label="Survivors helped" value={String(hud.results.rescues)} />
              <Stat label="Supplies" value={String(hud.results.supplies)} />
              <Stat label="Health" value={`${hud.results.health}%`} />
              <Stat label="Rescue points" value={String(hud.results.rescues * 400)} />
              <Stat label="Best (level)" value={String(best[levelIndex] ?? 0)} />
            </dl>
            <p className="mt-6 font-display text-5xl text-primary">{hud.results.score.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">final score</p>
            <p className="mt-3 font-display text-2xl tracking-widest">RANK {hud.results.rank}</p>
            <div className="mt-6 flex flex-col gap-3">
              {hud.status === "won" && levelIndex < LEVELS.length - 1 && (
                <GameButton onClick={() => startLevel(levelIndex + 1)}>NEXT LEVEL</GameButton>
              )}
              <GameButton variant={hud.status === "won" ? "ghost" : "solid"} onClick={() => startLevel(levelIndex)}>
                {hud.status === "won" ? "PLAY AGAIN" : "TRY AGAIN"}
              </GameButton>
              <GameButton variant="ghost" onClick={toMenu}>
                MAIN MENU
              </GameButton>
            </div>
          </div>
        </Overlay>
      )}

      {/* Intro cinematic */}
      {screen === "intro" && (
        <Overlay dark>
          <div className="text-center">
            <p
              key={introStep}
              className={`animate-fade-in font-display tracking-[0.3em] ${introStep === 0 ? "text-3xl text-destructive md:text-5xl" : "text-2xl md:text-4xl"}`}
            >
              {INTRO[introStep]}
            </p>
            <p className="mt-10 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              press esc to skip
            </p>
          </div>
        </Overlay>
      )}

      {/* Menu screens */}
      {(screen === "menu" || screen === "howto" || screen === "credits") && (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
          {screen === "menu" && (
            <div className="text-center">
              <h1 className="font-display text-6xl tracking-[0.18em] text-foreground drop-shadow-[0_0_30px_rgba(29,111,134,0.6)] md:text-8xl">
                FLOOD<span className="text-accent">ESCAPE</span>
              </h1>
              <p className="mt-4 text-sm uppercase tracking-[0.35em] text-muted-foreground">
                When the water rises, every decision matters.
              </p>
              <div className="mx-auto mt-10 flex w-64 flex-col gap-3">
                <GameButton
                  onClick={() => {
                    sfx.click();
                    setLevelIndex(0);
                    setScreen("intro");
                  }}
                >
                  PLAY
                </GameButton>
                <GameButton variant="ghost" onClick={() => setScreen("howto")}>
                  HOW TO PLAY
                </GameButton>
                <GameButton variant="ghost" onClick={() => setScreen("credits")}>
                  CREDITS
                </GameButton>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                {LEVELS.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      sfx.click();
                      setLevelIndex(i);
                      startLevel(i);
                    }}
                    className="rounded border border-border px-3 py-1 transition-colors hover:border-accent hover:text-accent"
                  >
                    {l.id}. {l.name} · best {best[i] ?? 0}
                  </button>
                ))}
              </div>
            </div>
          )}

          {screen === "howto" && (
            <Panel title="HOW TO PLAY" onBack={() => setScreen("menu")}>
              <Controls />
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                The city is flooding. Collect supplies, decide who you save, and reach the evacuation point
                before the water or the clock beats you. Deep water slows you down and drains health — the
                raised courtyards and sidewalks stay dry longest.
              </p>
            </Panel>
          )}

          {screen === "credits" && (
            <Panel title="CREDITS" onBack={() => setScreen("menu")}>
              <p className="font-display text-2xl tracking-[0.2em]">FLOOD ESCAPE</p>
              <p className="mt-4 text-sm text-muted-foreground">
                Created for the BTT Web Game Jam — Summer 2026.
              </p>
              <p className="mt-4 text-sm">
                Game concept, direction and design:
                <br />
                <span className="text-accent">Muhammed Suleiman Jibril</span>
              </p>
              <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
                Built with AI-assisted development.
              </p>
            </Panel>
          )}
        </div>
      )}

      <button
        onClick={toggleAudio}
        className="absolute bottom-4 left-4 z-20 rounded border border-border bg-card/70 px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-accent"
      >
        sound: {audio ? "on" : "off"}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-left text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </>
  );
}

function Overlay({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center px-6 backdrop-blur-sm ${dark ? "bg-background" : "bg-background/80"}`}
    >
      {children}
    </div>
  );
}

function Panel({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="w-full max-w-lg rounded-lg border border-border bg-card/90 p-8">
      <h2 className="font-display text-3xl tracking-[0.25em] text-accent">{title}</h2>
      <div className="mt-6">{children}</div>
      <div className="mt-8">
        <GameButton variant="ghost" onClick={onBack}>
          BACK
        </GameButton>
      </div>
    </div>
  );
}

function Controls({ compact }: { compact?: boolean }) {
  const rows: Array<[string, string]> = [
    ["W A S D / Arrows", "Move"],
    ["SHIFT", "Sprint (uses stamina)"],
    ["E", "Interact / talk / evacuate"],
    ["1 / 2", "Drink water / use first aid"],
    ["ESC", "Pause"],
  ];
  return (
    <ul className={`space-y-2 ${compact ? "text-xs" : "text-sm"}`}>
      {rows.map(([k, v]) => (
        <li key={k} className="flex items-center justify-between gap-4 border-b border-border/60 pb-2">
          <span className="font-display tracking-widest text-accent">{k}</span>
          <span className="text-muted-foreground">{v}</span>
        </li>
      ))}
    </ul>
  );
}

function GameButton({
  children,
  onClick,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "solid" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      className={
        variant === "solid"
          ? "w-full rounded border border-accent bg-accent px-5 py-2.5 font-display text-sm tracking-[0.25em] text-accent-foreground transition-transform hover:scale-[1.02]"
          : "w-full rounded border border-border bg-card/60 px-5 py-2.5 font-display text-sm tracking-[0.25em] text-foreground transition-colors hover:border-accent hover:text-accent"
      }
    >
      {children}
    </button>
  );
}

function Bar({ value, tone }: { value: number; tone: "health" | "stamina" | "flood" }) {
  const color =
    tone === "health" ? "bg-destructive" : tone === "stamina" ? "bg-primary" : "bg-accent";
  return (
    <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${color} transition-[width] duration-200`} style={{ width: `${value}%` }} />
    </div>
  );
}

function Hud({ hud, onUse }: { hud: HudState; onUse: (t: "water" | "aid") => void }) {
  const urgent = hud.timeLeft <= 30;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* top-left */}
      <div className="absolute left-4 top-4 space-y-2 rounded-lg border border-border/60 bg-card/70 p-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="w-16 font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Health
          </span>
          <Bar value={hud.health} tone="health" />
          <span className="w-8 text-right text-xs">{Math.round(hud.health)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-16 font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Stamina
          </span>
          <Bar value={hud.stamina} tone="stamina" />
          <span className="w-8 text-right text-xs">{Math.round(hud.stamina)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-16 font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Flood
          </span>
          <Bar value={hud.floodPct} tone="flood" />
          <span className="w-8 text-right text-xs">{hud.floodPct}%</span>
        </div>
        {hud.raft && (
          <p className="text-[10px] uppercase tracking-widest text-accent">Raft acquired — deep water is safer</p>
        )}
      </div>

      {/* top-center */}
      <div className="absolute left-1/2 top-4 w-72 -translate-x-1/2 rounded-lg border border-border/60 bg-card/70 p-3 text-center backdrop-blur">
        <p className="font-display text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Level {hud.level} — {hud.levelName}
        </p>
        <p
          className={`font-display text-2xl tracking-[0.2em] ${urgent ? "animate-pulse text-destructive" : "text-foreground"}`}
        >
          {fmt(hud.timeLeft)}
        </p>
        <ul className="mt-2 space-y-1 text-left text-xs">
          {hud.objectives.map((o) => (
            <li key={o.id} className={o.done ? "text-accent line-through" : "text-foreground"}>
              {o.done ? "✓" : "•"} {o.text}
            </li>
          ))}
        </ul>
      </div>

      {/* inventory bottom-right */}
      <div className="pointer-events-auto absolute bottom-4 right-4 flex gap-2">
        <InvSlot label="1" count={hud.inventory.water} name="Water" onClick={() => onUse("water")} />
        <InvSlot label="2" count={hud.inventory.aid} name="Aid" onClick={() => onUse("aid")} />
        <InvSlot label="" count={hud.inventory.kit} name="Kit" />
        <InvSlot label="" count={hud.inventory.token} name="Token" />
      </div>

      {/* prompts */}
      {hud.prompt && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded border border-accent/60 bg-card/85 px-4 py-2 font-display text-sm tracking-[0.2em] text-accent backdrop-blur">
          {hud.prompt}
        </div>
      )}
      {hud.tip && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded bg-background/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {hud.tip}
        </div>
      )}
    </div>
  );
}

function InvSlot({
  label,
  count,
  name,
  onClick,
}: {
  label: string;
  count: number;
  name: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick || count === 0}
      className={`h-16 w-16 rounded border ${count > 0 ? "border-accent/60 bg-card/80" : "border-border/50 bg-card/40 opacity-50"} text-center backdrop-blur transition-colors`}
    >
      <span className="block text-lg font-semibold">{count}</span>
      <span className="block text-[9px] uppercase tracking-widest text-muted-foreground">
        {name}
        {label && ` [${label}]`}
      </span>
    </button>
  );
}

function WaterBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(29,111,134,0.35),transparent_60%)]" />
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute left-1/2 h-[60vh] w-[220vw] -translate-x-1/2 rounded-[45%] bg-primary/10"
          style={{
            bottom: `${-38 + i * 5}vh`,
            animation: `waveDrift ${16 + i * 5}s linear infinite`,
            animationDelay: `${i * -3}s`,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(transparent,rgba(0,0,0,0.6))]" />
    </div>
  );
}