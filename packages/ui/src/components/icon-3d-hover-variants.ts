export const transition1 = {
  bounce: 0,
  delay: 0,
  duration: 0.4,
  type: "spring" as const,
};

export const transition2 = {
  delay: 0,
  duration: 0.4,
  ease: [0.44, 0, 0.56, 1] as const,
  type: "tween" as const,
};

export const transformTemplate1 = (_: unknown, t: string) =>
  `translate(-50%, -50%) ${t}`;

export const cubeSliceVariants = {
  zEwHlJ7zp: {
    "--border-color": "rgb(139, 47, 250)",
  },
};

export const titleVariants = {
  default: {
    "--fill-width": "0%",
  },
  hovered: {
    "--fill-width": "100%",
  },
};

export const titleTransition = {
  duration: 0.3,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
  type: "tween" as const,
};

export const sliceCubeVariants = {
  zEwHlJ7zp: {
    rotateX: -28,
    rotateY: -43,
    scale: 1.1,
  },
};

export const cornerScaleVariants = {
  zEwHlJ7zp: {
    scale: 2.2,
  },
};

export const bgFillVariants = {
  zEwHlJ7zp: {
    opacity: 1,
  },
};
