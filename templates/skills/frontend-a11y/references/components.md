# Accessible component examples

Full implementations referenced by the SKILL body. Copy and adapt; keep the
labeling, roles, and keyboard handling intact.

## Complete accessible form

```tsx
interface LoginFormProps {
  onSubmit: (email: string, password: string) => void
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!email) next.email = 'Email is required'
    if (!password) next.password = 'Password is required'
    if (Object.keys(next).length) { setErrors(next); return }
    onSubmit(email, password)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="email">Email <span aria-hidden="true">*</span></label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          aria-required="true"
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
          autoComplete="email"
        />
        {errors.email && <span id="email-error" role="alert">{errors.email}</span>}
      </div>

      <div>
        <label htmlFor="password">Password <span aria-hidden="true">*</span></label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          aria-required="true"
          aria-describedby={errors.password ? 'password-error' : undefined}
          aria-invalid={!!errors.password}
          autoComplete="current-password"
        />
        {errors.password && <span id="password-error" role="alert">{errors.password}</span>}
      </div>

      <button type="submit">Log in</button>
    </form>
  )
}
```

## Keyboard-driven dropdown (combobox + listbox)

Demonstrates arrow navigation, `Enter`/`Space` to select, `Escape` to close, and
the correct roles (`combobox`, `listbox`, `option`) with `aria-expanded`,
`aria-haspopup`, `aria-controls`, and `aria-selected`.

```tsx
export function Dropdown({ options, onSelect }: { options: string[]; onSelect: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = useId()

  if (!options.length) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault(); setActiveIndex(i => Math.min(i + 1, options.length - 1)); break
      case 'ArrowUp':
        e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (isOpen) onSelect(options[activeIndex])
        setIsOpen(o => !o)
        break
      case 'Escape':
        setIsOpen(false); break
    }
  }

  return (
    <div
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls={listId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => setIsOpen(o => !o)}
    >
      <span>{options[activeIndex]}</span>
      {isOpen && (
        <ul id={listId} role="listbox">
          {options.map((option, index) => (
            <li
              key={option}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => { onSelect(option); setIsOpen(false) }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

## Modal with focus restoration

Covers initial focus and restoration plus `Escape` to close. For a full focus
trap (Tab/Shift+Tab cycling within the modal, nested portals, dynamic content),
use `focus-trap-react` rather than reimplementing the edge cases.

```tsx
export function Modal({ isOpen, onClose, title, children }: {
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      modalRef.current?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      <h2 id="modal-title">{title}</h2>
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  )
}
```

## Reduced-motion hook

```tsx
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return prefersReduced
}
```
