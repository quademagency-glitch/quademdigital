'use client'

import React, { useEffect } from 'react'
import { watchPasswordInputs } from '../lib/passwordReveal'

/**
 * Wraps the whole admin, login screen included, and adds the show/hide
 * password button. The work is in `lib/passwordReveal.ts`.
 */
export const PasswordReveal: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    try {
      return watchPasswordInputs(document)
    } catch (err) {
      console.warn('[passwordReveal]', err)
    }
  }, [])

  return <>{children}</>
}
