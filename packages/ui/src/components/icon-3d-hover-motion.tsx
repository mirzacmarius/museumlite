"use client";

import { MotionConfigContext, m } from "framer-motion";
import React from "react";

export const Transition: React.FC<{
  value: unknown;
  children: React.ReactNode;
}> = ({ value, children }) => {
  const config = React.use(MotionConfigContext);
  const transition = value ?? config.transition;
  const contextValue = React.useMemo(
    () => ({ ...config, transition }),
    [JSON.stringify(transition)],
  );

  return (
    <MotionConfigContext.Provider value={contextValue}>
      {children}
    </MotionConfigContext.Provider>
  );
};

export const Variants = m.create(React.Fragment);
