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
    <motion.div
      className="content"
      data-framer-name="Content"
      style={{
        alignContent: "center",
        alignItems: "center",
        display: "flex",
        flex: "1",
        flexDirection: "column",
        flexWrap: "nowrap",
        gap: "12px",
        height: "min-content",
        justifyContent: "center",
        width: "100%",
        overflow: "hidden",
        padding: "0px",
        position: "relative",
      }}
    >
      <motion.div
        className="text-container"
        data-framer-name="Text"
        style={{
          alignContent: "center",
          alignItems: "center",
          display: "flex",
          flex: "none",
          flexDirection: "row",
          flexWrap: "nowrap",
          gap: "10px",
          height: "32px",
          justifyContent: "center",
          overflow: "visible",
          padding: "0px",
          position: "relative",
        }}
      >
        <motion.div
          className="bg-fill"
          data-framer-name="BG Fill"
          style={{
            flex: "none",
            height: "32px",
            left: "0px",
            overflow: "hidden",
            position: "absolute",
            top: "calc(50% - 16px)",
            width: "1px",
            zIndex: 0,
            backgroundColor: "transparent",
            opacity: 0,
          }}
        />{" "}
        <motion.div
          style={{
            flex: "none",
            height: "auto",
            position: "relative",
            whiteSpace: "nowrap",
            width: "100%",
            fontFamily: '"Inter", "Inter Placeholder", sans-serif',
            fontWeight: "600",
            fontSize: "20px",
            color: "hsl(var(--foreground))",
            userSelect: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            paddingTop: "8px",
            paddingBottom: "8px",
          }}
        >
          <span style={{ position: "relative", zIndex: 1 }}>{heading}</span>
          <motion.span
            style={{
              position: "absolute",
              top: "8px",
              left: "50%",
              transform: "translateX(-50%)",
              color: "hsl(var(--background))",
              clipPath: `inset(0 ${isHoverVariant ? "0%" : "100%"} 0 0)`,
              zIndex: 2,
              whiteSpace: "nowrap",
            }}
            animate={{
              clipPath: `inset(0 ${isHoverVariant ? "0%" : "100%"} 0 0)`,
            }}
            transition={titleTransition}
          >
            {heading}
          </motion.span>

          <motion.div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "hsl(var(--foreground))",
              transformOrigin: "left center",
              scaleX: 0,
              zIndex: 1,
            }}
            animate={{
              scaleX: isHoverVariant ? 1 : 0,
            }}
            transition={titleTransition}
          />
        </motion.div>
      </motion.div>

      <motion.div
        style={{
          flex: "none",
          height: "auto",
          position: "relative",
          whiteSpace: "pre-wrap",
          width: "100%",
          maxWidth: "100%",
          wordBreak: "break-word",
          wordWrap: "break-word",
          fontFamily: '"Inter", "Inter Placeholder", sans-serif',
          fontWeight: "400",
          fontSize: "14px",
          lineHeight: "1.6em",
          color: "hsl(var(--muted-foreground))",
          userSelect: "none",
          textAlign: "center",
        }}
      >
        {text}
      </motion.div>
    </motion.div>
  );
}
