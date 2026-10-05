/**
 * An eye button inside every password box and every secret code in the admin,
 * to show what is there and hide it again.
 *
 * Two kinds of box get one:
 *
 * - Password boxes (`<input type="password">`): login, reset password, create
 *   first user, change password. Payload has no such option (its only eye is on
 *   the API key field), and those screens render Payload's own `PasswordField`
 *   with no component slot, so this cannot be done by replacing the field.
 *
 * - Secret codes: any text field given `admin.className: 'qd-secret'` (the
 *   client portal access code, the invoice access token, the unsubscribe
 *   token). These start hidden as dots.
 *
 * Secrets are hidden with CSS (`-webkit-text-security`, keyed on the data
 * attribute below), never by turning the box into a password box. A password
 * box on a record screen invites the browser's password manager to fill in
 * Ernest's saved CMS password, and a save would then store that password as a
 * client's access code.
 *
 * The admin is watched for these boxes rather than each screen being changed.
 * This only swaps a password input's `type`, sets a data attribute, and adds a
 * sibling button. React leaves all three alone: it writes `type` only when the
 * prop changes, which for these inputs it never does, and it does not police
 * attributes or nodes it did not create. If React swaps an input for a new one,
 * the old button is removed and the new input gets its own.
 *
 * Kept free of React so the behaviour can be tested in a plain DOM.
 */

const MARK = 'data-qd-reveal'

/** `password` for a password box, whose type does the hiding. `masked` / `shown` for a secret code. */
type Mark = 'password' | 'masked' | 'shown'

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`

// Lucide's eye and eye-off (ISC licence). The open eye offers to show, the
// struck-through one offers to hide, which is the convention people know.
export const EYE = svg(
  '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
)
export const EYE_OFF = svg(
  '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
)

/**
 * Keys whose value is a secret wherever they turn up inside a JSON field.
 * `clients.onboardingState` keeps a copy of the access code at
 * `client.accessCode` so a retried welcome email sends the same code; a scan of
 * every collection on 2026-10-02 found no other copy of any of the three.
 */
export const SECRET_KEYS = new Set(['accessCode', 'accessToken', 'unsubscribeToken'])
export const MASK = '••••••••••••'

/** The same value with every secret key's text replaced by dots, for display only. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        SECRET_KEYS.has(k) && typeof v === 'string' && v ? MASK : redactSecrets(v),
      ]),
    )
  }
  return value
}

const inputOf = new WeakMap<HTMLButtonElement, HTMLInputElement>()

/** The field's own label, without the required-field asterisk, for the button's name. */
function labelFor(input: HTMLInputElement): string {
  return (input.labels?.[0]?.textContent || '').replace(/\*/g, '').trim()
}

function addButton(input: HTMLInputElement, kind: 'password' | 'secret') {
  const holder = input.parentElement
  if (!holder) return
  input.setAttribute(MARK, (kind === 'password' ? 'password' : 'masked') satisfies Mark)
  // The button sits over the right-hand end of the box. Payload's wrapper divs
  // carry no inline style of their own, so React will not overwrite this.
  holder.style.position = 'relative'

  const doc = input.ownerDocument
  const button = doc.createElement('button')
  button.type = 'button'
  button.className = 'qd-reveal'
  if (input.id) button.setAttribute('aria-controls', input.id)

  const what = kind === 'password' ? 'password' : labelFor(input) || 'code'
  const isShown = () =>
    kind === 'password'
      ? input.type === 'text'
      : input.getAttribute(MARK) === ('shown' satisfies Mark)
  const setShown = (shown: boolean) => {
    if (kind === 'password') input.type = shown ? 'text' : 'password'
    else input.setAttribute(MARK, (shown ? 'shown' : 'masked') satisfies Mark)
  }

  const sync = () => {
    const shown = isShown()
    const label = `${shown ? 'Hide' : 'Show'} ${what}`
    button.setAttribute('aria-label', label)
    button.setAttribute('aria-pressed', String(shown))
    button.title = label
    button.innerHTML = shown ? EYE_OFF : EYE
  }

  // Keeps the cursor in the box, so typing can carry on after a peek.
  button.addEventListener('mousedown', (e) => e.preventDefault())
  button.addEventListener('click', () => {
    setShown(!isShown())
    sync()
  })

  // A password is hidden again before the form goes, so the browser still
  // recognises it and offers to save it. Capture phase, so it runs before
  // Payload's own submit handler.
  if (kind === 'password') {
    input.form?.addEventListener(
      'submit',
      () => {
        setShown(false)
        sync()
      },
      true,
    )
  }

  sync()
  inputOf.set(button, input)
  input.after(button)
}

/** Adds a button to every password box and secret code under `root` that lacks one, and drops buttons whose box has gone. */
export function enhancePasswordInputs(root: ParentNode) {
  // Only buttons this file made. React renders its own `qd-reveal` buttons
  // (components/SecretJsonField.tsx), and those are not ours to remove.
  root.querySelectorAll<HTMLButtonElement>('button.qd-reveal').forEach((button) => {
    const input = inputOf.get(button)
    if (input && !input.isConnected) button.remove()
  })
  root
    .querySelectorAll<HTMLInputElement>(`input[type="password"]:not([${MARK}])`)
    .forEach((input) => {
      if (!input.disabled) addButton(input, 'password')
    })
  // Read-only secrets render as disabled inputs, and still need the eye.
  root
    .querySelectorAll<HTMLInputElement>(`.qd-secret input[type="text"]:not([${MARK}])`)
    .forEach((input) => addButton(input, 'secret'))
}

/** Runs once now and again whenever the admin changes what is on screen. Returns a stop function. */
export function watchPasswordInputs(doc: Document): () => void {
  const observed = new Set<Element>()
  const placeButtons = () => {
    doc.querySelectorAll<HTMLButtonElement>('button.qd-reveal').forEach((button) => {
      const input = inputOf.get(button)
      if (!input?.isConnected) return
      // Text fields can put the label and help text in the same parent as the
      // input. Anchor the eye to the input itself, not that entire field.
      button.style.top = `${input.offsetTop}px`
      button.style.bottom = 'auto'
      button.style.height = `${input.getBoundingClientRect().height}px`
    })
  }
  const resize =
    typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(placeButtons)
  const scan = () => {
    try {
      enhancePasswordInputs(doc)
      observed.forEach((element) => {
        if (!element.isConnected) {
          resize?.unobserve(element)
          observed.delete(element)
        }
      })
      doc.querySelectorAll<HTMLButtonElement>('button.qd-reveal').forEach((button) => {
        const holder = inputOf.get(button)?.parentElement
        if (holder && !observed.has(holder)) {
          observed.add(holder)
          resize?.observe(holder)
        }
      })
      placeButtons()
    } catch (err) {
      // A nicety. It must never take the login screen down with it.
      console.warn('[passwordReveal]', err)
    }
  }
  scan()
  const observer = new MutationObserver(scan)
  observer.observe(doc.body, { childList: true, subtree: true })
  doc.defaultView?.addEventListener('resize', placeButtons)
  return () => {
    observer.disconnect()
    resize?.disconnect()
    doc.defaultView?.removeEventListener('resize', placeButtons)
  }
}
