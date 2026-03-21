import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { DesktopFrame, FadeTransition } from "../../components";
import { HealthSummary, ThemeCard, PortfolioValueChart, AllocationPie, LatestAlerts, QuickActions } from "../../ui-replicas";
import { BG, FG, MUTED_FG, DISPLAY_FONT, MONO_FONT } from "../../design-tokens";
import { THEMES } from "../../data/portfolio";

export const DashboardScene: React.FC = () => {
  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative" }}>
      <DesktopFrame enterFrom="none" rotateYStart={-6} rotateYEnd={-3}>
        <div style={{ padding: "24px 32px", overflow: "hidden" }}>
          <FadeTransition enterDelay={0} enterDuration={12}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 600, color: FG, margin: 0, opacity: 0.9 }}>
                Dashboard
              </h1>
              <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, letterSpacing: "0.1em" }}>
                Portfolio overview
              </span>
            </div>
          </FadeTransition>

          <FadeTransition enterDelay={8} enterDuration={12}>
            <HealthSummary />
          </FadeTransition>

          <FadeTransition enterDelay={25} enterDuration={12}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 16 }}>
              {THEMES.map((t, i) => (
                <FadeTransition key={t.name} enterDelay={28 + i * 6} enterDuration={10}>
                  <ThemeCard theme={t} />
                </FadeTransition>
              ))}
            </div>
          </FadeTransition>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginTop: 16 }}>
            <FadeTransition enterDelay={55} enterDuration={12}>
              <PortfolioValueChart drawDuration={50} />
            </FadeTransition>
            <FadeTransition enterDelay={65} enterDuration={12}>
              <AllocationPie />
            </FadeTransition>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
            <FadeTransition enterDelay={90} enterDuration={12}>
              <LatestAlerts />
            </FadeTransition>
            <FadeTransition enterDelay={100} enterDuration={12}>
              <QuickActions />
            </FadeTransition>
          </div>
        </div>
      </DesktopFrame>
    </div>
  );
};
