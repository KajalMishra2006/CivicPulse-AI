import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { subscribeUserIssues, calculateIssueStats, uploadIssueImage } from './firebase/issues.js'
import ReportIssue from './reportissue.jsx'
import LanguageOnboardingModal from './LanguageOnboardingModal.jsx'
import LanguageSelector from './LanguageSelector.jsx'
import {
  isSpeechSynthesisSupported,
  playTextToSpeech,
  stopTextToSpeech
} from './utils/speech.js'
import {
  getTranslation,
  translateCategory,
  translateStatus,
  translatePriority
} from './utils/translations.js'
import {
  IconBuilding,
  IconClipboard,
  IconClock,
  IconActivity,
  IconCheckCircle,
  IconPlusCircle,
  IconFolder,
  IconLogOut
} from './Icons.jsx'
import './App.css'

function Dashboard({ onLogout }) {
  const { currentUser, userProfile, preferredLanguage, setLanguage, logout } = useAuth()
  const activeLanguage = preferredLanguage || userProfile?.preferredLanguage || 'English'
  const t = getTranslation(activeLanguage)

  const [showReport, setShowReport] = useState(false)
  const [issues, setIssues] = useState([])
  const [showIssues, setShowIssues] = useState(false)
  const [loadingIssues, setLoadingIssues] = useState(true)
  const [speakingIssueId, setSpeakingIssueId] = useState(null)
  const [showLanguageModal, setShowLanguageModal] = useState(false)

  // Citizen Identity Verification State
  const [showIdentityForm, setShowIdentityForm] = useState(false)
  const [idNumber, setIdNumber] = useState('')
  const [idType, setIdType] = useState('Citizen Government ID')
  const [idFile, setIdFile] = useState(null)
  const [idPreview, setIdPreview] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [idVerifyError, setIdVerifyError] = useState('')
  const [idVerifySuccess, setIdVerifySuccess] = useState('')

  useEffect(() => {
    if (!currentUser?.uid) return

    const unsubscribe = subscribeUserIssues(
      currentUser.uid,
      (userIssues) => {
        setIssues(userIssues)
        setLoadingIssues(false)
      },
      (err) => {
        if (import.meta.env?.DEV) console.error('Error loading issues:', err)
        setLoadingIssues(false)
      }
    )

    return () => {
      unsubscribe()
      stopTextToSpeech()
    }
  }, [currentUser?.uid])

  const stats = calculateIssueStats(issues)

  function handleToggleListen(issue) {
    if (speakingIssueId === issue.id) {
      stopTextToSpeech()
      setSpeakingIssueId(null)
      return
    }

    stopTextToSpeech()
    setSpeakingIssueId(issue.id)

    const priorityLabel = translatePriority(issue.priority, t)
    const statusLabel = translateStatus(issue.status, t)
    const categoryLabel = translateCategory(issue.category, t)

    const textToRead = `${issue.title}. ${categoryLabel}. ${t.status || 'Status'}: ${statusLabel}. ${t.priority || 'Priority'}: ${priorityLabel}. ${issue.description}`

    playTextToSpeech({
      text: textToRead,
      languageName: issue.preferredLanguage || activeLanguage,
      onStart: () => setSpeakingIssueId(issue.id),
      onEnd: () => setSpeakingIssueId(null),
      onError: () => setSpeakingIssueId(null)
    })
  }

  function handleIdFileChange(e) {
    setIdVerifyError('')
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setIdVerifyError('Please upload an image (JPG, PNG, WebP) or PDF file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setIdVerifyError('Document size must be less than 5MB.')
      return
    }

    setIdFile(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setIdPreview(url)
    } else {
      setIdPreview(null)
    }
  }

  async function handleIdentitySubmit(e) {
    e.preventDefault()
    setIdVerifyError('')
    setIdVerifySuccess('')

    if (!idNumber.trim()) {
      setIdVerifyError('Please enter your government identity number.')
      return
    }

    setIsVerifying(true)
    try {
      let idDocumentUrl = null
      if (idFile) {
        idDocumentUrl = await uploadIssueImage(idFile, currentUser.uid)
      }

      const response = await fetch('http://localhost:8080/api/identity/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          idNumber: idNumber.trim(),
          idType,
          idDocumentUrl
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit identity verification.')
      }

      setIdVerifySuccess('✓ Identity document submitted successfully. An administrator will review your credentials.')
      setShowIdentityForm(false)
      setIdFile(null)
      setIdPreview(null)
      setIdNumber('')
    } catch (err) {
      console.error('Identity Verification Error:', err)
      setIdVerifyError(err.message || 'Identity verification submission failed.')
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleLogoutClick() {
    stopTextToSpeech()
    if (onLogout) {
      onLogout()
    } else {
      await logout()
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'Recently'
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
      return 'Recently'
    }
  }

  if (showReport) {
    return (
      <ReportIssue
        onBack={() => setShowReport(false)}
        onIssueSubmitted={() => {
          setShowReport(false)
          setShowIssues(true)
        }}
      />
    )
  }

  if (showIssues) {
    return (
      <div className="report-page">
        <div className="report-card issue-list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              className="back-button-styled"
              onClick={() => { stopTextToSpeech(); setShowIssues(false); }}
            >
              ← {t.backToDashboard || 'Back to Dashboard'}
            </button>

            {/* Language Switcher in List View */}
            <LanguageSelector
              currentLanguage={activeLanguage}
              onSelectLanguage={setLanguage}
              variant="dark"
              label={t.language || 'Language'}
            />
          </div>

          <h1 className="report-page-title">{t.myIssues || 'My Issues'}</h1>

          {loadingIssues ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '30px 0' }}>{t.loadingIssues || 'Loading your reported issues...'}</p>
          ) : issues.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              <h3>{t.noIssues || "You haven't reported any issues yet."}</h3>
              <button
                type="button"
                className="primary-button"
                style={{ marginTop: '16px' }}
                onClick={() => { setShowIssues(false); setShowReport(true); }}
              >
                {(t.reportAnIssueBtn || 'Report an Issue').replace(/^\+\s*/, '')}
              </button>
            </div>
          ) : (
            <div className="issue-cards-grid">
              {issues.map((issue) => {
                const priority = (issue.priority || 'Medium').toLowerCase()
                const status = (issue.status || 'Pending').toLowerCase()
                const isSpeaking = speakingIssueId === issue.id

                return (
                  <div key={issue.id} className="issue-card">
                    <div className="issue-header-row">
                      <div className="issue-title-group">
                        <span className={`priority-badge priority-${priority}`}>
                          {priority === 'high' && '🚨 '}
                          {translatePriority(issue.priority, t)}
                        </span>
                        {issue.preferredLanguage && (
                          <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                            🌐 {issue.preferredLanguage}
                          </span>
                        )}
                        <h2 className="issue-title">{issue.title}</h2>
                      </div>

                      <span className={`status-badge status-${status.replace(' ', '-')}`}>
                        {translateStatus(issue.status, t)}
                      </span>
                    </div>

                    <div className="issue-meta-row">
                      <div className="issue-meta-item">
                        <strong>{t.category || 'Category'}:</strong> {translateCategory(issue.category, t)}
                      </div>
                      <div className="issue-meta-item">
                        <strong>{t.location || 'Location'}:</strong> {issue.location || 'Not specified'}
                      </div>
                      <div className="issue-meta-item">
                        <strong>{t.date || 'Date'}:</strong> {formatDate(issue.createdAt)}
                      </div>
                    </div>

                    <p className="issue-description">{issue.description}</p>

                    {issue.imageUrl && (
                      <div className="issue-image-container">
                        <img
                          src={issue.imageUrl}
                          alt={issue.title}
                          className="issue-photo"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* AI English Translation (if submitted in another language) */}
                    {issue.aiTranslatedText && (
                      <div className="ai-translated-box">
                        <span className="ai-trans-label">
                          ✨ {t.aiTranslation || 'AI Translation (English)'}:
                        </span>
                        <p className="ai-trans-text">{issue.aiTranslatedText}</p>
                      </div>
                    )}

                    {/* Action row with Text-to-Speech listen button */}
                    <div className="issue-card-actions">
                      {isSpeechSynthesisSupported() && (
                        <button
                          type="button"
                          className="btn-tts-listen"
                          onClick={() => handleToggleListen(issue)}
                          aria-label={isSpeaking ? 'Stop reading complaint' : 'Listen to complaint aloud'}
                        >
                          <span>{isSpeaking ? (t.stopReading || '⏹️ Stop') : (t.listenToComplaint || '🔊 Listen')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const identityStatus = userProfile?.identityVerificationStatus || 'unverified'

  return (
    <div className="dashboard-page">
      {/* 1. TOP NAVIGATION BAR */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2>CivicPulse<span className="brand-accent">-AI</span></h2>
          <span className="citizen-badge">
            <IconBuilding size={14} />
            <span>{t.citizen || 'Citizen Portal'}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <LanguageSelector
            currentLanguage={activeLanguage}
            onSelectLanguage={setLanguage}
            variant="dark"
            label={t.language || 'Language'}
          />

          <div className="user-profile-tag">
            <span className="user-name-text">{userProfile?.name || currentUser?.displayName || currentUser?.email}</span>
            <button
              type="button"
              className="navbar-logout-btn"
              onClick={handleLogoutClick}
            >
              <IconLogOut size={13} />
              <span>{t.logout || 'Logout'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main className="dashboard-content">
        <section className="hero-section">
          <div>
            <p className="welcome-label">{t.welcomeSub || 'Make Your Community Better.'}</p>
            <h1>{t.welcome || 'Welcome to CivicPulse-AI'}</h1>
            <p>
              {t.welcomeDesc || 'Report civic problems, track their progress, and help create a better community.'}
            </p>
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowReport(true)}
            >
              <IconPlusCircle size={17} />
              <span>{(t.reportAnIssueBtn || 'Report an Issue').replace(/^\+\s*/, '')}</span>
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowIssues(true)}
            >
              <IconFolder size={17} />
              <span>{t.viewMyIssuesBtn || 'View My Issues'}</span>
            </button>
          </div>
        </section>

        {/* CITIZEN IDENTITY VERIFICATION BANNER / CARD */}
        <section className="citizen-id-section">
          <div className="citizen-id-content">
            <div className="citizen-id-icon-wrap">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <strong className="citizen-id-title">
              Citizen Identity Verification
            </strong>
            <span className="citizen-id-subtitle">
              {identityStatus === 'verified' && '✓ Verified Account — One verified identity per citizen'}
              {identityStatus === 'pending' && '⏳ Verification in review by system administrator'}
              {identityStatus === 'rejected' && `❌ Verification Rejected: ${userProfile?.identityRejectionReason || 'Please resubmit valid document'}`}
              {identityStatus === 'unverified' && 'Verify your government identity document to secure your citizen account.'}
            </span>
          </div>

          <div className="citizen-id-badge-wrap">
            {identityStatus === 'verified' ? (
              <span className="citizen-id-badge-verified">
                ✓ Identity Verified
              </span>
            ) : identityStatus === 'pending' ? (
              <span className="citizen-id-badge-pending">
                ⏳ Verification Pending
              </span>
            ) : (
              <button
                type="button"
                className="citizen-id-btn"
                onClick={() => setShowIdentityForm((prev) => !prev)}
              >
                {showIdentityForm ? 'Cancel' : 'Verify Identity'}
              </button>
            )}
          </div>

          {idVerifySuccess && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '8px', fontSize: '13px' }}>
              {idVerifySuccess}
            </div>
          )}

          {idVerifyError && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', fontSize: '13px' }}>
              ⚠️ {idVerifyError}
            </div>
          )}

          {showIdentityForm && (
            <form onSubmit={handleIdentitySubmit} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Document Type *
                  </label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    disabled={isVerifying}
                    className="form-select"
                    style={{ width: '100%', padding: '8px 12px' }}
                  >
                    <option value="Citizen Government ID">Government ID Card</option>
                    <option value="Voter ID">Voter ID Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Passport">Passport</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Government Identity Number *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DL-1420110012345 / Voter ID"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    disabled={isVerifying}
                    required
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Upload Identity Document (Optional / Recommended - max 5MB)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleIdFileChange}
                  disabled={isVerifying}
                  className="form-file-input"
                />
              </div>

              {idPreview && (
                <div style={{ marginTop: '10px' }}>
                  <img src={idPreview} alt="ID Document Preview" style={{ maxHeight: '90px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </div>
              )}

              <div style={{ marginTop: '12px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}>
                🔒 <strong>Privacy Assurance:</strong> Your identity document is used exclusively for one-person-one-account uniqueness and verified by CivicPulse administrators. Raw ID numbers are never stored in plain text and never sent to AI models or translation engines.
              </div>

              <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={isVerifying}
                  style={{
                    background: '#0284c7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {isVerifying ? 'Submitting Verification...' : 'Submit for Verification'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowIdentityForm(false)}
                  disabled={isVerifying}
                  className="secondary-button"
                  style={{ marginTop: 0 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        {/* 3. METRICS / STATS SECTION */}
        <section className="stats-container-4">
          <div className="stat-card stat-card-reported">
            <div className="stat-icon-wrapper stat-icon-reported">
              <IconClipboard size={24} />
            </div>
            <h2>{stats.total}</h2>
            <p>{t.issuesReported || 'Issues Reported'}</p>
          </div>

          <div className="stat-card stat-card-pending">
            <div className="stat-icon-wrapper stat-icon-pending">
              <IconClock size={24} />
            </div>
            <h2>{stats.pending}</h2>
            <p>{t.pendingIssues || 'Pending Issues'}</p>
          </div>

          <div className="stat-card stat-card-inprogress">
            <div className="stat-icon-wrapper stat-icon-inprogress">
              <IconActivity size={24} />
            </div>
            <h2>{stats.inProgress}</h2>
            <p>{t.inProgress || 'In Progress'}</p>
          </div>

          <div className="stat-card stat-card-resolved">
            <div className="stat-icon-wrapper stat-icon-resolved">
              <IconCheckCircle size={24} />
            </div>
            <h2>{stats.resolved}</h2>
            <p>{t.issuesResolved || 'Issues Resolved'}</p>
          </div>
        </section>

      </main>

      {/* Language Onboarding / Selection Modal if invoked */}
      {showLanguageModal && (
        <LanguageOnboardingModal
          currentLanguage={activeLanguage}
          onSelectLanguage={(lang) => {
            setLanguage(lang)
            setShowLanguageModal(false)
          }}
        />
      )}
    </div>
  )
}

export default Dashboard