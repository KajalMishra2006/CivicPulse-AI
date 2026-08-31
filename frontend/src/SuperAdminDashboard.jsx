import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { subscribeAllIssues } from './firebase/issues.js'
import {
  subscribeScopedVerificationRequests,
  approveEmployeeHierarchy,
  rejectVerificationRequest
} from './firebase/verification.js'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase/config.js'
import { GEOGRAPHIC_HIERARCHY, getAllStates } from './utils/locations.js'
import './App.css'

function SuperAdminDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()

  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'state_admins' | 'complaints' | 'citizens' | 'employees'
  const [issues, setIssues] = useState([])
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  // Geographic filter
  const [filterState, setFilterState] = useState('All')

  // Approval Modal State
  const [approvingReq, setApprovingReq] = useState(null)
  const [assignedState, setAssignedState] = useState('Maharashtra')
  const [processingId, setProcessingId] = useState(null)
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')
  // Request filter within tab
  const [requestFilter, setRequestFilter] = useState('pending') // 'pending' | 'approved' | 'rejected' | 'all'

  useEffect(() => {
    // 1. Subscribe to all issues
    const unsubIssues = subscribeAllIssues(
      (allIssues) => {
        setIssues(allIssues)
        setLoading(false)
      },
      (err) => {
        console.error('Super Admin Issues Error:', err)
        setLoading(false)
      }
    )

    // 2. Subscribe to all users
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const allUsers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setUsers(allUsers)
      },
      (err) => console.error('Super Admin Users Error:', err)
    )

    // 3. Subscribe to verification requests
    console.log('[SUPER ADMIN] Loading verification requests...')
    console.log('[SUPER ADMIN] Current UID:', currentUser?.uid)
    console.log('[SUPER ADMIN] Current role:', userProfile?.role)

    const unsubReqs = subscribeScopedVerificationRequests(
      { role: 'super_admin' },
      (allReqs) => {
        setRequests(allReqs)
        const pendingCount = allReqs.filter((r) => {
          const role = (r.requestedRole || '').toUpperCase().replace(/[\s-]/g, '_')
          const type = (r.employeeType || '').toUpperCase().replace(/[\s-]/g, '_')
          return (role === 'STATE_ADMIN' || type === 'STATE_ADMIN') && (r.status || 'pending').toLowerCase() === 'pending'
        }).length
        console.log('[DASHBOARD]')
        console.log('Loading verification requests...')
        console.log('Found requests:', allReqs.length)
        console.log('State admin pending count:', pendingCount)
      },
      (err) => {
        console.error('[SUPER ADMIN] Firestore error:', err)
        setActionError(`Failed to load verification requests: ${err.message}`)
      }
    )

    return () => {
      unsubIssues()
      unsubUsers()
      unsubReqs()
    }
  }, [currentUser, userProfile])

  // Geographic counts
  const allStatesList = getAllStates()
  const totalStatesCount = allStatesList.length
  let totalDistrictsCount = 0
  let totalTalukasCount = 0

  Object.values(GEOGRAPHIC_HIERARCHY).forEach((st) => {
    const dists = Object.values(st.districts)
    totalDistrictsCount += dists.length
    dists.forEach((d) => {
      totalTalukasCount += (d.talukas || []).length
    })
  })

  // User category breakdowns
  const citizens = users.filter((u) => u.role === 'citizen' || !u.role)
  const verifiedCitizensCount = citizens.filter((c) => c.identityVerificationStatus === 'verified' || c.verified).length
  const employees = users.filter((u) => u.role && u.role !== 'citizen')
  const citizenAccessEmployees = employees.filter((e) => e.role === 'citizen_access_employee' || e.employeeType === 'CITIZEN_ACCESS')
  const issueResolutionEmployees = employees.filter((e) => e.role === 'issue_resolution_employee' || e.employeeType === 'ISSUE_RESOLUTION')
  const stateAdmins = employees.filter((e) => e.role === 'state_admin')
  const districtAdmins = employees.filter((e) => e.role === 'district_admin')

  // Issue KPIs
  const totalComplaints = issues.length
  const pendingComplaints = issues.filter((i) => (i.status || 'Pending').toLowerCase() === 'pending').length
  const inProgressComplaints = issues.filter((i) => (i.status || '').toLowerCase() === 'in progress').length
  const resolvedComplaints = issues.filter((i) => (i.status || '').toLowerCase() === 'resolved').length
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0

  // State-wise resolution performance table & charts
  const statePerformance = useMemo(() => {
    const statesMap = {}
    allStatesList.forEach((s) => {
      statesMap[s.id] = { name: s.name, total: 0, resolved: 0, pending: 0, inProgress: 0, citizens: 0, employees: 0 }
    })

    issues.forEach((i) => {
      const sId = i.stateId || (i.state || '').toLowerCase()
      if (statesMap[sId]) {
        statesMap[sId].total++
        const st = (i.status || 'Pending').toLowerCase()
        if (st === 'resolved') statesMap[sId].resolved++
        else if (st === 'in progress') statesMap[sId].inProgress++
        else statesMap[sId].pending++
      }
    })

    citizens.forEach((c) => {
      const sId = c.stateId || (c.state || '').toLowerCase()
      if (statesMap[sId]) statesMap[sId].citizens++
    })

    employees.forEach((e) => {
      const sId = e.stateId || (e.state || '').toLowerCase()
      if (statesMap[sId]) statesMap[sId].employees++
    })

    return Object.values(statesMap).map((item) => ({
      ...item,
      rate: item.total > 0 ? Math.round((item.resolved / item.total) * 100) : 0
    })).sort((a, b) => b.total - a.total)
  }, [issues, citizens, employees, allStatesList])

  // State Admin Applications (Nationwide)
  const stateAdminRequests = useMemo(() => {
    return requests.filter((r) => {
      const role = (r.requestedRole || '').toUpperCase().replace(/[\s-]/g, '_')
      const type = (r.employeeType || '').toUpperCase().replace(/[\s-]/g, '_')
      return role === 'STATE_ADMIN' || type === 'STATE_ADMIN'
    })
  }, [requests])

  const pendingStateAdminRequests = useMemo(() => {
    return stateAdminRequests.filter((r) => (r.status || 'pending').toLowerCase() === 'pending')
  }, [stateAdminRequests])

  const approvedStateAdminRequests = useMemo(() => {
    return stateAdminRequests.filter((r) => (r.status || '').toLowerCase() === 'approved')
  }, [stateAdminRequests])

  const rejectedStateAdminRequests = useMemo(() => {
    return stateAdminRequests.filter((r) => (r.status || '').toLowerCase() === 'rejected')
  }, [stateAdminRequests])

  const displayedStateAdminRequests = useMemo(() => {
    if (requestFilter === 'pending') return pendingStateAdminRequests
    if (requestFilter === 'approved') return approvedStateAdminRequests
    if (requestFilter === 'rejected') return rejectedStateAdminRequests
    return stateAdminRequests
  }, [requestFilter, pendingStateAdminRequests, approvedStateAdminRequests, rejectedStateAdminRequests, stateAdminRequests])

  async function handleConfirmApproveStateAdmin(e) {
    e.preventDefault()
    if (!approvingReq) return

    setActionError('')
    setActionSuccess('')
    setProcessingId(approvingReq.id)

    try {
      await approveEmployeeHierarchy({
        requestId: approvingReq.id,
        userId: approvingReq.userId || approvingReq.applicantUid,
        assignedRole: 'state_admin',
        state: assignedState || approvingReq.stateName || approvingReq.state || 'Maharashtra',
        district: '',
        taluka: '',
        adminUid: currentUser?.uid
      })

      setActionSuccess(`✓ Approved State Admin: ${approvingReq.name || approvingReq.applicantName} for ${assignedState || approvingReq.stateName || approvingReq.state}.`)
      setApprovingReq(null)
    } catch (err) {
      console.error('[SUPER ADMIN] Error approving State Admin:', err)
      setActionError(err.message || 'Failed to approve State Admin.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(req) {
    setActionError('')
    setActionSuccess('')
    setProcessingId(req.id)

    try {
      await rejectVerificationRequest(req.id, currentUser?.uid, 'Credentials could not be validated by Super Admin.')
      setActionSuccess(`Rejected application for ${req.name}.`)
    } catch (err) {
      console.error('Error rejecting request:', err)
      setActionError(err.message || 'Failed to reject request.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleLogoutClick() {
    if (onLogout) {
      onLogout()
    } else {
      await logout()
    }
  }

  return (
    <div className="dashboard-page">
      {/* 1. TOP NAVBAR */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h2>CivicPulse<span className="brand-accent">-AI</span></h2>
          <span className="official-badge" style={{ background: '#4338ca' }}>
            National Super Admin Command
          </span>
          <span style={{ fontSize: '13px', background: '#e0e7ff', color: '#3730a3', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            🇮🇳 All States & Territories
          </span>
        </div>

        <div className="official-user-tag">
          <span>{userProfile?.name || currentUser?.email || 'Super Admin'}</span>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 0 }}
            onClick={handleLogoutClick}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* 2. MAIN VIEWPORT */}
      <main className="dashboard-content">
        <section className="hero-section" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white' }}>
          <div>
            <p className="welcome-label" style={{ color: '#818cf8' }}>NATIONAL GOVERNANCE & HIERARCHY OVERSIGHT</p>
            <h1 style={{ color: 'white' }}>Super Admin Apex Portal</h1>
            <p style={{ color: '#c7d2fe' }}>
              High-level strategic administration. Appoint State Administrators, monitor state performance, and enforce nationwide RBAC policies.
            </p>
          </div>
        </section>

        {actionSuccess && (
          <div className="main-error" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#065f46' }}>
            {actionSuccess}
          </div>
        )}

        {actionError && <p className="error-message main-error">{actionError}</p>}

        {/* 3. NAVIGATION TABS */}
        <div style={{ display: 'flex', gap: '10px', margin: '20px 0', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`filter-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            📊 National Overview & Analytics
          </button>

          <button
            type="button"
            className={`filter-btn ${activeTab === 'state_admins' ? 'active' : ''}`}
            onClick={() => setActiveTab('state_admins')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            🏛️ State Admins Management ({pendingStateAdminRequests.length} Pending)
          </button>

          <button
            type="button"
            className={`filter-btn ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            👮 Government Hierarchy Directory ({employees.length})
          </button>

          <button
            type="button"
            className={`filter-btn ${activeTab === 'complaints' ? 'active' : ''}`}
            onClick={() => setActiveTab('complaints')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            📋 National Complaints Queue ({totalComplaints})
          </button>
        </div>

        {/* 4. TAB CONTENT: OVERVIEW */}
        {loading ? (
          <div className="stat-card" style={{ padding: '40px', textAlign: 'center' }}>
            <p>Loading national command data...</p>
          </div>
        ) : activeTab === 'overview' && (
          <>
            {/* TOP 9-METRIC STATS GRID */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">🗺️</span>
                <h2>{totalStatesCount}</h2>
                <p>States / UTs ({stateAdmins.length} Admins)</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">🏙️</span>
                <h2>{totalDistrictsCount}</h2>
                <p>Districts ({districtAdmins.length} Admins)</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">📍</span>
                <h2>{totalTalukasCount}</h2>
                <p>Talukas / Wards</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">👥</span>
                <h2>{citizens.length}</h2>
                <p>Citizens ({verifiedCitizensCount} Verified)</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">👮</span>
                <h2>{employees.length}</h2>
                <p>Officers ({citizenAccessEmployees.length} Access / {issueResolutionEmployees.length} Field)</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">📋</span>
                <h2>{totalComplaints}</h2>
                <p>Total Complaints</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">⏳</span>
                <h2 style={{ color: '#eab308' }}>{pendingComplaints}</h2>
                <p>Pending</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">⚙️</span>
                <h2 style={{ color: '#0284c7' }}>{inProgressComplaints}</h2>
                <p>In Progress</p>
              </div>

              <div className="stat-card" style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <span className="stat-icon">✅</span>
                <h2 style={{ color: '#166534' }}>{resolutionRate}%</h2>
                <p style={{ color: '#15803d', fontWeight: '700' }}>Resolved ({resolvedComplaints})</p>
              </div>
            </section>

            {/* STATE-WISE RESOLUTION PERFORMANCE TABLE */}
            <section style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>
                📊 State-Wise Complaint Resolution & Governance Performance
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>State</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Complaints</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Pending</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>In Progress</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Resolved</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Resolution %</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Citizens</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Employees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statePerformance.map((st) => (
                      <tr key={st.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a' }}>{st.name}</td>
                        <td style={{ padding: '10px 14px' }}>{st.total}</td>
                        <td style={{ padding: '10px 14px', color: '#eab308', fontWeight: '600' }}>{st.pending}</td>
                        <td style={{ padding: '10px 14px', color: '#0284c7', fontWeight: '600' }}>{st.inProgress}</td>
                        <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: '700' }}>{st.resolved}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: st.rate >= 70 ? '#16a34a' : st.rate >= 40 ? '#d97706' : '#dc2626' }}>
                          {st.rate}%
                        </td>
                        <td style={{ padding: '10px 14px' }}>{st.citizens}</td>
                        <td style={{ padding: '10px 14px' }}>{st.employees}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* 5. TAB CONTENT: STATE ADMINS MANAGEMENT */}
        {activeTab === 'state_admins' && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                🏛️ State Administrator Appointments & Applications
              </h3>

              {/* FILTER SUB-BAR */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`filter-btn ${requestFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setRequestFilter('pending')}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Pending ({pendingStateAdminRequests.length})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${requestFilter === 'approved' ? 'active' : ''}`}
                  onClick={() => setRequestFilter('approved')}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Approved ({approvedStateAdminRequests.length})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${requestFilter === 'rejected' ? 'active' : ''}`}
                  onClick={() => setRequestFilter('rejected')}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Rejected ({rejectedStateAdminRequests.length})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${requestFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setRequestFilter('all')}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  All ({stateAdminRequests.length})
                </button>
              </div>
            </div>

            {/* 3 COUNTER STAT CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div className="stat-card" style={{ padding: '14px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                <span className="stat-icon">⏳</span>
                <h2 style={{ color: '#d97706', margin: '4px 0' }}>{pendingStateAdminRequests.length}</h2>
                <p style={{ margin: 0, color: '#92400e', fontWeight: '600' }}>Pending State Admin Requests</p>
              </div>

              <div className="stat-card" style={{ padding: '14px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <span className="stat-icon">✅</span>
                <h2 style={{ color: '#16a34a', margin: '4px 0' }}>{approvedStateAdminRequests.length}</h2>
                <p style={{ margin: 0, color: '#166534', fontWeight: '600' }}>Approved State Admin Requests</p>
              </div>

              <div className="stat-card" style={{ padding: '14px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                <span className="stat-icon">❌</span>
                <h2 style={{ color: '#dc2626', margin: '4px 0' }}>{rejectedStateAdminRequests.length}</h2>
                <p style={{ margin: 0, color: '#991b1b', fontWeight: '600' }}>Rejected State Admin Requests</p>
              </div>
            </div>

            {displayedStateAdminRequests.length === 0 ? (
              <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
                <p>No {requestFilter !== 'all' ? requestFilter : ''} State Admin requests in queue.</p>
              </div>
            ) : (
              displayedStateAdminRequests.map((req) => {
                const isPending = (req.status || 'pending').toLowerCase() === 'pending'
                const isApproved = (req.status || '').toLowerCase() === 'approved'

                return (
                  <div
                    key={req.id}
                    className="issue-card"
                    style={{ borderLeft: isPending ? '4px solid #f59e0b' : isApproved ? '4px solid #10b981' : '4px solid #ef4444' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{req.name || req.applicantName}</h2>
                        <span style={{ color: '#6b7280', fontSize: '13px' }}>{req.email || req.applicantEmail}</span>
                      </div>

                      <span
                        className={`status-badge status-${isApproved ? 'resolved' : isPending ? 'pending' : 'rejected'}`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {req.status || 'pending'}
                      </span>
                    </div>

                    <div className="issue-meta-row">
                      <div className="issue-meta-item">
                        <strong>Target State:</strong> {req.stateName || req.state || 'Maharashtra'}
                      </div>
                      <div className="issue-meta-item">
                        <strong>Organization:</strong> {req.organization}
                      </div>
                      <div className="issue-meta-item">
                        <strong>Department:</strong> {req.department}
                      </div>
                      <div className="issue-meta-item">
                        <strong>Employee ID:</strong> {req.employeeId}
                      </div>
                      <div className="issue-meta-item">
                        <strong>Submitted:</strong> {req.submittedAt?.seconds ? new Date(req.submittedAt.seconds * 1000).toLocaleDateString() : req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                      </div>
                    </div>

                    {req.reason && (
                      <p style={{ margin: '10px 0', fontSize: '13px', color: '#334155' }}>
                        <strong>Reason for Request:</strong> {req.reason}
                      </p>
                    )}

                    {req.idDocumentUrl && (
                      <div style={{ margin: '10px 0', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
                        🛡️ <strong>ID Document Attached:</strong>{' '}
                        <a href={req.idDocumentUrl} target="_blank" rel="noreferrer" style={{ color: '#4338ca', fontWeight: '600' }}>
                          View Official Credential Document ↗
                        </a>
                      </div>
                    )}

                    {isPending && (
                      <div className="status-control-container" style={{ marginTop: '14px', paddingTop: '12px' }}>
                        <span className="status-control-label">Super Admin Strategic Decision:</span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            className="primary-button"
                            style={{ background: '#10b981', color: 'white', marginTop: 0, padding: '8px 18px', fontSize: '13px', fontWeight: '700' }}
                            disabled={processingId === req.id}
                            onClick={() => {
                              setApprovingReq(req)
                              setAssignedState(req.stateName || req.state || 'Maharashtra')
                            }}
                          >
                            ✓ Approve State Admin
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            style={{ background: '#fee2e2', color: '#b91c1c', marginTop: 0, padding: '8px 18px', fontSize: '13px', fontWeight: '600' }}
                            disabled={processingId === req.id}
                            onClick={() => handleReject(req)}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </section>
        )}

        {/* 6. TAB CONTENT: GOVERNMENT EMPLOYEES DIRECTORY */}
        {activeTab === 'employees' && (
          <section>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>
              👮 National Government Employee & Admin Directory
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {employees.map((emp) => (
                <div key={emp.id} className="stat-card" style={{ padding: '16px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>{emp.name || emp.email}</strong>
                    <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                      {(emp.role || '').replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b' }}>{emp.email}</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#334155' }}>
                    📍 {emp.stateName || emp.state} {emp.districtName ? `> ${emp.districtName}` : ''} {emp.talukaName ? `> ${emp.talukaName}` : ''}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                    Department: {emp.department || 'Municipal Authority'} ({emp.employeeId || 'EMP'})
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. TAB CONTENT: NATIONAL COMPLAINTS QUEUE */}
        {activeTab === 'complaints' && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                📋 All Civic Complaints Across All States ({issues.length})
              </h3>
              <select
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
                className="form-select"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <option value="All">All States</option>
                {allStatesList.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {issues
              .filter((i) => filterState === 'All' || i.state === filterState || i.stateName === filterState)
              .map((issue) => (
                <div key={issue.id} className="issue-card" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ background: '#0284c7', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '800' }}>
                        Score: {issue.priorityScore || 50}/100
                      </span>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>{issue.title}</strong>
                      <span style={{ fontSize: '12px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                        👥 {issue.reportCount || 1} Reports
                      </span>
                    </div>
                    <span className={`status-badge status-${(issue.status || 'Pending').toLowerCase().replace(' ', '-')}`}>
                      {issue.status || 'Pending'}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#475569' }}>
                    📍 {issue.state || issue.stateName} &gt; {issue.district || issue.districtName} &gt; {issue.taluka || issue.talukaName} | Category: <strong>{issue.category}</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>{issue.description}</p>
                </div>
              ))}
          </section>
        )}
      </main>

      {/* STATE ADMIN APPROVAL MODAL */}
      {approvingReq && (
        <div className="gov-modal-backdrop" onClick={() => setApprovingReq(null)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button type="button" className="gov-modal-close" onClick={() => setApprovingReq(null)}>
              ✕
            </button>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
              Approve State Admin: {approvingReq.name}
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
              Confirm the state territory this State Administrator will oversee.
            </p>

            <form onSubmit={handleConfirmApproveStateAdmin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Assigned State *
                </label>
                <select
                  value={assignedState}
                  onChange={(e) => setAssignedState(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  {allStatesList.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="secondary-button" onClick={() => setApprovingReq(null)} style={{ marginTop: 0 }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === approvingReq.id}
                  className="primary-button"
                  style={{ background: '#10b981', color: 'white', marginTop: 0, padding: '8px 20px', fontWeight: '700' }}
                >
                  {processingId === approvingReq.id ? 'Approving...' : 'Confirm & Appoint State Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperAdminDashboard
