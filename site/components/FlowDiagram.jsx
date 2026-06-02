// FlowDiagram — "what one interview gives you" pipeline.
//
// A deterministic, dependency-free SVG-free flow that renders the SPEC-FIRST
// payload of a single `/ack-init` run: the interview answers fan out into the
// frozen manifest, which the zero-LLM render engine stamps into specs, a PLAN,
// a best-in-class CLAUDE.md, a design system, and wired `.claude/` tooling.
//
// Pure presentational + theme-aware via the .ack-* class system in globals.css.
// No client state, SSR-safe (pages router), no app-router/React-19 APIs.
export default function FlowDiagram({
  // Copy is passed in so the EN/PT pages stay the single source of truth.
  labels = {},
}) {
  const t = {
    interview: 'Archetype-first interview',
    interviewSub: 'Answer only what applies',
    manifest: 'Frozen project.manifest.yaml',
    manifestSub: 'JSON-Schema validated · source of truth',
    render: 'Deterministic render · zero LLM',
    outputsTitle: 'Your fork lands with',
    specs: 'Tech specs',
    specsSub: 'PRD · ARCHITECTURE · DOMAIN · REQUIREMENTS · NON-GOALS · ROADMAP',
    plan: 'PLAN',
    planSub: 'Sequenced delivery roadmap',
    claudemd: 'Best-in-class CLAUDE.md',
    claudemdSub: 'Context-engineered, not generic',
    design: 'Design system + requirements',
    designSub: 'Tokens · components · brand · MCP',
    tooling: 'Wired .claude/ tooling',
    toolingSub: 'Skills · agents · commands · hooks',
    ...labels,
  }

  const outputs = [
    { key: 'specs', icon: SpecIcon, title: t.specs, sub: t.specsSub },
    { key: 'plan', icon: PlanIcon, title: t.plan, sub: t.planSub },
    { key: 'claudemd', icon: BrainIcon, title: t.claudemd, sub: t.claudemdSub },
    { key: 'design', icon: PaletteIcon, title: t.design, sub: t.designSub },
    { key: 'tooling', icon: WrenchIcon, title: t.tooling, sub: t.toolingSub },
  ]

  return (
    <div className="ack-flow">
      <div className="ack-flow-rail">
        <div className="ack-flow-node ack-flow-node--input">
          <span className="ack-flow-kicker">Step 1</span>
          <strong>{t.interview}</strong>
          <span className="ack-flow-sub">{t.interviewSub}</span>
        </div>
        <FlowArrow />
        <div className="ack-flow-node ack-flow-node--manifest">
          <span className="ack-flow-kicker">Step 2</span>
          <strong>{t.manifest}</strong>
          <span className="ack-flow-sub">{t.manifestSub}</span>
        </div>
        <FlowArrow />
        <div className="ack-flow-node ack-flow-node--render">
          <span className="ack-flow-kicker">Step 3</span>
          <strong>{t.render}</strong>
        </div>
      </div>

      <div className="ack-flow-fan" aria-hidden="true" />

      <p className="ack-flow-outputs-title">{t.outputsTitle}</p>
      <div className="ack-flow-outputs">
        {outputs.map(({ key, icon: Icon, title, sub }) => (
          <div className="ack-flow-out" key={key}>
            <span className="ack-flow-out-icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="ack-flow-out-body">
              <strong>{title}</strong>
              <span className="ack-flow-sub">{sub}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FlowArrow() {
  return (
    <span className="ack-flow-arrow" aria-hidden="true">
      <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
        <path
          d="M1 7h24m0 0-5-5m5 5-5 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/* ---- Inline icons (currentColor, 20px grid) ---------------------------- */
function SpecIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function PlanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9h17M8 4.5v3M16 4.5v3M7 13h4M7 16h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function BrainIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 8 18a2.5 2.5 0 0 0 4 0V5.5A2 2 0 0 0 9 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8A3 3 0 0 1 16 18a2.5 2.5 0 0 1-4 0" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
function PaletteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.9-.3-1 .3-2.1 1.4-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="7.5" cy="11" r="1.1" fill="currentColor" />
      <circle cx="11" cy="7.5" r="1.1" fill="currentColor" />
      <circle cx="15" cy="8.5" r="1.1" fill="currentColor" />
    </svg>
  )
}
function WrenchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 6.5a3.5 3.5 0 0 1 4.7 4.2l-9.6 9.6a2 2 0 0 1-2.8-2.8l9.6-9.6a3.5 3.5 0 0 1-1.9-1.4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m14.5 6.5-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
