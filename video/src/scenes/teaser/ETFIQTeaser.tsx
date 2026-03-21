import React from "react";
import { Series, AbsoluteFill } from "remotion";
import { TitleScene } from "./TitleScene";
import { DashboardScene } from "./DashboardScene";
import { CharlesScene } from "./CharlesScene";
import { AgentPipelineScene } from "./AgentPipelineScene";
import { LogoScene } from "./LogoScene";
import { AudioLayer } from "../../audio/AudioLayer";
import { BG } from "../../design-tokens";

export const ETFIQTeaser: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <AudioLayer composition="teaser" />
      <Series>
        <Series.Sequence durationInFrames={120}>
          <TitleScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={300}>
          <DashboardScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={240}>
          <CharlesScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={180}>
          <AgentPipelineScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={60}>
          <LogoScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
