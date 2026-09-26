import { SUPPORTED_LANGUAGES } from './utils/speech.js'
import { IconGlobe, IconChevronDown } from './Icons.jsx'

function LanguageSelector({
  currentLanguage = 'English',
  onSelectLanguage,
  label = '',
  variant = 'light', // 'light' (for dark headers) | 'dark' (for white cards)
  className = ''
}) {
  const isLight = variant === 'light'

  return (
    <div
      className={`civic-language-selector ${isLight ? 'variant-light' : 'variant-dark'} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        position: 'relative',
        flexShrink: 0,
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}
    >
      {label && (
        <span
          className="lang-label"
          style={{
            fontSize: '12px',
            fontWeight: '600',
            color: isLight ? '#cbd5e1' : '#64748b',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          {label}:
        </span>
      )}

      <div
        className="lang-dropdown-wrapper"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: isLight ? 'rgba(255, 255, 255, 0.12)' : '#ffffff',
          border: isLight ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid #cbd5e1',
          borderRadius: '9999px',
          padding: '4px 8px',
          boxShadow: isLight ? 'none' : '0 1px 3px rgba(7, 27, 58, 0.05)',
          maxWidth: '100%',
          boxSizing: 'border-box',
          flexShrink: 0,
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <IconGlobe size={15} color={isLight ? '#5eead4' : '#0FA58F'} />

        <select
          value={currentLanguage}
          onChange={(e) => onSelectLanguage(e.target.value)}
          aria-label="Select Interface Language"
          style={{
            background: 'transparent',
            border: 'none',
            color: isLight ? '#ffffff' : '#071B3A',
            fontSize: '12.5px',
            fontWeight: '600',
            cursor: 'pointer',
            outline: 'none',
            paddingRight: '2px',
            fontFamily: 'inherit',
            maxWidth: '110px',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none'
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option
              key={lang.name}
              value={lang.name}
              style={{
                background: '#071B3A',
                color: '#ffffff',
                fontSize: '13px'
              }}
            >
              {lang.label || lang.nativeName}
            </option>
          ))}
        </select>

        <IconChevronDown size={13} color={isLight ? '#94a3b8' : '#64748b'} />
      </div>
    </div>
  )
}

export default LanguageSelector
