import React from 'react'

export const Logo: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', maxHeight: '40px' }}>
      {/* We use standard img since Next/Image requires explicit width/height in some configs */}
      <img src="/logo.png" alt="Quadem Digital" style={{ maxHeight: '100%', width: 'auto' }} />
    </div>
  )
}

export const Icon: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', maxHeight: '32px', width: '32px' }}>
      <img src="/logo.png" alt="Quadem Digital Icon" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  )
}
