"use client";

import { motion } from "framer-motion";
import type React from "react";
import { Icon3DHoverCubeCorners } from "./icon-3d-hover-cube-corners";
import { Icon3DHoverCubeSlice } from "./icon-3d-hover-cube-slice";
import {
  sliceCubeVariants,
  transformTemplate1,
} from "./icon-3d-hover-variants";

interface Icon3DHoverCubeBgProps {
  isHoverVariant: boolean;
  icon?: React.ReactNode;
}

const CUBE_SLICES = [1, 2, 3] as const;

export function Icon3DHoverCubeBg({
  isHoverVariant,
  icon,
}: Icon3DHoverCubeBgProps) {
  const animateState = isHoverVariant ? "zEwHlJ7zp" : "default";

  return (
    <motion.div
      className="bg-container"
      data-framer-name="BG"
      style={{
        flex: "none",
        height: "348px",
        overflow: "visible",
        position: "relative",
        width: "348px",
        zIndex: 2,
        scale: 0.23,
        opacity: icon ? 0.3 : 0.8,
      }}
    >
      <motion.div
        className="slice-cube"
        data-framer-name="Slice Cube"
        style={{
          alignContent: "center",
          alignItems: "center",
          display: "flex",
          flex: "none",
          flexDirection: "column",
          flexWrap: "nowrap",
          gap: "28px",
          height: "min-content",
          justifyContent: "center",
          left: "50%",
          overflow: "visible",
          padding: "0px",
          position: "absolute",
          top: "50%",
          transformStyle: "preserve-3d",
          width: "min-content",
          zIndex: 3,
          rotate: 49,
          rotateX: 23,
          rotateY: 33,
          scale: 0.7,
          transformPerspective: 1200,
        }}
        transformTemplate={transformTemplate1}
        variants={sliceCubeVariants}
        animate={animateState}
      >
        {CUBE_SLICES.map((sliceIndex) => (
          <Icon3DHoverCubeSlice
            key={sliceIndex}
            isHoverVariant={isHoverVariant}
            sliceIndex={sliceIndex}
          />
        ))}
      </motion.div>
      <Icon3DHoverCubeCorners isHoverVariant={isHoverVariant} />
    </motion.div>
  );
}
