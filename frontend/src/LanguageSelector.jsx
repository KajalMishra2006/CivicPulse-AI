import { SUPPORTED_LANGUAGES, getLanguageMetadata } from './utils/speech.js'

function LanguageSelector({
  currentLanguage = 'English',
  onSelectLanguage,
  label = '',
  variant = 'light', // 'light' (for dark headers) | 'dark' (for white cards)
  className = ''
}) {
  const meta = getLanguageMetadata(currentLanguage)

  const isLight = variant === 'light'

  return (
    <div
      className={`civic-language-selector ${isLight ? 'variant-light' : 'variant-dark'} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        position: 'relative'
      }}
    >
      {label && (
        <span
          className="lang-label"
          style={{
            fontSize: '12px',
            fontWeight: '600',
            color: isLight ? '#cbd5e1' : '#64748b'
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
          borderRadius: '20px',
          padding: '4px 10px',
          boxShadow: isLight ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{ fontSize: '14px', lineHeight: 1 }} aria-hidden="true">
          {meta.flag || '🌐'}
        </span>

        <select
          value={currentLanguage}
          onChange={(e) => onSelectLanguage(e.target.value)}
          aria-label="Select Interface Language"
          style={{
            background: 'transparent',
            border: 'none',
            color: isLight ? '#ffffff' : '#0f172a',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            outline: 'none',
            paddingRight: '4px',
            fontFamily: 'inherit'
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option
              key={lang.name}
              value={lang.name}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '13px'
              }}
            >
              {lang.nativeName} ({lang.name})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default LanguageSelector
