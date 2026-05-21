"use client";

import { m } from "framer-motion";
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
    <m.div className="content icon-3d-content" data-framer-name="Content">
      <m.div
        className="text-container icon-3d-text-container"
        data-framer-name="Text"
      >
        <m.div className="bg-fill icon-3d-bg-fill" data-framer-name="BG Fill" />{" "}
        <m.div className="icon-3d-heading-wrap">
          <span className="icon-3d-heading-base">{heading}</span>
          <m.span
            className="icon-3d-heading-reveal"
            animate={{
              clipPath: `inset(0 ${isHoverVariant ? "0%" : "100%"} 0 0)`,
            }}
            transition={titleTransition}
          >
            {heading}
          </m.span>

          <m.div
            className="icon-3d-heading-bg"
            animate={{
              scaleX: isHoverVariant ? 1 : 0,
            }}
            transition={titleTransition}
          />
        </m.div>
      </m.div>

      <m.div className="icon-3d-description">{text}</m.div>
    </m.div>
  );
}
