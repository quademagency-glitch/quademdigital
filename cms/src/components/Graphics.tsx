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
    <img
      src="/logo-icon.png"
      alt="Quadem"
      style={{
        width: '24px',
        height: '24px',
        display: 'block',
        objectFit: 'contain',
      }}
    />
  )
}
