'use client'

import React from 'react'

export const AfterNavLinks: React.FC = () => {
  return (
    <div
      style={{
        padding: '0.875rem 0.75rem 0.75rem',
        marginTop: '0.5rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: 'rgba(0,174,239,0.04)',
          border: '1px solid rgba(0,174,239,0.1)',
          borderRadius: '8px',
        }}
      >
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: '#00AEEF',
            boxShadow: '0 0 6px rgba(0,174,239,0.8)',
            flexShrink: 0,
            display: 'inline-block',
            animation: 'qdPulse 2.5s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: '0.6875rem',
            color: 'rgba(136,146,164,0.75)',
            fontWeight: 500,
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap' as const,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Quadem Digital Enterprise
        </span>
      </div>
      <style>{`@keyframes qdPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.75)} }`}</style>
    </div>
  )
}
