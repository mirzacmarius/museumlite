"use client";

import { motion } from "framer-motion";
import type React from "react";
import { Icon3DHoverCubeBg } from "./icon-3d-hover-cube-bg";

interface Icon3DHoverCubeProps {
  isHoverVariant: boolean;
  icon?: React.ReactNode;
}

function Icon3DHoverCubeIconOverlay({
  icon,
  isHoverVariant,
}: {
  icon: React.ReactNode;
  isHoverVariant: boolean;
}) {
  return (
    <motion.div
      className="icon-3d-icon-overlay"
      animate={{
        scale: isHoverVariant ? 1.1 : 1,
        rotate: isHoverVariant ? 5 : 0,
      }}
      transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
    >
      {icon}
    </motion.div>
  );
}

export function Icon3DHoverCube({
  isHoverVariant,
  icon,
}: Icon3DHoverCubeProps) {
  return (
    <motion.div
      className="icon-container icon-3d-icon-container"
      data-framer-name="Icon"
    >
      {icon ? (
        <Icon3DHoverCubeIconOverlay
          icon={icon}
          isHoverVariant={isHoverVariant}
        />
      ) : null}
      <Icon3DHoverCubeBg isHoverVariant={isHoverVariant} icon={icon} />
    </motion.div>
  );
}
