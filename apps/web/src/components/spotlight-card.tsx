"use client";

import { cn } from "@v1/ui/utils";
import { useEffect, useReducer, useRef } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

interface SpotlightState {
  x: number;
  y: number;
  opacity: number;
}

type SpotlightAction =
  | { type: "move"; x: number; y: number }
  | { type: "show" }
  | { type: "hide" };

const initialSpotlightState: SpotlightState = {
  x: 0,
  y: 0,
  opacity: 0,
};

function spotlightReducer(
  state: SpotlightState,
  action: SpotlightAction,
): SpotlightState {
  switch (action.type) {
    case "move":
      return { ...state, x: action.x, y: action.y };
    case "show":
      return { ...state, opacity: 1 };
    case "hide":
      return { ...state, opacity: 0 };
  }
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(0, 243, 255, 0.15)",
  ...props
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(spotlightReducer, initialSpotlightState);

  useEffect(() => {
    const element = divRef.current;
    if (!element) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const rect = element.getBoundingClientRect();
      dispatch({
        type: "move",
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const handleFocus = () => {
      dispatch({ type: "show" });
    };

    const handleBlur = () => {
      dispatch({ type: "hide" });
    };

    const handleMouseEnter = () => {
      dispatch({ type: "show" });
    };

    const handleMouseLeave = () => {
      dispatch({ type: "hide" });
    };

    element.addEventListener("mousemove", handleMouseMove);
    element.addEventListener("focusin", handleFocus);
    element.addEventListener("focusout", handleBlur);
    element.addEventListener("mouseenter", handleMouseEnter);
    element.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("focusin", handleFocus);
      element.removeEventListener("focusout", handleBlur);
      element.removeEventListener("mouseenter", handleMouseEnter);
      element.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={divRef}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5",
        className,
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity: state.opacity,
          background: `radial-gradient(600px circle at ${state.x}px ${state.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
}
