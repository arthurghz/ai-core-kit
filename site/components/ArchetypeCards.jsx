// ArchetypeCards — tappable showcase of the kit's project archetypes.
//
// Each card links into the docs (or is marked "planned" for stacks that are on
// the roadmap). Pure presentational, theme-aware via .ack-* classes. SSR-safe.
export default function ArchetypeCards({ items, plannedLabel = 'Planned' }) {
  const data = items || DEFAULT_ITEMS
  return (
    <div className="ack-arch-grid">
      {data.map((it) => {
        const planned = !it.href
        const Tag = planned ? 'div' : 'a'
        const props = planned
          ? {}
          : { href: it.href }
        return (
          <Tag
            key={it.key}
            className={`ack-arch-card${planned ? ' ack-arch-card--planned' : ''}`}
            {...props}
          >
            <span className="ack-arch-icon" aria-hidden="true">
              <Glyph name={it.glyph} />
            </span>
            <span className="ack-arch-head">
              <strong>{it.title}</strong>
              {planned ? (
                <span className="ack-arch-badge">{plannedLabel}</span>
              ) : (
                <span className="ack-arch-go" aria-hidden="true">→</span>
              )}
            </span>
            <span className="ack-arch-desc">{it.desc}</span>
            <span className="ack-arch-stack">
              {it.stack.map((s) => (
                <span className="ack-chip" key={s}>{s}</span>
              ))}
            </span>
          </Tag>
        )
      })}
    </div>
  )
}

const DEFAULT_ITEMS = [
  {
    key: 'backend-api',
    title: 'backend-api',
    glyph: 'server',
    href: '/en/archetypes/backend-api',
    desc: 'A typed service with a clean domain core, tests, and CI — ready to ship.',
    stack: ['API', 'Domain core', 'Tests', 'CI'],
  },
  {
    key: 'fullstack',
    title: 'fullstack',
    glyph: 'layers',
    href: '/en/archetypes/fullstack',
    desc: 'Frontend + backend with an opt-in design system, MCP, and the contract gate.',
    stack: ['Web', 'API', 'Design system', 'MCP'],
  },
  {
    key: 'saas',
    title: 'SaaS starter',
    glyph: 'rocket',
    href: '/en/archetypes/saas',
    desc: 'A productionized Vercel SaaS: Next.js + React + shadcn/ui on Supabase.',
    stack: ['Vercel', 'Next.js', 'shadcn/ui', 'Supabase'],
  },
  {
    key: 'iac',
    title: 'fullstack + IaC',
    glyph: 'cloud',
    href: '/en/archetypes/overview#infrastructure-as-code-iac',
    desc: 'An orthogonal IaC toggle any deep archetype can switch on — infrastructure-as-code for AWS or GCP.',
    stack: ['AWS', 'GCP', 'Terraform', 'IaC'],
  },
]

function Glyph({ name }) {
  switch (name) {
    case 'server':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
          <rect x="3.5" y="13.5" width="17" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
          <path d="M7 7.5h.01M7 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'layers':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3 21 8l-9 5-9-5 9-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="m3 13 9 5 9-5M3 16.5 12 21l9-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      )
    case 'rocket':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 14c-1 1.5-1.2 4-1 5 1-0.2 3.5-.4 5-1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 16.5 7.5 14.5c.7-5 4-8.5 9-9.5.5 5-1 8.3-6.5 11.5l-.5-.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="14.5" cy="9.5" r="1.3" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'cloud':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 18a4 4 0 0 1-.5-7.97A5 5 0 0 1 16 9.5a3.5 3.5 0 0 1 .5 6.96" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 18h8.5M12 21l1.5-2.5M16 21l1.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}
