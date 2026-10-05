import React from 'react'
import { ArrowUpRight } from 'lucide-react'

/** Presentation around Payload's own login form; authentication stays native. */
export const LoginIntro = () => (
  <>
    <aside className="qd-login-brand-panel" aria-label="Quadem Digital workspace">
      <a className="qd-login-wordmark" href="https://quademdigital.com">
        <img src="/logo-icon.png" alt="" width={42} height={42} />
        <span>
          <strong>Quadem Digital</strong>
          <small>DIGITAL ENTERPRISE</small>
        </span>
      </a>
      <div className="qd-login-statement">
        <p className="qd-login-kicker">THE QUADEM WORKSPACE</p>
        <h2>
          Create.
          <br />
          Connect.
          <br />
          <span>Deliver.</span>
        </h2>
        <p>
          Your clients, content and operations.
          <br />
          One place to keep the work moving.
        </p>
      </div>
      <div className="qd-login-brand-footer">
        <span>Clients</span>
        <span>Content</span>
        <span>Operations</span>
      </div>
    </aside>
    <header className="qd-login-intro">
      <p className="qd-login-kicker">WELCOME TO YOUR WORKSPACE</p>
      <h1>Welcome back.</h1>
      <p>Sign in with your Quadem CMS account.</p>
    </header>
  </>
)

export const LoginFooter = () => (
  <footer className="qd-login-footer">
    <p>Need access? Ask your workspace administrator.</p>
    <div>
      <a href="https://team.quademdigital.com">
        Team portal <ArrowUpRight size={15} aria-hidden="true" />
      </a>
      <a href="https://quademdigital.com">
        Visit website <ArrowUpRight size={15} aria-hidden="true" />
      </a>
    </div>
  </footer>
)
