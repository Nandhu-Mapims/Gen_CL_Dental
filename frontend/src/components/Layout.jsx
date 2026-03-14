import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const bellRef = useRef(null)
  const dropdownRef = useRef(null)

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get('/notifications?limit=10')
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadNotifications()
    }
  }, [open])

  useEffect(() => {
    if (open) {
      const interval = setInterval(() => {
        loadNotifications()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [open])

  useEffect(() => {
    const handler = (event) => {
      if (
        dropdownRef.current &&
        bellRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !bellRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [open])

  const markOneAsRead = async (id) => {
    try {
      await apiClient.post(`/notifications/${id}/read`, {})
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await apiClient.post('/notifications/read-all', {})
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
    }
  }

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => setOpen((prev) => !prev)}
        className={`relative p-2 rounded-full transition-all ${unreadCount > 0
          ? 'bg-red-50 hover:bg-red-100 text-red-600 ring-2 ring-red-300'
          : 'hover:bg-slate-100 text-slate-700'
          }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'No new notifications'}
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 max-w-xs bg-white rounded-lg shadow-lg border border-slate-200 z-50"
        >
          <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Notifications
              </div>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {unreadCount} NEW
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadNotifications}
                disabled={loading}
                className="text-[11px] text-maroon-700 hover:text-maroon-800 font-medium disabled:opacity-50"
                title="Refresh notifications"
              >
                ↻
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-maroon-700 hover:text-maroon-800 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-maroon-600 mb-2"></div>
                <div>Loading notifications...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                <div className="text-2xl mb-2">🔕</div>
                <div>No notifications yet.</div>
                <div className="text-xs text-slate-400 mt-1">You'll be notified when supervisors add actions to your submissions.</div>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => markOneAsRead(n._id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 text-sm transition-all ${n.isRead
                    ? 'bg-white hover:bg-slate-50'
                    : 'bg-maroon-50 hover:bg-maroon-100 border-l-4 border-l-maroon-600'
                    }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-semibold text-slate-800 flex-1">
                      {!n.isRead && <span className="inline-block w-2 h-2 bg-maroon-600 rounded-full mr-2"></span>}
                      {n.title}
                    </div>
                    {n.type === 'action' && (
                      <span className="px-2 py-0.5 bg-maroon-100 text-maroon-700 text-[10px] font-semibold rounded">
                        ACTION
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 text-xs leading-snug mb-2">
                    {n.message}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {n.createdAt
                      ? new Date(n.createdAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      : ''}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Sidebar Menu Item Component
function SidebarMenuItem({ to, icon, label, isActive }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive
        ? 'bg-gradient-to-r from-maroon-600 to-maroon-600 text-white shadow-lg shadow-maroon-500/50'
        : 'text-slate-700 hover:bg-maroon-50 hover:text-maroon-700'
        }`}
    >
      <span className="text-base w-5 text-center">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

// Collapsible Sidebar Section
function SidebarSection({ icon, label, isOpen, onToggle, isActive, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive
          ? 'bg-gradient-to-r from-maroon-600 to-maroon-600 text-white shadow-lg shadow-maroon-500/50'
          : 'text-slate-700 hover:bg-maroon-50 hover:text-maroon-700'
          }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-base w-5 text-center">{icon}</span>
          <span>{label}</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-200 pl-4">
          {children}
        </div>
      )}
    </div>
  )
}

// Sub Menu Item for collapsible sections
function SubMenuItem({ to, icon, label, isActive }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
        ? 'bg-maroon-50 text-maroon-700 border-l-2 border-maroon-600'
        : 'text-slate-600 hover:bg-maroon-50 hover:text-maroon-700'
        }`}
    >
      <span className="text-base w-5 text-center">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

export function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const mainContentRef = useRef(null)
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // #region agent log
  useEffect(() => {
    if (!mainContentRef.current) return
    const el = mainContentRef.current
    const cs = getComputedStyle(el)
    const bodyCs = getComputedStyle(document.body)
    const htmlCs = getComputedStyle(document.documentElement)
    const payload = {
      location: 'Layout.jsx:main-content',
      message: 'Layout main content computed styles',
      data: {
        mainContentTextAlign: cs.textAlign,
        bodyTextAlign: bodyCs.textAlign,
        htmlTextAlign: htmlCs.textAlign,
        documentDir: document.documentElement.getAttribute('dir') || '(not set)',
        pathname: location.pathname,
      },
      timestamp: Date.now(),
      hypothesisId: 'H1-H5',
    }
    fetch('http://127.0.0.1:7242/ingest/d2807f7f-5428-4368-9347-b5373051ed00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => { })
  }, [location.pathname])
  // #endregion
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [configMenuOpen, setConfigMenuOpen] = useState(false)
  const [createFormsMenuOpen, setCreateFormsMenuOpen] = useState(false)
  const [formsMenuOpen, setFormsMenuOpen] = useState(false)
  const [userForms, setUserForms] = useState([])

  const isActive = (path) => location.pathname === path

  const isConfigActive = () => {
    return isActive('/admin/departments') || isActive('/admin/users') || isActive('/admin/assign-forms') || isActive('/admin/ward-list') || isActive('/admin/unit-list') || isActive('/admin/master-data')
  }

  const isCreateFormsActive = () => {
    return isActive('/admin/forms') || isActive('/admin/checklists')
  }

  const isFormsActive = () => {
    return userForms.some(form => location.pathname === `/form/${form._id}`)
  }

  useEffect(() => {
    const loadUserForms = async () => {
      if (['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(user?.role)) {
        try {
          const accessibleForms = await apiClient.get('/form-templates/accessible/list')
          setUserForms(accessibleForms)
          if (accessibleForms.length > 1) setFormsMenuOpen(true)
        } catch (err) {
          console.error('Error loading user forms:', err)
          setUserForms([])
        }
      }
    }
    loadUserForms()
  }, [user])

  // Auto-expand sections based on current route
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const timer = setTimeout(() => {
      if (isConfigActive()) setConfigMenuOpen(true)
      if (isCreateFormsActive()) setCreateFormsMenuOpen(true)
      if (isFormsActive()) setFormsMenuOpen(true)
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-gradient-to-br from-maroon-50 via-maroon-50 to-pink-50">
      {/* Top Header - height fits logo without clipping */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-lg border-b border-maroon-200/50 z-50 min-h-[5rem] h-24">
        <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-100 transition-colors lg:hidden"
            >
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link to="/" className="flex items-center gap-4 group flex-shrink-0 min-w-0">
              <span className="flex items-center justify-center flex-shrink-0 w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20">
                <img
                  src="/Logo-Checklist.png"
                  alt="APDCH - Dental General Checklist"
                  className="max-h-full max-w-full w-auto object-contain animate-logo-fade-in animate-logo-breathe animate-logo-glow group-hover:scale-105 transition-transform  origin-center"
                />
              </span>
              <div className="hidden sm:block min-w-0">
                <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                  APDCH - Dental General Checklist
                </h1>
                <p className="text-xs text-slate-500">
                  Dental General Checklist
                </p>
              </div>
            </Link>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              {/* Notifications for auditors and chiefs */}
              {['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(user.role) && (
                <NotificationBell />
              )}
              <div className="hidden md:flex items-center gap-3 pr-3 border-r border-slate-200">
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                  <div className="flex items-center justify-end gap-2 mt-0.5">
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-maroon-600 to-maroon-600 text-white shadow-sm">
                      {user.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : user.role === 'DEPT_ADMIN' ? 'DEPT ADMIN' : user.role === 'SUPERVISOR' ? 'SUPERVISOR' : user.role === 'QA' ? 'QA' : 'STAFF'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-maroon-50 to-maroon-50 hover:from-maroon-100 hover:to-maroon-100 text-maroon-700 text-sm font-medium transition-all border border-maroon-200 shadow-sm hover:shadow-md"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex pt-24">
        {/* Sidebar - shown for everyone (including login) */}
        <>
          {/* Backdrop for mobile */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/20 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside className={`fixed left-0 top-24 bottom-0 w-72 bg-white/95 backdrop-blur-md shadow-xl border-r border-maroon-200/50 z-40 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } lg:translate-x-0`}>
            <div className="flex flex-col h-full">
              {/* Content when user is logged in */}
              {user ? (
                <>
                  {/* User Info (Mobile) */}
                  <div className="md:hidden p-4 border-b border-maroon-200 bg-gradient-to-r from-maroon-50 via-maroon-50 to-pink-50">
                    <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-maroon-600 to-maroon-600 text-white shadow-sm">
                        {user.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : user.role === 'DEPT_ADMIN' ? 'DEPT ADMIN' : user.role === 'SUPERVISOR' ? 'SUPERVISOR' : user.role === 'QA' ? 'QA' : 'STAFF'}
                      </span>
                      {user.department && (
                        <span className="text-[10px] text-slate-500">
                          {user.department.name || user.department}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Navigation */}
                  <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isSuperAdmin ? (
                      <>
                        {/* Admin Navigation */}
                        <div className="mb-4">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
                            Main menu
                          </div>
                          <SidebarMenuItem
                            to="/admin/dashboard"
                            icon="📊"
                            label="Dashboard"
                            isActive={isActive('/admin/dashboard')}
                          />
                          <SidebarMenuItem
                            to="/admin/analytics"
                            icon="✅"
                            label="Analytics"
                            isActive={isActive('/admin/analytics')}
                          />
                          <SidebarMenuItem
                            to="/admin/chief-analytics"
                            icon="👔"
                            label="Supervisor Analytics"
                            isActive={isActive('/admin/chief-analytics')}
                          />
                          <SidebarMenuItem
                            to="/admin/submissions-report"
                            icon="📋"
                            label="Submissions Report"
                            isActive={isActive('/admin/submissions-report')}
                          />
                          <SidebarMenuItem
                            to="/admin/department-logs"
                            icon="📈"
                            label="Department Logs"
                            isActive={isActive('/admin/department-logs')}
                          />
                        </div>

                        <div className="mb-4">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
                            Form management
                          </div>
                          <SidebarSection
                            icon="📝"
                            label="Create Forms"
                            isOpen={createFormsMenuOpen}
                            onToggle={() => setCreateFormsMenuOpen(!createFormsMenuOpen)}
                            isActive={isCreateFormsActive() && !createFormsMenuOpen}
                          >
                            <SubMenuItem
                              to="/admin/forms"
                              icon="📋"
                              label="Forms"
                              isActive={isActive('/admin/forms')}
                            />
                            <SubMenuItem
                              to="/admin/checklists"
                              icon="✏️"
                              label="Form Builder"
                              isActive={isActive('/admin/checklists')}
                            />
                          </SidebarSection>
                        </div>

                        <div className="mb-4">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
                            Configuration
                          </div>
                          <SidebarSection
                            icon="⚙️"
                            label="Configure"
                            isOpen={configMenuOpen}
                            onToggle={() => setConfigMenuOpen(!configMenuOpen)}
                            isActive={isConfigActive() && !configMenuOpen}
                          >
                            <SubMenuItem
                              to="/admin/departments"
                              icon="🏢"
                              label="Departments"
                              isActive={isActive('/admin/departments')}
                            />
                            <SubMenuItem
                              to="/admin/users"
                              icon="👥"
                              label="Users"
                              isActive={isActive('/admin/users')}
                            />
                            <SubMenuItem
                              to="/admin/assign-forms"
                              icon="📋"
                              label="Assign forms"
                              isActive={isActive('/admin/assign-forms')}
                            />

                            <SubMenuItem
                              to="/admin/master-data"
                              icon="📌"
                              label="Designations"
                              isActive={isActive('/admin/master-data')}
                            />
                          </SidebarSection>
                        </div>

                        <div className="mb-4">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
                            Help
                          </div>
                          <SidebarMenuItem
                            to="/user-manual"
                            icon="📖"
                            label="User Manual"
                            isActive={isActive('/user-manual')}
                          />
                          <SidebarMenuItem
                            to="/change-password"
                            icon="🔐"
                            label="Change password"
                            isActive={isActive('/change-password')}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {user.role === 'STAFF' && (
                          <div className="mb-4">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">My dashboard</div>
                            <SidebarMenuItem to="/auditor/dashboard" icon="🗂️" label="My Dashboard" isActive={isActive('/auditor/dashboard')} accentColor="green" />
                            <SidebarMenuItem to="/auditor/analytics" icon="📊" label="My Analytics" isActive={isActive('/auditor/analytics')} accentColor="green" />
                          </div>
                        )}
                        {(user.role === 'SUPERVISOR' || user.role === 'DEPT_ADMIN') && (
                          <div className="mb-4">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">Supervisor</div>
                            <SidebarMenuItem to="/chief/dashboard" icon="👔" label="Supervisor Dashboard" isActive={isActive('/chief/dashboard')} accentColor="maroon" />
                            <SidebarMenuItem to="/chief/analytics" icon="📊" label="Analytics" isActive={isActive('/chief/analytics')} accentColor="maroon" />
                            <SidebarMenuItem to="/chief/doctor-performance" icon="🏆" label="Staff Performance" isActive={isActive('/chief/doctor-performance')} accentColor="maroon" />
                          </div>
                        )}

                        {/* Forms Section */}
                        {userForms.length > 0 && (
                          <div className="mb-4">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
                              Submit forms
                            </div>
                            {userForms.length === 1 ? (
                              <SidebarMenuItem
                                to={`/form/${userForms[0]._id}`}
                                icon="📝"
                                label={userForms[0].name}
                                isActive={location.pathname === `/form/${userForms[0]._id}`}
                              />
                            ) : (
                              <SidebarSection
                                icon="📝"
                                label="Available Forms"
                                isOpen={formsMenuOpen}
                                onToggle={() => setFormsMenuOpen(!formsMenuOpen)}
                                isActive={isFormsActive() && !formsMenuOpen}
                              >
                                {userForms.map((form) => (
                                  <SubMenuItem
                                    key={form._id}
                                    to={`/form/${form._id}`}
                                    icon="📄"
                                    label={form.name}
                                    isActive={location.pathname === `/form/${form._id}`}
                                  />
                                ))}
                              </SidebarSection>
                            )}
                          </div>
                        )}

                        {/* Reports Section */}
                        <div className="mb-4">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
                            Reports
                          </div>
                          <SidebarMenuItem
                            to="/admin/submissions-report"
                            icon="📋"
                            label="Submissions Report"
                            isActive={isActive('/admin/submissions-report')}
                          />
                          <SidebarMenuItem
                            to="/admin/department-logs"
                            icon="📈"
                            label={user.role === 'chief' ? 'Department Logs (HOD)' : 'Department Logs'}
                            isActive={isActive('/admin/department-logs')}
                          />
                        </div>

                        {/* Help Section */}
                        <div className="mb-4">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
                            Help
                          </div>
                          <SidebarMenuItem
                            to="/user-manual"
                            icon="📖"
                            label="User Manual"
                            isActive={isActive('/user-manual')}
                          />
                          <SidebarMenuItem
                            to="/change-password"
                            icon="🔐"
                            label="Change password"
                            isActive={isActive('/change-password')}
                          />
                        </div>
                      </>
                    )}
                  </nav>
                </>
              ) : (
                /* Content when user is NOT logged in (login page) */
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div>
                    <div className="mb-6">
                      <img
                        src="/Logo-Checklist.png"
                        alt="APDCH - Dental General Checklist"
                        className="h-28 sm:h-36 w-auto object-contain mb-3 animate-logo-fade-in animate-logo-breathe animate-logo-glow"
                      />
                      <h2 className="text-xl font-semibold text-slate-900">
                        APDCH - Dental General Checklist
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        Secure login for Admin, Supervisor and Staff Auditors.
                      </p>
                    </div>

                    <div className="space-y-3 text-sm text-slate-600">
                      <div className="font-semibold text-slate-700">
                        Quick steps:
                      </div>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Enter your email and password to login.</li>
                        <li>Role-based dashboard will open after login.</li>
                        <li>Use the sidebar to navigate checklists and reports.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-8 text-xs text-slate-400">
                    Need help? Contact your Administrator.
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="p-4 border-t border-maroon-200 bg-gradient-to-r from-maroon-50/50 to-maroon-50/50">
                <div className="text-xs text-maroon-600 text-center font-medium">
                  APDCH - Dental General Checklist v1.0
                </div>
              </div>
            </div>
          </aside>
        </>

        {/* Main Content */}
        <main className={`flex-1 min-w-0 overflow-auto transition-all duration-300 ${user ? 'lg:ml-72' : ''}`}>
          <div ref={mainContentRef} className="p-4 sm:p-6 md:p-8 max-w-[100rem] w-full mx-auto min-h-[calc(100vh-6rem)] text-left min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
