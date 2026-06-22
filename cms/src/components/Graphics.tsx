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
        maxWidth: '100%',
        maxHeight: '100%',
        height: 'auto',
        width: 'auto',
        objectFit: 'contain',
      }}
    />
  )
}
