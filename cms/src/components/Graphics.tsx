import React from 'react'

export const Logo: React.FC = () => {
  return (
    <img
      src="/logo.png"
      alt="Quadem Digital"
      style={{ maxHeight: '32px', width: 'auto', display: 'block' }}
    />
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
