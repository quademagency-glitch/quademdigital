import React from 'react'

export const Logo: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', maxHeight: '40px' }}>
      <img
        src="/logo-icon.png"
        alt=""
        style={{ height: '100%', maxHeight: '32px', width: 'auto', display: 'block', objectFit: 'contain' }}
      />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '1.25rem',
            letterSpacing: '-0.025em',
            color: '#eef0f5',
            lineHeight: 1,
          }}
        >
          Quadem
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: '#00AEEF',
            textTransform: 'uppercase' as const,
            lineHeight: 1,
          }}
        >
          Digital
        </span>
      </div>
    </div>
  )
}

export const Icon: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '32px',
        width: '32px',
        background: 'rgba(0,174,239,0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(0,174,239,0.2)',
      }}
    >
      <img
        src="/logo-icon.png"
        alt="Quadem"
        style={{ maxWidth: '22px', maxHeight: '22px', objectFit: 'contain' }}
      />
    </div>
  )
}
