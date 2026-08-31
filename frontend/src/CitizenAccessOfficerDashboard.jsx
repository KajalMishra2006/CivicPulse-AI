import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import {
  subscribeTalukaCitizens,
  approveCitizenIdentity,
  rejectCitizenIdentity
} from './firebase/verification.js'
import './App.css'

function CitizenAccessOfficerDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()

  const stateName = userProfile?.stateName || userProfile?.state || 'Maharashtra'
  const stateId = userProfile?.stateId || stateName.toLowerCase().replace(/\s+/g, '_')

  const districtName = userProfile?.districtName || userProfile?.district || 'Pune'
  const districtId = userProfile?.districtId || districtName.toLowerCase().replace(/\s+/g, '_')

  const talukaName = userProfile?.talukaName || userProfile?.taluka || 'Haveli'
  const talukaId = userProfile?.talukaId || talukaName.toLowerCase().replace(/\s+/g, '_')

  const [citizens, setCitizens] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'verified' | 'rejected'
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [rejectingCitizen, setRejectingCitizen] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processingId, setProcessingId] = useState(null)
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    // Subscribe in real-time to citizens in this specific taluka
    const unsubscribe = subscribeTalukaCitizens(
      { stateId, districtId, talukaId },
      (talukaCitizens) => {
        setCitizens(talukaCitizens)
        setLoading(false)
      },
      (err) => {
        console.error('Citizen Access Sub Error:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [stateId, districtId, talukaId])

  const pendingCitizens = citizens.filter(
    (c) => (c.identityVerificationStatus || 'pending') === 'pending' && !c.verified
  )
  const verifiedCitizens = citizens.filter(
    (c) => c.identityVerificationStatus === 'verified' || c.verified
  )
  const rejectedCitizens = citizens.filter(
    (c) => c.identityVerificationStatus === 'rejected'
  )

  async function handleApprove(citizen) {
    setActionError('')
    setActionSuccess('')
    setProcessingId(citizen.id)

    try {
      await approveCitizenIdentity(citizen.id, currentUser?.uid)
      setActionSuccess(`✓ Approved citizen registration: ${citizen.name || citizen.email}`)
    } catch (err) {
      console.error('Error approving citizen:', err)
      setActionError(err.message || 'Failed to approve citizen.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleConfirmReject(e) {
    e.preventDefault()
    if (!rejectingCitizen) return

    setActionError('')
    setActionSuccess('')
    setProcessingId(rejectingCitizen.id)

    try {
      await rejectCitizenIdentity(rejectingCitizen.id, currentUser?.uid, rejectionReason)
      setActionSuccess(`Rejected registration for ${rejectingCitizen.name || rejectingCitizen.email}`)
      setRejectingCitizen(null)
      setRejectionReason('')
    } catch (err) {
      console.error('Error rejecting citizen:', err)
      setActionError(err.message || 'Failed to reject citizen.')
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
          <span className="official-badge" style={{ background: '#0284c7' }}>
            Citizen Access Portal
          </span>
          <span style={{ fontSize: '13px', background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            📍 {talukaName}, {districtName}
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
        <section className="hero-section" style={{ background: 'linear-gradient(135deg, #075985 0%, #0284c7 100%)', color: 'white' }}>
          <div>
            <p className="welcome-label" style={{ color: '#7dd3fc' }}>CITIZEN IDENTITY & ACCESS VERIFICATION</p>
            <h1 style={{ color: 'white' }}>{talukaName} Taluka Citizen Gate</h1>
            <p style={{ color: '#e0f2fe' }}>
              Review and validate citizen identity documents for {talukaName} Taluka, {districtName} District. Approved citizens are unlocked to submit complaints.
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
            className={`filter-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            ⏳ Pending Verification ({pendingCitizens.length})
          </button>

          <button
            type="button"
            className={`filter-btn ${activeTab === 'verified' ? 'active' : ''}`}
            onClick={() => setActiveTab('verified')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            ✓ Approved Citizens ({verifiedCitizens.length})
          </button>

          <button
            type="button"
            className={`filter-btn ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('rejected')}
            style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
          >
            ✕ Rejected ({rejectedCitizens.length})
          </button>
        </div>

        {/* 4. CONTENT LIST */}
        {loading ? (
          <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
            <p>Loading citizen verification queue...</p>
          </div>
        ) : (
          <section className="issues-list-section">
            {activeTab === 'pending' && (
              <>
                {pendingCitizens.length === 0 ? (
                  <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
                    <p>No pending citizen verification requests in {talukaName} Taluka.</p>
                  </div>
                ) : (
                  pendingCitizens.map((citizen) => (
                    <div key={citizen.id} className="issue-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{citizen.name || 'Citizen'}</h2>
                          <span style={{ color: '#6b7280', fontSize: '13px' }}>{citizen.email}</span>
                        </div>

                        <span className="status-badge status-pending">
                          Pending Verification
                        </span>
                      </div>

                      <div className="issue-meta-row">
                        <div className="issue-meta-item">
                          <strong>Jurisdiction:</strong> {citizen.taluka || talukaName}, {citizen.district || districtName}
                        </div>
                        <div className="issue-meta-item">
                          <strong>Ward / Area:</strong> {citizen.localArea || 'Not specified'}
                        </div>
                        <div className="issue-meta-item">
                          <strong>ID Type:</strong> {citizen.idType || 'Citizen ID'}
                        </div>
                        {citizen.idNumber && (
                          <div className="issue-meta-item">
                            <strong>ID Number:</strong> {citizen.idNumber}
                          </div>
                        )}
                        <div className="issue-meta-item">
                          <strong>Registered:</strong> {citizen.createdAt?.seconds ? new Date(citizen.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                        </div>
                      </div>

                      {/* DOCUMENT PREVIEW SECTION */}
                      {citizen.idDocumentUrl && (
                        <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                            📄 Citizen Identity Document Uploaded
                          </span>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ marginTop: 0, padding: '4px 12px', fontSize: '12px' }}
                            onClick={() => setSelectedDoc({ url: citizen.idDocumentUrl, name: citizen.name })}
                          >
                            👁️ View Document
                          </button>
                        </div>
                      )}

                      {/* ACTIONS */}
                      <div className="status-control-container" style={{ marginTop: '14px', paddingTop: '12px' }}>
                        <span className="status-control-label">Taluka Access Decision:</span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            className="primary-button"
                            style={{ background: '#10b981', color: 'white', marginTop: 0, padding: '8px 18px', fontSize: '13px', fontWeight: '700' }}
                            disabled={processingId === citizen.id}
                            onClick={() => handleApprove(citizen)}
                          >
                            ✓ Approve Citizen
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            style={{ background: '#fee2e2', color: '#b91c1c', marginTop: 0, padding: '8px 18px', fontSize: '13px', fontWeight: '600' }}
                            disabled={processingId === citizen.id}
                            onClick={() => setRejectingCitizen(citizen)}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'verified' && (
              <>
                {verifiedCitizens.length === 0 ? (
                  <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
                    <p>No verified citizens in {talukaName} Taluka yet.</p>
                  </div>
                ) : (
                  verifiedCitizens.map((citizen) => (
                    <div key={citizen.id} className="issue-card" style={{ borderLeft: '4px solid #10b981' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '16px', color: '#0f172a' }}>{citizen.name || 'Citizen'}</strong>
                          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>{citizen.email}</p>
                        </div>
                        <span className="status-badge status-resolved">
                          ✓ Verified Citizen
                        </span>
                      </div>
                      <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#475569' }}>
                        📍 {citizen.localArea || talukaName} | Preferred Language: {citizen.preferredLanguage || 'English'}
                      </p>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'rejected' && (
              <>
                {rejectedCitizens.length === 0 ? (
                  <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
                    <p>No rejected citizen applications.</p>
                  </div>
                ) : (
                  rejectedCitizens.map((citizen) => (
                    <div key={citizen.id} className="issue-card" style={{ borderLeft: '4px solid #ef4444' }}>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>{citizen.name || citizen.email}</strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#b91c1c' }}>
                        Reason: {citizen.identityRejectionReason || 'Document verification failed.'}
                      </p>
                    </div>
                  ))
                )}
              </>
            )}
          </section>
        )}
      </main>

      {/* DOCUMENT PREVIEW MODAL */}
      {selectedDoc && (
        <div className="gov-modal-backdrop" onClick={() => setSelectedDoc(null)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <button type="button" className="gov-modal-close" onClick={() => setSelectedDoc(null)}>
              ✕
            </button>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>
              Verification Document: {selectedDoc.name}
            </h3>
            <div style={{ textAlign: 'center', maxHeight: '500px', overflowY: 'auto' }}>
              {selectedDoc.url.startsWith('data:application/pdf') ? (
                <iframe src={selectedDoc.url} title="Citizen Verification Document PDF" style={{ width: '100%', height: '400px', border: 'none' }} />
              ) : (
                <img src={selectedDoc.url} alt="Citizen Verification Document" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingCitizen && (
        <div className="gov-modal-backdrop" onClick={() => setRejectingCitizen(null)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <button type="button" className="gov-modal-close" onClick={() => setRejectingCitizen(null)}>
              ✕
            </button>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#b91c1c' }}>
              Reject Citizen Verification
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 14px 0' }}>
              Provide a reason for rejecting <strong>{rejectingCitizen.name || rejectingCitizen.email}</strong>.
            </p>

            <form onSubmit={handleConfirmReject}>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Identity document is blurred / Name mismatch on ID card..."
                required
                rows="3"
                className="form-textarea"
                style={{ width: '100%', marginBottom: '14px' }}
              />

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="secondary-button" onClick={() => setRejectingCitizen(null)} style={{ marginTop: 0 }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === rejectingCitizen.id}
                  className="primary-button"
                  style={{ background: '#ef4444', color: 'white', marginTop: 0, padding: '8px 18px' }}
                >
                  {processingId === rejectingCitizen.id ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CitizenAccessOfficerDashboard
