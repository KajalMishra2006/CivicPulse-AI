import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { subscribeScopedIssues } from './firebase/issues.js'
import {
  subscribeScopedVerificationRequests,
  approveEmployeeHierarchy,
  rejectVerificationRequest
} from './firebase/verification.js'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase/config.js'
import { getTalukasForDistrict } from './utils/locations.js'
import './App.css'

function DistrictAdminDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()

  const stateName = userProfile?.stateName || userProfile?.state || 'Maharashtra'
  const stateId = userProfile?.stateId || stateName.toLowerCase().replace(/\s+/g, '_')

  const districtName = userProfile?.districtName || userProfile?.district || 'Pune'
  const districtId = userProfile?.districtId || districtName.toLowerCase().replace(/\s+/g, '_')

  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'employees' | 'complaints' | 'talukas'
  const [issues, setIssues] = useState([])
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  // Geographic filter
  const [selectedTaluka, setSelectedTaluka] = useState('All')

  // Approval Modal State
  const [approvingReq, setApprovingReq] = useState(null)
  const [assignedTaluka, setAssignedTaluka] = useState('')
  const [assignedRole, setAssignedRole] = useState('issue_resolution_employee')
  const [processingId, setProcessingId] = useState(null)
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')

  const talukaList = useMemo(() => {
    return getTalukasForDistrict(stateId || stateName, districtId || districtName)
  }, [stateId, stateName, districtId, districtName])

  useEffect(() => {
    // 1. Subscribe to district issues
    const unsubIssues = subscribeScopedIssues(
      { role: 'district_admin', stateId: stateId || stateName, districtId: districtId || districtName },
      (districtIssues) => {
        setIssues(districtIssues)
        setLoading(false)
      },
      (err) => {
        console.error('District Admin Issues Error:', err)
        setLoading(false)
      }
    )

    // 2. Subscribe to users in this district
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const districtUsers = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => {
            const uDist = (u.districtId || u.districtName || u.district || '').toLowerCase()
            return uDist === districtId.toLowerCase() || uDist === districtName.toLowerCase()
          })
        setUsers(districtUsers)
      },
      (err) => console.error('District Admin Users Error:', err)
    )

    // 3. Subscribe to verification requests in this district
    const unsubReqs = subscribeScopedVerificationRequests(
      { role: 'district_admin', stateId: stateId || stateName, districtId: districtId || districtName },
      (districtReqs) => setRequests(districtReqs),
      (err) => console.error('District Admin Reqs Error:', err)
    )

    return () => {
      unsubIssues()
      unsubUsers()
      unsubReqs()
    }
  }, [stateId, stateName, districtId, districtName])

  const citizens = users.filter((u) => u.role === 'citizen' || !u.role)
  const employees = users.filter((u) => u.role && u.role !== 'citizen' && u.role !== 'super_admin' && u.role !== 'state_admin')
  const citizenAccessEmployees = employees.filter((e) => e.role === 'citizen_access_employee' || e.employeeType === 'CITIZEN_ACCESS')
  const issueResolutionEmployees = employees.filter((e) => e.role === 'issue_resolution_employee' || e.employeeType === 'ISSUE_RESOLUTION')

  const totalComplaints = issues.length
  const pendingComplaints = issues.filter((i) => (i.status || 'Pending').toLowerCase() === 'pending').length
  const inProgressComplaints = issues.filter((i) => (i.status || '').toLowerCase() === 'in progress').length
  const resolvedComplaints = issues.filter((i) => (i.status || '').toLowerCase() === 'resolved').length
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0

  // Taluka Employee Requests (Citizen Access + Issue Resolution)
  const talukaEmployeeRequests = useMemo(() => {
    return requests.filter((r) => {
      const role = (r.requestedRole || '').toUpperCase().replace(/[\s-]/g, '_')
      const type = (r.employeeType || '').toUpperCase().replace(/[\s-]/g, '_')
      return (
        role === 'CITIZEN_ACCESS' ||
        role === 'CITIZEN_ACCESS_EMPLOYEE' ||
        role === 'CITIZEN_ACCESS_OFFICER' ||
        type === 'CITIZEN_ACCESS' ||
        type === 'CITIZEN_ACCESS_EMPLOYEE' ||
        type === 'CITIZEN_ACCESS_OFFICER' ||
        role === 'ISSUE_RESOLUTION' ||
        role === 'ISSUE_RESOLUTION_EMPLOYEE' ||
        role === 'ISSUE_RESOLUTION_OFFICER' ||
        type === 'ISSUE_RESOLUTION' ||
        type === 'ISSUE_RESOLUTION_EMPLOYEE' ||
        type === 'ISSUE_RESOLUTION_OFFICER'
      )
    })
  }, [requests])

  // Taluka performance breakdown
  const talukaPerformance = useMemo(() => {
    const tMap = {}
    talukaList.forEach((t) => {
      tMap[t.name] = { name: t.name, total: 0, resolved: 0, pending: 0, inProgress: 0, citizens: 0 }
    })

    issues.forEach((i) => {
      const tName = i.talukaName || i.taluka || 'Other'
      if (!tMap[tName]) tMap[tName] = { name: tName, total: 0, resolved: 0, pending: 0, inProgress: 0, citizens: 0 }
      tMap[tName].total++
      const st = (i.status || 'Pending').toLowerCase()
      if (st === 'resolved') tMap[tName].resolved++
      else if (st === 'in progress') tMap[tName].inProgress++
      else tMap[tName].pending++
    })

    citizens.forEach((c) => {
      const tName = c.talukaName || c.taluka || 'Other'
      if (tMap[tName]) tMap[tName].citizens++
    })

    return Object.values(tMap).map((t) => ({
      ...t,
      rate: t.total > 0 ? Math.round((t.resolved / t.total) * 100) : 0
    })).sort((a, b) => b.total - a.total)
  }, [talukaList, issues, citizens])

  async function handleConfirmApproveEmployee(e) {
    e.preventDefault()
    if (!approvingReq) return

    setActionError('')
    setActionSuccess('')
    setProcessingId(approvingReq.id)

    try {
      await approveEmployeeHierarchy({
        requestId: approvingReq.id,
        userId: approvingReq.userId,
        assignedRole,
        state: stateName,
        district: districtName,
        taluka: assignedTaluka || talukaList[0]?.name || 'Haveli',
        adminUid: currentUser?.uid
      })

      setActionSuccess(`✓ Approved ${assignedRole.replace(/_/g, ' ')}: ${approvingReq.name} for ${assignedTaluka}.`)
      setApprovingReq(null)
    } catch (err) {
      console.error('Error approving Employee:', err)
      setActionError(err.message || 'Failed to approve Employee.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(req) {
    setActionError('')
    setActionSuccess('')
    setProcessingId(req.id)

    try {
      await rejectVerificationRequest(req.id, currentUser?.uid, `Credentials could not be verified by ${districtName} District Admin.`)
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
          <h2>CivicPulse<span className="brand-accent">-AI</span></h2>
          <span className="official-badge" style={{ background: '#0d9488' }}>
            District Administration Portal
          </span>
          <span style={{ fontSize: '13px', background: '#ccfbf1', color: '#0f766e', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            📍 {districtName}, {stateName}
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
        <section className="hero-section" style={{ background: 'linear-gradient(135deg, #115e59 0%, #0d9488 100%)', color: 'white' }}>
          <div>
            <p className="welcome-label" style={{ color: '#99f6e4' }}>DISTRICT MUNICIPAL OPERATIONS</p>
            <h1 style={{ color: 'white' }}>{districtName} District Administration</h1>
            <p style={{ color: '#ccfbf1' }}>
              Manage Taluka Citizen Access Employees, Issue Resolution Employees, taluka performance, and district-wide civic resolutions.
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
            📊 District Overview & Talukas
          </button>

          <button
            type="button"
            className={`filter-btn ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            👮 Taluka Employees ({talukaEmployeeRequests.filter((r) => r.status === 'pending').length} Pending)
          </button>

          <button
            type="button"
            className={`filter-btn ${activeTab === 'complaints' ? 'active' : ''}`}
            onClick={() => setActiveTab('complaints')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            📋 District Complaints Queue ({issues.length})
          </button>
        </div>

        {/* 4. OVERVIEW TAB */}
        {loading ? (
          <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
            <p>Loading district operations data...</p>
          </div>
        ) : activeTab === 'overview' && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">📍</span>
                <h2>{talukaList.length}</h2>
                <p>Talukas / Wards</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">👥</span>
                <h2>{citizens.length}</h2>
                <p>District Citizens</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">🛡️</span>
                <h2>{citizenAccessEmployees.length}</h2>
                <p>Citizen Access Staff</p>
              </div>

              <div className="stat-card" style={{ padding: '16px' }}>
                <span className="stat-icon">⚙️</span>
                <h2>{issueResolutionEmployees.length}</h2>
                <p>Resolution Staff</p>
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

            {/* TALUKA PERFORMANCE TABLE */}
            <section style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>
                📍 Taluka-Level Complaint Performance in {districtName}
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Taluka</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Complaints</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Pending</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>In Progress</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Resolved</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Resolution %</th>
                      <th style={{ padding: '10px 14px', color: '#475569' }}>Citizens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {talukaPerformance.map((t) => (
                      <tr key={t.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a' }}>{t.name}</td>
                        <td style={{ padding: '10px 14px' }}>{t.total}</td>
                        <td style={{ padding: '10px 14px', color: '#eab308', fontWeight: '600' }}>{t.pending}</td>
                        <td style={{ padding: '10px 14px', color: '#0284c7', fontWeight: '600' }}>{t.inProgress}</td>
                        <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: '700' }}>{t.resolved}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: t.rate >= 70 ? '#16a34a' : '#d97706' }}>
                          {t.rate}%
                        </td>
                        <td style={{ padding: '10px 14px' }}>{t.citizens}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* 5. TALUKA EMPLOYEES TAB */}
        {activeTab === 'employees' && (
          <section>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>
              👮 Taluka Government Employee Applications for {districtName}
            </h3>

            {talukaEmployeeRequests.length === 0 ? (
              <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
                <p>No Taluka Employee requests in queue for {districtName}.</p>
              </div>
            ) : (
              talukaEmployeeRequests.map((req) => (
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
                      <strong>Requested Role:</strong> {(req.requestedRole || req.employeeType || '').replace(/_/g, ' ')}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Target Taluka:</strong> {req.taluka || 'Haveli'}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Department:</strong> {req.department}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Employee ID:</strong> {req.employeeId}
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="status-control-container" style={{ marginTop: '14px', paddingTop: '12px' }}>
                      <span className="status-control-label">District Admin Decision:</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{ background: '#10b981', color: 'white', marginTop: 0, padding: '8px 18px', fontSize: '13px', fontWeight: '700' }}
                          disabled={processingId === req.id}
                          onClick={() => {
                            setApprovingReq(req)
                            setAssignedTaluka(req.taluka || talukaList[0]?.name || 'Haveli')
                            setAssignedRole(req.requestedRole || (req.employeeType === 'CITIZEN_ACCESS' ? 'citizen_access_employee' : 'issue_resolution_employee'))
                          }}
                        >
                          ✓ Approve Taluka Employee
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
                📋 Civic Complaints in {districtName} ({issues.length})
              </h3>
              <select
                value={selectedTaluka}
                onChange={(e) => setSelectedTaluka(e.target.value)}
                className="form-select"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <option value="All">All Talukas in {districtName}</option>
                {talukaList.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            {issues
              .filter((i) => selectedTaluka === 'All' || i.taluka === selectedTaluka || i.talukaName === selectedTaluka)
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
                    📍 {issue.taluka || issue.talukaName} | Category: <strong>{issue.category}</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>{issue.description}</p>
                </div>
              ))}
          </section>
        )}
      </main>

      {/* TALUKA EMPLOYEE APPROVAL MODAL */}
      {approvingReq && (
        <div className="gov-modal-backdrop" onClick={() => setApprovingReq(null)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button type="button" className="gov-modal-close" onClick={() => setApprovingReq(null)}>
              ✕
            </button>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
              Approve Taluka Employee: {approvingReq.name}
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
              Assign role and taluka jurisdiction in <strong>{districtName}</strong>.
            </p>

            <form onSubmit={handleConfirmApproveEmployee}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Role Type *
                </label>
                <select
                  value={assignedRole}
                  onChange={(e) => setAssignedRole(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  <option value="issue_resolution_employee">Issue Resolution Employee</option>
                  <option value="citizen_access_employee">Citizen Access Employee</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Assigned Taluka / Ward *
                </label>
                <select
                  value={assignedTaluka}
                  onChange={(e) => setAssignedTaluka(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  {talukaList.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
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
                  {processingId === approvingReq.id ? 'Approving...' : 'Confirm & Appoint Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default DistrictAdminDashboard
