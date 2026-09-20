
/**
 * Unified SVG Outline Icons for CivicPulse-AI
 * Consistent 24x24 viewBox, 2px stroke, sharp modern civic-tech aesthetics.
 * Zero external dependencies.
 */

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  style: { verticalAlign: 'middle', flexShrink: 0 }
}

export function IconBuilding({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  )
}

export function IconClipboard({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  )
}

export function IconClock({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function IconActivity({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

export function IconCheckCircle({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export function IconAlertCircle({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function IconPlusCircle({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

export function IconFolder({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function IconUsers({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function IconBarChart({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

export function IconMap({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}

export function IconMapPin({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function IconShield({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function IconGlobe({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

export function IconLogOut({ size = 18, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function IconXCircle({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

export function IconChevronDown({ size = 16, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconSearch({ size = 18, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function IconFilter({ size = 18, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

export function IconArrowRight({ size = 18, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export function IconArrowLeft({ size = 18, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

export function IconSparkles({ size = 18, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    </svg>
  )
}

export function IconFileText({ size = 20, className = '', color = 'currentColor', style = {} }) {
  return (
    <svg {...baseProps} width={size} height={size} stroke={color} className={className} style={{ ...baseProps.style, ...style }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
