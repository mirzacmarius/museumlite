"use client";

import { motion } from "framer-motion";
import { Transition } from "./icon-3d-hover-motion";
import { cubeSliceVariants, transition2 } from "./icon-3d-hover-variants";

interface Icon3DHoverCubeSliceProps {
  isHoverVariant: boolean;
  sliceIndex: 1 | 2 | 3;
}

export function Icon3DHoverCubeSlice({
  isHoverVariant,
  sliceIndex,
}: Icon3DHoverCubeSliceProps) {
  const animateState = isHoverVariant ? "zEwHlJ7zp" : "default";

  return (
    <Transition value={transition2}>
      <motion.div
        className={`slice-${sliceIndex} icon-3d-slice`}
        data-framer-name={`Slice ${sliceIndex}`}
      >
        <motion.div
          className="slice-1-front icon-3d-slice-face icon-3d-slice-face-front"
          data-framer-name="Front"
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-back icon-3d-slice-face icon-3d-slice-face-back"
          data-framer-name="Back"
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-right icon-3d-slice-face icon-3d-slice-face-right"
          data-framer-name="Right"
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-left icon-3d-slice-face icon-3d-slice-face-left"
          data-framer-name="Left"
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-top icon-3d-slice-face icon-3d-slice-face-top"
          data-framer-name="Top"
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-bottom icon-3d-slice-face icon-3d-slice-face-bottom"
          data-framer-name="Bottom"
          variants={cubeSliceVariants}
          animate={animateState}
        />
      </motion.div>
    </Transition>
  );
}
