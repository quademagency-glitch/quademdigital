'use client'

import React, { useState } from 'react'
import type { JSONFieldClientComponent } from 'payload'
import { FieldDescription, FieldLabel, useField } from '@payloadcms/ui'
import { EYE, EYE_OFF, redactSecrets } from '../lib/passwordReveal'

/**
 * A read-only JSON field shown with any secret inside it dotted out, and the
 * eye in its top right corner to show everything.
 *
 * Used for `clients.onboardingState`, which keeps a copy of the client's
 * portal access code. Payload's JSON editor would print it in plain text above
 * the client's tabs, beside the access code field that hides it.
 *
 * Display only. It never sets a value: the field is worker-owned, refuses
 * updates at field level, and editor saves strip it (see Clients.ts).
 */
export const SecretJsonField: JSONFieldClientComponent = ({ field, path }) => {
  const fieldPath = path ?? field.name
  const { value } = useField<unknown>({ path: fieldPath })
  const [shown, setShown] = useState(false)

  const hasValue = value !== null && value !== undefined && value !== ''
  const label = shown ? 'Hide codes' : 'Show codes'

  return (
    <div className="field-type json qd-secret-json">
      <FieldLabel label={field.label} path={fieldPath} />
      <div className="qd-secret-json__box">
        {hasValue ? (
          <>
            <pre>{JSON.stringify(shown ? value : redactSecrets(value), null, 2)}</pre>
            <button
              aria-label={label}
              aria-pressed={shown}
              className="qd-reveal qd-reveal--corner"
              dangerouslySetInnerHTML={{ __html: shown ? EYE_OFF : EYE }}
              onClick={() => setShown((s) => !s)}
              title={label}
              type="button"
            />
          </>
        ) : (
          <p className="qd-secret-json__empty">Nothing recorded yet.</p>
        )}
      </div>
      <FieldDescription description={field.admin?.description} path={fieldPath} />
    </div>
  )
}
