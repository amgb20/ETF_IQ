// ── API Response Types (match backend schemas/onboarding.py) ────────

export interface ThemeClassification {
  label: string;
  color: string;
  etf_ids: string[];
  etf_isins: string[];
  research_agent: string | null;
}

export interface ClassifyThemesResponse {
  themes: ThemeClassification[];
}

export interface PairCorrelation {
  etf_id_a: string;
  etf_id_b: string;
  isin_a: string;
  isin_b: string;
  name_a: string;
  name_b: string;
  correlation: number;
}

export interface PairOverlap {
  etf_id_a: string;
  etf_id_b: string;
  isin_a: string;
  isin_b: string;
  name_a: string;
  name_b: string;
  overlap_pct: number;
  shared_holdings_count: number;
}

export interface FlaggedPair {
  etf_id_a: string;
  etf_id_b: string;
  isin_a: string;
  isin_b: string;
  reason: string;
  value: number;
}

export interface CorrelationsResponse {
  price_correlations: PairCorrelation[];
  holdings_overlaps: PairOverlap[];
  flagged_pairs: FlaggedPair[];
}

export interface RankedETF {
  etf_id: string;
  isin: string;
  name: string;
  rank: number;
  score_breakdown: Record<string, string>;
}

export interface PairRanking {
  pair_etf_ids: string[];
  ranked_etfs: RankedETF[];
  reasoning: string;
}

export interface SuggestedETF {
  isin: string;
  name: string;
  ter: number | null;
  vol_1y: number | null;
  ret_risk_1y: number | null;
  why: string;
}

export interface ReplacementSuggestion {
  discard_etf_id: string;
  theme: string;
  suggested_etfs: SuggestedETF[];
  reasoning: string;
}

export interface AdvisorResponse {
  rankings: PairRanking[];
  replacements: ReplacementSuggestion[];
}

export interface OnboardingStatusResponse {
  is_onboarded: boolean;
}

export interface HydrateETFsResponse {
  hydrated: number;
  already_populated: number;
  errors: string[];
}

// ── Local Wizard State Types ───────────────────────────────────────

export interface DraftETF {
  id: string;
  isin: string;
  name: string;
  ticker_yf: string | null;
}

export interface AllocationEntry extends DraftETF {
  mode: "weight" | "owned";
  target_weight: number;
  shares: number;
  entry_price: number;
  entry_date: string;
  theme_label: string;
  theme_color: string;
}

export type ResolutionChoice =
  | { type: "keep_winner"; winner_etf_id: string }
  | { type: "keep_and_replace"; winner_etf_id: string; replacement: SuggestedETF }
  | { type: "keep_both" };

export interface CorrelatedPairInput {
  etf_id_a: string;
  etf_id_b: string;
  price_correlation: number | null;
  holdings_overlap_pct: number | null;
}
