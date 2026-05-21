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
  const hoverState = isHoverVariant ? "true" : "false";

  return (
    <>
      <motion.div
        className="icon-3d-corner icon-3d-corner-tl"
        data-hover={hoverState}
        variants={cornerScaleVariants}
        animate={animateState}
      />
      <motion.div
        className="icon-3d-corner icon-3d-corner-bl"
        data-hover={hoverState}
        variants={cornerScaleVariants}
        animate={animateState}
      />
      <motion.div
        className="icon-3d-corner icon-3d-corner-br"
        data-hover={hoverState}
        variants={cornerScaleVariants}
        animate={animateState}
      />
      <motion.div
        className="icon-3d-corner icon-3d-corner-tr"
        data-hover={hoverState}
        variants={cornerScaleVariants}
        animate={animateState}
      />
    </>
  );
}
