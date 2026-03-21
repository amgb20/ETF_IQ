import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";

const cormorant = loadCormorant();
const jetbrains = loadJetBrains();

export const DISPLAY_FONT = cormorant.fontFamily;
export const MONO_FONT = jetbrains.fontFamily;

export const BG = "#0A0A0F";
export const CARD = "#0d0d12";
export const GOLD = "#C9A84C";
export const CYAN = "#00D4FF";
export const FG = "#f0ede6";

export const POSITIVE = "#22c55e";
export const NEGATIVE = "#ef4444";
export const WARNING = "#f59e0b";
export const INFO = "#3b82f6";

export const BORDER = "#23201a";
export const MUTED = "#14141a";
export const MUTED_FG = "#8a8a9a";
export const INPUT = "#17171d";
export const SECONDARY = "#14141a";

export const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

export const LIGHT = {
  BG: "#ffffff",
  CARD: "#ffffff",
  FG: "#09090b",
  BORDER: "#e4e4e7",
  MUTED: "#f4f4f5",
  MUTED_FG: "#71717a",
  INPUT: "#e4e4e7",
  SECONDARY: "#f4f4f5",
};
