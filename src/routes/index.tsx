import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const FloodEscape = lazy(() => import("@/components/game/FloodEscape"));

const title = "Flood Escape — Survive the Rising Water";
const description =
  "A tense browser survival game: navigate a flooding city, save survivors, gather supplies and reach evacuation before the water wins.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main>
      <h1 className="sr-only">Flood Escape — when the water rises, every decision matters</h1>
      <Suspense
        fallback={
          <div className="flex h-[100dvh] items-center justify-center bg-background text-muted-foreground">
            Loading Flood Escape…
          </div>
        }
      >
        <FloodEscape />
      </Suspense>
    </main>
  );
}
