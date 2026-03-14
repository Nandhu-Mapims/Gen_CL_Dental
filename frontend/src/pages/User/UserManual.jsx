import React, { useState, useMemo } from 'react'

export function UserManual() {
  const [searchQuery, setSearchQuery] = useState('')

  // All manual content organized by sections
  const sections = [
    {
      id: 'login',
      title: 'Login',
      icon: '🔐',
      content: [
        { type: 'text', value: 'Enter your email and password to login. Contact admin if you forgot your password.' },
        { type: 'steps', value: ['Go to login page', 'Enter email and password', 'Click "Login"'] }
      ],
      keywords: ['login', 'password', 'email', 'sign in', 'access', 'credentials']
    },
    {
      id: 'roles',
      title: 'User Roles',
      icon: '👥',
      content: [
        { type: 'roles', value: [
          { role: 'Super Admin', color: 'blue', desc: 'Full system access. Manage users, departments, locations, forms and view all analytics.' },
          { role: 'Staff (Auditor)', color: 'green', desc: 'Submit quality checklists. View own submissions and reports.' },
          { role: 'Supervisor / Dept Admin', color: 'purple', desc: 'Review submissions. Add corrective & preventive actions. View department analytics.' },
          { role: 'QA', color: 'orange', desc: 'View analytics and reports across departments.' }
        ]}
      ],
      keywords: ['role', 'admin', 'staff', 'auditor', 'supervisor', 'qa', 'permission', 'access']
    },
    {
      id: 'submit-checklist',
      title: 'Submit Checklist (Staff / Auditor)',
      icon: '📝',
      content: [
        { type: 'steps', value: [
          'Click the form name in the sidebar navigation (e.g., "Daily Quality Checklist")',
          'Select Department / Service from the dropdown',
          'Select Location (Zone A, Floor 1, Ward, etc.) from the dropdown',
          'Select Shift (Morning, Afternoon, Night)',
          'Answer YES or NO for each checklist item',
          'Add remarks if NO is selected (strongly recommended)',
          'Click "Submit Checklist"'
        ]},
        { type: 'tip', value: 'Audit date and time are set automatically by the system at the moment you submit.' },
        { type: 'warning', value: 'Submissions are locked after submit (cannot edit). Contact admin if a correction is needed.' }
      ],
      keywords: ['submit', 'checklist', 'form', 'location', 'zone', 'floor', 'shift', 'yes', 'no', 'remarks', 'auditor', 'staff', 'department']
    },
    {
      id: 'supervisor-review',
      title: 'Review & Add Actions (Supervisor)',
      icon: '👔',
      content: [
        { type: 'steps', value: [
          'Open "Supervisor Dashboard" from navigation',
          'Browse recent submissions by department and date',
          'View checklist responses (read-only)',
          'Enter Corrective Action in the text field',
          'Enter Preventive Action in the text field',
          'Click "Save" for that row',
          'Staff member receives notification automatically'
        ]},
        { type: 'tip', value: 'Use "Apply to All" to set the same corrective/preventive action for multiple submissions at once.' }
      ],
      keywords: ['supervisor', 'hod', 'review', 'corrective', 'preventive', 'action', 'dashboard']
    },
    {
      id: 'submissions-report',
      title: 'Submissions Report',
      icon: '📋',
      content: [
        { type: 'steps', value: [
          'Click "Submissions Report" in navigation',
          'Filter by department, location, shift, or date range',
          'Browse and select any submission row to view details',
          'View the complete audit report for that session',
          'Use "Export to PDF" or "Print" as needed'
        ]},
        { type: 'table', value: {
          headers: ['Column', 'Description'],
          rows: [
            ['Checklist Item', 'The quality audit question'],
            ['YES / NO', 'Staff response'],
            ['Remarks', 'Comments (if NO)'],
            ['Corrective Action', 'Added by Supervisor'],
            ['Preventive Action', 'Added by Supervisor']
          ]
        }}
      ],
      keywords: ['report', 'submissions', 'date', 'time', 'print', 'pdf', 'export', 'filter']
    },
    {
      id: 'department-logs',
      title: 'Department Logs',
      icon: '📊',
      content: [
        { type: 'text', value: 'View all audit submissions for your department. Filter by date, location, or shift to narrow down results.' },
        { type: 'steps', value: [
          'Click "Department Logs" in navigation',
          'Use filters (department, date, location, shift) to find submissions',
          'Click on any submission row to open the preview modal',
          'View checklist responses, remarks, and corrective/preventive actions',
          'Use "Close" to exit the preview'
        ]}
      ],
      keywords: ['department', 'logs', 'view', 'submissions', 'filter', 'preview', 'location', 'zone', 'date', 'shift']
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: '🔔',
      content: [
        { type: 'text', value: 'Staff receive notifications when Supervisors add corrective/preventive actions to their submissions.' },
        { type: 'steps', value: [
          'Bell icon shows unread count',
          'Click bell to view notifications',
          'Click notification to mark as read',
          '"Mark all read" clears all'
        ]}
      ],
      keywords: ['notification', 'bell', 'alert', 'unread', 'message']
    },
    {
      id: 'admin-departments',
      title: 'Manage Departments (Admin)',
      icon: '🏢',
      content: [
        { type: 'text', value: 'Navigate to: Configure → Departments' },
        { type: 'list', value: [
          'Create departments with name and code',
          'Edit department details',
          'Activate or deactivate departments'
        ]}
      ],
      keywords: ['admin', 'department', 'create', 'manage', 'configure']
    },
    {
      id: 'admin-users',
      title: 'Manage Users (Admin)',
      icon: '👤',
      content: [
        { type: 'text', value: 'Navigate to: Configure → Users' },
        { type: 'list', value: [
          'Create users with name, email, password',
          'Assign role: Super Admin, Staff, Supervisor, Dept Admin, or QA',
          'Assign user to a department',
          'Reset passwords or deactivate users'
        ]}
      ],
      keywords: ['admin', 'user', 'create', 'password', 'role', 'manage']
    },
    {
      id: 'admin-forms',
      title: 'Create Forms (Admin)',
      icon: '📄',
      content: [
        { type: 'text', value: 'Navigate to: Create Forms → Forms' },
        { type: 'list', value: [
          'Create form templates with name',
          'Assign to departments',
          'Add checklist items via Form Builder'
        ]},
        { type: 'text', value: 'Navigate to: Create Forms → Form Builder' },
        { type: 'list', value: [
          'Select form template',
          'Add items with labels',
          'Choose type: YES/NO or TEXT',
          'Organize into sections'
        ]}
      ],
      keywords: ['admin', 'form', 'create', 'checklist', 'builder', 'item', 'template']
    },
    {
      id: 'admin-assign',
      title: 'Assign Forms to Users (Admin)',
      icon: '📋',
      content: [
        { type: 'text', value: 'Navigate to: Configure → Assign Forms' },
        { type: 'list', value: [
          'Select a form template',
          'Choose users to assign',
          'Users see assigned forms in navigation'
        ]}
      ],
      keywords: ['admin', 'assign', 'form', 'user', 'access']
    },
    {
      id: 'audit-flow',
      title: 'Quality Audit Flow Overview',
      icon: '🔄',
      content: [
        { type: 'text', value: 'End-to-end quality audit flow: staff submits checklist → system records date/time → supervisor reviews and adds corrective/preventive actions → reports and logs track compliance over time.' },
        { type: 'steps', value: [
          'Admin sets up: creates departments, locations (zones/floors), shifts, form templates, and checklist items.',
          'Admin assigns: assigns forms to departments and users.',
          'Staff submits: selects department, location, shift → answers checklist → submits. System records date and time automatically.',
          'Supervisor reviews: opens Supervisor Dashboard → views submissions → adds corrective/preventive actions → staff is notified.',
          'Reports: Admin/Supervisor views analytics by department, location, shift, or date range.'
        ]}
      ],
      keywords: ['flow', 'quality', 'audit', 'submit', 'report', 'logs', 'date', 'time', 'location', 'zone']
    },
    {
      id: 'locations',
      title: 'Locations (Zones, Floors, Wards)',
      icon: '📍',
      content: [
        { type: 'text', value: 'Locations represent the physical area where an audit is carried out. Admin can create any type: Zone A, Zone B, Zone C, Ground Floor, 1st Floor, ICU Ward, OT, etc.' },
        { type: 'definition', value: [
          { term: 'Zone', desc: 'A named area zone (e.g. Zone A, Zone B, Zone C)' },
          { term: 'Floor', desc: 'A building floor (e.g. Ground Floor, 1st Floor)' },
          { term: 'Ward', desc: 'A hospital ward (e.g. ICU Ward, General Ward)' },
          { term: 'Room / Unit', desc: 'A specific room, bay, or unit within a floor' }
        ]},
        { type: 'tip', value: 'Admin creates locations via Configure → Locations. Staff pick the location when submitting a checklist.' }
      ],
      keywords: ['location', 'zone', 'floor', 'ward', 'room', 'unit', 'area', 'building', 'block']
    },
    {
      id: 'rules',
      title: 'Important Rules',
      icon: '⚠️',
      content: [
        { type: 'rules', value: [
          'Department, Location, and Shift are required when submitting a checklist',
          'Audit date and time are set automatically by the system on submit',
          'Submissions are locked after submit — cannot edit. Contact admin if a correction is needed.',
          'Add remarks when selecting NO (strongly recommended for quality records)',
          'Only Supervisors / Dept Admins can add corrective/preventive actions',
          'Supervisors cannot edit original checklist responses'
        ]}
      ],
      keywords: ['rule', 'important', 'locked', 'edit', 'duplicate', 'remarks', 'date', 'time', 'location']
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      content: [
        { type: 'faq', value: [
          { q: 'Cannot submit — duplicate warning', a: 'A submission already exists for this Department + Location + Shift for the current date. Wait for the 24-hour window or contact admin.' },
          { q: 'No locations available in dropdown', a: 'Ask admin to create locations in Configure → Locations.' },
          { q: 'Form not visible in navigation', a: 'Ask admin to assign the form to your account or department.' },
          { q: 'Cannot edit submitted checklist', a: 'Submissions are locked after submit. Contact your admin if a correction is needed.' },
          { q: 'Page shows error', a: 'Refresh the page. Check your internet connection. Contact admin if the problem persists.' }
        ]}
      ],
      keywords: ['error', 'problem', 'duplicate', 'cannot', 'not working', 'help', 'troubleshoot', 'location', 'form']
    }
  ]

  // Filter sections based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections
    
    const query = searchQuery.toLowerCase()
    return sections.filter(section => {
      // Check title
      if (section.title.toLowerCase().includes(query)) return true
      // Check keywords
      if (section.keywords.some(kw => kw.includes(query))) return true
      // Check content
      const contentStr = JSON.stringify(section.content).toLowerCase()
      if (contentStr.includes(query)) return true
      return false
    })
  }, [searchQuery])

  // Render content based on type
  const renderContent = (item) => {
    switch (item.type) {
      case 'text':
        return <p className="text-slate-700">{item.value}</p>
      
      case 'steps':
        return (
          <ol className="space-y-2">
            {item.value.map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 bg-maroon-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                <span className="text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        )
      
      case 'list':
        return (
          <ul className="space-y-1 ml-4">
            {item.value.map((li, i) => (
              <li key={i} className="text-slate-700 flex gap-2">
                <span className="text-maroon-500">•</span>
                {li}
              </li>
            ))}
          </ul>
        )
      
      case 'warning':
        return (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r">
            <p className="text-amber-800 text-sm"><strong>⚠️ Warning:</strong> {item.value}</p>
          </div>
        )
      
      case 'tip':
        return (
          <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r">
            <p className="text-green-800 text-sm"><strong>💡 Tip:</strong> {item.value}</p>
          </div>
        )
      
      case 'roles':
        return (
          <div className="grid gap-3">
            {item.value.map((r, i) => (
              <div key={i} className={`p-3 rounded-lg border ${
                r.color === 'blue' ? 'bg-maroon-50 border-maroon-200' :
                r.color === 'green' ? 'bg-green-50 border-green-200' :
                'bg-maroon-100 border-maroon-300'
              }`}>
                <span className={`font-bold ${
                  r.color === 'blue' ? 'text-maroon-800' :
                  r.color === 'green' ? 'text-green-800' :
                  'text-maroon-800'
                }`}>{r.role}:</span>
                <span className={`ml-2 ${
                  r.color === 'blue' ? 'text-maroon-700' :
                  r.color === 'green' ? 'text-green-700' :
                  'text-maroon-700'
                }`}>{r.desc}</span>
              </div>
            ))}
          </div>
        )
      
      case 'table':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 border-b w-12">#</th>
                  {item.value.headers.map((h, i) => (
                    <th key={i} className="text-left px-3 py-2 font-semibold text-slate-700 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {item.value.rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-500 font-medium">{i + 1}</td>
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 text-slate-600">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      
      case 'definition':
        return (
          <div className="space-y-2">
            {item.value.map((d, i) => (
              <div key={i} className="bg-slate-50 p-3 rounded border border-slate-200">
                <span className="font-bold text-slate-800">{d.term}:</span>
                <span className="text-slate-600 ml-2">{d.desc}</span>
              </div>
            ))}
          </div>
        )
      
      case 'rules':
        return (
          <div className="space-y-2">
            {item.value.map((rule, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-red-500">❗</span>
                <span className="text-slate-700">{rule}</span>
              </div>
            ))}
          </div>
        )
      
      case 'faq':
        return (
          <div className="space-y-3">
            {item.value.map((f, i) => (
              <div key={i} className="bg-slate-50 p-3 rounded border border-slate-200">
                <p className="font-semibold text-slate-800">Q: {f.q}</p>
                <p className="text-slate-600 mt-1">A: {f.a}</p>
              </div>
            ))}
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">User Manual</h1>
        <p className="mt-1 text-sm text-slate-600">APDCH - Dental General Checklist - Quick Reference Guide</p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 sticky top-0 z-10">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search manual... (e.g., submit, uhid, chief, report)"
            className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200 transition-all text-slate-700"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xl"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-slate-500 mt-2">
            Found {filteredSections.length} result{filteredSections.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        )}
      </div>

      {/* Quick Links (only when not searching) */}
      {!searchQuery && (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <h2 className="font-bold text-slate-700 mb-3">Quick Links</h2>
          <div className="flex flex-wrap gap-2">
            {sections.slice(0, 8).map(section => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="px-3 py-1.5 bg-slate-100 hover:bg-maroon-50 rounded text-sm text-slate-700 hover:text-maroon-700 transition-colors"
              >
                {section.icon} {section.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      {filteredSections.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 border border-slate-200 text-center">
          <p className="text-slate-500 text-lg">No results found for "{searchQuery}"</p>
          <p className="text-slate-400 text-sm mt-2">Try different keywords</p>
        </div>
      ) : (
        filteredSections.map(section => (
          <div
            key={section.id}
            id={section.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">
                {section.title}
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {section.content.map((item, i) => (
                <div key={i}>{renderContent(item)}</div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Footer */}
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center text-sm text-slate-500">
        APDCH - Dental General Checklist • Last Updated: {new Date().toLocaleDateString('en-GB')}
      </div>
    </div>
  )
}
