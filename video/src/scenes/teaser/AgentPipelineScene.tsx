import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { GrainOverlay } from "../../components";
import { AgentDispatchScene } from "../../three/AgentDispatchScene";
import { BG, GOLD, MONO_FONT, DISPLAY_FONT, FG, MUTED_FG } from "../../design-tokens";

export const AgentPipelineScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [120, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative", overflow: "hidden" }}>
      <GrainOverlay opacity={0.025} />
      <div style={{ position: "absolute", inset: 0, opacity: bgOpacity }}>
        <AgentDispatchScene />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 20,
          opacity: textOpacity,
        }}
      >
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 32, color: GOLD, fontWeight: 300, marginBottom: 8 }}>
          7 AI Agents at Work
        </div>
        <div style={{ fontFamily: MONO_FONT, fontSize: 12, color: MUTED_FG }}>
          Research-grade reports in under 2 minutes
        </div>
      </div>
    </div>
  );
};
