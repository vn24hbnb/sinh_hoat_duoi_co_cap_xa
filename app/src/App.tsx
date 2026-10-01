import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { UiSettingsProvider } from './contexts/UiSettingsContext'

// Import Pages dynamically
const Overview = React.lazy(() => import('./pages/shared/Overview'))
const Login = React.lazy(() => import('./pages/shared/Login'))
const ChangePassword = React.lazy(() => import('./pages/shared/ChangePassword'))
const NotFound = React.lazy(() => import('./pages/shared/NotFound'))
const GuideFaq = React.lazy(() => import('./pages/shared/GuideFaq'))

const MemberHome = React.lazy(() => import('./pages/member/MemberHome'))
const Attendance = React.lazy(() => import('./pages/member/Attendance'))
const ExamIntro = React.lazy(() => import('./pages/member/ExamIntro'))
const ExamResult = React.lazy(() => import('./pages/member/ExamResult'))
const MemberResults = React.lazy(() => import('./pages/member/MemberResults'))

const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'))
const AdminLiveMap = React.lazy(() => import('./pages/admin/AdminLiveMap'))
const MeetingManager = React.lazy(() => import('./pages/admin/MeetingManager'))
const MemberManager = React.lazy(() => import('./pages/admin/MemberManager'))
const QuestionManager = React.lazy(() => import('./pages/admin/QuestionManager'))
const AdminReports = React.lazy(() => import('./pages/admin/AdminReports'))
const AdminUiSettings = React.lazy(() => import('./pages/admin/AdminUiSettings'))
const AdminAuditLogs = React.lazy(() => import('./pages/admin/AdminAuditLogs'))


// Route Guard to verify authentication
const PrivateRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles
}) => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <LoadingSpinner message="Đang kiểm tra quyền truy cập..." fullScreen />
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Force password change if mustChangePassword is true, EXCEPT when already on /change-password
  // Disabled by user request: all accounts log in directly without forcing password change.
  // if (user.mustChangePassword && window.location.pathname !== '/change-password') {
  //   return <Navigate to="/change-password" replace />
  // }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If not authorized, redirect to root path
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}


export const App: React.FC = () => {
  return (
    <AuthProvider>
      <UiSettingsProvider>
        <BrowserRouter>
          <React.Suspense fallback={<LoadingSpinner message="Đang tải trang..." fullScreen />}>
            <Routes>
              {/* Root redirect route */}
              <Route path="/" element={<Overview />} />

            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/guide" element={<GuideFaq />} />

            {/* Shared Protected Routes */}
            <Route
              path="/change-password"
              element={
                <PrivateRoute>
                  <ChangePassword />
                </PrivateRoute>
              }
            />

            {/* Member Routes */}
            <Route
              path="/member"
              element={
                <PrivateRoute allowedRoles={['member']}>
                  <MemberHome />
                </PrivateRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <PrivateRoute allowedRoles={['member']}>
                  <Attendance />
                </PrivateRoute>
              }
            />
            <Route
              path="/exam"
              element={
                <PrivateRoute allowedRoles={['member']}>
                  <ExamIntro />
                </PrivateRoute>
              }
            />
            <Route
              path="/result"
              element={
                <PrivateRoute allowedRoles={['member']}>
                  <ExamResult />
                </PrivateRoute>
              }
            />
            <Route
              path="/results"
              element={
                <PrivateRoute allowedRoles={['member']}>
                  <MemberResults />
                </PrivateRoute>
              }
            />

            {/* Admin/Organizer Routes */}
            <Route
              path="/admin"
              element={
                <PrivateRoute allowedRoles={['admin', 'organizer']}>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/live-map"
              element={
                <PrivateRoute allowedRoles={['admin', 'organizer']}>
                  <AdminLiveMap />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/meetings"
              element={
                <PrivateRoute allowedRoles={['admin', 'organizer']}>
                  <MeetingManager />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/members"
              element={
                <PrivateRoute allowedRoles={['admin', 'organizer']}>
                  <MemberManager />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/questions"
              element={
                <PrivateRoute allowedRoles={['admin', 'organizer']}>
                  <QuestionManager />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <PrivateRoute allowedRoles={['admin', 'organizer']}>
                  <AdminReports />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/ui-settings"
              element={
                <PrivateRoute allowedRoles={['admin', 'organizer']}>
                  <AdminUiSettings />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <PrivateRoute allowedRoles={['admin', 'organizer']}>
                  <AdminAuditLogs />
                </PrivateRoute>
              }
            />


            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
      </UiSettingsProvider>
    </AuthProvider>
  )
}

export default App
