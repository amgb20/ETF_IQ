export interface VoiceoverClip {
  id: string;
  text: string;
  composition: "teaser" | "full";
  scene: string;
  durationSeconds: number;
}

export const VOICEOVER_CLIPS: VoiceoverClip[] = [
  {
    id: "teaser-s1-title",
    text: "Meet ETF IQ — your AI-powered portfolio intelligence platform.",
    composition: "teaser",
    scene: "TitleScene",
    durationSeconds: 4,
  },
  {
    id: "teaser-s2-dashboard",
    text: "Track your entire portfolio at a glance. Real-time P&L, investment themes, and allocation targets — all in one place.",
    composition: "teaser",
    scene: "DashboardScene",
    durationSeconds: 10,
  },
  {
    id: "teaser-s3-charles",
    text: "Ask Charles anything. He searches the web, reads your portfolio data, and answers with full context.",
    composition: "teaser",
    scene: "CharlesScene",
    durationSeconds: 8,
  },
  {
    id: "teaser-s4-agents",
    text: "Seven AI agents research, analyze, and synthesize — delivering reports in under two minutes.",
    composition: "teaser",
    scene: "AgentPipelineScene",
    durationSeconds: 6,
  },

  {
    id: "full-s1-title",
    text: "ETF IQ — portfolio intelligence, powered by AI.",
    composition: "full",
    scene: "TitleScene",
    durationSeconds: 3,
  },
  {
    id: "full-s2-onboarding",
    text: "Getting started takes minutes. Search ETFs, discover themes automatically, set your allocations, and you're ready.",
    composition: "full",
    scene: "OnboardingScene",
    durationSeconds: 12,
  },
  {
    id: "full-s3-dashboard",
    text: "Your dashboard shows everything at a glance — portfolio value, theme performance, allocation drift, and AI-scored confidence.",
    composition: "full",
    scene: "DashboardScene",
    durationSeconds: 8,
  },
  {
    id: "full-s4-analysis",
    text: "Deep analytics — charts, correlations, news events on the timeline, and real-time sentiment scoring from every agent.",
    composition: "full",
    scene: "AnalysisScene",
    durationSeconds: 6,
  },
  {
    id: "full-s5-charles",
    text: "Charles is your conversational advisor — combining your portfolio data with live web intelligence to answer any question.",
    composition: "full",
    scene: "CharlesScene",
    durationSeconds: 8,
  },
  {
    id: "full-s6-report",
    text: "Hit generate and watch AI agents fan out — pulling market intelligence, analyzing risk, scoring recommendations. Your report is ready in under two minutes. Track every prediction with weekly sentiment scoring.",
    composition: "full",
    scene: "ReportWowScene",
    durationSeconds: 15,
  },
  {
    id: "full-s7-lightmode",
    text: "Beautiful in light or dark.",
    composition: "full",
    scene: "LightModeFlash",
    durationSeconds: 2,
  },
];
