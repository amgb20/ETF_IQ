import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { DesktopFrame, FadeTransition } from "../../components";
import { ChatPanel, ChatMessage, AlertsTab } from "../../ui-replicas";
import { BG, GOLD, CYAN, FG, MUTED_FG, CARD, BORDER, MONO_FONT, DISPLAY_FONT } from "../../design-tokens";
import { CHARLES_CONVERSATIONS } from "../../data/portfolio";

export const CharlesScene: React.FC = () => {
  const frame = useCurrentFrame();

  const rag = CHARLES_CONVERSATIONS.rag;
  const web = CHARLES_CONVERSATIONS.webSearch;
  const alert = CHARLES_CONVERSATIONS.alertPrompt;

  const ragUserShow = frame >= 5;
  const ragTyping = frame >= 20 && frame < 35;
  const ragAnswerStart = 35;
  const ragText = rag.answer;
  const ragChars = Math.min(Math.floor(Math.max(0, frame - ragAnswerStart) * 2.5), ragText.length);
  const ragDone = ragChars >= ragText.length;

  const webUserShow = frame >= 85;
  const webTyping = frame >= 100 && frame < 115;
  const webAnswerStart = 115;
  const webText = web.answer;
  const webChars = Math.min(Math.floor(Math.max(0, frame - webAnswerStart) * 2.5), webText.length);
  const webDone = webChars >= webText.length;

  const alertPromptShow = frame >= 175;
  const alertText = alert.answer;
  const alertChars = Math.min(Math.floor(Math.max(0, frame - 185) * 2), alertText.length);
  const alertDone = alertChars >= alertText.length;
  const alertUIShow = frame >= 210;

  const chatScale = interpolate(frame, [0, 8], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const chatOpacity = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative" }}>
      <DesktopFrame rotateYStart={-5} rotateYEnd={-3}>
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <div style={{ padding: "24px 32px" }}>
            <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 600, color: FG, margin: 0, opacity: 0.3 }}>
              Dashboard
            </h1>
          </div>

          {alertUIShow && (
            <FadeTransition enterDelay={0} enterDuration={10} style={{ position: "absolute", bottom: 40, left: 40, width: 500, zIndex: 15 }}>
              <AlertsTab showNewAlert newAlertTicker="SPY" newAlertThreshold="-3" />
            </FadeTransition>
          )}

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
              {ragUserShow && (
                <ChatMessage role="user" text={rag.question} />
              )}
              {ragTyping && <ChatMessage role="assistant" text="" typing />}
              {frame >= ragAnswerStart && (
                <ChatMessage
                  role="assistant"
                  text={ragText.slice(0, ragChars)}
                  typing={!ragDone}
                  toolBadge={ragDone ? { label: rag.tool, icon: rag.toolIcon } : undefined}
                />
              )}

              {webUserShow && (
                <ChatMessage role="user" text={web.question} />
              )}
              {webTyping && <ChatMessage role="assistant" text="" typing />}
              {frame >= webAnswerStart && (
                <ChatMessage
                  role="assistant"
                  text={webText.slice(0, webChars)}
                  typing={!webDone}
                  toolBadge={webDone ? { label: web.tool, icon: web.toolIcon } : undefined}
                  sources={webDone ? web.sources : undefined}
                />
              )}

              {alertPromptShow && frame >= 185 && (
                <ChatMessage
                  role="assistant"
                  text={alertText.slice(0, alertChars)}
                  typing={!alertDone}
                  toolBadge={alertDone ? { label: "Create Alert", icon: "Bell" } : undefined}
                />
              )}
            </ChatPanel>
          </div>
        </div>
      </DesktopFrame>
    </div>
  );
};
