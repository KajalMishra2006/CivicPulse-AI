import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { subscribeUserIssues, calculateIssueStats } from './firebase/issues.js'
import { maskPhoneNumber, maskGovernmentId } from './firebase/auth.js'
import ReportIssue from './reportissue.jsx'
import LanguageOnboardingModal from './LanguageOnboardingModal.jsx'
import LanguageSelector from './LanguageSelector.jsx'
import ComplaintStatusChart from './ComplaintStatusChart.jsx'
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
  IconLogOut,
  IconUsers,
  IconMapPin
} from './Icons.jsx'
import './App.css'

function Dashboard({ onLogout }) {
  const { currentUser, userProfile, preferredLanguage, setLanguage, logout } = useAuth()
  const activeLanguage = preferredLanguage || userProfile?.preferredLanguage || 'English'
  const t = getTranslation(activeLanguage)

  // Citizen 5-Navigation Tabs: 'profile' | 'submit' | 'my_complaints' | 'complaint_status'
  const [activeNav, setActiveNav] = useState('my_complaints')
  const [issues, setIssues] = useState([])
  const [loadingIssues, setLoadingIssues] = useState(true)
  const [speakingIssueId, setSpeakingIssueId] = useState(null)
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [filterCategory, setFilterCategory] = useState('All')

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

  // Filter complaints for citizen
  const filteredIssues = issues.filter((issue) => {
    if (filterCategory !== 'All' && issue.category !== filterCategory) return false
    return true
  })

  // Submit Complaint view directly delegates to ReportIssue
  if (activeNav === 'submit') {
    return (
      <ReportIssue
        onBack={() => {
          stopTextToSpeech()
          setActiveNav('my_complaints')
        }}
        onIssueSubmitted={() => {
          stopTextToSpeech()
          setActiveNav('my_complaints')
        }}
      />
    )
  }

  return (
    <div className="dashboard-page">
      {/* 1. TOP NAVIGATION BAR */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            className="govbridge-nav-brand"
            onClick={() => { stopTextToSpeech(); setActiveNav('my_complaints'); }}
            title="GovBridge Home"
            style={{ cursor: 'pointer' }}
          >
            <img src="/govbridge-logo.png" alt="GovBridge" className="govbridge-nav-logo" />
          </div>
          <span className="citizen-badge">
            <IconBuilding size={14} />
            <span>{t.citizen || 'Citizen Portal'}</span>
          </span>
          <span style={{ fontSize: '13px', background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            📍 {userProfile?.talukaName || userProfile?.taluka || 'Local'}, {userProfile?.districtName || userProfile?.district || 'District'}
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
            <h1>{t.welcome || 'Welcome to GovBridge'}</h1>
            <p>
              {t.welcomeDesc || 'Report civic problems, track their progress, and help create a better community.'}
            </p>
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => { stopTextToSpeech(); setActiveNav('submit'); }}
            >
              <IconPlusCircle size={17} />
              <span>{(t.reportAnIssueBtn || 'Report an Issue').replace(/^\+\s*/, '')}</span>
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => { stopTextToSpeech(); setActiveNav('my_complaints'); }}
            >
              <IconFolder size={17} />
              <span>{t.viewMyIssuesBtn || 'View My Issues'}</span>
            </button>
          </div>
        </section>

        {/* CITIZEN 5-TIER CLEAN NAVIGATION TABS */}
        <div className="citizen-nav-tabs" style={{ display: 'flex', gap: '8px', margin: '20px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`filter-btn ${activeNav === 'profile' ? 'active' : ''}`}
            onClick={() => { stopTextToSpeech(); setActiveNav('profile'); }}
            style={{ padding: '9px 18px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconUsers size={16} />
            <span>Profile</span>
          </button>

          <button
            type="button"
            className={`filter-btn ${activeNav === 'submit' ? 'active' : ''}`}
            onClick={() => { stopTextToSpeech(); setActiveNav('submit'); }}
            style={{ padding: '9px 18px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconPlusCircle size={16} />
            <span>Submit Complaint</span>
          </button>

          <button
            type="button"
            className={`filter-btn ${activeNav === 'my_complaints' ? 'active' : ''}`}
            onClick={() => { stopTextToSpeech(); setActiveNav('my_complaints'); }}
            style={{ padding: '9px 18px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconFolder size={16} />
            <span>My Complaints ({issues.length})</span>
          </button>

          <button
            type="button"
            className={`filter-btn ${activeNav === 'complaint_status' ? 'active' : ''}`}
            onClick={() => { stopTextToSpeech(); setActiveNav('complaint_status'); }}
            style={{ padding: '9px 18px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconActivity size={16} />
            <span>Complaint Status</span>
          </button>

          <button
            type="button"
            className="filter-btn"
            onClick={handleLogoutClick}
            style={{ padding: '9px 18px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}
          >
            <IconLogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: PROFILE */}
        {/* ======================================================== */}
        {activeNav === 'profile' && (
          <section className="profile-section">
            <div className="stat-card" style={{ padding: '24px', background: 'white', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <IconUsers size={22} color="#0284c7" />
                    <span>Citizen Profile & Account</span>
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    Verified citizen profile details with automated registration activation.
                  </p>
                </div>

                <span style={{ fontSize: '12px', background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconCheckCircle size={14} />
                  <span>Active & Verified Account</span>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Citizen Full Name</span>
                  <strong style={{ fontSize: '15px', color: '#0f172a' }}>{userProfile?.name || currentUser?.displayName || 'Citizen'}</strong>
                </div>

                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Registered Email</span>
                  <strong style={{ fontSize: '15px', color: '#0f172a' }}>{currentUser?.email || 'N/A'}</strong>
                </div>

                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Mobile Phone Number (Masked)</span>
                  <strong style={{ fontSize: '15px', color: '#0f172a' }}>{maskPhoneNumber(userProfile?.mobileNumber || userProfile?.phone || '')}</strong>
                </div>

                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Government ID Number (Masked)</span>
                  <strong style={{ fontSize: '15px', color: '#0f172a' }}>{maskGovernmentId(userProfile?.idNumber || userProfile?.governmentId || '')}</strong>
                </div>
              </div>

              <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e40af', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconMapPin size={16} />
                  <span>Administrative Jurisdiction</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>State:</span>
                    <strong style={{ color: '#0f172a' }}>{userProfile?.stateName || userProfile?.state || 'Maharashtra'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>District:</span>
                    <strong style={{ color: '#0f172a' }}>{userProfile?.districtName || userProfile?.district || 'Pune'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Taluka:</span>
                    <strong style={{ color: '#0f172a' }}>{userProfile?.talukaName || userProfile?.taluka || 'Haveli'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Local Ward / Area:</span>
                    <strong style={{ color: '#0f172a' }}>{userProfile?.localArea || 'Main Ward'}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primary-button"
                  style={{ marginTop: 0 }}
                  onClick={() => setActiveNav('submit')}
                >
                  <IconPlusCircle size={16} />
                  <span>Submit a New Complaint</span>
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ marginTop: 0 }}
                  onClick={() => setActiveNav('my_complaints')}
                >
                  <IconFolder size={16} />
                  <span>View My Complaints ({issues.length})</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: MY COMPLAINTS */}
        {/* ======================================================== */}
        {activeNav === 'my_complaints' && (
          <section className="my-complaints-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 16px 0', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                  {t.myIssues || 'My Complaints'} ({filteredIssues.length})
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Showing all civic complaints submitted by your account.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="form-select"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >
                  <option value="All">All Categories</option>
                  <option value="Roads">{t.roadsPotholes || 'Roads & Potholes'}</option>
                  <option value="Garbage">{t.garbageSanitation || 'Garbage & Sanitation'}</option>
                  <option value="Streetlight">{t.streetlights || 'Streetlights'}</option>
                  <option value="Water">{t.waterSupply || 'Water Supply'}</option>
                  <option value="Drainage">{t.drainageFlooding || 'Drainage & Flooding'}</option>
                  <option value="Electricity">{t.electricityPower || 'Electricity & Power'}</option>
                  <option value="Other">{t.otherCivic || 'Other Civic Issues'}</option>
                </select>

                <button
                  type="button"
                  className="primary-button"
                  style={{ marginTop: 0, padding: '7px 14px', fontSize: '13px' }}
                  onClick={() => setActiveNav('submit')}
                >
                  <span>+ New Complaint</span>
                </button>
              </div>
            </div>

            {loadingIssues ? (
              <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
                <p style={{ color: '#64748b' }}>{t.loadingIssues || 'Loading your reported complaints...'}</p>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="stat-card" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>{t.noIssues || "No complaints found."}</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>
                  {filterCategory === 'All' ? "You haven't reported any civic complaints yet." : `No complaints found in category "${filterCategory}".`}
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setActiveNav('submit')}
                >
                  <IconPlusCircle size={16} />
                  <span>Submit a Complaint</span>
                </button>
              </div>
            ) : (
              <div className="issue-cards-grid">
                {filteredIssues.map((issue) => {
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

                      {/* Resolution Notes from Taluka Officer if Resolved */}
                      {issue.status === 'Resolved' && issue.resolutionNotes && (
                        <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', color: '#166534' }}>
                          <strong>✓ Officer Resolution Note:</strong> {issue.resolutionNotes}
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
          </section>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: COMPLAINT STATUS */}
        {/* ======================================================== */}
        {activeNav === 'complaint_status' && (
          <section className="complaint-status-section">
            {/* Visual Problem Status Chart */}
            <ComplaintStatusChart
              title="My Problem Status Breakdown"
              pending={stats.pending}
              inProgress={stats.inProgress}
              resolved={stats.resolved}
            />

            {/* 4 Stats Cards */}
            <section className="stats-container-4" style={{ margin: '20px 0' }}>
              <div className="stat-card stat-card-reported">
                <div className="stat-icon-wrapper stat-icon-reported">
                  <IconClipboard size={24} />
                </div>
                <h2>{stats.total}</h2>
                <p>{t.issuesReported || 'Total Complaints'}</p>
              </div>

              <div className="stat-card stat-card-pending">
                <div className="stat-icon-wrapper stat-icon-pending">
                  <IconClock size={24} />
                </div>
                <h2>{stats.pending}</h2>
                <p>{t.pendingIssues || 'Pending Investigation'}</p>
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
                <p>{t.issuesResolved || 'Resolved & Closed'}</p>
              </div>
            </section>

            {/* STATUS TRACKER TIMELINE FOR EACH COMPLAINT */}
            <div className="stat-card" style={{ padding: '24px', background: 'white' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 16px 0' }}>
                Live Complaint Lifecycle Tracker
              </h3>

              {issues.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
                  No active complaints to track.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {issues.map((issue) => {
                    const status = (issue.status || 'Pending').toLowerCase()
                    const isPending = status === 'pending'
                    const isInProgress = status === 'in progress'
                    const isResolved = status === 'resolved'

                    return (
                      <div key={issue.id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                          <strong style={{ fontSize: '15px', color: '#0f172a' }}>{issue.title}</strong>
                          <span className={`status-badge status-${status.replace(' ', '-')}`}>
                            {issue.status || 'Pending'}
                          </span>
                        </div>

                        {/* Visual Progress Steps: Pending -> In Progress -> Resolved */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0', fontSize: '12px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontWeight: '700', background: isPending || isInProgress || isResolved ? '#fef08a' : '#e2e8f0', color: '#854d0e' }}>
                            1. Pending (Received)
                          </span>
                          <span>→</span>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontWeight: '700', background: isInProgress || isResolved ? '#bae6fd' : '#f1f5f9', color: isInProgress || isResolved ? '#0369a1' : '#94a3b8' }}>
                            2. In Progress (Investigation)
                          </span>
                          <span>→</span>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontWeight: '700', background: isResolved ? '#bbf7d0' : '#f1f5f9', color: isResolved ? '#15803d' : '#94a3b8' }}>
                            3. Resolved (Action Taken)
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <span><strong>Jurisdiction:</strong> {issue.talukaName || issue.taluka || userProfile?.talukaName || 'Haveli'} Taluka, {issue.districtName || issue.district || userProfile?.districtName || 'Pune'}</span>
                          <span><strong>Submitted:</strong> {formatDate(issue.createdAt)}</span>
                        </div>

                        {isResolved && issue.resolutionNotes && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', background: '#dcfce7', borderRadius: '6px', fontSize: '12px', color: '#166534' }}>
                            <strong>Official Resolution:</strong> {issue.resolutionNotes}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

      </main>

      {/* 4. GOVBRIDGE FOOTER */}
      <footer className="govbridge-footer">
        <div className="govbridge-footer-inner">
          <div className="govbridge-footer-brand">
            <img src="/govbridge-logo.png" alt="GovBridge" className="govbridge-footer-logo" />
          </div>
          <p className="govbridge-footer-copy">© {new Date().getFullYear()} GovBridge Civic Platform. All rights reserved.</p>
        </div>
      </footer>

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