import React from "react";
import { GOLD, FG, MUTED_FG, CARD, BORDER, POSITIVE, MONO_FONT, DISPLAY_FONT } from "../design-tokens";
import { REPORT_ARCHIVE } from "../data/portfolio";

interface ReportArchiveTableProps {
  newReportOnTop?: boolean;
}

export const ReportArchiveTable: React.FC<ReportArchiveTableProps> = ({ newReportOnTop = false }) => {
  const rows = newReportOnTop
    ? [{ date: "2026-03-20", type: "weekly", summary: "AI agents report complete. Portfolio confidence 7.8/10.", status: "complete" as const }, ...REPORT_ARCHIVE]
    : REPORT_ARCHIVE;

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderTop: `2px solid ${GOLD}4d`,
        borderRadius: 12,
        padding: 20,
        overflow: "hidden",
      }}
    >
      <div style={{ fontFamily: DISPLAY_FONT, fontSize: 16, color: FG, fontWeight: 400, marginBottom: 16 }}>
        Report Archive
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Date", "Type", "Summary", "Status", "Actions"].map((h) => (
              <th
                key={h}
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 9,
                  color: MUTED_FG,
                  textAlign: "left",
                  padding: "8px 10px",
                  borderBottom: `1px solid ${BORDER}`,
                  fontWeight: 400,
                  letterSpacing: "0.05em",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i === 0 && newReportOnTop ? `${GOLD}0d` : "transparent" }}>
              <td style={{ fontFamily: MONO_FONT, fontSize: 11, color: FG, padding: "10px" }}>
                {r.date}
              </td>
              <td style={{ padding: "10px" }}>
                <span
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: 9,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: `${MUTED_FG}22`,
                    color: MUTED_FG,
                    border: `1px solid ${BORDER}`,
                    textTransform: "capitalize",
                  }}
                >
                  {r.type}
                </span>
              </td>
              <td style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, padding: "10px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.summary}
              </td>
              <td style={{ padding: "10px" }}>
                <span
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: 9,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: `${POSITIVE}22`,
                    color: POSITIVE,
                    border: `1px solid ${POSITIVE}44`,
                    textTransform: "capitalize",
                  }}
                >
                  {r.status}
                </span>
              </td>
              <td style={{ padding: "10px" }}>
                <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: FG, opacity: 0.6, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                  PDF
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
