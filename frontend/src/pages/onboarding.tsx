import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "@/contexts/UserContext";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressStepper } from "@/components/onboarding/progress-stepper";
import { StepDisclaimer } from "@/components/onboarding/step-disclaimer";
import { StepAddEtfs } from "@/components/onboarding/step-add-etfs";
import { StepThemes } from "@/components/onboarding/step-themes";
import { StepCorrelations } from "@/components/onboarding/step-correlations";
import { StepOptimization } from "@/components/onboarding/step-optimization";
import { StepAllocations } from "@/components/onboarding/step-allocations";
import { StepReview } from "@/components/onboarding/step-review";
import {
  useClassifyThemes,
  useComputeCorrelations,
  useCorrelationAdvisor,
  useCompleteOnboarding,
} from "@/hooks/use-onboarding";
import type {
  DraftETF,
  ThemeClassification,
  CorrelationsResponse,
  AdvisorResponse,
  AllocationEntry,
  ResolutionChoice,
} from "@/types/onboarding";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useUserContext();
  const queryClient = useQueryClient();

  // ── Wizard step state ──────────────────────────────────────────
  const [step, setStep] = useState(1);

  // Step 2: ETF selection
  const [etfs, setEtfs] = useState<DraftETF[]>([]);

  // Step 3: Theme detection
  const [themes, setThemes] = useState<ThemeClassification[]>([]);

  // Step 4: Correlations
  const [correlations, setCorrelations] = useState<CorrelationsResponse | null>(null);

  // Step 5: Advisor
  const [advisor, setAdvisor] = useState<AdvisorResponse | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, ResolutionChoice>>(new Map());

  // Step 6: Allocations
  const [allocations, setAllocations] = useState<AllocationEntry[]>([]);
  const [portfolioName, setPortfolioName] = useState("");

  // ── Mutations ──────────────────────────────────────────────────
  const classifyThemes = useClassifyThemes();
  const computeCorrelations = useComputeCorrelations();
  const correlationAdvisor = useCorrelationAdvisor();
  const completeOnboarding = useCompleteOnboarding();

  // ── Step 2→3: Analyze themes ──────────────────────────────────
  const handleAnalyzeThemes = useCallback(async () => {
    try {
      const result = await classifyThemes.mutateAsync({
        etf_ids: etfs.map((e) => e.id),
      });
      setThemes(result.themes);
      setStep(3);
    } catch (err) {
      console.error("Theme classification failed:", err);
    }
  }, [etfs, classifyThemes]);

  // ── Step 3→4: Compute correlations ────────────────────────────
  const handleCheckCorrelations = useCallback(async () => {
    try {
      const result = await computeCorrelations.mutateAsync({
        etf_ids: etfs.map((e) => e.id),
      });
      setCorrelations(result);
      setStep(4);
    } catch (err) {
      console.error("Correlation computation failed:", err);
    }
  }, [etfs, computeCorrelations]);

  // ── Helper: Build allocation entries from final ETF list ──────
  const buildAllocations = useCallback(
    (finalEtfs: DraftETF[], themeList: ThemeClassification[]) => {
      const entries: AllocationEntry[] = finalEtfs.map((etf) => {
        const theme = themeList.find(
          (t) => t.etf_ids.includes(etf.id) || t.etf_isins.includes(etf.isin)
        );
        return {
          ...etf,
          mode: "weight" as const,
          target_weight: 0,
          shares: 0,
          entry_price: 0,
          entry_date: new Date().toISOString().split("T")[0],
          theme_label: theme?.label || "Other",
          theme_color: theme?.color || "#71717a",
        };
      });

      // Auto-distribute weight evenly
      const evenWeight = Math.round((100 / entries.length) * 10) / 10;
      for (const entry of entries) {
        entry.target_weight = evenWeight;
      }

      setAllocations(entries);
    },
    []
  );

  // ── Step 4→5: Get advisor recommendations (or skip to 6) ─────
  const handleOptimize = useCallback(async () => {
    if (!correlations || correlations.flagged_pairs.length === 0) {
      // No conflicts — skip to allocations
      buildAllocations(etfs, themes);
      setStep(6);
      return;
    }

    try {
      const pairsInput = correlations.flagged_pairs.map((fp) => {
        const priceCorr = correlations.price_correlations.find(
          (pc) =>
            (pc.etf_id_a === fp.etf_id_a && pc.etf_id_b === fp.etf_id_b) ||
            (pc.etf_id_a === fp.etf_id_b && pc.etf_id_b === fp.etf_id_a)
        );
        const holdingsOvl = correlations.holdings_overlaps.find(
          (ho) =>
            (ho.etf_id_a === fp.etf_id_a && ho.etf_id_b === fp.etf_id_b) ||
            (ho.etf_id_a === fp.etf_id_b && ho.etf_id_b === fp.etf_id_a)
        );
        return {
          etf_id_a: fp.etf_id_a,
          etf_id_b: fp.etf_id_b,
          price_correlation: priceCorr?.correlation ?? null,
          holdings_overlap_pct: holdingsOvl?.overlap_pct ?? null,
        };
      });

      const result = await correlationAdvisor.mutateAsync({
        correlated_pairs: pairsInput,
        all_etf_ids: etfs.map((e) => e.id),
      });
      setAdvisor(result);
      setStep(5);
    } catch (err) {
      console.error("Advisor call failed:", err);
    }
  }, [correlations, etfs, themes, correlationAdvisor, buildAllocations]);

  // ── Step 5→6: Apply resolutions and build allocations ─────────
  const handleFinalizeResolutions = useCallback(() => {
    const finalEtfIds = new Set(etfs.map((e) => e.id));
    const additionalEtfs: DraftETF[] = [];

    if (advisor) {
      for (const ranking of advisor.rankings) {
        const pk = ranking.pair_etf_ids.sort().join(":");
        const resolution = resolutions.get(pk);
        if (!resolution) continue;

        if (resolution.type === "keep_winner") {
          const loserId = ranking.ranked_etfs.find(
            (r) => r.etf_id !== resolution.winner_etf_id
          )?.etf_id;
          if (loserId) finalEtfIds.delete(loserId);
        } else if (resolution.type === "keep_and_replace") {
          const loserId = ranking.ranked_etfs.find(
            (r) => r.etf_id !== resolution.winner_etf_id
          )?.etf_id;
          if (loserId) finalEtfIds.delete(loserId);
          additionalEtfs.push({
            id: "",
            isin: resolution.replacement.isin,
            name: resolution.replacement.name,
            ticker_yf: null,
          });
        }
        // keep_both: do nothing
      }
    }

    const finalEtfs = [
      ...etfs.filter((e) => finalEtfIds.has(e.id)),
      ...additionalEtfs,
    ];

    buildAllocations(finalEtfs, themes);
    setStep(6);
  }, [etfs, advisor, resolutions, themes, buildAllocations]);

  // ── Step 7: Complete onboarding ───────────────────────────────
  const handleComplete = useCallback(async () => {
    const themeMap = new Map<string, { color: string; research_agent: string | null; positions: AllocationEntry[] }>();
    for (const alloc of allocations) {
      if (!themeMap.has(alloc.theme_label)) {
        const matched = themes.find((t) => t.label === alloc.theme_label);
        themeMap.set(alloc.theme_label, {
          color: alloc.theme_color,
          research_agent: matched?.research_agent ?? null,
          positions: [],
        });
      }
      themeMap.get(alloc.theme_label)!.positions.push(alloc);
    }

    const themesPayload = Array.from(themeMap.entries()).map(([name, data]) => ({
      name,
      color: data.color,
      research_agent: data.research_agent,
      positions: data.positions.map((alloc) => ({
        etf_id: alloc.id,
        shares: alloc.mode === "owned" ? alloc.shares : 0,
        entry_price: alloc.mode === "owned" ? alloc.entry_price : 0,
        entry_date:
          alloc.mode === "owned"
            ? alloc.entry_date
            : new Date().toISOString().split("T")[0],
        invested_amount:
          alloc.mode === "owned" ? alloc.shares * alloc.entry_price : 0,
        target_allocation:
          alloc.mode === "weight" ? alloc.target_weight : null,
      })),
    }));

    try {
      await completeOnboarding.mutateAsync({
        portfolio_name: portfolioName || "My Portfolio",
        themes: themesPayload,
      });

      await queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });

      navigate(`/${user?.id}/dashboard`, { replace: true });
    } catch (err) {
      console.error("Onboarding completion failed:", err);
    }
  }, [allocations, portfolioName, completeOnboarding, queryClient, navigate, user]);

  // ── Back navigation ───────────────────────────────────────────
  const handleBack = () => {
    if (step === 6 && (!correlations || correlations.flagged_pairs.length === 0)) {
      setStep(4);
    } else {
      setStep((s) => Math.max(1, s - 1));
    }
  };

  const hasFlaggedPairs = (correlations?.flagged_pairs.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background">
      <ProgressStepper current={step} />

      <div className="px-4 py-8">
        {step > 1 && (
          <div className="max-w-4xl mx-auto mb-6">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>
        )}

        {step === 1 && <StepDisclaimer onAccept={() => setStep(2)} />}

        {step === 2 && (
          <StepAddEtfs
            etfs={etfs}
            setEtfs={setEtfs}
            onAnalyze={handleAnalyzeThemes}
            isAnalyzing={classifyThemes.isPending}
          />
        )}

        {step === 3 && (
          <StepThemes
            themes={themes}
            etfs={etfs}
            isLoading={classifyThemes.isPending}
            onNext={handleCheckCorrelations}
            isLoadingNext={computeCorrelations.isPending}
          />
        )}

        {step === 4 && (
          <StepCorrelations
            correlations={correlations}
            etfs={etfs}
            isLoading={computeCorrelations.isPending}
            hasFlaggedPairs={hasFlaggedPairs}
            onNext={handleOptimize}
            isLoadingNext={correlationAdvisor.isPending}
          />
        )}

        {step === 5 && (
          <StepOptimization
            advisor={advisor}
            isLoading={correlationAdvisor.isPending}
            resolutions={resolutions}
            setResolutions={setResolutions}
            etfs={etfs}
            onNext={handleFinalizeResolutions}
          />
        )}

        {step === 6 && (
          <StepAllocations
            allocations={allocations}
            setAllocations={setAllocations}
            portfolioName={portfolioName}
            setPortfolioName={setPortfolioName}
            onNext={() => setStep(7)}
          />
        )}

        {step === 7 && (
          <StepReview
            allocations={allocations}
            themes={themes}
            portfolioName={portfolioName}
            onComplete={handleComplete}
            isSubmitting={completeOnboarding.isPending}
          />
        )}
      </div>
    </div>
  );
}
