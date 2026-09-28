import React from 'react'

/**
 * Reusable visual chart displaying Complaint Problem Status:
 * - Pending (amber / yellow)
 * - In Progress (blue / cyan)
 * - Resolved (green / emerald)
 * 
 * Works out-of-the-box with 0 external dependencies using responsive SVG and CSS.
 */
export default function ComplaintStatusChart({
  title = 'Problem Status',
  pending = 0,
  inProgress = 0,
  resolved = 0
}) {
  const total = pending + inProgress + resolved

  const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0
  const inProgressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0
  const resolvedPct = total > 0 ? Math.max(0, 100 - pendingPct - inProgressPct) : 0

  // SVG Donut calculation
  const radius = 64
  const circumference = 2 * Math.PI * radius // ~402.12
  const strokeWidth = 22

  const resolvedDash = (resolvedPct / 100) * circumference
  const inProgressDash = (inProgressPct / 100) * circumference
  const pendingDash = (pendingPct / 100) * circumference

  // Offsets for donut arcs (starting at top = -90deg)
  const resolvedOffset = 0
  const inProgressOffset = -resolvedDash
  const pendingOffset = -(resolvedDash + inProgressDash)

  return (
    <div
      className="complaint-status-chart-card"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '22px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        marginBottom: '24px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📊</span> {title}
        </h3>
        <span style={{ fontSize: '13px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '4px 12px', borderRadius: '20px', fontWeight: '600' }}>
          Total: {total}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '24px', flexWrap: 'wrap' }}>
        {/* SVG Donut Ring */}
        <div style={{ position: 'relative', width: '160px', height: '160px', flexShrink: 0 }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background Track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />

            {total > 0 && (
              <>
                {/* Resolved Arc (Green) */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${resolvedDash} ${circumference - resolvedDash}`}
                  strokeDashoffset={resolvedOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />

                {/* In Progress Arc (Blue) */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#0284c7"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${inProgressDash} ${circumference - inProgressDash}`}
                  strokeDashoffset={inProgressOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />

                {/* Pending Arc (Amber) */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${pendingDash} ${circumference - pendingDash}`}
                  strokeDashoffset={pendingOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              </>
            )}
          </svg>

          {/* Center Text inside Donut */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              pointerEvents: 'none'
            }}
          >
            <span style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', lineHeight: '1.1' }}>
              {total}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Problems
            </span>
          </div>
        </div>

        {/* Legend & Stat Bars */}
        <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Pending */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: '700' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                Pending
              </span>
              <span style={{ color: '#0f172a', fontWeight: '700' }}>
                {pending} <span style={{ color: '#64748b', fontWeight: '500', fontSize: '12px' }}>({pendingPct}%)</span>
              </span>
            </div>
            <div style={{ height: '7px', background: '#fef3c7', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${pendingPct}%`, height: '100%', background: '#f59e0b', borderRadius: '4px', transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* In Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1', fontWeight: '700' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
                In Progress
              </span>
              <span style={{ color: '#0f172a', fontWeight: '700' }}>
                {inProgress} <span style={{ color: '#64748b', fontWeight: '500', fontSize: '12px' }}>({inProgressPct}%)</span>
              </span>
            </div>
            <div style={{ height: '7px', background: '#e0f2fe', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${inProgressPct}%`, height: '100%', background: '#0284c7', borderRadius: '4px', transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* Resolved */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: '700' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                Resolved
              </span>
              <span style={{ color: '#0f172a', fontWeight: '700' }}>
                {resolved} <span style={{ color: '#64748b', fontWeight: '500', fontSize: '12px' }}>({resolvedPct}%)</span>
              </span>
            </div>
            <div style={{ height: '7px', background: '#dcfce7', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${resolvedPct}%`, height: '100%', background: '#10b981', borderRadius: '4px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
