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
import { EYE, EYE_OFF } from '../lib/passwordReveal'

const DOTS = '••••••••••••'
const EMPTY = '<span class="html-diff-no-value"></span>'

/**
 * How a secret code appears when comparing versions of a record: as dots, with
 * a button to show the real values, the same as on the edit screen.
 *
 * Payload's own text diff prints both values in full, so without this the
 * Versions tab of any client, invoice or subscriber shows the access code or
 * token beside every saved change. Built from the same parts as Payload's text
 * diff, so it looks the same once shown.
 *
 * Hidden, both sides are the same row of dots whatever they hold, so the diff
 * cannot show a change by colour. It says so in words instead.
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

  const from = typeof comparisonValue === 'string' ? comparisonValue : ''
  const to = typeof versionValue === 'string' ? versionValue : ''
  const render = (value: string) => (!value ? EMPTY : shown ? escapeDiffHTML(value) : DOTS)

  const { From, To } = getHTMLDiffComponents({
    fromHTML: `<p>${render(from)}</p>`,
    toHTML: `<p>${render(to)}</p>`,
    postProcess: unescapeDiffHTML,
    tokenizeByCharacter: true,
  })

  const name = typeof field.label === 'string' ? field.label : 'code'

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
          {shown ? `Hide ${name}` : `Show ${name}`}
        </button>
        <span>{from === to ? 'Unchanged in this version.' : 'Changed in this version.'}</span>
      </div>
    </div>
  )
}
