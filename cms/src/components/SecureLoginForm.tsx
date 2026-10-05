'use client'

import React, { useState } from 'react'

export const SecureLoginForm = () => {
  const [challenge, setChallenge] = useState('')
  // An email code, or one from an authenticator app (lib/authenticatorApp.ts).
  const [method, setMethod] = useState<'email' | 'app'>('email')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const resend = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('name') === 'resend'
    setPending(true)
    setMessage('')
    try {
      const response = await fetch('/api/users/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password'), securityChallenge: resend ? '' : challenge, securityCode: resend ? '' : form.get('securityCode'), trustDevice: form.get('trustDevice') === 'on' }),
      })
      const data = await response.json()
      if (!response.ok) {
        const error = data.errors?.[0]
        if (error?.data?.securityChallenge) {
          setChallenge(error.data.securityChallenge)
          setMethod(error.data.method === 'app' ? 'app' : 'email')
        }
        setMessage(error?.message || 'Sign-in failed. Try again.')
        return
      }
      const next = new URLSearchParams(window.location.search).get('redirect')
      const target = new URL(next || '/admin', window.location.origin)
      window.location.assign(target.origin === window.location.origin && target.pathname.startsWith('/admin') ? target.href : '/admin')
    } catch { setMessage('Quadem could not be reached. Try again in a minute.') }
    finally { setPending(false) }
  }
  return <form className="login__form qd-secure-form" onSubmit={submit}>
    <div className="field-type email"><label className="field-label" htmlFor="secure-email">Email</label><input id="secure-email" name="email" type="email" autoComplete="username" required onChange={() => setChallenge('')} /></div>
    <div className="field-type password"><label className="field-label" htmlFor="secure-password">Password</label><input id="secure-password" name="password" type="password" autoComplete="current-password" required /></div>
    {challenge && method === 'email' && <div className="field-type text"><label className="field-label" htmlFor="secure-code">Code from your email</label><input id="secure-code" name="securityCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" /><p>Six digits. Expires after five minutes.</p></div>}
    {challenge && method === 'app' && <div className="field-type text"><label className="field-label" htmlFor="secure-code">Code from your authenticator app</label><input id="secure-code" name="securityCode" autoComplete="one-time-code" maxLength={9} /><p>Six digits. Lost your phone? Use one of your recovery codes.</p></div>}
    {challenge && <div className="qd-trust-device"><label><input type="checkbox" name="trustDevice" /><span>Trust this device for 30 days</span></label><p>Skip codes on this browser. Choose this only on a device you use privately.</p></div>}
    {message && <p className="qd-secure-message" role="alert">{message}</p>}
    <div className="form-submit"><button className="btn btn--style-primary btn--size-large" type="submit" disabled={pending}>{pending ? 'Signing in…' : challenge ? 'Verify and sign in' : 'Log in'}</button></div>
    {challenge && method === 'email' && <button type="submit" name="resend" formNoValidate disabled={pending} className="qd-secure-reveal">Send another code</button>}
    <a className="login__forgot-password" href="/admin/forgot">Forgot password?</a>
  </form>
}
