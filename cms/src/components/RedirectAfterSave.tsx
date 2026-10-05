'use client'

import React from 'react'
import { PublishButton, SaveButton } from '@payloadcms/ui'

// Keep these exports for the existing collection import paths. Native controls
// preserve validation, upload guards, keyboard shortcuts and scheduling, and
// leave the saved record open so its delivery results can be reviewed.
export const SaveAndRedirectButton: React.FC<{ label?: string }> = ({ label }) => (
  <SaveButton label={label || 'Save changes'} />
)

export const PublishAndRedirectButton: React.FC<{ label?: string }> = ({ label }) => (
  <PublishButton label={label || 'Publish changes'} />
)
