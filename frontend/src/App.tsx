import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { OtpLogin } from './pages/auth/OtpLogin';
import { PasswordLogin } from './pages/auth/PasswordLogin';
import { AdminDashboard } from './pages/admin/Dashboard';
import { Employees } from './pages/admin/Employees';
import { EmployeeDetail } from './pages/admin/EmployeeDetail';
import { AdminAttendance } from './pages/admin/Attendance';
import { AdminLeave } from './pages/admin/Leave';
import { Payroll } from './pages/admin/Payroll';
import { ApprovalsInbox } from './pages/shared/ApprovalsInbox';
import { SimpleListPage } from './components/SimpleListPage';
import { TeamDashboard } from './pages/manager/TeamDashboard';
import { EssHome } from './pages/ess/Home';
import { MyAttendance } from './pages/ess/MyAttendance';
import { MyLeave } from './pages/ess/MyLeave';
import { MyPayslips } from './pages/ess/MyPayslips';

const ADMIN_ROLES = ['HR Admin', 'Finance', 'Platform Admin'];

const adminNav = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/employees', label: 'Employees' },
  { to: '/admin/attendance', label: 'Attendance' },
  { to: '/admin/leave', label: 'Leave' },
  { to: '/admin/payroll', label: 'Payroll' },
  { to: '/admin/recruitment', label: 'Recruitment' },
  { to: '/admin/performance', label: 'Performance' },
  { to: '/admin/assets', label: 'Assets' },
  { to: '/admin/exit', label: 'Exit' },
  { to: '/admin/learning', label: 'Learning' },
  { to: '/admin/engagement', label: 'Engagement' },
  { to: '/admin/approvals', label: 'Approvals' },
];

const managerNav = [
  { to: '/manager', label: 'My Team' },
  { to: '/manager/approvals', label: 'Approvals' },
];

const essNav = [
  { to: '/ess', label: 'Home' },
  { to: '/ess/attendance', label: 'My Attendance' },
  { to: '/ess/leave', label: 'My Leave' },
  { to: '/ess/payslips', label: 'My Payslips' },
];

function RoleHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (ADMIN_ROLES.includes(user.roleName)) return <Navigate to="/admin" replace />;
  if (user.roleName === 'Manager') return <Navigate to="/manager" replace />;
  return <Navigate to="/ess" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<OtpLogin />} />
      <Route path="/login/password" element={<PasswordLogin />} />
      <Route path="/" element={<RoleHome />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={ADMIN_ROLES}>
            <Layout navItems={adminNav} title="HRMS Admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/:id" element={<EmployeeDetail />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="leave" element={<AdminLeave />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="recruitment" element={<SimpleListPage title="Recruitment — Job Requisitions" path="/job-requisitions" columns={['title', 'status', 'headcount', 'employmentType']} />} />
        <Route path="performance" element={<SimpleListPage title="Performance — Review Cycles" path="/review-cycles" columns={['name', 'status', 'periodStart', 'periodEnd']} />} />
        <Route path="assets" element={<SimpleListPage title="Assets" path="/assets" columns={['assetTag', 'type', 'status', 'makeModel']} />} />
        <Route path="exit" element={<SimpleListPage title="Exit Requests" path="/exit-requests" columns={['status', 'resignationDate', 'lastWorkingDay']} />} />
        <Route path="learning" element={<SimpleListPage title="Learning — Courses" path="/courses" columns={['title', 'category', 'isMandatory', 'isActive']} />} />
        <Route path="engagement" element={<SimpleListPage title="Announcements" path="/announcements" columns={['title', 'audience', 'publishedAt']} />} />
        <Route path="approvals" element={<ApprovalsInbox />} />
      </Route>

      <Route
        path="/manager"
        element={
          <ProtectedRoute roles={['Manager']}>
            <Layout navItems={managerNav} title="Manager" />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeamDashboard />} />
        <Route path="approvals" element={<ApprovalsInbox />} />
      </Route>

      <Route
        path="/ess"
        element={
          <ProtectedRoute roles={['Employee', 'Manager']}>
            <Layout navItems={essNav} title="My HRMS" />
          </ProtectedRoute>
        }
      >
        <Route index element={<EssHome />} />
        <Route path="attendance" element={<MyAttendance />} />
        <Route path="leave" element={<MyLeave />} />
        <Route path="payslips" element={<MyPayslips />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
