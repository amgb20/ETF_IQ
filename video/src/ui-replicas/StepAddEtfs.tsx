import React from "react";
import { GOLD, CYAN, FG, MUTED_FG, CARD, BORDER, MONO_FONT, DISPLAY_FONT, INPUT } from "../design-tokens";

interface StepAddEtfsProps {
  searchText: string;
  results: { ticker: string; name: string; isin: string }[];
  selected: string[];
  showResults?: boolean;
}

export const StepAddEtfs: React.FC<StepAddEtfsProps> = ({
  searchText,
  results,
  selected,
  showResults = true,
}) => {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px" }}>
      <div
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderTop: `2px solid ${GOLD}4d`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "24px 24px 0" }}>
          <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 22, color: FG, fontWeight: 400, margin: 0 }}>
            Add Your ETFs
          </h2>
          <p style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG, marginTop: 6 }}>
            Search and add all the ETFs you're interested in tracking.
          </p>
        </div>
        <div style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: INPUT,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "10px 14px",
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED_FG} strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: searchText ? FG : MUTED_FG }}>
              {searchText || "Search all ETFs by name, ISIN, or ticker…"}
            </span>
          </div>

          {showResults && results.length > 0 && (
            <div
              style={{
                marginTop: 8,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                overflow: "hidden",
                maxHeight: 180,
              }}
            >
              {results.map((r, i) => (
                <div
                  key={r.ticker}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderBottom: i < results.length - 1 ? `1px solid ${BORDER}` : "none",
                    background: selected.includes(r.ticker) ? `${GOLD}0d` : "transparent",
                  }}
                >
                  <div>
                    <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: FG }}>{r.name}</span>
                    <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, marginLeft: 8 }}>
                      {r.ticker} · {r.isin}
                    </span>
                  </div>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: selected.includes(r.ticker) ? `${GOLD}33` : "transparent",
                      color: selected.includes(r.ticker) ? GOLD : MUTED_FG,
                      fontSize: 16,
                    }}
                  >
                    {selected.includes(r.ticker) ? "✓" : "+"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selected.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 10,
                  color: MUTED_FG,
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                  textTransform: "uppercase",
                }}
              >
                Selected ({selected.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selected.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontFamily: MONO_FONT,
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: `${GOLD}1a`,
                      color: GOLD,
                      border: `1px solid ${GOLD}40`,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
