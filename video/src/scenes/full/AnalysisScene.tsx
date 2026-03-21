import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { DesktopFrame, FadeTransition, SimulatedCursor } from "../../components";
import { ChartWorkspace, AnalysisLineChart, EventPinnedCard, CorrelationHeatmap, SentimentChart } from "../../ui-replicas";
import { BG, FG, MUTED_FG, DISPLAY_FONT, MONO_FONT } from "../../design-tokens";
import { CHART_EVENTS } from "../../data/portfolio";

export const AnalysisScene: React.FC = () => {
  const frame = useCurrentFrame();

  const chartPhase = frame < 60;
  const corrPhase = frame >= 60 && frame < 120;
  const sentPhase = frame >= 120;

  const eventsOn = frame >= 35;
  const eventCardShow = frame >= 50 && frame < 60;
  const clickedEvent = eventCardShow ? CHART_EVENTS[1] : null;

  const chartOpacity = interpolate(frame, [55, 60], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const corrOpacity = interpolate(frame, [60, 68], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    * interpolate(frame, [115, 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sentOpacity = interpolate(frame, [120, 128], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative" }}>
      <DesktopFrame rotateYStart={-5} rotateYEnd={-3}>
        <div style={{ padding: "24px 32px" }}>
          <FadeTransition enterDelay={0} enterDuration={10}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 600, color: FG, margin: 0, opacity: 0.9 }}>
                Analysis
              </h1>
              <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG }}>
                Prices as of Mar 20, 2026
              </span>
            </div>
          </FadeTransition>

          <div style={{ position: "relative" }}>
            {chartPhase && (
              <div style={{ opacity: chartOpacity }}>
                <ChartWorkspace eventsOn={eventsOn}>
                  <div style={{ position: "relative" }}>
                    <AnalysisLineChart
                      drawDuration={30}
                      showEvents={eventsOn}
                      onEventIndex={clickedEvent?.index ?? null}
                    />
                    {clickedEvent && (
                      <EventPinnedCard event={clickedEvent} x={200} y={80} />
                    )}
                  </div>
                </ChartWorkspace>
              </div>
            )}

            {corrPhase && (
              <div style={{ opacity: corrOpacity }}>
                <CorrelationHeatmap />
              </div>
            )}

            {sentPhase && (
              <div style={{ opacity: sentOpacity }}>
                <SentimentChart drawDuration={30} />
              </div>
            )}
          </div>
        </div>
      </DesktopFrame>

      <SimulatedCursor
        keyframes={[
          { frame: 32, x: 1050, y: 310 },
          { frame: 35, x: 1050, y: 310, click: true },
          { frame: 48, x: 680, y: 480 },
          { frame: 50, x: 680, y: 480, click: true },
        ]}
      />
    </div>
  );
};
