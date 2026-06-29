'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { Popup, PopupList, useConfig, useLocale, useRouteTransition } from '@payloadcms/ui'

export const SettingsLocale: React.FC = () => {
  const {
    config: { localization },
  } = useConfig()
  const locale = useLocale()
  const router = useRouter()
  const { startRouteTransition } = useRouteTransition()

  if (!localization) {
    return null
  }

  const { locales } = localization

  return (
    <div className="qd-settings-locale">
      <Popup
        button={<span>Language: {locale?.code ? locale.code.toUpperCase() : 'Loading...'}</span>}
        horizontalAlign="left"
        size="small"
        render={({ close }) => (
          <PopupList.ButtonGroup>
            {locales.map((localeOption) => {
              const label =
                typeof localeOption.label === 'string'
                  ? localeOption.label
                  : localeOption.label?.en || localeOption.code
              return (
                <PopupList.Button
                  key={localeOption.code}
                  active={locale.code === localeOption.code}
                  disabled={locale.code === localeOption.code}
                  onClick={() => {
                    close()
                    const searchParams = new URLSearchParams(window.location.search)
                    searchParams.set('locale', localeOption.code)
                    startRouteTransition(() => {
                      router.push(`${window.location.pathname}?${searchParams.toString()}`)
                    })
                  }}
                >
                  {label} ({localeOption.code})
                </PopupList.Button>
              )
            })}
          </PopupList.ButtonGroup>
        )}
      />
    </div>
  )
}
