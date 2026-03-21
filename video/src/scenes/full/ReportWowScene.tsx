import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { DesktopFrame, FadeTransition, SimulatedCursor, GrainOverlay } from "../../components";
import { GenerateReportForm, ProgressIndicator, ReportArchiveTable, SentimentChart } from "../../ui-replicas";
import { AgentDispatchScene } from "../../three/AgentDispatchScene";
import { BG, GOLD, FG, MUTED_FG, DISPLAY_FONT, MONO_FONT } from "../../design-tokens";

export const ReportWowScene: React.FC = () => {
  const frame = useCurrentFrame();

  const clickPhase = frame < 60;
  const dispatchPhase = frame >= 60 && frame < 300;
  const resultPhase = frame >= 300 && frame < 390;
  const sentimentPhase = frame >= 390;

  const desktopScale = dispatchPhase
    ? interpolate(frame, [60, 90], [0.85, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : resultPhase
    ? interpolate(frame, [300, 320], [0.4, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0.85;

  const desktopOpacity = dispatchPhase
    ? interpolate(frame, [60, 90], [1, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : resultPhase
    ? interpolate(frame, [300, 320], [0.25, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  const threeOpacity = dispatchPhase
    ? interpolate(frame, [70, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      * interpolate(frame, [280, 300], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const isGenerating = frame >= 30 && frame < 300;
  const reportStatus = frame >= 330 ? "complete" as const : frame >= 60 ? "running" as const : "pending" as const;

  const sentOverlayOpacity = sentimentPhase
    ? interpolate(frame, [390, 410], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative", overflow: "hidden" }}>
      <GrainOverlay opacity={0.02} />

      <div style={{ position: "absolute", inset: 0, opacity: desktopOpacity, transform: `scale(${desktopScale})`, transformOrigin: "center center", zIndex: 5 }}>
        <DesktopFrame rotateYStart={-5} rotateYEnd={-3}>
          <div style={{ padding: "24px 32px" }}>
            <FadeTransition enterDelay={0} enterDuration={10}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 600, color: FG, margin: 0, opacity: 0.9 }}>
                  Reports
                </h1>
                <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG }}>
                  AI-generated analysis
                </span>
              </div>
            </FadeTransition>

            {clickPhase && (
              <GenerateReportForm isGenerating={frame >= 30} />
            )}

            {resultPhase && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <ProgressIndicator
                  status={reportStatus}
                  elapsed="1:42"
                  summary={reportStatus === "complete" ? "AI Stack outperforming. Gold hedge effective." : undefined}
                />
                <ReportArchiveTable newReportOnTop={reportStatus === "complete"} />
              </div>
            )}
          </div>
        </DesktopFrame>
      </div>

      {threeOpacity > 0 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, opacity: threeOpacity }}>
          <AgentDispatchScene />
        </div>
      )}

      {sentOverlayOpacity > 0 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 15, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
          <div style={{ opacity: sentOverlayOpacity, width: 600 }}>
            <SentimentChart drawDuration={40} />
          </div>
          <div
            style={{
              opacity: interpolate(frame, [420, 440], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              fontFamily: DISPLAY_FONT,
              fontSize: 28,
              color: GOLD,
              fontWeight: 300,
              textAlign: "center",
            }}
          >
            AI predictions you can track and verify
          </div>
        </div>
      )}

      {clickPhase && (
        <SimulatedCursor
          keyframes={[
            { frame: 15, x: 960, y: 520 },
            { frame: 28, x: 960, y: 520, click: true },
          ]}
        />
      )}
    </div>
  );
};
