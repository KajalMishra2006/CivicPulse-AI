import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { subscribeScopedIssues } from './firebase/issues.js'
import ComplaintStatusChart from './ComplaintStatusChart.jsx'
import {
  subscribeScopedVerificationRequests,
  approveEmployeeHierarchy,
  rejectVerificationRequest,
  createOfficerHierarchyDirectly
} from './firebase/verification.js'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase/config.js'
import { getDistrictsForState } from './utils/locations.js'
import './App.css'

function StateAdminDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()

  const stateName = userProfile?.stateName || userProfile?.state || 'Maharashtra'
  const stateId = userProfile?.stateId || stateName.toLowerCase().replace(/\s+/g, '_')

  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'district_admins' | 'complaints' | 'districts'
  const [issues, setIssues] = useState([])
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  // Geographic filter
  const [selectedDistrict, setSelectedDistrict] = useState('All')

  // Approval Modal State
  const [approvingReq, setApprovingReq] = useState(null)
  const [assignedDistrict, setAssignedDistrict] = useState('')
  const [processingId, setProcessingId] = useState(null)
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')

  const districtList = useMemo(() => {
    return getDistrictsForState(stateId || stateName)
  }, [stateId, stateName])

  // Direct District Officer Appointment Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOfficerName, setNewOfficerName] = useState('')
  const [newOfficerEmail, setNewOfficerEmail] = useState('')
  const [newOfficerPassword, setNewOfficerPassword] = useState('')
  const [newOfficerDistrict, setNewOfficerDistrict] = useState(districtList[0]?.name || 'Pune')
  const [newOfficerDept, setNewOfficerDept] = useState('District Revenue & Operations')
  const [newOfficerEmpId, setNewOfficerEmpId] = useState('')
  const [newOfficerPhone, setNewOfficerPhone] = useState('')
  const [isCreatingOfficer, setIsCreatingOfficer] = useState(false)

  useEffect(() => {
    // 1. Subscribe to state issues
    const unsubIssues = subscribeScopedIssues(
      { role: 'state_admin', stateId: stateId || stateName },
      (stateIssues) => {
        setIssues(stateIssues)
        setLoading(false)
      },
      (err) => {
        console.error('State Admin Issues Error:', err)
        setLoading(false)
      }
    )

    // 2. Subscribe to users in this state
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const stateUsers = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => {
            const uState = (u.stateId || u.stateName || u.state || '').toLowerCase()
            return uState === stateId.toLowerCase() || uState === stateName.toLowerCase()
          })
        setUsers(stateUsers)
      },
      (err) => console.error('State Admin Users Error:', err)
    )

    // 3. Subscribe to verification requests in this state
    const unsubReqs = subscribeScopedVerificationRequests(
      { role: 'state_admin', stateId: stateId || stateName },
      (stateReqs) => setRequests(stateReqs),
      (err) => console.error('State Admin Reqs Error:', err)
    )

    return () => {
      unsubIssues()
      unsubUsers()
      unsubReqs()
    }
  }, [stateId, stateName])

  const citizens = users.filter((u) => u.role === 'citizen' || !u.role)
  const employees = users.filter((u) => u.role && u.role !== 'citizen')

  const totalComplaints = issues.length
  const pendingComplaints = issues.filter((i) => (i.status || 'Pending').toLowerCase() === 'pending').length
  const inProgressComplaints = issues.filter((i) => (i.status || '').toLowerCase() === 'in progress').length
  const resolvedComplaints = issues.filter((i) => (i.status || '').toLowerCase() === 'resolved').length
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0

  // District Officer & Admin Requests
  const districtAdminRequests = useMemo(() => {
    return requests.filter((r) => {
      const role = (r.requestedRole || '').toUpperCase().replace(/[\s-]/g, '_')
      const type = (r.employeeType || '').toUpperCase().replace(/[\s-]/g, '_')
      return role === 'DISTRICT_ADMIN' || type === 'DISTRICT_ADMIN' || role === 'DISTRICT_OFFICER' || type === 'DISTRICT_OFFICER'
    })
  }, [requests])

  // District performance breakdown
  const districtPerformance = useMemo(() => {
    const dMap = {}
    districtList.forEach((d) => {
      dMap[d.name] = { name: d.name, total: 0, resolved: 0, pending: 0, inProgress: 0, citizens: 0 }
    })

    issues.forEach((i) => {
      const dName = i.districtName || i.district || 'Other'
      if (!dMap[dName]) dMap[dName] = { name: dName, total: 0, resolved: 0, pending: 0, inProgress: 0, citizens: 0 }
      dMap[dName].total++
      const st = (i.status || 'Pending').toLowerCase()
      if (st === 'resolved') dMap[dName].resolved++
      else if (st === 'in progress') dMap[dName].inProgress++
      else dMap[dName].pending++
    })

    citizens.forEach((c) => {
      const dName = c.districtName || c.district || 'Other'
      if (dMap[dName]) dMap[dName].citizens++
    })

    return Object.values(dMap).map((d) => ({
      ...d,
      rate: d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0
    })).sort((a, b) => b.total - a.total)
  }, [districtList, issues, citizens])

  async function handleConfirmApproveDistrictAdmin(e) {
    e.preventDefault()
    if (!approvingReq) return

    setActionError('')
    setActionSuccess('')
    setProcessingId(approvingReq.id)

    try {
      const roleToAssign = 'district_officer'
      await approveEmployeeHierarchy({
        requestId: approvingReq.id,
        userId: approvingReq.userId,
        assignedRole: roleToAssign,
        state: stateName,
        district: assignedDistrict || districtList[0]?.name || 'Pune',
        taluka: '',
        adminUid: currentUser?.uid
      })

      setActionSuccess(`✓ Approved District Officer: ${approvingReq.name} for ${assignedDistrict}.`)
      setApprovingReq(null)
    } catch (err) {
      console.error('Error approving District Officer:', err)
      setActionError(err.message || 'Failed to approve District Officer.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleCreateDistrictOfficer(e) {
    e.preventDefault()
    setActionError('')
    setActionSuccess('')
    if (!newOfficerName.trim() || !newOfficerEmail.trim() || !newOfficerPassword || !newOfficerDistrict) {
      setActionError('Full Name, Official Email, Password, and District are required.')
      return
    }
    if (newOfficerPassword.length < 8) {
      setActionError('Password must be at least 8 characters.')
      return
    }

    setIsCreatingOfficer(true)
    try {
      await createOfficerHierarchyDirectly({
        callerUid: currentUser?.uid,
        email: newOfficerEmail.trim(),
        password: newOfficerPassword,
        name: newOfficerName.trim(),
        role: 'district_officer',
        state: stateName,
        district: newOfficerDistrict,
        department: newOfficerDept.trim(),
        employeeId: newOfficerEmpId.trim(),
        mobileNumber: newOfficerPhone.trim()
      })
      setActionSuccess(`✓ Successfully appointed ${newOfficerName.trim()} as District Officer for ${newOfficerDistrict}.`)
      setShowCreateModal(false)
      setNewOfficerName('')
      setNewOfficerEmail('')
      setNewOfficerPassword('')
      setNewOfficerEmpId('')
      setNewOfficerPhone('')
    } catch (err) {
      console.error('Failed to appoint District Officer:', err)
      setActionError(err.message || 'Failed to appoint District Officer.')
    } finally {
      setIsCreatingOfficer(false)
    }
  }

  async function handleReject(req) {
    setActionError('')
    setActionSuccess('')
    setProcessingId(req.id)

    try {
      await rejectVerificationRequest(req.id, currentUser?.uid, `Credentials could not be verified by ${stateName} State Admin.`)
      setActionSuccess(`Rejected application for ${req.name}.`)
    } catch (err) {
      console.error('Error rejecting request:', err)
      setActionError(err.message || 'Failed to reject request.')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="dashboard-page">
      {/* 1. TOP NAVBAR */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div className="govbridge-nav-brand">
            <img src="/govbridge-logo.png" alt="GovBridge" className="govbridge-nav-logo" />
          </div>
          <span className="official-badge" style={{ background: '#0284c7' }}>
            State Administration Portal
          </span>
          <span style={{ fontSize: '13px', background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            🏛️ {stateName}
          </span>
        </div>

        <div className="official-user-tag">
          <span>{userProfile?.name || currentUser?.email}</span>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 0 }}
            onClick={onLogout || logout}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* 2. MAIN VIEWPORT */}
      <main className="dashboard-content">
        <section className="hero-section" style={{ background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)', color: 'white' }}>
          <div>
            <p className="welcome-label" style={{ color: '#7dd3fc' }}>STATE EXECUTIVE HEADQUARTERS</p>
            <h1 style={{ color: 'white' }}>{stateName} State Administration</h1>
            <p style={{ color: '#e0f2fe' }}>
              Direct oversight of districts, District Administrators, taluka metrics, and state-level civic complaint turnaround times.
            </p>
          </div>
        </section>

        {actionSuccess && (
          <div className="main-error" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#065f46' }}>
            {actionSuccess}
          </div>
        )}

        {actionError && <p className="error-message main-error">{actionError}</p>}

        {/* 3. TABS */}
        <div style={{ display: 'flex', gap: '10px', margin: '20px 0', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`filter-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            📊 State Overview & Districts
          </button>

          <button
            type="button"
            className={`filter-btn ${activeTab === 'district_admins' ? 'active' : ''}`}
            onClick={() => setActiveTab('district_admins')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            🏙️ District Officers ({districtAdminRequests.filter((r) => r.status === 'pending').length} Pending)
          </button>

          <button
            type="button"
            className={`filter-btn ${activeTab === 'complaints' ? 'active' : ''}`}
            onClick={() => setActiveTab('complaints')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            📋 State Complaints Queue ({issues.length})
          </button>
        </div>

        {/* 4. OVERVIEW TAB */}
        {loading ? (
          <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
            <p>Loading state administration data...</p>
          </div>
        ) : activeTab === 'overview' && (
          <>
            {/* PROBLEM STATUS STATE CHART */}
            <ComplaintStatusChart
              title={`Problem Status — ${stateName}`}
              pending={pendingComplaints}
              inProgress={inProgressComplaints}
              resolved={resolvedComplaints}
            />

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">🏙️</span>
                <h2>{districtList.length}</h2>
                <p>Districts</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">👥</span>
                <h2>{citizens.length}</h2>
                <p>State Citizens</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">👮</span>
                <h2>{employees.length}</h2>
                <p>State Officials</p>
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

            {/* DISTRICT PERFORMANCE TABLE */}
            <section style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>
                🏙️ District-Level Complaint Resolution in {stateName}
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>District</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Complaints</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Pending</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>In Progress</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Resolved</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Resolution %</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Citizens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {districtPerformance.map((d) => (
                      <tr key={d.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a' }}>{d.name}</td>
                        <td style={{ padding: '10px 14px' }}>{d.total}</td>
                        <td style={{ padding: '10px 14px', color: '#eab308', fontWeight: '600' }}>{d.pending}</td>
                        <td style={{ padding: '10px 14px', color: '#0284c7', fontWeight: '600' }}>{d.inProgress}</td>
                        <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: '700' }}>{d.resolved}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: d.rate >= 70 ? '#16a34a' : '#d97706' }}>
                          {d.rate}%
                        </td>
                        <td style={{ padding: '10px 14px' }}>{d.citizens}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* 5. DISTRICT ADMINS TAB */}
        {activeTab === 'district_admins' && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                🏙️ District Officer Appointments & Applications ({stateName})
              </h3>
              <button
                type="button"
                className="primary-button"
                onClick={() => setShowCreateModal(true)}
                style={{ marginTop: 0, padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>+ Appoint District Officer</span>
              </button>
            </div>

            {districtAdminRequests.length === 0 ? (
              <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
                <p>No District Admin requests in queue for {stateName}.</p>
              </div>
            ) : (
              districtAdminRequests.map((req) => (
                <div key={req.id} className="issue-card" style={{ borderLeft: req.status === 'pending' ? '4px solid #f59e0b' : '4px solid #10b981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{req.name}</h2>
                      <span style={{ color: '#6b7280', fontSize: '13px' }}>{req.email}</span>
                    </div>

                    <span className={`status-badge status-${req.status === 'approved' ? 'resolved' : 'pending'}`} style={{ textTransform: 'capitalize' }}>
                      {req.status}
                    </span>
                  </div>

                  <div className="issue-meta-row">
                    <div className="issue-meta-item">
                      <strong>Target District:</strong> {req.district || 'Pune'}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Organization:</strong> {req.organization}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Employee ID:</strong> {req.employeeId}
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="status-control-container" style={{ marginTop: '14px', paddingTop: '12px' }}>
                      <span className="status-control-label">State Admin Decision:</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{ background: '#10b981', color: 'white', marginTop: 0, padding: '8px 18px', fontSize: '13px', fontWeight: '700' }}
                          disabled={processingId === req.id}
                          onClick={() => {
                            setApprovingReq(req)
                            setAssignedDistrict(req.district || districtList[0]?.name || 'Pune')
                          }}
                        >
                          ✓ Approve District Admin
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
              ))
            )}
          </section>
        )}

        {/* 6. COMPLAINTS TAB */}
        {activeTab === 'complaints' && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                📋 Civic Complaints in {stateName} ({issues.length})
              </h3>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="form-select"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <option value="All">All Districts in {stateName}</option>
                {districtList.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {issues
              .filter((i) => selectedDistrict === 'All' || i.district === selectedDistrict || i.districtName === selectedDistrict)
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
                    📍 {issue.district || issue.districtName} &gt; {issue.taluka || issue.talukaName} | Category: <strong>{issue.category}</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>{issue.description}</p>
                </div>
              ))}
          </section>
        )}
      </main>

      {/* DISTRICT ADMIN APPROVAL MODAL */}
      {approvingReq && (
        <div className="gov-modal-backdrop" onClick={() => setApprovingReq(null)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button type="button" className="gov-modal-close" onClick={() => setApprovingReq(null)}>
              ✕
            </button>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
              Approve District Admin: {approvingReq.name}
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
              Select the district in <strong>{stateName}</strong> this District Admin will manage.
            </p>

            <form onSubmit={handleConfirmApproveDistrictAdmin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Assigned District *
                </label>
                <select
                  value={assignedDistrict}
                  onChange={(e) => setAssignedDistrict(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  {districtList.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
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
                  {processingId === approvingReq.id ? 'Approving...' : 'Confirm & Appoint District Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIRECT DISTRICT OFFICER APPOINTMENT MODAL */}
      {showCreateModal && (
        <div className="gov-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <button type="button" className="gov-modal-close" onClick={() => setShowCreateModal(false)}>
              ✕
            </button>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
              🏙️ Appoint District Officer ({stateName})
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
              Directly provisions an active District Officer credential in {stateName} state hierarchy.
            </p>

            <form onSubmit={handleCreateDistrictOfficer}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Officer Rajesh Kulkarni"
                  value={newOfficerName}
                  onChange={(e) => setNewOfficerName(e.target.value)}
                  required
                  disabled={isCreatingOfficer}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Official Email *
                </label>
                <input
                  type="email"
                  placeholder="e.g. rajesh.kulkarni@district.gov.in"
                  value={newOfficerEmail}
                  onChange={(e) => setNewOfficerEmail(e.target.value)}
                  required
                  disabled={isCreatingOfficer}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Password * (min 8 chars)
                </label>
                <input
                  type="password"
                  placeholder="Enter secure initial password"
                  value={newOfficerPassword}
                  onChange={(e) => setNewOfficerPassword(e.target.value)}
                  required
                  disabled={isCreatingOfficer}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Assigned District * ({stateName})
                </label>
                <select
                  value={newOfficerDistrict}
                  onChange={(e) => setNewOfficerDistrict(e.target.value)}
                  disabled={isCreatingOfficer}
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  {districtList.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={newOfficerDept}
                    onChange={(e) => setNewOfficerDept(e.target.value)}
                    disabled={isCreatingOfficer}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Employee ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DO-PUN-01"
                    value={newOfficerEmpId}
                    onChange={(e) => setNewOfficerEmpId(e.target.value)}
                    disabled={isCreatingOfficer}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreatingOfficer}
                  style={{ marginTop: 0 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOfficer}
                  className="primary-button"
                  style={{ marginTop: 0, padding: '8px 20px', fontWeight: '700' }}
                >
                  {isCreatingOfficer ? 'Appointing...' : 'Appoint District Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default StateAdminDashboard
