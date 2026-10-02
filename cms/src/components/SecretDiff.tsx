'use client'

import React, { useState } from 'react'
import type { TextFieldDiffClientComponent } from 'payload'
import {
  escapeDiffHTML,
  FieldDiffContainer,
  getHTMLDiffComponents,
  unescapeDiffHTML,
  useTranslation,
} from '@payloadcms/ui'
import { EYE, EYE_OFF, MASK, redactSecrets } from '../lib/passwordReveal'

const EMPTY = '<span class="html-diff-no-value"></span>'

/**
 * How a secret appears when comparing versions of a record: as dots, with a
 * button to show the real values, the same as on the edit screen.
 *
 * Payload's own diff prints values in full, so without this the Versions tab
 * of any client, invoice or subscriber shows the access code or token beside
 * every saved change. Built from the same parts as Payload's text and JSON
 * diffs, so it looks the same once shown.
 *
 * Two shapes of field use it:
 * - a text field that IS a secret (`accessCode`, `accessToken`,
 *   `unsubscribeToken`). Hidden, both sides are the same row of dots whatever
 *   they hold, so the diff cannot show a change by colour. It says so in words.
 * - a JSON field that CONTAINS one (`onboardingState`). Only the secret keys
 *   are dotted out, so every other change still shows as normal.
 */
export const SecretDiff: TextFieldDiffClientComponent = ({
  comparisonValue,
  field,
  locale,
  nestingLevel,
  versionValue,
}) => {
  const { i18n } = useTranslation()
  const [shown, setShown] = useState(false)

  const isJson = [comparisonValue, versionValue].some((v) => v !== null && typeof v === 'object')
  const format = (value: unknown) => {
    if (value === null || value === undefined || value === '') return EMPTY
    if (typeof value === 'object') {
      return `<pre>${escapeDiffHTML(JSON.stringify(shown ? value : redactSecrets(value), null, 2))}</pre>`
    }
    return shown ? escapeDiffHTML(String(value)) : MASK
  }

  const { From, To } = getHTMLDiffComponents({
    fromHTML: `<p>${format(comparisonValue)}</p>`,
    toHTML: `<p>${format(versionValue)}</p>`,
    postProcess: unescapeDiffHTML,
    tokenizeByCharacter: !isJson,
  })

  const what = isJson ? 'codes' : typeof field.label === 'string' ? field.label : 'code'
  const same = JSON.stringify(comparisonValue ?? '') === JSON.stringify(versionValue ?? '')

  return (
    <div className="qd-secret-diff">
      <FieldDiffContainer
        className="text-diff"
        From={From}
        i18n={i18n}
        label={{ label: field.label, locale }}
        nestingLevel={nestingLevel}
        To={To}
      />
      <div className="qd-secret-diff__bar">
        <button
          aria-pressed={shown}
          className="qd-secret-diff__toggle"
          onClick={() => setShown((s) => !s)}
          type="button"
        >
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: shown ? EYE_OFF : EYE }} />
          {shown ? `Hide ${what}` : `Show ${what}`}
        </button>
        {!isJson && <span>{same ? 'Unchanged in this version.' : 'Changed in this version.'}</span>}
      </div>
    </div>
  )
}
