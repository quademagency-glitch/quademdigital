import React from 'react'

const Logo: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', maxHeight: '40px' }}>
      <img src="/logo.png" alt="Quadem Digital" style={{ maxHeight: '100%', width: 'auto' }} />
    </div>
  )
}

export default Logo
