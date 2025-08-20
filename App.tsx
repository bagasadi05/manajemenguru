
import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import Layout from './components/Layout';
import PwaPrompt from './components/PwaPrompt';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/query-core';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';

// Lazy load pages for code splitting using path aliases
const RoleSelectionPage = lazy(() => import('@/components/pages/RoleSelectionPage'));
const LoginPage = lazy(() => import('@/components/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/components/pages/DashboardPage'));
const AttendancePage = lazy(() => import('@/components/pages/AttendancePage'));
const StudentsPage = lazy(() => import('@/components/pages/StudentsPage'));
const StudentDetailPage = lazy(() => import('@/components/pages/StudentDetailPage'));
const SchedulePage = lazy(() => import('@/components/pages/SchedulePage'));
const SettingsPage = lazy(() => import('@/components/pages/SettingsPage'));
const TasksPage = lazy(() => import('@/components/pages/TasksPage'));
const ReportPage = lazy(() => import('@/components/pages/ReportPage'));
const MassInputPage = lazy(() => import('@/components/pages/MassInputPage'));
const PortalLoginPage = lazy(() => import('@/components/pages/PortalLoginPage'));
const ParentPortalPage = lazy(() => import('@/components/pages/ParentPortalPage'));


// A wrapper for routes that require authentication.
// It shows a loader while checking the session, redirects to login if not authenticated,
// or renders the main Layout with the requested page.
const PrivateRoutes = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return session ? (
    <Layout>
      <Outlet />
    </Layout>
  ) : (
    <Navigate to="/guru-login" replace />
  );
};

const loadingSpinner = (
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <Suspense fallback={loadingSpinner}>
                <HashRouter>
                  <Routes>
                    <Route path="/" element={<RoleSelectionPage />} />
                    <Route path="/guru-login" element={<LoginPage />} />
                    <Route path="/portal-login" element={<PortalLoginPage />} />
                    <Route path="/portal/:studentId" element={<ParentPortalPage />} />
                    
                    <Route element={<PrivateRoutes />}>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/absensi" element={<AttendancePage />} />
                      <Route path="/siswa" element={<StudentsPage />} />
                      <Route path="/siswa/:studentId" element={<StudentDetailPage />} />
                      <Route path="/jadwal" element={<SchedulePage />} />
                      <Route path="/pengaturan" element={<SettingsPage />} />
                      <Route path="/tugas" element={<TasksPage />} />
                      <Route path="/input-massal" element={<MassInputPage />} />
                    </Route>
                    
                    {/* Report page has no main layout */}
                    <Route path="/cetak-rapot/:studentId" element={<ReportPage />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </HashRouter>
              </Suspense>
              <PwaPrompt />
              <OfflineBanner />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;