import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export function DepartmentSelect() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    ;(async () => {
      // Admin is redirected to /admin/dashboard by HomeRedirect; no need to fetch here
      if (user.role === 'admin') {
        setLoading(false)
        return
      }

      // Regular users will see forms in the navigation menu
      setLoading(false)
    })()
  }, [user])

  // If regular user without department assignment, show message
  if ((user?.role === 'auditor' || user?.role === 'chief') && !user?.department) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">No Department Assigned</h2>
        <p className="text-slate-600">
          Your account is not assigned to any department. Please contact your administrator.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  // For regular users, show message that forms are in the menu
  if ((user?.role === 'auditor' || user?.role === 'chief') && user?.department) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-4xl mb-4">📝</div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Welcome!</h2>
        <p className="text-slate-600">
          Please select a form from the navigation menu above to get started.
        </p>
      </div>
    )
  }

  // This should only show for admin users
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-800">Select Department</h2>
      <p className="text-slate-600">Choose a department to fill audit forms</p>
    </div>
  )
}


