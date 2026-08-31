import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import {
  subscribeScopedIssues,
  updateIssueStatus,
  calculateOfficialStats,
  getIssueGroupReports
} from './firebase/issues.js'
import {
  playTextToSpeech,
  stopTextToSpeech
} from './utils/speech.js'
import { translateComplaintDynamic } from './utils/complaintTranslator.js'
import './App.css'

function GovernmentDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()

  const stateName = userProfile?.stateName || userProfile?.state || 'Maharashtra'
  const stateId = userProfile?.stateId || stateName.toLowerCase().replace(/\s+/g, '_')

  const districtName = userProfile?.districtName || userProfile?.district || 'Pune'
  const districtId = userProfile?.districtId || districtName.toLowerCase().replace(/\s+/g, '_')

  const talukaName = userProfile?.talukaName || userProfile?.taluka || 'Haveli'
  const talukaId = userProfile?.talukaId || talukaName.toLowerCase().replace(/\s+/g, '_')

  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [filterCategory, setFilterCategory] = useState('All')
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'in_progress' | 'resolved'
  const [resolutionNotes, setResolutionNotes] = useState('')

  // Clustered details modal state
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [groupReports, setGroupReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(false)

  // Dynamic Translation & Voice in Details
  const [translationLang, setTranslationLang] = useState('English')
  const [translatedText, setTranslatedText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  useEffect(() => {
    // 1. Real-time subscription strictly scoped to this Taluka
    const unsubscribe = subscribeScopedIssues(
      { role: 'issue_resolution_employee', stateId, districtId, talukaId },
      (scopedIssues) => {
        setIssues(scopedIssues)
        setLoading(false)
        setError('')
      },
      (err) => {
        console.error('Error fetching taluka issues:', err)
        setError('Failed to fetch taluka issues in real time.')
        setLoading(false)
      }
    )

    return () => {
      unsubscribe()
      stopTextToSpeech()
    }
  }, [stateId, districtId, talukaId])

  // Open modal and load grouped citizen reports
  async function handleOpenDetails(issue) {
    setSelectedIssue(issue)
    setTranslatedText('')
    setResolutionNotes(issue.resolutionNotes || '')
    setLoadingReports(true)

    try {
      const clusterId = issue.issueClusterId || issue.groupId || issue.id
      const reports = await getIssueGroupReports(clusterId)
      setGroupReports(reports.length > 0 ? reports : [issue])
    } catch (err) {
      console.error('Error loading cluster reports:', err)
      setGroupReports([issue])
    } finally {
      setLoadingReports(false)
    }
  }

  function handleCloseDetails() {
    setSelectedIssue(null)
    setGroupReports([])
    setTranslatedText('')
    stopTextToSpeech()
    setIsPlayingAudio(false)
  }

  // Handle dynamic translation
  async function handleTranslate(targetLang) {
    if (!selectedIssue) return
    setTranslationLang(targetLang)
    setIsTranslating(true)

    try {
      const result = await translateComplaintDynamic({
        text: selectedIssue.description,
        sourceLanguage: selectedIssue.preferredLanguage || selectedIssue.originalLanguage || 'Auto',
        targetLanguage: targetLang
      })
      setTranslatedText(result)
    } catch (err) {
      console.error('Translation error:', err)
    } finally {
      setIsTranslating(false)
    }
  }

  // Handle TTS audio reading
  function handleToggleAudio() {
    if (isPlayingAudio) {
      stopTextToSpeech()
      setIsPlayingAudio(false)
      return
    }

    if (!selectedIssue) return
    const textToSpeak = translatedText || selectedIssue.description
    const langToSpeak = translatedText ? translationLang : (selectedIssue.preferredLanguage || 'English')

    playTextToSpeech({
      text: textToSpeak,
      languageName: langToSpeak,
      onStart: () => setIsPlayingAudio(true),
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false)
    })
  }

  // Handle Status Update with Resolution Notes
  async function handleStatusChange(issueId, newStatus) {
    setUpdatingId(issueId)
    setError('')
    try {
      await updateIssueStatus(issueId, newStatus, currentUser?.uid, resolutionNotes)
      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue((prev) => ({ ...prev, status: newStatus, resolutionNotes }))
      }
    } catch (err) {
      console.error('Error updating status:', err)
      setError('Failed to update issue status. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Filter issues based on active tab and category
  const filteredIssues = issues.filter((issue) => {
    const rawStatus = (issue.status || 'Pending').toLowerCase()
    if (activeTab === 'pending' && rawStatus !== 'pending') return false
    if (activeTab === 'in_progress' && rawStatus !== 'in progress') return false
    if (activeTab === 'resolved' && rawStatus !== 'resolved') return false

    if (filterCategory !== 'All' && issue.category !== filterCategory) return false
    return true
  })

  const stats = calculateOfficialStats(issues)

  return (
    <div className="dashboard-page">
      {/* 1. TOP NAVBAR */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h2>CivicPulse<span className="brand-accent">-AI</span></h2>
          <span className="official-badge">
            Taluka Issue Resolution Portal
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
        <section className="hero-section" style={{ background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)', color: 'white' }}>
          <div>
            <p className="welcome-label" style={{ color: '#a7f3d0' }}>MUNICIPAL FIELD OPERATIONS & RESOLUTION</p>
            <h1 style={{ color: 'white' }}>{talukaName} Taluka Civic Resolution</h1>
            <p style={{ color: '#d1fae5' }}>
              Real-time complaint triage sorted by AI Priority Score descending. Clustered community issues update across all citizens simultaneously.
            </p>
          </div>
        </section>

        {error && <p className="error-message main-error">{error}</p>}

        {/* 3. KEY METRICS STATS CARDS */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">📋</span>
            <h2>{stats.total}</h2>
            <p>Total Complaints</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">🚨</span>
            <h2 style={{ color: '#dc2626' }}>{stats.highPriority}</h2>
            <p>High Priority</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <h2 style={{ color: '#eab308' }}>{stats.pending}</h2>
            <p>Pending</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⚙️</span>
            <h2 style={{ color: '#0284c7' }}>{stats.inProgress}</h2>
            <p>In Progress</p>
          </div>

          <div className="stat-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span className="stat-icon">✅</span>
            <h2 style={{ color: '#166534' }}>{stats.resolved}</h2>
            <p style={{ color: '#15803d', fontWeight: '700' }}>Resolved</p>
          </div>
        </section>

        {/* 4. QUEUE TABS & CATEGORY FILTER */}
        <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`filter-btn ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
            >
              ⏳ Active Pending Queue ({stats.pending})
            </button>

            <button
              type="button"
              className={`filter-btn ${activeTab === 'in_progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('in_progress')}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
            >
              ⚙️ In Progress ({stats.inProgress})
            </button>

            <button
              type="button"
              className={`filter-btn ${activeTab === 'resolved' ? 'active' : ''}`}
              onClick={() => setActiveTab('resolved')}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
            >
              ✓ Resolved Archive ({stats.resolved})
            </button>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="form-select"
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            <option value="All">All Categories</option>
            <option value="Roads">Roads & Potholes</option>
            <option value="Garbage">Garbage & Sanitation</option>
            <option value="Streetlight">Streetlights</option>
            <option value="Water">Water Supply</option>
            <option value="Drainage">Drainage & Flooding</option>
            <option value="Electricity">Electricity & Power</option>
            <option value="Other">Other Civic Issues</option>
          </select>
        </section>

        {/* 5. ISSUES QUEUE */}
        {loading ? (
          <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
            <p>Loading taluka complaint queue...</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
            <p>No complaints in this queue for {talukaName} Taluka.</p>
          </div>
        ) : (
          <section className="issues-list-section">
            {filteredIssues.map((issue) => {
              const priorityClass = (issue.priority || 'MEDIUM').toLowerCase()
              const statusClass = (issue.status || 'Pending').toLowerCase().replace(' ', '-')
              const reportCount = issue.reportCount || 1

              return (
                <div
                  key={issue.id}
                  className={`issue-card priority-${priorityClass}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleOpenDetails(issue)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span className={`priority-badge priority-${priorityClass}`}>
                        {issue.priority || 'MEDIUM'} ({issue.priorityScore || 50}/100)
                      </span>

                      <h2 style={{ margin: 0, fontSize: '18px' }}>{issue.title}</h2>

                      {reportCount > 1 && (
                        <span style={{ fontSize: '12px', background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontWeight: '700' }}>
                          👥 {reportCount} Citizens Reported
                        </span>
                      )}
                    </div>

                    <span className={`status-badge status-${statusClass}`}>
                      {issue.status || 'Pending'}
                    </span>
                  </div>

                  <p style={{ margin: '8px 0', fontSize: '14px', color: '#334155' }}>
                    {issue.description}
                  </p>

                  <div className="issue-meta-row">
                    <div className="issue-meta-item">
                      <strong>Category:</strong> {issue.category}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Location:</strong> {issue.location || `${talukaName}, ${districtName}`}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Reported:</strong> {issue.createdAt?.seconds ? new Date(issue.createdAt.seconds * 1000).toLocaleString() : 'Recent'}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Language:</strong> {issue.preferredLanguage || 'English'}
                    </div>
                  </div>

                  {/* QUICK STATUS BUTTONS */}
                  <div
                    className="status-control-container"
                    style={{ marginTop: '12px', paddingTop: '10px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="status-control-label">Status Action:</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`status-btn-pill ${issue.status === 'Pending' ? 'active-pending' : ''}`}
                        disabled={updatingId === issue.id}
                        onClick={() => handleStatusChange(issue.id, 'Pending')}
                      >
                        Pending
                      </button>

                      <button
                        type="button"
                        className={`status-btn-pill ${issue.status === 'In Progress' ? 'active-progress' : ''}`}
                        disabled={updatingId === issue.id}
                        onClick={() => handleStatusChange(issue.id, 'In Progress')}
                      >
                        In Progress
                      </button>

                      <button
                        type="button"
                        className={`status-btn-pill ${issue.status === 'Resolved' ? 'active-resolved' : ''}`}
                        disabled={updatingId === issue.id}
                        onClick={() => handleStatusChange(issue.id, 'Resolved')}
                      >
                        ✓ Mark Resolved
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </main>

      {/* 6. DETAILED CLUSTER MODAL WITH CITIZEN AUDIT LIST & AI TRANSLATION */}
      {selectedIssue && (
        <div className="gov-modal-backdrop" onClick={handleCloseDetails}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <button type="button" className="gov-modal-close" onClick={handleCloseDetails}>
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span className={`priority-badge priority-${(selectedIssue.priority || 'MEDIUM').toLowerCase()}`}>
                {selectedIssue.priority || 'MEDIUM'} ({selectedIssue.priorityScore || 50}/100)
              </span>
              <h2 style={{ margin: 0, fontSize: '22px' }}>{selectedIssue.title}</h2>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 14px 0' }}>
              📍 {selectedIssue.location || `${talukaName}, ${districtName}`} | Category: <strong>{selectedIssue.category}</strong>
            </p>

            {/* ORIGINAL COMPLAINT & AUDIO LISTENING */}
            <div style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                  Original Complaint Description ({selectedIssue.preferredLanguage || 'English'})
                </strong>

                <button
                  type="button"
                  className="btn-tts-listen"
                  onClick={handleToggleAudio}
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                >
                  {isPlayingAudio ? '⏹️ Stop Reading' : '🔊 Listen Aloud'}
                </button>
              </div>

              <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {translatedText || selectedIssue.description}
              </p>
            </div>

            {/* DYNAMIC GEMINI TRANSLATION TOOL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                🌐 Translate Complaint:
              </span>
              {['English', 'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Bengali', 'Kannada'].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleTranslate(lang)}
                  disabled={isTranslating}
                  className={`filter-btn ${translationLang === lang ? 'active' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  {lang}
                </button>
              ))}
              {isTranslating && <span style={{ fontSize: '12px', color: '#0284c7' }}>Translating with Gemini AI...</span>}
            </div>

            {/* CITIZEN SUBMISSIONS IN THIS CLUSTER */}
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>👥</span> All Citizen Reports in This Cluster ({groupReports.length})
              </h3>

              {loadingReports ? (
                <p style={{ fontSize: '13px', color: '#64748b' }}>Loading reporting citizen details...</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                  {groupReports.map((rep, idx) => (
                    <div key={rep.id || idx} style={{ padding: '8px 10px', borderBottom: idx < groupReports.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontWeight: '600' }}>
                        <span>{idx + 1}. {rep.userName || rep.userEmail || 'Citizen'}</span>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          {rep.createdAt?.seconds ? new Date(rep.createdAt.seconds * 1000).toLocaleString() : 'Recent'}
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0 0', color: '#475569', fontSize: '12px' }}>
                        "{rep.originalDescription || rep.description}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RESOLUTION NOTES & ACTIONS */}
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Resolution Notes / Action Taken:
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="e.g. Municipal road team dispatched; pothole filled with hot mix asphalt..."
                rows="2"
                className="form-textarea"
                style={{ width: '100%', marginBottom: '12px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ marginTop: 0 }}
                    onClick={() => handleStatusChange(selectedIssue.id, 'In Progress')}
                    disabled={updatingId === selectedIssue.id}
                  >
                    Mark In Progress
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ background: '#10b981', color: 'white', marginTop: 0 }}
                    onClick={() => handleStatusChange(selectedIssue.id, 'Resolved')}
                    disabled={updatingId === selectedIssue.id}
                  >
                    ✓ Save & Resolve Cluster
                  </button>
                </div>

                <button type="button" className="secondary-button" style={{ marginTop: 0 }} onClick={handleCloseDetails}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GovernmentDashboard
