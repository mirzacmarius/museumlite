"use client";

import { LayoutGroup, m } from "framer-motion";
import React, { useRef, useState } from "react";
import { Icon3DHoverContent } from "./icon-3d-hover-content";
import { Icon3DHoverCube } from "./icon-3d-hover-cube";
import "./icon-3d-hover.css";
import { Transition, Variants } from "./icon-3d-hover-motion";
import { transition1 } from "./icon-3d-hover-variants";

const EMPTY_ICON_STYLE: React.CSSProperties = {};

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
  style = EMPTY_ICON_STYLE,
  width,
  height,
  icon,
  ...restProps
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const currentVariant: "Default" | "Hover" = isHovered ? "Hover" : variant;
  const isHoveredRef = useRef(false);
  const refBinding = useRef<HTMLDivElement>(null);
  const defaultLayoutId = React.useId();

  const isHoverVariant = currentVariant === "Hover";
  const variants = [currentVariant === "Default" ? "GPnJri30y" : "zEwHlJ7zp"];

  const handleMouseEnter = async () => {
    isHoveredRef.current = true;
    setIsHovered(true);
  };

  const handleMouseLeave = async () => {
    isHoveredRef.current = false;
    setIsHovered(false);
  };

  return (
    <div style={{ width: width || "100%", height: height || "auto" }}>
      <LayoutGroup id={defaultLayoutId}>
        <Variants animate={variants} initial={false}>
          <Transition value={transition1}>
            <m.div
              {...restProps}
              className={`icon-hover-3d icon-hover-3d-card ${className}`}
              data-framer-name="Default"
              data-highlight={true}
              ref={refBinding}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={
                currentVariant === "Hover" ? handleMouseLeave : undefined
              }
              style={style}
            >
              <Icon3DHoverCube isHoverVariant={isHoverVariant} icon={icon} />
              <Icon3DHoverContent
                isHoverVariant={isHoverVariant}
                heading={heading}
                text={text}
              />
            </m.div>
          </Transition>
        </Variants>
      </LayoutGroup>
    </div>
  );
};
