import { Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "@/contexts/UserContext";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { usePortfolios } from "@/hooks/use-portfolios";
import { useUser } from "@/hooks/use-user";
import { TosModal } from "@/components/legal/tos-modal";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import AnalysisPage from "@/pages/analysis";
import ReportsPage from "@/pages/reports";
import OnboardingPage from "@/pages/onboarding";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useUserContext();
  const { data: portfolios, isLoading: portfoliosLoading } = usePortfolios();

  if (isAuthenticated && portfoliosLoading) return null;

  if (isAuthenticated && portfolios && portfolios.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function TosGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useUserContext();
  const { data: user } = useUser();
  const [accepted, setAccepted] = useState(false);
  const qc = useQueryClient();

  if (!isAuthenticated || !user) return <>{children}</>;
  if (user.accepted_tos || accepted) return <>{children}</>;

  return (
    <>
      {children}
      <TosModal
        onAccepted={() => {
          setAccepted(true);
          qc.invalidateQueries({ queryKey: ["user-profile"] });
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <TosGuard>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            element={
              <OnboardingGuard>
                <AppLayout />
              </OnboardingGuard>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Routes>
    </TosGuard>
  );
}
