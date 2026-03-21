import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

interface FadeTransitionProps {
  children: React.ReactNode;
  enterDelay?: number;
  enterDuration?: number;
  exitStart?: number;
  exitDuration?: number;
  scaleFrom?: number;
  translateY?: number;
  style?: React.CSSProperties;
}

export const FadeTransition: React.FC<FadeTransitionProps> = ({
  children,
  enterDelay = 0,
  enterDuration = 15,
  exitStart,
  exitDuration = 10,
  scaleFrom = 0.97,
  translateY = 10,
  style,
}) => {
  const frame = useCurrentFrame();

  const enterOpacity = interpolate(
    frame,
    [enterDelay, enterDelay + enterDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const exitOpacity = exitStart !== undefined
    ? interpolate(frame, [exitStart, exitStart + exitDuration], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const scale = interpolate(
    frame,
    [enterDelay, enterDelay + enterDuration],
    [scaleFrom, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const ty = interpolate(
    frame,
    [enterDelay, enterDelay + enterDuration],
    [translateY, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        opacity: enterOpacity * exitOpacity,
        transform: `translateY(${ty}px) scale(${scale})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
