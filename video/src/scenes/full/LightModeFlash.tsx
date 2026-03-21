import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { DesktopFrame } from "../../components";
import { DashboardLight } from "../../ui-replicas";
import { LIGHT } from "../../design-tokens";

export const LightModeFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    * interpolate(frame, [52, 60], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width: "100%", height: "100%", background: "#111", position: "relative", opacity }}>
      <DesktopFrame rotateYStart={5} rotateYEnd={3} rotateX={4}>
        <DashboardLight />
      </DesktopFrame>
    </div>
  );
};
