import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { AuthProvider, UserDataProvider, useAuth, useUserData } from "./app/providers";
import { ErrorState, PageSkeleton } from "./components/ui";
import { ToastProvider } from "./components/ui/toast";
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage } from "./features/auth/AuthPages";

const OnboardingPage = lazy(() => import("./features/onboarding/OnboardingPage"));
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage"));
const WorkoutsPage = lazy(() => import("./features/workouts/WorkoutsPage"));
const SessionPage = lazy(() => import("./features/workouts/SessionPage"));
const ExerciseLibraryPage = lazy(() => import("./features/exercises/ExerciseLibraryPage"));
const ExerciseDetailPage = lazy(() => import("./features/exercises/ExerciseDetailPage"));
const NutritionPage = lazy(() => import("./features/nutrition/NutritionPage"));
const ProgressPage = lazy(() => import("./features/progress/ProgressPage"));
const CoachPage = lazy(() => import("./features/coach/CoachPage"));
const CyclePage = lazy(() => import("./features/cycle/CyclePage"));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage"));

function FullScreenLoader() {
  return <div className="mx-auto max-w-3xl p-6"><PageSkeleton /></div>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RequireProfile({ onboarding }: { onboarding: "required" | "pending" }) {
  const { bundle, loading, error, refresh } = useUserData();
  if (loading && !bundle) return <FullScreenLoader />;
  if (error || !bundle) return <div className="mx-auto max-w-lg p-6"><ErrorState message={error ?? "No se pudo cargar tu perfil."} onRetry={refresh} /></div>;
  if (onboarding === "required" && !bundle.profile.onboarding_completed) return <Navigate to="/onboarding" replace />;
  if (onboarding === "pending" && bundle.profile.onboarding_completed) return <Navigate to="/" replace />;
  return <Outlet />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, ready, passwordRecovery } = useAuth();
  if (!ready) return <FullScreenLoader />;
  if (user && !passwordRecovery) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <UserDataProvider>
            <Suspense fallback={<FullScreenLoader />}>
              <Routes>
                <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
                <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
                <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                <Route element={<RequireAuth><Outlet /></RequireAuth>}>
                  <Route element={<RequireProfile onboarding="pending" />}>
                    <Route path="/onboarding" element={<OnboardingPage />} />
                  </Route>
                  <Route element={<RequireProfile onboarding="required" />}>
                    <Route path="/workouts/session/:sessionId" element={<SessionPage />} />
                    <Route element={<AppShell />}>
                      <Route index element={<DashboardPage />} />
                      <Route path="/workouts" element={<WorkoutsPage />} />
                      <Route path="/exercises" element={<ExerciseLibraryPage />} />
                      <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
                      <Route path="/nutrition" element={<NutritionPage />} />
                      <Route path="/progress" element={<ProgressPage />} />
                      <Route path="/coach" element={<CoachPage />} />
                      <Route path="/cycle" element={<CyclePage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </UserDataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
