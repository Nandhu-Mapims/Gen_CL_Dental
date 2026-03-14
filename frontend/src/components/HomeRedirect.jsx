import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DepartmentSelect } from '../pages/User/DepartmentSelect'

export function HomeRedirect() {
  const { user } = useAuth()

  if (user?.role === 'SUPER_ADMIN' || user?.role === 'QA') {
    return <Navigate to="/admin/dashboard" replace />
  }
  if (user?.role === 'STAFF') {
    return <Navigate to="/auditor/dashboard" replace />
  }
  if (user?.role === 'SUPERVISOR' || user?.role === 'DEPT_ADMIN') {
    return <Navigate to="/chief/dashboard" replace />
  }
  return <DepartmentSelect />
}

