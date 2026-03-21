import { Composition } from "remotion";
import { ETFIQTeaser } from "./scenes/teaser/ETFIQTeaser";
import { ETFIQFull } from "./scenes/full/ETFIQFull";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ETFIQTeaser"
        component={ETFIQTeaser}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ETFIQFull"
        component={ETFIQFull}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
