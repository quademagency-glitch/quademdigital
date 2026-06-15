'use client'

import React, { useState, useMemo } from 'react'
import { useField } from '@payloadcms/ui'
import * as LucideIcons from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'

const BRAND_ICONS: Record<string, string> = {
    linkedin: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    instagram: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>',
    twitter: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    facebook: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>',
    youtube: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>',
    tiktok: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78 2.92 2.92 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.57 6.33 6.33 0 0 0 9.37 22a6.33 6.33 0 0 0 6.38-6.22V9.4a8.16 8.16 0 0 0 3.84.96V7.04a4.85 4.85 0 0 1-1-.35z"/></svg>',
    github: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>',
    whatsapp: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    dribbble: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"></path></svg>'
}

export const IconPicker: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<string>({ path })
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Lucide icons keys
  const iconKeys = useMemo(() => {
    return Object.keys(LucideIcons).filter(k => 
      k !== 'createLucideIcon' && 
      k !== 'default' && 
      k !== 'LucideProps' &&
      k !== 'IconNode' &&
      k !== 'LucideIcon' &&
      (typeof (LucideIcons as any)[k] === 'function' || typeof (LucideIcons as any)[k] === 'object')
    )
  }, [])

  const filteredLucideIcons = useMemo(() => {
    if (!search) return iconKeys.slice(0, 50)
    return iconKeys.filter(k => k.toLowerCase().includes(search.toLowerCase())).slice(0, 50)
  }, [search, iconKeys])

  const filteredBrandIcons = useMemo(() => {
    const brandKeys = Object.keys(BRAND_ICONS)
    if (!search) return brandKeys
    return brandKeys.filter(k => k.toLowerCase().includes(search.toLowerCase()))
  }, [search])

  const handleSelectLucide = (IconName: string) => {
    const IconComponent = (LucideIcons as any)[IconName]
    if (IconComponent) {
      try {
        const svgString = renderToStaticMarkup(<IconComponent size={24} strokeWidth={2} />)
        setValue(svgString)
        setIsOpen(false)
        setSearch('')
      } catch (err) {
        console.error('Failed to render icon', err)
      }
    }
  }

  const handleSelectBrand = (brandKey: string) => {
    setValue(BRAND_ICONS[brandKey])
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <label className="field-label">Select an Icon</label>
      
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '10px' }}>
        <div 
          style={{ 
            width: '64px', height: '64px', 
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--theme-elevation-50)',
            color: 'var(--theme-elevation-800)'
          }}
          dangerouslySetInnerHTML={{ __html: value || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' }}
        />
        <button 
          type="button" 
          onClick={() => setIsOpen(!isOpen)} 
          className="btn btn--style-secondary btn--size-medium"
        >
          {value ? 'Change Icon' : 'Choose Icon'}
        </button>
      </div>

      {isOpen && (
        <div style={{ 
          marginTop: '15px', padding: '20px', 
          border: '1px solid var(--theme-elevation-200)', 
          borderRadius: '4px', 
          background: 'var(--theme-elevation-50)' 
        }}>
          <input 
            type="text" 
            placeholder="Search icons (e.g. 'instagram', 'linkedin', 'film')..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="field-type text"
            style={{ width: '100%', marginBottom: '15px' }}
          />
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', 
            gap: '10px', 
            maxHeight: '300px', 
            overflowY: 'auto' 
          }}>
            {/* Render Brand Icons */}
            {filteredBrandIcons.map(key => (
              <button
                key={`brand-${key}`}
                type="button"
                title={key}
                onClick={() => handleSelectBrand(key)}
                style={{ 
                  padding: '12px', 
                  border: '1px solid var(--theme-elevation-200)', 
                  background: 'var(--theme-elevation-100)', 
                  cursor: 'pointer', 
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--theme-elevation-800)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-elevation-200)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--theme-elevation-100)'}
                dangerouslySetInnerHTML={{ __html: BRAND_ICONS[key] }}
              />
            ))}

            {/* Render Lucide Icons */}
            {filteredLucideIcons.map(key => {
              const IconComponent = (LucideIcons as any)[key]
              return (
                <button
                  key={`lucide-${key}`}
                  type="button"
                  title={key}
                  onClick={() => handleSelectLucide(key)}
                  style={{ 
                    padding: '12px', 
                    border: '1px solid var(--theme-elevation-200)', 
                    background: 'var(--theme-elevation-100)', 
                    cursor: 'pointer', 
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--theme-elevation-800)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-elevation-200)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--theme-elevation-100)'}
                >
                  <IconComponent size={24} strokeWidth={2} />
                </button>
              )
            })}
            
            {filteredBrandIcons.length === 0 && filteredLucideIcons.length === 0 && (
              <p style={{ gridColumn: '1 / -1', color: 'var(--theme-elevation-500)' }}>No icons found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
