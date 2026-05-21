"use client";

import { domAnimation, LazyMotion, MotionConfig, m } from "framer-motion";
import type { ReactNode } from "react";

export { m };

interface MotionProviderProps {
  children: ReactNode;
}

export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
