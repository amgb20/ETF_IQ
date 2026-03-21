import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { DesktopFrame, FadeTransition, SimulatedCursor } from "../../components";
import { HealthSummary, ThemeCard, PortfolioValueChart, AllocationPie, QuickActions } from "../../ui-replicas";
import { BG, GOLD, FG, MUTED_FG, DISPLAY_FONT, MONO_FONT } from "../../design-tokens";
import { THEMES } from "../../data/portfolio";

export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative" }}>
      <DesktopFrame enterFrom="below" enterDuration={25}>
        <div style={{ padding: "24px 32px", overflow: "hidden" }}>
          <FadeTransition enterDelay={10} enterDuration={15}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 600, color: FG, margin: 0, opacity: 0.9 }}>
                Dashboard
              </h1>
              <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, letterSpacing: "0.1em" }}>
                Portfolio overview
              </span>
            </div>
          </FadeTransition>

          <FadeTransition enterDelay={20} enterDuration={15}>
            <HealthSummary />
          </FadeTransition>

          <FadeTransition enterDelay={40} enterDuration={15}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 16 }}>
              {THEMES.map((t, i) => (
                <FadeTransition key={t.name} enterDelay={45 + i * 8} enterDuration={12}>
                  <ThemeCard theme={t} />
                </FadeTransition>
              ))}
            </div>
          </FadeTransition>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginTop: 16 }}>
            <FadeTransition enterDelay={70} enterDuration={15}>
              <PortfolioValueChart drawDuration={60} />
            </FadeTransition>
            <FadeTransition enterDelay={80} enterDuration={15}>
              <AllocationPie />
            </FadeTransition>
          </div>

          <FadeTransition enterDelay={110} enterDuration={15}>
            <div style={{ marginTop: 16 }}>
              <QuickActions />
            </div>
          </FadeTransition>
        </div>
      </DesktopFrame>

      <SimulatedCursor
        keyframes={[
          { frame: 140, x: 960, y: 700 },
          { frame: 155, x: 830, y: 760 },
          { frame: 165, x: 830, y: 760, click: true },
        ]}
      />
    </div>
  );
};
