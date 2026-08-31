import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import {
  subscribeVerificationRequests,
  approveEmployeeWithRole,
  rejectVerificationRequest
} from './firebase/verification.js'
import { INDIAN_STATES_AND_DISTRICTS, getDistrictsForState } from './utils/locations.js'
import './App.css'

function AdminDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all') // 'all' | 'citizen_access_officer' | 'issue_resolution_officer' | 'higher_authority'
  const [statusFilter, setStatusFilter] = useState('pending') // 'pending' | 'approved' | 'rejected' | 'all'

  // Modal / Action States
  const [approvingReq, setApprovingReq] = useState(null)
  const [assignedRole, setAssignedRole] = useState('issue_resolution_officer')
  const [assignedState, setAssignedState] = useState('Maharashtra')
  const [assignedDistrict, setAssignedDistrict] = useState('Mumbai')
  const [previewDoc, setPreviewDoc] = useState(null)

  const [processingId, setProcessingId] = useState(null)
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const unsubscribe = subscribeVerificationRequests(
      (allRequests) => {
        setRequests(allRequests)
        setLoading(false)
      },
      (err) => {
        console.error('Error loading verification requests:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Filter requests based on requested role & status
  const filteredRequests = requests.filter((req) => {
    // 1. Role category filter
    if (selectedCategory !== 'all') {
      const role = (req.requestedRole || req.assignedRole || 'issue_resolution_officer').toLowerCase()
      if (role !== selectedCategory.toLowerCase()) return false
    }

    // 2. Status filter
    if (statusFilter !== 'all') {
      const status = (req.status || 'pending').toLowerCase()
      if (status !== statusFilter.toLowerCase()) return false
    }

    return true
  })

  const pendingCaoCount = requests.filter((r) => r.status === 'pending' && (r.requestedRole === 'citizen_access_officer' || r.requestedRole === 'CITIZEN_ACCESS_OFFICER')).length
  const pendingIroCount = requests.filter((r) => r.status === 'pending' && (r.requestedRole === 'issue_resolution_officer' || r.requestedRole === 'ISSUE_RESOLUTION_OFFICER' || !r.requestedRole)).length
  const pendingHaCount = requests.filter((r) => r.status === 'pending' && (r.requestedRole === 'higher_authority' || r.requestedRole === 'HIGHER_AUTHORITY')).length
  const totalPending = requests.filter((r) => r.status === 'pending').length

  function handleOpenApproveModal(req) {
    setApprovingReq(req)
    setAssignedRole(req.requestedRole || 'issue_resolution_officer')
    setAssignedState(req.state || 'Maharashtra')
    setAssignedDistrict(req.district || 'Mumbai')
  }

  async function handleConfirmApprove(e) {
    e.preventDefault()
    if (!approvingReq) return

    setActionError('')
    setActionSuccess('')
    setProcessingId(approvingReq.id)

    try {
      await approveEmployeeWithRole({
        requestId: approvingReq.id,
        userId: approvingReq.userId,
        assignedRole,
        assignedState,
        assignedDistrict,
        adminUid: currentUser?.uid
      })

      setActionSuccess(`✓ Approved ${approvingReq.name} as ${assignedRole.replace(/_/g, ' ').toUpperCase()} for ${assignedState} / ${assignedDistrict}.`)
      setApprovingReq(null)
    } catch (err) {
      console.error('Error approving employee:', err)
      setActionError(err.message || 'Failed to approve employee.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(req) {
    setActionError('')
    setActionSuccess('')
    setProcessingId(req.id)

    try {
      await rejectVerificationRequest(req.id, currentUser?.uid, 'Government credentials could not be verified')
      setActionSuccess(`Rejected registration request for ${req.name} (${req.email}).`)
    } catch (err) {
      console.error('Error rejecting employee request:', err)
      setActionError(err.message || 'Failed to reject employee request.')
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

  function formatDate(timestamp) {
    if (!timestamp) return 'N/A'
    try {
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      }
      return new Date(timestamp).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    } catch {
      return 'N/A'
    }
  }

  return (
    <div className="dashboard-page">
      {/* 1. TOP NAVBAR */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h2>CivicPulse<span className="brand-accent">-AI</span></h2>
          <span className="official-badge" style={{ background: '#7c3aed' }}>
            System Administrator Portal
          </span>
          <span style={{ fontSize: '13px', background: '#ede9fe', color: '#6d28d9', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            🛡️ Role & Access Control Command
          </span>
        </div>

        <div className="official-user-tag">
          <span>{userProfile?.name || currentUser?.email || 'Administrator'}</span>
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

      {/* 2. MAIN ADMIN CONTENT */}
      <main className="dashboard-content">
        <section className="hero-section">
          <div>
            <p className="welcome-label" style={{ color: '#7c3aed' }}>GOVERNMENT EMPLOYEE VERIFICATION & ACCESS GOVERNANCE</p>
            <h1>Employee Role & Access Management</h1>
            <p>
              Verify official government employee applications, validate municipal credentials and employee ID cards, and assign jurisdiction roles.
            </p>
          </div>
        </section>

        {actionSuccess && (
          <div className="main-error" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#065f46' }}>
            {actionSuccess}
          </div>
        )}

        {actionError && <p className="error-message main-error">{actionError}</p>}

        {/* 3. ROLE CATEGORY SWITCHER TABS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            📋 All Requests ({totalPending} Pending)
          </button>

          <button
            type="button"
            className={`filter-btn ${selectedCategory === 'citizen_access_officer' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('citizen_access_officer')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            🛡️ Citizen Access Officers ({pendingCaoCount} Pending)
          </button>

          <button
            type="button"
            className={`filter-btn ${selectedCategory === 'issue_resolution_officer' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('issue_resolution_officer')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            ⚙️ Issue Resolution Officers ({pendingIroCount} Pending)
          </button>

          <button
            type="button"
            className={`filter-btn ${selectedCategory === 'higher_authority' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('higher_authority')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            🏛️ Higher Authority ({pendingHaCount} Pending)
          </button>
        </div>

        {/* Status Filter Bar */}
        <div className="filter-bar">
          <button
            type="button"
            className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending
          </button>
          <button
            type="button"
            className={`filter-btn ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            Approved
          </button>
          <button
            type="button"
            className={`filter-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            Rejected
          </button>
          <button
            type="button"
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Statuses
          </button>
        </div>

        {/* Employee Requests List */}
        <section>
          {loading ? (
            <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
              <p>Loading government employee verification requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="stat-card" style={{ padding: '40px', textAlign: 'center' }}>
              <h3>No verification requests found in this category</h3>
              <p style={{ color: '#64748b' }}>All official applications in this queue have been reviewed.</p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const status = (req.status || 'pending').toLowerCase()
              const requestedRole = req.requestedRole || 'issue_resolution_officer'

              return (
                <div
                  key={req.id}
                  className="issue-card"
                  style={{
                    borderLeft:
                      status === 'pending'
                        ? '4px solid #f59e0b'
                        : status === 'approved'
                        ? '4px solid #10b981'
                        : '4px solid #ef4444'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: '20px' }}>{req.name}</h2>
                        <span
                          style={{
                            background:
                              requestedRole === 'citizen_access_officer'
                                ? '#e0f2fe'
                                : requestedRole === 'higher_authority'
                                ? '#ede9fe'
                                : '#fef3c7',
                            color:
                              requestedRole === 'citizen_access_officer'
                                ? '#0369a1'
                                : requestedRole === 'higher_authority'
                                ? '#6d28d9'
                                : '#92400e',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}
                        >
                          Target Role: {requestedRole.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <span style={{ color: '#6b7280', fontSize: '13px' }}>{req.email}</span>
                    </div>

                    <span
                      className={`status-badge status-${status === 'approved' ? 'resolved' : status === 'pending' ? 'pending' : 'rejected'}`}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="issue-meta-row">
                    <div className="issue-meta-item">
                      <strong>Organization:</strong> {req.organization}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Department / Designation:</strong> {req.department} ({req.designation || 'Officer'})
                    </div>
                    <div className="issue-meta-item">
                      <strong>Employee ID:</strong> {req.employeeId}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Requested Jurisdiction:</strong> {req.state || 'All'} / {req.district || 'All'}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Submitted:</strong> {formatDate(req.createdAt)}
                    </div>
                  </div>

                  {req.reason && (
                    <p style={{ margin: '10px 0 6px 0', color: '#374151', fontSize: '13px' }}>
                      <strong>Reason for Access:</strong> {req.reason}
                    </p>
                  )}

                  {/* ID Document Preview Button */}
                  {req.idDocumentUrl && (
                    <div style={{ margin: '12px 0', padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: '#0369a1', fontWeight: '600' }}>
                        🪪 Government Employee ID Card Attached
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ url: req.idDocumentUrl, name: req.name })}
                        style={{
                          background: '#0284c7',
                          color: 'white',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        🔍 View ID Card
                      </button>
                    </div>
                  )}

                  {/* Action Controls for Pending Requests */}
                  {status === 'pending' && (
                    <div className="status-control-container" style={{ marginTop: '16px', paddingTop: '14px' }}>
                      <span className="status-control-label">Administrator Role & Approval Action:</span>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{
                            background: '#10b981',
                            color: 'white',
                            marginTop: 0,
                            padding: '8px 20px',
                            fontSize: '13px',
                            fontWeight: '700'
                          }}
                          disabled={processingId === req.id}
                          onClick={() => handleOpenApproveModal(req)}
                        >
                          ✓ Configure & Approve Access
                        </button>

                        <button
                          type="button"
                          className="secondary-button"
                          style={{
                            background: '#fee2e2',
                            color: '#b91c1c',
                            marginTop: 0,
                            padding: '8px 18px',
                            fontSize: '13px',
                            fontWeight: '600'
                          }}
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
      </main>

      {/* APPROVAL & ROLE ASSIGNMENT MODAL */}
      {approvingReq && (
        <div className="gov-modal-backdrop" onClick={() => setApprovingReq(null)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <button type="button" className="gov-modal-close" onClick={() => setApprovingReq(null)}>
              ✕
            </button>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
              Assign Role & Jurisdiction: {approvingReq.name}
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
              Select the validated municipal role and geographic jurisdiction for this government employee.
            </p>

            <form onSubmit={handleConfirmApprove}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Assign Role *
                </label>
                <select
                  value={assignedRole}
                  onChange={(e) => setAssignedRole(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 12px' }}
                >
                  <option value="citizen_access_officer">Citizen Access Officer (Verifies Citizens in District)</option>
                  <option value="issue_resolution_officer">Issue Resolution Officer (Resolves Field Issues)</option>
                  <option value="higher_authority">Higher Authority (Cross-District Oversight Analytics)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Assigned State *
                  </label>
                  <select
                    value={assignedState}
                    onChange={(e) => {
                      setAssignedState(e.target.value)
                      const dists = getDistrictsForState(e.target.value)
                      setAssignedDistrict(dists[0] || 'District 1')
                    }}
                    className="form-select"
                    style={{ width: '100%', padding: '8px 12px' }}
                  >
                    {Object.keys(INDIAN_STATES_AND_DISTRICTS).map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Assigned District *
                  </label>
                  <select
                    value={assignedDistrict}
                    onChange={(e) => setAssignedDistrict(e.target.value)}
                    className="form-select"
                    style={{ width: '100%', padding: '8px 12px' }}
                  >
                    {getDistrictsForState(assignedState).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setApprovingReq(null)}
                  style={{ marginTop: 0 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === approvingReq.id}
                  className="primary-button"
                  style={{
                    background: '#10b981',
                    color: 'white',
                    marginTop: 0,
                    padding: '8px 20px',
                    fontWeight: '700'
                  }}
                >
                  {processingId === approvingReq.id ? 'Approving...' : 'Confirm Role & Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="gov-modal-backdrop" onClick={() => setPreviewDoc(null)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', textAlign: 'center' }}>
            <button type="button" className="gov-modal-close" onClick={() => setPreviewDoc(null)}>
              ✕
            </button>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
              Employee ID Card: {previewDoc.name}
            </h3>

            {previewDoc.url.startsWith('data:application/pdf') ? (
              <div style={{ padding: '30px', background: '#f8fafc', borderRadius: '8px' }}>
                <p style={{ fontSize: '15px', color: '#334155' }}>📄 PDF Verification Document</p>
                <a
                  href={previewDoc.url}
                  download="employee_id.pdf"
                  className="primary-button"
                  style={{ display: 'inline-block', textDecoration: 'none' }}
                >
                  Download / View PDF
                </a>
              </div>
            ) : (
              <img
                src={previewDoc.url}
                alt="Employee ID Card"
                style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '8px', objectFit: 'contain', border: '1px solid #cbd5e1' }}
              />
            )}

            <div style={{ marginTop: '20px' }}>
              <button type="button" className="secondary-button" onClick={() => setPreviewDoc(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
