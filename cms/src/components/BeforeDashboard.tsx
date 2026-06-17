'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'

export const BeforeDashboard: React.FC = () => {
  const { user } = useAuth()
  
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome {user?.email || 'Admin'}</h1>
    </div>
  )
}
