"use client";

import { LayoutGroup, motion } from "framer-motion";
import React, { useRef, useState } from "react";
import { Icon3DHoverContent } from "./icon-3d-hover-content";
import { Icon3DHoverCube } from "./icon-3d-hover-cube";
import { Transition, Variants } from "./icon-3d-hover-motion";
import { transition1 } from "./icon-3d-hover-variants";

interface Props {
  heading?: string;
  text?: string;
  variant?: "Default" | "Hover";
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  icon?: React.ReactNode;
}

export const IconHover3D: React.FC<Props> = ({
  heading = "Library",
  text = "A comprehensive collection of digital books and resources for learning and research. ",
  variant = "Default",
  className = "",
  style = {},
  width,
  height,
  icon,
  ...restProps
}) => {
  const [currentVariant, setCurrentVariant] = useState<"Default" | "Hover">(
    variant,
  );
  const [gestureState, setGestureState] = useState({ isHovered: false });
  const refBinding = useRef<HTMLDivElement>(null);
  const defaultLayoutId = React.useId();

  const isHoverVariant = currentVariant === "Hover";
  const variants = [currentVariant === "Default" ? "GPnJri30y" : "zEwHlJ7zp"];

  const handleMouseEnter = async () => {
    setGestureState({ isHovered: true });
    setCurrentVariant("Hover");
  };

  const handleMouseLeave = async () => {
    setGestureState({ isHovered: false });
    setCurrentVariant("Default");
  };

  return (
    <div style={{ width: width || "100%", height: height || "auto" }}>
      <LayoutGroup id={defaultLayoutId}>
        <Variants animate={variants} initial={false}>
          <Transition value={transition1}>
            <motion.div
              {...restProps}
              className={`icon-hover-3d ${className}`}
              data-framer-name="Default"
              data-highlight={true}
              ref={refBinding}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={
                currentVariant === "Hover" ? handleMouseLeave : undefined
              }
              style={{
                backgroundColor: "hsl(var(--background))",
                alignContent: "center",
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                flexWrap: "nowrap",
                gap: "24px",
                height: "100%",
                justifyContent: "flex-start",
                overflow: "visible",
                padding: "24px",
                position: "relative",
                width: "100%",
                borderRadius: "12px",
                border: "1px solid hsl(var(--border))",
                ...style,
              }}
            >
              <Icon3DHoverCube isHoverVariant={isHoverVariant} icon={icon} />
              <Icon3DHoverContent
                isHoverVariant={isHoverVariant}
                heading={heading}
                text={text}
              />
            </motion.div>
          </Transition>
        </Variants>
      </LayoutGroup>
    </div>
  );
};
