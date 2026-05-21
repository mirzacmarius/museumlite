"use client";

import { m } from "framer-motion";
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
    <m.div
      className={`bg-container icon-3d-cube-bg${icon ? " icon-3d-cube-bg-with-icon" : ""}`}
      data-framer-name="BG"
    >
      <m.div
        className="slice-cube icon-3d-slice-cube"
        data-framer-name="Slice Cube"
        style={{
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
      </m.div>
      <Icon3DHoverCubeCorners isHoverVariant={isHoverVariant} />
    </m.div>
  );
}
