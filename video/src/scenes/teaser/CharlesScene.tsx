import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { DesktopFrame, FadeTransition, TypewriterText } from "../../components";
import { ChatPanel, ChatMessage } from "../../ui-replicas";
import { BG, GOLD, CYAN, FG, MUTED_FG, CARD, BORDER, MONO_FONT } from "../../design-tokens";
import { CHARLES_CONVERSATIONS, RISK_METRICS } from "../../data/portfolio";

export const CharlesScene: React.FC = () => {
  const frame = useCurrentFrame();

  const chatScale = interpolate(frame, [0, 12], [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const chatOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const userMsgShow = frame >= 15;
  const typingShow = frame >= 35 && frame < 55;
  const answerStart = 55;
  const answerText = CHARLES_CONVERSATIONS.webSearch.answer;
  const answerChars = Math.min(
    Math.floor(Math.max(0, frame - answerStart) * 2),
    answerText.length
  );
  const answerDone = answerChars >= answerText.length;
  const toolBadgeShow = answerDone;
  const sourcesShow = frame >= answerStart + 80;

  const riskCardOpacity = interpolate(frame, [180, 195], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative" }}>
      <DesktopFrame rotateYStart={-6} rotateYEnd={-3}>
        <div style={{ width: "100%", height: "100%", position: "relative", opacity: 0.4 }}>
          <div style={{ padding: 32, fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG }}>
            Dashboard content (blurred background)
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            zIndex: 30,
            transform: `scale(${chatScale})`,
            opacity: chatOpacity,
            transformOrigin: "bottom right",
          }}
        >
          <ChatPanel floating>
            {userMsgShow && (
              <FadeTransition enterDelay={0} enterDuration={8}>
                <ChatMessage role="user" text="What's my biggest risk exposure?" />
              </FadeTransition>
            )}
            {typingShow && (
              <ChatMessage role="assistant" text="" typing />
            )}
            {frame >= answerStart && (
              <ChatMessage
                role="assistant"
                text={answerText.slice(0, answerChars)}
                typing={!answerDone}
                toolBadge={toolBadgeShow ? { label: "Web Search", icon: "Globe" } : undefined}
                sources={sourcesShow ? CHARLES_CONVERSATIONS.webSearch.sources : undefined}
              />
            )}
          </ChatPanel>
        </div>

        {riskCardOpacity > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: 60,
              opacity: riskCardOpacity,
              width: 280,
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: 16,
              zIndex: 20,
            }}
          >
            <div style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG, marginBottom: 10 }}>RISK SNAPSHOT</div>
            {Object.values(RISK_METRICS).slice(0, 2).map((m) => (
              <div key={m.label} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG }}>{m.label}</span>
                  <span style={{ fontFamily: MONO_FONT, fontSize: 9, color: m.color, fontWeight: 500 }}>{m.value}</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: m.color, width: m.barWidth }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </DesktopFrame>
    </div>
  );
};
