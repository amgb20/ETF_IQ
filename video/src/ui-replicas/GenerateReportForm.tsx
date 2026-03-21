import React from "react";
import { GOLD, CYAN, FG, MUTED_FG, CARD, BORDER, MONO_FONT, DISPLAY_FONT, SECONDARY } from "../design-tokens";

interface GenerateReportFormProps {
  selectedType?: "weekly" | "monthly";
  selectedSections?: string[];
  isGenerating?: boolean;
}

const ALL_SECTIONS = ["Exec Summary", "AI Stack", "Gold", "Defence", "Macro", "Risk", "Recommendations"];

export const GenerateReportForm: React.FC<GenerateReportFormProps> = ({
  selectedType = "weekly",
  selectedSections = ALL_SECTIONS,
  isGenerating = false,
}) => {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderTop: `2px solid ${GOLD}4d`,
        borderRadius: 12,
        padding: 24,
      }}
    >
      <div style={{ fontFamily: DISPLAY_FONT, fontSize: 16, color: FG, fontWeight: 400, marginBottom: 20 }}>
        Generate Report
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, marginBottom: 8 }}>Report Type</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["weekly", "monthly"] as const).map((t) => (
            <div
              key={t}
              style={{
                fontFamily: MONO_FONT,
                fontSize: 11,
                padding: "6px 16px",
                borderRadius: 6,
                background: t === selectedType ? `${GOLD}33` : SECONDARY,
                color: t === selectedType ? GOLD : MUTED_FG,
                border: `1px solid ${t === selectedType ? `${GOLD}66` : BORDER}`,
                textTransform: "capitalize",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, marginBottom: 8 }}>Date Range</div>
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 11,
            padding: "6px 16px",
            borderRadius: 6,
            background: `${GOLD}33`,
            color: GOLD,
            border: `1px solid ${GOLD}66`,
            display: "inline-block",
          }}
        >
          Auto
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, marginBottom: 8 }}>Sections</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_SECTIONS.map((s) => {
            const active = selectedSections.includes(s);
            return (
              <div
                key={s}
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 10,
                  padding: "4px 10px",
                  borderRadius: 4,
                  background: active ? `${GOLD}33` : SECONDARY,
                  color: active ? GOLD : MUTED_FG,
                  border: `1px solid ${active ? `${GOLD}66` : BORDER}`,
                }}
              >
                {s}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          fontFamily: MONO_FONT,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.15em",
          padding: "12px 24px",
          borderRadius: 8,
          background: isGenerating ? `${GOLD}88` : GOLD,
          color: "#0A0A0F",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {isGenerating && (
          <div style={{ width: 14, height: 14, border: "2px solid #0A0A0F", borderTopColor: "transparent", borderRadius: "50%" }} />
        )}
        GENERATE REPORT
      </div>
    </div>
  );
};
