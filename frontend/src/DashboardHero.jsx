import { IconBuilding } from './Icons.jsx'
import './App.css'

export default function DashboardHero({
  eyebrow = 'GOVBRIDGE CIVIC PORTAL',
  title = 'Welcome to GovBridge',
  subtitle = 'Make a difference in your community',
  description = 'Review and manage citizen complaints, track progress, and help build a better, more responsive administration.',
  icon: IconComponent = IconBuilding
}) {
  return (
    <section className="govbridge-dashboard-hero" aria-label="Dashboard Overview">
      <div className="dashboard-hero-content">
        <div className="dashboard-hero-icon-container">
          <IconComponent size={28} color="#0FA58F" />
        </div>

        <div className="dashboard-hero-text">
          <span className="dashboard-hero-eyebrow">{eyebrow}</span>
          <h1 className="dashboard-hero-title">{title}</h1>
          {subtitle && <h2 className="dashboard-hero-subtitle">{subtitle}</h2>}
          {description && <p className="dashboard-hero-description">{description}</p>}
        </div>
      </div>

      {/* Decorative civic dome architectural graphic watermark on the right */}
      <div className="dashboard-hero-watermark" aria-hidden="true">
        <svg width="240" height="150" viewBox="0 0 240 150" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M120 10V20M120 15H130" stroke="#0FA58F" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <path d="M120 20C95 20 80 45 80 65H160C160 45 145 20 120 20Z" fill="#0FA58F" fillOpacity="0.08" stroke="#0FA58F" strokeWidth="2" strokeOpacity="0.3" />
          <rect x="75" y="65" width="90" height="10" rx="2" fill="#0FA58F" fillOpacity="0.12" stroke="#0FA58F" strokeWidth="2" strokeOpacity="0.3" />
          {/* Columns */}
          <line x1="88" y1="75" x2="88" y2="125" stroke="#0FA58F" strokeWidth="2.5" strokeOpacity="0.3" />
          <line x1="104" y1="75" x2="104" y2="125" stroke="#0FA58F" strokeWidth="2.5" strokeOpacity="0.3" />
          <line x1="120" y1="75" x2="120" y2="125" stroke="#0FA58F" strokeWidth="2.5" strokeOpacity="0.3" />
          <line x1="136" y1="75" x2="136" y2="125" stroke="#0FA58F" strokeWidth="2.5" strokeOpacity="0.3" />
          <line x1="152" y1="75" x2="152" y2="125" stroke="#0FA58F" strokeWidth="2.5" strokeOpacity="0.3" />
          {/* Base */}
          <rect x="60" y="125" width="120" height="12" rx="2" fill="#0FA58F" fillOpacity="0.12" stroke="#0FA58F" strokeWidth="2" strokeOpacity="0.3" />
          <line x1="40" y1="137" x2="200" y2="137" stroke="#0FA58F" strokeWidth="2" strokeOpacity="0.3" />
          {/* Trees / Foliage outline */}
          <circle cx="50" cy="115" r="16" fill="#10B981" fillOpacity="0.08" />
          <circle cx="65" cy="120" r="12" fill="#10B981" fillOpacity="0.08" />
          <circle cx="175" cy="120" r="12" fill="#10B981" fillOpacity="0.08" />
          <circle cx="190" cy="115" r="16" fill="#10B981" fillOpacity="0.08" />
        </svg>
      </div>
    </section>
  )
}
