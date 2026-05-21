"use client";

import { motion } from "framer-motion";
import { cornerScaleVariants } from "./icon-3d-hover-variants";

interface Icon3DHoverCubeCornersProps {
  isHoverVariant: boolean;
}

export function Icon3DHoverCubeCorners({
  isHoverVariant,
}: Icon3DHoverCubeCornersProps) {
  const animateState = isHoverVariant ? "zEwHlJ7zp" : "default";

  return (
    <>
      <motion.div
        style={{
          flex: "none",
          height: "24px",
          left: isHoverVariant ? "-6px" : "14px",
          overflow: "hidden",
          position: "absolute",
          top: isHoverVariant ? "-6px" : "14px",
          width: "24px",
          zIndex: 2,
          borderLeft: "4px solid hsl(var(--foreground))",
          borderTop: "4px solid hsl(var(--foreground))",
          scale: 1,
        }}
        variants={cornerScaleVariants}
        animate={animateState}
      />
      <motion.div
        style={{
          flex: "none",
          height: "24px",
          left: isHoverVariant ? "-6px" : "14px",
          overflow: "hidden",
          position: "absolute",
          top: isHoverVariant ? "330px" : "310px",
          width: "24px",
          zIndex: 2,
          borderLeft: "4px solid hsl(var(--foreground))",
          borderBottom: "4px solid hsl(var(--foreground))",
          scale: 1,
        }}
        variants={cornerScaleVariants}
        animate={animateState}
      />
      <motion.div
        style={{
          bottom: isHoverVariant ? "-6px" : "14px",
          flex: "none",
          height: "24px",
          overflow: "hidden",
          position: "absolute",
          right: isHoverVariant ? "-6px" : "14px",
          width: "24px",
          zIndex: 2,
          borderRight: "4px solid hsl(var(--foreground))",
          borderBottom: "4px solid hsl(var(--foreground))",
          scale: 1,
        }}
        variants={cornerScaleVariants}
        animate={animateState}
      />
      <motion.div
        style={{
          flex: "none",
          height: "24px",
          overflow: "hidden",
          position: "absolute",
          right: isHoverVariant ? "-6px" : "14px",
          top: isHoverVariant ? "-6px" : "14px",
          width: "24px",
          zIndex: 2,
          borderRight: "4px solid hsl(var(--foreground))",
          borderTop: "4px solid hsl(var(--foreground))",
          scale: 1,
        }}
        variants={cornerScaleVariants}
        animate={animateState}
      />
    </>
  );
}
