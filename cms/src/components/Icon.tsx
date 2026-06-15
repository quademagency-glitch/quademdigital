import React from 'react'

const Icon: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', maxHeight: '32px', width: '32px' }}>
      <img src="/logo.png" alt="Quadem Digital Icon" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  )
}

export default Icon
