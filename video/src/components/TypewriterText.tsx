import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

interface TypewriterTextProps {
  text: string;
  startFrame?: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
  showCursor?: boolean;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  startFrame = 0,
  charsPerFrame = 1.5,
  style,
  showCursor = true,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(Math.floor(elapsed * charsPerFrame), text.length);
  const displayed = text.slice(0, charCount);
  const isTyping = charCount < text.length && frame >= startFrame;

  return (
    <span style={style}>
      {displayed}
      {showCursor && isTyping && (
        <span style={{ opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0, color: "inherit" }}>|</span>
      )}
    </span>
  );
};
