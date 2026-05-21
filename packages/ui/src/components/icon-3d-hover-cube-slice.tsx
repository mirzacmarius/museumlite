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
        className={`slice-${sliceIndex}`}
        data-framer-name={`Slice ${sliceIndex}`}
        style={{
          alignContent: "center",
          alignItems: "center",
          display: "flex",
          flex: "none",
          flexDirection: "row",
          flexWrap: "nowrap",
          gap: "10px",
          height: "min-content",
          justifyContent: "center",
          overflow: "visible",
          padding: "0px",
          position: "relative",
          transformStyle: "preserve-3d",
          width: "min-content",
        }}
      >
        <motion.div
          className="slice-1-front"
          data-framer-name="Front"
          style={{
            alignContent: "center",
            alignItems: "center",
            display: "flex",
            flex: "none",
            flexDirection: "column",
            flexWrap: "nowrap",
            gap: "10px",
            height: "34px",
            justifyContent: "center",
            overflow: "hidden",
            padding: "0px",
            position: "relative",
            width: "240px",
            border: "4px solid hsl(var(--foreground))",
            backgroundColor: "hsl(var(--background))",
            zIndex: 120,
          }}
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-back"
          data-framer-name="Back"
          style={{
            alignContent: "center",
            alignItems: "center",
            bottom: "0px",
            display: "flex",
            flex: "none",
            flexDirection: "column",
            flexWrap: "nowrap",
            gap: "10px",
            justifyContent: "center",
            overflow: "hidden",
            padding: "0px",
            position: "absolute",
            right: "0px",
            top: "0px",
            width: "240px",
            zIndex: 1,
            border: "4px solid hsl(var(--foreground))",
            backgroundColor: "hsl(var(--background))",
            rotateY: 180,
          }}
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-right"
          data-framer-name="Right"
          style={{
            alignContent: "center",
            alignItems: "center",
            bottom: "0px",
            display: "flex",
            flex: "none",
            flexDirection: "column",
            flexWrap: "nowrap",
            gap: "10px",
            justifyContent: "center",
            left: "120px",
            overflow: "hidden",
            padding: "0px",
            position: "absolute",
            top: "0px",
            width: "240px",
            zIndex: 1,
            border: "4px solid hsl(var(--foreground))",
            backgroundColor: "hsl(var(--background))",
            rotateY: 90,
          }}
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-left"
          data-framer-name="Left"
          style={{
            alignContent: "center",
            alignItems: "center",
            bottom: "0px",
            display: "flex",
            flex: "none",
            flexDirection: "column",
            flexWrap: "nowrap",
            gap: "10px",
            justifyContent: "center",
            overflow: "hidden",
            padding: "0px",
            position: "absolute",
            right: "120px",
            top: "0px",
            width: "240px",
            zIndex: 1,
            border: "4px solid hsl(var(--foreground))",
            backgroundColor: "hsl(var(--background))",
            rotateY: -90,
          }}
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-top"
          data-framer-name="Top"
          style={{
            flex: "none",
            height: "240px",
            left: "0px",
            overflow: "hidden",
            position: "absolute",
            right: "0px",
            top: "-120px",
            zIndex: 1,
            border: "4px solid hsl(var(--foreground))",
            backgroundColor: "hsl(var(--background))",
            rotateX: 90,
          }}
          variants={cubeSliceVariants}
          animate={animateState}
        />
        <motion.div
          className="slice-1-bottom"
          data-framer-name="Bottom"
          style={{
            flex: "none",
            height: "240px",
            left: "0px",
            overflow: "hidden",
            position: "absolute",
            right: "0px",
            top: "-86px",
            zIndex: 1,
            border: "4px solid hsl(var(--foreground))",
            backgroundColor: "hsl(var(--background))",
            rotateX: 90,
          }}
          variants={cubeSliceVariants}
          animate={animateState}
        />
      </motion.div>
    </Transition>
  );
}
