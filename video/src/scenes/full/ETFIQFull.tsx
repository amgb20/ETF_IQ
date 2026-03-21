import React from "react";
import { Series, AbsoluteFill } from "remotion";
import { TitleScene } from "../teaser/TitleScene";
import { LogoScene } from "../teaser/LogoScene";
import { OnboardingScene } from "./OnboardingScene";
import { DashboardScene } from "./DashboardScene";
import { AnalysisScene } from "./AnalysisScene";
import { CharlesScene } from "./CharlesScene";
import { ReportWowScene } from "./ReportWowScene";
import { LightModeFlash } from "./LightModeFlash";
import { AudioLayer } from "../../audio/AudioLayer";
import { BG } from "../../design-tokens";

export const ETFIQFull: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <AudioLayer composition="full" />
      <Series>
        <Series.Sequence durationInFrames={90}>
          <TitleScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={360}>
          <OnboardingScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={240}>
          <DashboardScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={180}>
          <AnalysisScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={240}>
          <CharlesScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={450}>
          <ReportWowScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={60}>
          <LightModeFlash />
        </Series.Sequence>
        <Series.Sequence durationInFrames={180}>
          <LogoScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
