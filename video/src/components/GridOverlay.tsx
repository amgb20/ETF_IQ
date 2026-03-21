import React from "react";
import { GOLD } from "../design-tokens";

export const GridOverlay: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 1,
      opacity,
      backgroundImage: `
        linear-gradient(${GOLD}18 1px, transparent 1px),
        linear-gradient(90deg, ${GOLD}18 1px, transparent 1px)
      `,
      backgroundSize: "60px 60px",
    }}
  />
);
