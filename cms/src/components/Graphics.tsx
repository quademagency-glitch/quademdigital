import React from 'react'

export const Logo: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.125rem 0' }}>
      <img
        src="/logo.png"
        alt=""
        style={{ height: '26px', width: 'auto', display: 'block', flexShrink: 0 }}
      />
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '0.9375rem',
            letterSpacing: '-0.025em',
            color: '#eef0f5',
          }}
        >
          Quadem
        </div>
        <div
          style={{
            fontSize: '0.5625rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: '#00AEEF',
            textTransform: 'uppercase' as const,
            marginTop: '2px',
          }}
        >
          Digital
        </div>
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
        src="/logo.png"
        alt="Quadem"
        style={{ maxWidth: '20px', maxHeight: '20px', objectFit: 'contain' }}
      />
    </div>
  )
}
