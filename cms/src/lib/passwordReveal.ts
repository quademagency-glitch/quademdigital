/**
 * An eye button inside every password box in the admin, to show what was
 * typed and hide it again.
 *
 * Payload has no such option (its only eye is on the API key field), and the
 * password boxes are not ours to replace: the login, reset-password and
 * create-first-user screens render Payload's own `PasswordField` with no
 * component slot. So this works on the page instead. It watches the admin for
 * any `<input type="password">` and puts a button beside it.
 *
 * It only ever swaps the input's `type` attribute and adds a sibling. React
 * leaves both alone: it writes `type` only when the prop changes, which for
 * these inputs it never does, and it does not police nodes it did not create.
 * If React swaps the input for a new one, the old button is removed and the
 * new input gets its own.
 *
 * Kept free of React so the behaviour can be tested in a plain DOM.
 */

const MARK = 'data-qd-reveal'

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`

// Lucide's eye and eye-off (ISC licence). The open eye offers to show, the
// struck-through one offers to hide, which is the convention people know.
const EYE = svg(
  '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
)
const EYE_OFF = svg(
  '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
)

const inputOf = new WeakMap<HTMLButtonElement, HTMLInputElement>()

function addButton(input: HTMLInputElement) {
  const holder = input.parentElement
  if (!holder) return
  input.setAttribute(MARK, '')
  // The button sits over the right-hand end of the box. Payload's wrapper div
  // carries no style of its own, so React will not overwrite this.
  holder.style.position = 'relative'

  const doc = input.ownerDocument
  const button = doc.createElement('button')
  button.type = 'button'
  button.className = 'qd-reveal'
  if (input.id) button.setAttribute('aria-controls', input.id)

  const sync = () => {
    const shown = input.type === 'text'
    const label = shown ? 'Hide password' : 'Show password'
    button.setAttribute('aria-label', label)
    button.setAttribute('aria-pressed', String(shown))
    button.title = label
    button.innerHTML = shown ? EYE_OFF : EYE
  }

  // Keeps the cursor in the box, so typing can carry on after a peek.
  button.addEventListener('mousedown', (e) => e.preventDefault())
  button.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password'
    sync()
  })

  // Hidden again before the form goes, so the browser still recognises a
  // password and offers to save it. Capture phase, so it runs before Payload's
  // own submit handler.
  input.form?.addEventListener(
    'submit',
    () => {
      input.type = 'password'
      sync()
    },
    true,
  )

  sync()
  inputOf.set(button, input)
  input.after(button)
}

/** Adds a button to every password box under `root` that lacks one, and drops buttons whose box has gone. */
export function enhancePasswordInputs(root: ParentNode) {
  root.querySelectorAll<HTMLButtonElement>('button.qd-reveal').forEach((button) => {
    const input = inputOf.get(button)
    if (!input || !input.isConnected) button.remove()
  })
  root
    .querySelectorAll<HTMLInputElement>(`input[type="password"]:not([${MARK}])`)
    .forEach((input) => {
      if (!input.disabled) addButton(input)
    })
}

/** Runs once now and again whenever the admin changes what is on screen. Returns a stop function. */
export function watchPasswordInputs(doc: Document): () => void {
  const scan = () => {
    try {
      enhancePasswordInputs(doc)
    } catch (err) {
      // A nicety. It must never take the login screen down with it.
      console.warn('[passwordReveal]', err)
    }
  }
  scan()
  const observer = new MutationObserver(scan)
  observer.observe(doc.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
