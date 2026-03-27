import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "@/contexts/UserContext";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { usePortfolios } from "@/hooks/use-portfolios";
import { useUser } from "@/hooks/use-user";
import { TosModal } from "@/components/legal/tos-modal";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import AnalysisPage from "@/pages/analysis";
import ReportsPage from "@/pages/reports";
import OnboardingPage from "@/pages/onboarding";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import SettingsPage from "@/pages/settings";

function RootPage() {
  const { user, isLoading } = useUserContext();
  if (isLoading) return <div style={{ background: "#0A0A0F", minHeight: "100vh" }} />;
  if (user) return <Navigate to={`/${user.id}/dashboard`} replace />;
  return <LandingPage />;
}

function UserRouteGuard({ children }: { children: React.ReactNode }) {
  const { userId } = useParams<{ userId: string }>();
  const { user, isLoading } = useUserContext();

  if (isLoading) return null;

  if (user && userId && userId !== user.id) {
    return <Navigate to={`/${user.id}/dashboard`} replace />;
  }

  return <>{children}</>;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useUserContext();
  const { data: portfolios, isLoading: portfoliosLoading } = usePortfolios();
  const { data: userProfile, isLoading: profileLoading } = useUser();

  if (isAuthenticated && (portfoliosLoading || profileLoading)) return null;

  if (isAuthenticated && user) {
    const needsOnboarding =
      (portfolios && portfolios.length === 0) ||
      (userProfile && !userProfile.is_onboarded);
    if (needsOnboarding) {
      return <Navigate to={`/${user.id}/onboarding`} replace />;
    }
  }

  return <>{children}</>;
}

function ThemeSync() {
  const { data: userProfile } = useUser();
  const { setTheme } = useTheme();
  useEffect(() => {
    if (userProfile?.theme) setTheme(userProfile.theme as Theme);
  }, [userProfile?.theme, setTheme]);
  return null;
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
      <ThemeSync />
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/:userId/onboarding" element={<UserRouteGuard><OnboardingPage /></UserRouteGuard>} />
          <Route
            path="/:userId"
            element={
              <UserRouteGuard>
                <OnboardingGuard>
                  <AppLayout />
                </OnboardingGuard>
              </UserRouteGuard>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="analysis/*" element={<AnalysisPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </TosGuard>
  );
}
