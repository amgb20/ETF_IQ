import React from "react";
import { Audio, staticFile, Sequence } from "remotion";
import type { VoiceoverClip } from "./voiceover-scripts";
import { VOICEOVER_CLIPS } from "./voiceover-scripts";

interface AudioLayerProps {
  composition: "teaser" | "full";
  fps?: number;
}

const SCENE_START_FRAMES: Record<string, Record<string, number>> = {
  teaser: {
    TitleScene: 0,
    DashboardScene: 120,
    CharlesScene: 420,
    AgentPipelineScene: 660,
  },
  full: {
    TitleScene: 0,
    OnboardingScene: 90,
    DashboardScene: 450,
    AnalysisScene: 690,
    CharlesScene: 870,
    ReportWowScene: 1110,
    LightModeFlash: 1560,
  },
};

export const AudioLayer: React.FC<AudioLayerProps> = ({ composition, fps = 30 }) => {
  const clips = VOICEOVER_CLIPS.filter((c) => c.composition === composition);
  const startFrames = SCENE_START_FRAMES[composition] || {};

  return (
    <>
      {clips.map((clip) => {
        const startFrame = startFrames[clip.scene];
        if (startFrame === undefined) return null;

        try {
          const audioSrc = staticFile(`audio/clips/${clip.id}.mp3`);
          return (
            <Sequence key={clip.id} from={startFrame} durationInFrames={clip.durationSeconds * fps}>
              <Audio src={audioSrc} volume={0.9} />
            </Sequence>
          );
        } catch {
          return null;
        }
      })}
    </>
  );
};
