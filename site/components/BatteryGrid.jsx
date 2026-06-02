// BatteryGrid — compact "batteries included" grid of cross-cutting features.
//
// Small, scannable cards (icon + title + one line) linking into the feature
// docs. Theme-aware via .ack-* classes. SSR-safe, no client state.
export default function BatteryGrid({ items }) {
  const data = items || DEFAULT_ITEMS
  return (
    <div className="ack-batt-grid">
      {data.map((it) => {
        const Tag = it.href ? 'a' : 'div'
        const props = it.href ? { href: it.href } : {}
        return (
          <Tag className="ack-batt" key={it.key} {...props}>
            <span className="ack-batt-icon" aria-hidden="true">
              <Glyph name={it.glyph} />
            </span>
            <span className="ack-batt-body">
              <strong>{it.title}</strong>
              <span>{it.desc}</span>
            </span>
          </Tag>
        )
      })}
    </div>
  )
}

const DEFAULT_ITEMS = [
  { key: 'gate', glyph: 'shield', href: '/en/features/contract-gate', title: 'Opt-in contract gate', desc: 'A conservative 3-mode design-contract hook — enforced only where you ask.' },
  { key: 'mcp', glyph: 'plug', href: '/en/features/mcp', title: 'Optional MCP', desc: 'Wire Model Context Protocol servers for component and tool discovery.' },
  { key: 'cost', glyph: 'gauge', href: '/en/features/cost-telemetry', title: 'Offline cost telemetry', desc: 'Per-feature, per-model, per-agent spend from transcripts — no live hooks.' },
  { key: 'catalog', glyph: 'grid', href: '/en/features/skills-catalog', title: 'Skills & agents catalog', desc: 'Curated .claude/ skills, RPI agents, and commands across both layers.' },
  { key: 'render', glyph: 'cog', href: '/en/concepts/render-engine', title: 'Deterministic render', desc: 'Zero LLM in the loop — the same manifest always produces the same repo.' },
  { key: 'design', glyph: 'sparkle', href: '/en/features/design-system', title: 'Design system payload', desc: 'shadcn/ui, brand guidelines, theme tokens, and a component-discovery MCP.' },
]

function Glyph({ name }) {
  switch (name) {
    case 'shield':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'plug':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 3v5M15 3v5M7 8h10v2a5 5 0 0 1-10 0V8ZM12 15v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'gauge':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 16a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="m12 16 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1.4" fill="currentColor" />
        </svg>
      )
    case 'grid':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      )
    case 'cog':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'sparkle':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M18 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}
