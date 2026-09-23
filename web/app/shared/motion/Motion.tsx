import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Wraps only the parts of the page that animate with Motion, so pages without them load
// no animation code at all. Features load lazily; reducedMotion="user" makes every
// animation instant for people who ask their OS for less movement.
const features = () => import("motion/react").then((m) => m.domMax);

export function Motion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
