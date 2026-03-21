import React from "react";
import { GOLD, FG, MUTED_FG, CARD, BORDER, POSITIVE, NEGATIVE, MONO_FONT } from "../design-tokens";

type Status = "pending" | "running" | "complete" | "failed";

interface ProgressIndicatorProps {
  status: Status;
  elapsed?: string;
  currentStep?: string;
  summary?: string;
}

const STATUS_LABELS: Record<Status, string> = {
  pending: "Queued...",
  running: "Agents researching...",
  complete: "Report ready",
  failed: "Generation failed",
};

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  status,
  elapsed = "1:42",
  currentStep = "Synthesizing sections",
  summary,
}) => {
  const iconColor = status === "complete" ? POSITIVE : status === "failed" ? NEGATIVE : GOLD;

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ width: 20, height: 20, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {status === "complete" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={POSITIVE} strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : status === "failed" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={NEGATIVE} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" /><path d="m9 9 6 6" />
          </svg>
        ) : (
          <div
            style={{
              width: 18,
              height: 18,
              border: `2px solid ${GOLD}`,
              borderTopColor: "transparent",
              borderRadius: "50%",
            }}
          />
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: MONO_FONT, fontSize: 12, color: FG, fontWeight: 500 }}>
          {STATUS_LABELS[status]}
        </div>
        {summary ? (
          <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, marginTop: 2 }}>{summary}</div>
        ) : (
          status === "running" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 9,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: `${MUTED_FG}22`,
                  color: MUTED_FG,
                  border: `1px solid ${BORDER}`,
                }}
              >
                {currentStep}
              </span>
            </div>
          )
        )}
      </div>
      {(status === "pending" || status === "running") && (
        <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG }}>
          Elapsed: {elapsed}
        </span>
      )}
      {status === "complete" && (
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 10,
            padding: "6px 14px",
            borderRadius: 6,
            border: `1px solid ${BORDER}`,
            color: FG,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          </svg>
          View PDF
        </div>
      )}
    </div>
  );
};
