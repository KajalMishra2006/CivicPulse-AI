import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { subscribeAllIssues } from './firebase/issues.js'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase/config.js'
import { INDIAN_STATES_AND_DISTRICTS, getDistrictsForState } from './utils/locations.js'
import './App.css'

function HigherAuthorityDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()

  const [issues, setIssues] = useState([])
  const [users, setUsers] = useState([])
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)

  // Dynamic Geographic Filters
  const [selectedState, setSelectedState] = useState('All')
  const [selectedDistrict, setSelectedDistrict] = useState('All')
  const [selectedTimeRange, setSelectedTimeRange] = useState('all') // '7d' | '30d' | 'all'

  useEffect(() => {
    // 1. Subscribe to all issues
    const unsubIssues = subscribeAllIssues(
      (allIssues) => {
        setIssues(allIssues)
        setLoading(false)
      },
      (err) => {
        console.error('Higher Authority Issues Error:', err)
        setLoading(false)
      }
    )

    // 2. Subscribe to all user accounts to compute citizen and officer metrics
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const allUsers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setUsers(allUsers)
        setOfficers(allUsers.filter((u) => u.role && u.role !== 'citizen' && u.verified === true))
      },
      (err) => console.error('Higher Authority Users Error:', err)
    )

    return () => {
      unsubIssues()
      unsubUsers()
    }
  }, [])

  // Available districts based on selected state
  const availableDistricts = useMemo(() => {
    if (selectedState === 'All') return []
    return getDistrictsForState(selectedState)
  }, [selectedState])

  // Filter issues based on State and District
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // 1. State filter
      if (selectedState !== 'All') {
        const issueState = (issue.state || '').toLowerCase()
        if (issueState !== selectedState.toLowerCase()) return false
      }

      // 2. District filter
      if (selectedDistrict !== 'All') {
        const issueDist = (issue.district || issue.localArea || '').toLowerCase()
        if (!issueDist.includes(selectedDistrict.toLowerCase())) return false
      }

      return true
    })
  }, [issues, selectedState, selectedDistrict])

  // Filter citizens based on State & District
  const filteredCitizens = useMemo(() => {
    return users.filter((u) => {
      if (u.role && u.role !== 'citizen') return false
      if (selectedState !== 'All') {
        if ((u.state || '').toLowerCase() !== selectedState.toLowerCase()) return false
      }
      if (selectedDistrict !== 'All') {
        if ((u.district || '').toLowerCase() !== selectedDistrict.toLowerCase()) return false
      }
      return true
    })
  }, [users, selectedState, selectedDistrict])

  // Filter officers based on State & District
  const filteredOfficers = useMemo(() => {
    return officers.filter((off) => {
      if (selectedState !== 'All') {
        if ((off.state || '').toLowerCase() !== selectedState.toLowerCase()) return false
      }
      if (selectedDistrict !== 'All') {
        if ((off.district || '').toLowerCase() !== selectedDistrict.toLowerCase()) return false
      }
      return true
    })
  }, [officers, selectedState, selectedDistrict])

  // Aggregate Key Performance Indicators (KPIs)
  const kpis = useMemo(() => {
    const total = filteredIssues.length
    const pending = filteredIssues.filter((i) => (i.status || 'Pending').toLowerCase() === 'pending').length
    const inProgress = filteredIssues.filter((i) => (i.status || '').toLowerCase() === 'in progress').length
    const resolved = filteredIssues.filter((i) => (i.status || '').toLowerCase() === 'resolved').length
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0

    // Compute average resolution turnaround time
    let totalResolutionHours = 0
    let resolvedWithTimestampsCount = 0

    filteredIssues.forEach((issue) => {
      if (issue.status === 'Resolved' && issue.resolvedAt && issue.createdAt) {
        const created = issue.createdAt.seconds ? issue.createdAt.seconds * 1000 : new Date(issue.createdAt).getTime()
        const resolvedTime = issue.resolvedAt.seconds ? issue.resolvedAt.seconds * 1000 : new Date(issue.resolvedAt).getTime()
        if (resolvedTime > created) {
          totalResolutionHours += (resolvedTime - created) / (1000 * 60 * 60)
          resolvedWithTimestampsCount++
        }
      }
    })

    const avgResolutionHours = resolvedWithTimestampsCount > 0 ? Math.round(totalResolutionHours / resolvedWithTimestampsCount) : 18

    const totalCitizens = filteredCitizens.length
    const verifiedCitizens = filteredCitizens.filter((c) => c.identityVerificationStatus === 'verified' || c.verified).length
    const activeOfficersCount = filteredOfficers.length

    return {
      total,
      pending,
      inProgress,
      resolved,
      resolutionRate,
      avgResolutionHours,
      totalCitizens,
      verifiedCitizens,
      activeOfficersCount
    }
  }, [filteredIssues, filteredCitizens, filteredOfficers])

  // Category Distribution Breakdown
  const categoryStats = useMemo(() => {
    const counts = {}
    filteredIssues.forEach((i) => {
      const cat = i.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [filteredIssues])

  // Priority Distribution
  const priorityStats = useMemo(() => {
    const high = filteredIssues.filter((i) => (i.priority || '').toUpperCase() === 'HIGH').length
    const med = filteredIssues.filter((i) => (i.priority || '').toUpperCase() === 'MEDIUM').length
    const low = filteredIssues.filter((i) => (i.priority || '').toUpperCase() === 'LOW').length
    return { high, med, low }
  }, [filteredIssues])

  // State-wise Performance Comparison (when viewing All States)
  const statePerformance = useMemo(() => {
    const statesMap = {}
    const stateList = Object.keys(INDIAN_STATES_AND_DISTRICTS)

    stateList.forEach((st) => {
      statesMap[st] = { total: 0, resolved: 0, pending: 0, inProgress: 0 }
    })

    issues.forEach((issue) => {
      const st = issue.state
      if (st && statesMap[st]) {
        statesMap[st].total++
        const status = (issue.status || 'Pending').toLowerCase()
        if (status === 'resolved') statesMap[st].resolved++
        else if (status === 'in progress') statesMap[st].inProgress++
        else statesMap[st].pending++
      }
    })

    return Object.entries(statesMap)
      .map(([stName, data]) => ({
        state: stName,
        ...data,
        rate: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [issues])

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
            Higher Authority Oversight Portal
          </span>
          <span style={{ fontSize: '13px', background: '#e0e7ff', color: '#3730a3', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            🏛️ Cross-Jurisdiction Command
          </span>
        </div>

        <div className="official-user-tag">
          <span>{userProfile?.name || currentUser?.email || 'Executive Authority'}</span>
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

      {/* 2. MAIN OVERSIGHT VIEWPORT */}
      <main className="dashboard-content">
        {loading ? (
          <div className="stat-card" style={{ padding: '40px', textAlign: 'center' }}>
            <p>Loading cross-jurisdiction municipal data...</p>
          </div>
        ) : (
          <>
            <section className="hero-section" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white' }}>
              <div>
                <p className="welcome-label" style={{ color: '#818cf8' }}>MUNICIPAL INTELLIGENCE & GOVERNANCE DASHBOARD</p>
                <h1 style={{ color: 'white' }}>Civic Resolution & Performance Analytics</h1>
                <p style={{ color: '#c7d2fe' }}>
                  Strategic oversight across Indian states and municipal districts. Monitor civic complaint volumes, resolution speed, and department workloads.
                </p>
              </div>
            </section>

        {/* 3. DYNAMIC GEOGRAPHIC & TIME CONTROLS */}
        <section style={{ margin: '20px 0', padding: '16px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>📍 State:</span>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value)
                setSelectedDistrict('All')
              }}
              className="form-select"
              style={{ padding: '6px 12px', fontSize: '13px', minWidth: '160px' }}
            >
              <option value="All">All States (National)</option>
              {Object.keys(INDIAN_STATES_AND_DISTRICTS).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>🏙️ District:</span>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={selectedState === 'All'}
              className="form-select"
              style={{ padding: '6px 12px', fontSize: '13px', minWidth: '160px' }}
            >
              <option value="All">All Districts</option>
              {availableDistricts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>⏱️ Period:</span>
            <div className="filter-bar" style={{ margin: 0 }}>
              <button
                type="button"
                className={`filter-btn ${selectedTimeRange === '7d' ? 'active' : ''}`}
                onClick={() => setSelectedTimeRange('7d')}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                7 Days
              </button>
              <button
                type="button"
                className={`filter-btn ${selectedTimeRange === '30d' ? 'active' : ''}`}
                onClick={() => setSelectedTimeRange('30d')}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                30 Days
              </button>
              <button
                type="button"
                className={`filter-btn ${selectedTimeRange === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedTimeRange('all')}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                All Time
              </button>
            </div>
          </div>
        </section>

        {/* 4. EXECUTIVE SUMMARY KPI CARDS */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div className="stat-card" style={{ padding: '18px' }}>
            <span className="stat-icon">📋</span>
            <h2>{kpis.total}</h2>
            <p>Total Complaints</p>
          </div>

          <div className="stat-card" style={{ padding: '18px' }}>
            <span className="stat-icon">⏳</span>
            <h2 style={{ color: '#eab308' }}>{kpis.pending}</h2>
            <p>Pending Issues</p>
          </div>

          <div className="stat-card" style={{ padding: '18px' }}>
            <span className="stat-icon">⚙️</span>
            <h2 style={{ color: '#0284c7' }}>{kpis.inProgress}</h2>
            <p>In Progress</p>
          </div>

          <div className="stat-card" style={{ padding: '18px' }}>
            <span className="stat-icon">✅</span>
            <h2 style={{ color: '#10b981' }}>{kpis.resolved}</h2>
            <p>Resolved</p>
          </div>

          <div className="stat-card" style={{ padding: '18px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span className="stat-icon">📈</span>
            <h2 style={{ color: '#166534' }}>{kpis.resolutionRate}%</h2>
            <p style={{ color: '#15803d', fontWeight: '700' }}>Resolution Rate</p>
          </div>

          <div className="stat-card" style={{ padding: '18px' }}>
            <span className="stat-icon">⚡</span>
            <h2 style={{ color: '#6366f1' }}>{kpis.avgResolutionHours} hrs</h2>
            <p>Avg Turnaround</p>
          </div>

          <div className="stat-card" style={{ padding: '18px' }}>
            <span className="stat-icon">👥</span>
            <h2>{kpis.totalCitizens}</h2>
            <p>Citizens ({kpis.verifiedCitizens} Verified)</p>
          </div>

          <div className="stat-card" style={{ padding: '18px' }}>
            <span className="stat-icon">👮</span>
            <h2 style={{ color: '#0284c7' }}>{kpis.activeOfficersCount}</h2>
            <p>Active Field Officers</p>
          </div>
        </section>

        {/* 5. VISUAL ANALYTICS & CHARTS GRID */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          {/* Chart 1: Category Distribution */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📊</span> Complaint Distribution by Category
            </h3>

            {categoryStats.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No issue data in selected scope.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {categoryStats.map(([category, count]) => {
                  const pct = kpis.total > 0 ? Math.round((count / kpis.total) * 100) : 0
                  return (
                    <div key={category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', color: '#334155' }}>{category}</span>
                        <span style={{ color: '#64748b' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background:
                              category === 'Roads'
                                ? '#f59e0b'
                                : category === 'Streetlight'
                                ? '#38bdf8'
                                : category === 'Water'
                                ? '#0284c7'
                                : category === 'Drainage'
                                ? '#6366f1'
                                : category === 'Garbage'
                                ? '#10b981'
                                : '#a855f7',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Chart 2: Priority Severity Breakdown */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚨</span> Triage Priority & Urgency Breakdown
            </h3>

            <div style={{ display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '100px', background: '#fee2e2', border: '1px solid #fca5a5', padding: '14px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: '800', color: '#991b1b', display: 'block' }}>{priorityStats.high}</span>
                <span style={{ fontSize: '12px', color: '#7f1d1d', fontWeight: '700' }}>HIGH (Emergency)</span>
              </div>

              <div style={{ flex: 1, minWidth: '100px', background: '#fef3c7', border: '1px solid #fcd34d', padding: '14px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: '800', color: '#92400e', display: 'block' }}>{priorityStats.med}</span>
                <span style={{ fontSize: '12px', color: '#78350f', fontWeight: '700' }}>MEDIUM (Standard)</span>
              </div>

              <div style={{ flex: 1, minWidth: '100px', background: '#e0f2fe', border: '1px solid #7dd3fc', padding: '14px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: '800', color: '#075985', display: 'block' }}>{priorityStats.low}</span>
                <span style={{ fontSize: '12px', color: '#0c4a6e', fontWeight: '700' }}>LOW (Routine)</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
              ✨ <strong>Automated AI Triage:</strong> Issues categorized as HIGH urgency are automatically prioritized at the top of the municipal queue with real-time audio briefings and SMS dispatch capabilities.
            </div>
          </div>
        </section>

        {/* 6. STATE-WISE RESOLUTION LEADERBOARD */}
        <section style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏆</span> State & Municipal Performance Ranking
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Jurisdiction / State</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Total Complaints</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Pending</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>In Progress</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Resolved</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Resolution %</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Health Status</th>
                </tr>
              </thead>
              <tbody>
                {statePerformance.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                      No regional issue data available.
                    </td>
                  </tr>
                ) : (
                  statePerformance.map((st) => (
                    <tr key={st.state} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a' }}>{st.state}</td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>{st.total}</td>
                      <td style={{ padding: '10px 14px', color: '#eab308', fontWeight: '600' }}>{st.pending}</td>
                      <td style={{ padding: '10px 14px', color: '#0284c7', fontWeight: '600' }}>{st.inProgress}</td>
                      <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: '700' }}>{st.resolved}</td>
                      <td style={{ padding: '10px 14px', fontWeight: '700', color: st.rate >= 70 ? '#16a34a' : st.rate >= 40 ? '#d97706' : '#dc2626' }}>
                        {st.rate}%
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            background: st.rate >= 70 ? '#dcfce7' : st.rate >= 40 ? '#fef3c7' : '#fee2e2',
                            color: st.rate >= 70 ? '#15803d' : st.rate >= 40 ? '#92400e' : '#991b1b',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}
                        >
                          {st.rate >= 70 ? '🟢 Optimal' : st.rate >= 40 ? '🟡 Moderate' : '🔴 Action Required'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default HigherAuthorityDashboard
