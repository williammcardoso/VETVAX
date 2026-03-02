import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { RequireAuth, RequireOnboarding, RequireRole } from "@/components/auth/RouteGuards";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import InviteAccept from "@/pages/InviteAccept";
import NotFound from "@/pages/NotFound";
import AppShell from "@/components/layout/AppShell";
import Dashboard from "@/pages/Dashboard";
import Tutors from "@/pages/Tutors";
import TutorDetail from "@/pages/TutorDetail";
import AppointmentNew from "@/pages/AppointmentNew";
import Reports from "@/pages/Reports";
import Catalog from "@/pages/Catalog";
import Settings from "@/pages/Settings";
import Access from "@/pages/Access";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/invite"
              element={
                <RequireAuth>
                  <InviteAccept />
                </RequireAuth>
              }
            />
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <Onboarding />
                </RequireAuth>
              }
            />

            <Route
              path="/"
              element={
                <RequireAuth>
                  <RequireOnboarding>
                    <AppShell />
                  </RequireOnboarding>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tutors" element={<Tutors />} />
              <Route path="tutors/:id" element={<TutorDetail />} />
              <Route path="appointments/new" element={<AppointmentNew />} />
              <Route path="reports" element={<Reports />} />

              <Route
                path="catalog"
                element={
                  <RequireRole allow={["admin"]}>
                    <Catalog />
                  </RequireRole>
                }
              />
              <Route
                path="settings"
                element={
                  <RequireRole allow={["admin", "manager"]}>
                    <Settings />
                  </RequireRole>
                }
              />
              <Route
                path="access"
                element={
                  <RequireRole allow={["admin"]}>
                    <Access />
                  </RequireRole>
                }
              />
            </Route>

            <Route path="/home" element={<Navigate to="/" replace />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;