import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { DepartmentManagement } from './pages/Admin/DepartmentManagement'
import { FormBuilder } from './pages/Admin/FormBuilder'
import { FormBuilderWithSections } from './pages/Admin/FormBuilderWithSections'
import { SimpleFormBuilder } from './pages/Admin/SimpleFormBuilder'
import { FormTemplateManagement } from './pages/Admin/FormTemplateManagement'
import { UserManagement } from './pages/Admin/UserManagement'
import { FormUserAssignment } from './pages/Admin/FormUserAssignment'
import { ChiefDashboard } from './pages/Chief/ChiefDashboard'
import { ChiefAnalytics } from './pages/Chief/ChiefAnalytics'
import { ChiefDoctorPerformance } from './pages/Chief/ChiefDoctorPerformance'
import { AuditorDashboard } from './pages/Auditor/AuditorDashboard'
import { AuditorAnalytics } from './pages/Auditor/AuditorAnalytics'
import { Dashboard } from './pages/Admin/Dashboard'
import { Analytics } from './pages/Admin/Analytics'
import { ChiefAnalytics as AdminChiefAnalytics } from './pages/Admin/ChiefAnalytics'
import { PatientReport } from './pages/Admin/PatientReport'
import { DepartmentLogs } from './pages/Admin/DepartmentLogs'
import { MasterDataManagement } from './pages/Admin/MasterDataManagement'
import { LocationManagement } from './pages/Admin/LocationManagement'
import { WardListManagement } from './pages/Admin/WardListManagement'
import { UnitListManagement } from './pages/Admin/UnitListManagement'
import { Form } from './pages/User/Form'
import { UserManual } from './pages/User/UserManual'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomeRedirect } from './components/HomeRedirect'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ProtectedRoute roles={['STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA', 'SUPER_ADMIN']}><ChangePasswordPage /></ProtectedRoute>} />

          <Route path="/admin/departments" element={<ProtectedRoute roles={['SUPER_ADMIN']}><DepartmentManagement /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['SUPER_ADMIN']}><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/assign-forms" element={<ProtectedRoute roles={['SUPER_ADMIN']}><FormUserAssignment /></ProtectedRoute>} />

          <Route path="/chief/dashboard" element={<ProtectedRoute roles={['SUPER_ADMIN', 'SUPERVISOR', 'DEPT_ADMIN']}><ChiefDashboard /></ProtectedRoute>} />
          <Route path="/chief/analytics" element={<ProtectedRoute roles={['SUPER_ADMIN', 'SUPERVISOR', 'DEPT_ADMIN']}><ChiefAnalytics /></ProtectedRoute>} />
          <Route path="/chief/doctor-performance" element={<ProtectedRoute roles={['SUPER_ADMIN', 'SUPERVISOR', 'DEPT_ADMIN']}><ChiefDoctorPerformance /></ProtectedRoute>} />

          <Route path="/auditor/dashboard" element={<ProtectedRoute roles={['SUPER_ADMIN', 'STAFF', 'QA']}><AuditorDashboard /></ProtectedRoute>} />
          <Route path="/auditor/analytics" element={<ProtectedRoute roles={['SUPER_ADMIN', 'STAFF', 'QA']}><AuditorAnalytics /></ProtectedRoute>} />

          <Route path="/admin/forms" element={<ProtectedRoute roles={['SUPER_ADMIN']}><FormTemplateManagement /></ProtectedRoute>} />
          <Route path="/admin/checklists" element={<ProtectedRoute roles={['SUPER_ADMIN']}><SimpleFormBuilder /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={['SUPER_ADMIN', 'QA']}><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute roles={['SUPER_ADMIN', 'QA']}><Analytics /></ProtectedRoute>} />
          <Route path="/admin/chief-analytics" element={<ProtectedRoute roles={['SUPER_ADMIN']}><AdminChiefAnalytics /></ProtectedRoute>} />

          <Route path="/admin/submissions-report" element={<ProtectedRoute roles={['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']}><PatientReport /></ProtectedRoute>} />
          <Route path="/admin/patient-report" element={<Navigate to="/admin/submissions-report" replace />} />
          <Route path="/admin/department-logs" element={<ProtectedRoute roles={['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']}><DepartmentLogs /></ProtectedRoute>} />
          <Route path="/admin/locations" element={<ProtectedRoute roles={['SUPER_ADMIN']}><LocationManagement /></ProtectedRoute>} />
          <Route path="/admin/master-data" element={<ProtectedRoute roles={['SUPER_ADMIN']}><MasterDataManagement /></ProtectedRoute>} />
          <Route path="/admin/ward-list" element={<ProtectedRoute roles={['SUPER_ADMIN']}><WardListManagement /></ProtectedRoute>} />
          <Route path="/admin/unit-list" element={<ProtectedRoute roles={['SUPER_ADMIN']}><UnitListManagement /></ProtectedRoute>} />

          <Route path="/form/:formTemplateId" element={<ProtectedRoute roles={['SUPER_ADMIN', 'STAFF', 'SUPERVISOR', 'DEPT_ADMIN']}><Form /></ProtectedRoute>} />
          <Route path="/user-manual" element={<ProtectedRoute roles={['SUPER_ADMIN', 'STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA']}><UserManual /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute roles={['SUPER_ADMIN', 'STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA']}><HomeRedirect /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
