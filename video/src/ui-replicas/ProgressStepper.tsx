import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { GOLD, MUTED, MUTED_FG, BG, FG, MONO_FONT } from "../design-tokens";

const STEPS = ["Disclaimer", "Holdings", "Themes", "Correlation", "Optimization", "Allocations", "Review"];

interface ProgressStepperProps {
  currentStep: number;
  animateToStep?: number;
  animationFrame?: number;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  currentStep,
  animateToStep,
  animationFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const effectiveStep = animateToStep !== undefined
    ? interpolate(frame, [animationFrame, animationFrame + 15], [currentStep, animateToStep], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : currentStep;

  return (
    <div
      style={{
        background: `${BG}cc`,
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${GOLD}1a`,
        padding: "16px 24px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 0, maxWidth: 800, width: "100%" }}>
        {STEPS.map((label, i) => {
          const isComplete = i < Math.floor(effectiveStep);
          const isCurrent = i === Math.floor(effectiveStep);
          return (
            <React.Fragment key={label}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 70 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontFamily: MONO_FONT,
                    fontWeight: 500,
                    background: isComplete ? GOLD : isCurrent ? `${GOLD}33` : MUTED,
                    color: isComplete ? BG : isCurrent ? GOLD : MUTED_FG,
                    border: isCurrent ? `2px solid ${GOLD}` : "none",
                    transition: "all 0.3s",
                  }}
                >
                  {isComplete ? "✓" : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: MONO_FONT,
                    color: isCurrent ? FG : MUTED_FG,
                    letterSpacing: "0.05em",
                  }}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: isComplete ? GOLD : `${GOLD}22`,
                    marginBottom: 20,
                    transition: "all 0.3s",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
