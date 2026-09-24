import { useEffect, useRef, useState, type AnimationEvent } from "react";
import { useNavigation } from "react-router";

type Phase = "idle" | "run" | "done";

// Navigations that finish sooner than this never show the bar (it would only flicker).
const SHOW_AFTER = 150;

/**
 * 2px lapis bar at the very top while a route loads. CSS does the motion (app.css,
 * `.nav-progress`): it fades in only after 150 ms, creeps towards 90% with transform, and on
 * completion a second bar sweeps to 100% before the whole thing fades out. Transform/opacity
 * only; reduced motion turns it into a static bar. Decorative: pages announce their own state.
 */
export function NavigationProgress() {
  const busy = useNavigation().state !== "idle";
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (busy) {
      startedAt.current = performance.now();
      setRun((n) => n + 1); // remount: the animations restart from zero
      setPhase("run");
      return;
    }
    setPhase((p) => (p !== "run" ? p : performance.now() - startedAt.current < SHOW_AFTER ? "idle" : "done"));
  }, [busy]);

  if (phase === "idle") return null;

  const onAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.animationName === "nav-progress-out") setPhase("idle");
  };

  return (
    <div key={run} aria-hidden="true" data-state={phase} onAnimationEnd={onAnimationEnd} className="nav-progress">
      <div className="nav-progress-bar" />
      {phase === "done" && <div className="nav-progress-bar nav-progress-fill" />}
    </div>
  );
}
