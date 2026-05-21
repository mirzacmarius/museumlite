"use client";

import { motion } from "framer-motion";
import { titleTransition } from "./icon-3d-hover-variants";

interface Icon3DHoverContentProps {
  isHoverVariant: boolean;
  heading: string;
  text: string;
}

export function Icon3DHoverContent({
  isHoverVariant,
  heading,
  text,
}: Icon3DHoverContentProps) {
  return (
    <motion.div className="content icon-3d-content" data-framer-name="Content">
      <motion.div
        className="text-container icon-3d-text-container"
        data-framer-name="Text"
      >
        <motion.div
          className="bg-fill icon-3d-bg-fill"
          data-framer-name="BG Fill"
        />{" "}
        <motion.div className="icon-3d-heading-wrap">
          <span className="icon-3d-heading-base">{heading}</span>
          <motion.span
            className="icon-3d-heading-reveal"
            animate={{
              clipPath: `inset(0 ${isHoverVariant ? "0%" : "100%"} 0 0)`,
            }}
            transition={titleTransition}
          >
            {heading}
          </motion.span>

          <motion.div
            className="icon-3d-heading-bg"
            animate={{
              scaleX: isHoverVariant ? 1 : 0,
            }}
            transition={titleTransition}
          />
        </motion.div>
      </motion.div>

      <motion.div className="icon-3d-description">{text}</motion.div>
    </motion.div>
  );
}
