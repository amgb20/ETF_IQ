import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { DesktopFrame, FadeTransition, SimulatedCursor, TypewriterText } from "../../components";
import { ProgressStepper, StepAddEtfs, StepThemes, StepAllocations, StepReview } from "../../ui-replicas";
import { BG, FG, MUTED_FG, DISPLAY_FONT, MONO_FONT, CHART_COLORS, GOLD } from "../../design-tokens";
import { THEMES, ONBOARDING_SEARCH_RESULTS } from "../../data/portfolio";

export const OnboardingScene: React.FC = () => {
  const frame = useCurrentFrame();

  const stepAddEnd = 90;
  const stepThemesEnd = 180;
  const stepAllocEnd = 270;

  const currentStep =
    frame < stepAddEnd ? 1
    : frame < stepThemesEnd ? 2
    : frame < stepAllocEnd ? 5
    : 6;

  const searchText = frame < stepAddEnd
    ? "NVDA".slice(0, Math.min(Math.floor(Math.max(0, frame - 10) * 0.3), 4))
    : "";

  const selectedEtfs: string[] = [];
  if (frame >= 30) selectedEtfs.push("QQQ");
  if (frame >= 45) selectedEtfs.push("NVDA");
  if (frame >= 55) selectedEtfs.push("GLD");
  if (frame >= 65) selectedEtfs.push("XAR");

  const allocItems = [
    { ticker: "QQQ", theme: "AI Stack", themeColor: CHART_COLORS[0], percentage: frame >= stepThemesEnd ? Math.min(25, Math.floor((frame - stepThemesEnd) * 0.7)) : 0 },
    { ticker: "NVDA", theme: "AI Stack", themeColor: CHART_COLORS[0], percentage: frame >= stepThemesEnd + 15 ? Math.min(15, Math.floor((frame - stepThemesEnd - 15) * 0.6)) : 0 },
    { ticker: "GLD", theme: "Gold", themeColor: GOLD, percentage: frame >= stepThemesEnd + 25 ? Math.min(35, Math.floor((frame - stepThemesEnd - 25) * 0.8)) : 0 },
    { ticker: "XAR", theme: "Defence", themeColor: CHART_COLORS[3], percentage: frame >= stepThemesEnd + 35 ? Math.min(25, Math.floor((frame - stepThemesEnd - 35) * 0.7)) : 0 },
  ];
  const totalPct = allocItems.reduce((s, a) => s + a.percentage, 0);

  const stepOpacity = (start: number, end: number) => {
    const fadeIn = interpolate(frame, [start, start + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const fadeOut = interpolate(frame, [end - 10, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return fadeIn * fadeOut;
  };

  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative" }}>
      <DesktopFrame enterFrom="none" rotateYStart={-7} rotateYEnd={-4}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <ProgressStepper currentStep={currentStep} />
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {frame < stepAddEnd && (
              <div style={{ opacity: stepOpacity(0, stepAddEnd), position: "absolute", inset: 0 }}>
                <StepAddEtfs
                  searchText={searchText}
                  results={ONBOARDING_SEARCH_RESULTS}
                  selected={selectedEtfs}
                  showResults={frame >= 20}
                />
              </div>
            )}

            {frame >= stepAddEnd && frame < stepThemesEnd && (
              <div style={{ opacity: stepOpacity(stepAddEnd, stepThemesEnd), position: "absolute", inset: 0 }}>
                <StepThemes themes={THEMES} etfCount={4} />
              </div>
            )}

            {frame >= stepThemesEnd && frame < stepAllocEnd && (
              <div style={{ opacity: stepOpacity(stepThemesEnd, stepAllocEnd), position: "absolute", inset: 0 }}>
                <StepAllocations
                  items={allocItems}
                  totalPct={totalPct}
                  portfolioName="My ETF Portfolio"
                />
              </div>
            )}

            {frame >= stepAllocEnd && (
              <div style={{ opacity: interpolate(frame, [stepAllocEnd, stepAllocEnd + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), position: "absolute", inset: 0 }}>
                <StepReview portfolioName="My ETF Portfolio" themes={THEMES} />
              </div>
            )}
          </div>
        </div>
      </DesktopFrame>

      <SimulatedCursor
        keyframes={[
          { frame: 28, x: 820, y: 380 },
          { frame: 30, x: 820, y: 380, click: true },
          { frame: 43, x: 820, y: 410 },
          { frame: 45, x: 820, y: 410, click: true },
          { frame: 53, x: 820, y: 440 },
          { frame: 55, x: 820, y: 440, click: true },
          { frame: 63, x: 820, y: 470 },
          { frame: 65, x: 820, y: 470, click: true },
          { frame: 330, x: 960, y: 650 },
          { frame: 340, x: 960, y: 650, click: true },
        ]}
      />
    </div>
  );
};
