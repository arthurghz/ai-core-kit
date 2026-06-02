# Design — ${project.name}

> ${project.description}
>
> <!-- STATUS: skeleton. Authored by `/ack-spec` from the moment-0 discovery
>      interview (templates/interview/spec-questions.yaml, the DESIGN & UX bank).
>      This is the product's VISUAL + UX intent: the surfaces it ships on, the
>      tone it speaks in, the brand it wears, the screens that define it, and the
>      components it is made of — plus the design acceptance criteria (DA-NN) that
>      say a screen is "done and on-brand". Keep the headings (CLAUDE.md and the
>      contract gate link to them). Tokens are the machine source of truth; this
>      doc is the human source of design intent. Keep DA-NN ATOMIC, NUMBERED, and
>      VERIFIABLE — each should map to a check (and, where it governs a protected
>      UI path, to a clause in a contract). The "why" is in PRD.md; the "what" in
>      REQUIREMENTS.md; the "how to apply" lives in the `design-system/` skills.
>      Numbering is stable: never renumber an existing DA; mark removed ones as
>      Deprecated rather than reusing the id. This doc is authored only for
>      design-bearing archetypes (fullstack/saas); backend/SDK/IaC omit it. -->

## Platform & Targets

<!-- Which surfaces ship in v1 and what that implies for layout. State the target
     platforms (web, responsive-web, mobile-web, installable PWA), the breakpoint
     story, and the input modalities (pointer, touch, keyboard). This drives
     density and the responsive strategy below. Source: discovery
     `design_platform`. Be concrete: "responsive web, mobile-first, 360–1440px"
     beats "works everywhere". -->

| Surface | In v1? | Breakpoints / notes |
|---------|--------|---------------------|
| <e.g. responsive web> | yes | <e.g. 360 / 768 / 1024 / 1440> |
| <e.g. installable PWA> | deferred | <offline + install criteria> |

## Design Maturity & Intent

<!-- What KIND of product this is, because a marketing site, a data-dense app, and
     a dashboard want different defaults. State the product kind and the design
     ambition for v1 (ship-fast-with-the-system vs. bespoke craft) so later choices
     are anchored. Source: `design_product_kind`. Name the ONE design outcome that,
     if true, means the design succeeded. -->

- **Product kind:** <marketing-site / data-dense-app / dashboard / content / mixed>
- **Design ambition (v1):** <lean on the system / selectively bespoke>
- **Design north-star:** <the one design outcome that signals success>

## Voice & Tone

<!-- How the product SOUNDS and FEELS — copy voice and visual personality together,
     because they must agree. Map the chosen tone to a concrete posture: spacing
     generosity, type personality, motion restraint, illustration vs. photography.
     Source: `design_tone`. Reject "clean/modern" alone — say what it does and does
     not do (e.g. "technical/precise: dense tables are fine; no decorative motion"). -->

| Dimension | Stance |
|-----------|--------|
| Copy voice | <e.g. plain, direct, second-person> |
| Visual personality | <e.g. minimal/neutral, generous whitespace> |
| Motion | <e.g. functional only; ≤200ms; respects reduced-motion> |
| Imagery | <e.g. product UI screenshots; no stock photography> |

## Brand Palette

<!-- The brand colour story. The ONE deterministic input is the brand hex captured
     during the interview (`design_brand_color`), confirmed back to the user, and
     written into `design_system.tokens.color_brand`; the renderer materializes the
     theme `:root` from it — see `design-system/theme/`. DO NOT hard-code hex values
     in component code; reference the materialized tokens. Here, narrate the WHY:
     what the brand colour signals, the supporting neutrals, semantic colours
     (success/warning/danger/info), and the contrast intent. The token VALUE flows
     through the manifest; the rationale flows through this doc. -->

- **Brand (primary):** <what it signals> → token `color_brand` (materialized in `design-system/theme/`)
- **Neutrals:** <surface / text / border ramp intent>
- **Semantic:** <success / warning / danger / info — each tied to a token, not a raw hex>
- **Contrast intent:** <e.g. body text ≥ 4.5:1, large text ≥ 3:1 on every surface>

> The brand token is the only design value that crosses into the deterministic
> render. Confirm it during `/ack-spec`; never introduce ad-hoc colours alongside it.

## Density

<!-- The spacing/sizing base and where it tightens. State the base grid (e.g. 8pt
     vs 4pt) and the comfortable/compact/dense intent per region (a marketing hero
     is comfortable; an admin table is dense). Source: `design_density`. This
     reconciles to the design-system spacing scale — name the scale, do not invent
     numbers per screen. -->

- **Base grid:** <e.g. 8pt with 4pt half-steps>
- **Default density:** <comfortable / compact / dense>
- **Per-region exceptions:** <e.g. data tables dense; onboarding comfortable>

## Key Screens & Flows

<!-- The handful of screens that DEFINE the product, each named with the job it
     does and the primary action it exists to make easy. Then the critical flows
     that string them together (the path a persona takes to get value). Tie each
     screen to the personas in PRD.md and the requirements in REQUIREMENTS.md.
     Source: `design_key_screens`. Keep it to the screens that matter — this is the
     design spine, not a sitemap. -->

| Screen | Job it does | Primary action | Personas (PRD) |
|--------|-------------|----------------|----------------|
| <e.g. Dashboard> | <at-a-glance status> | <e.g. drill into an alert> | <persona> |
| <e.g. Onboarding> | <first value fast> | <e.g. connect a source> | <persona> |

### Critical flows

<!-- The 1–3 end-to-end journeys that prove the product. Each: the entry, the
     steps, the success state, and the failure/empty states (empty, loading, error
     are first-class — name them). The thinnest of these usually IS the PLAN's
     first slice — link to PLAN.md#First Slice. -->

- **Flow 1 — <name>:** <entry → steps → success>; states: <empty / loading / error>.

## Component Inventory

<!-- The components v1 needs, each with a Definition of Done so "done" is not a
     matter of taste. Seed from `design_components`; map to the design-system /
     shadcn copy-in list. Per component, the DoD is the contract for that piece of
     UI: the states it must handle, the tokens it must use, and the a11y it must
     pass. A component is NOT done until every DoD box is checkable. -->

| Component | Source | States required | Definition of Done |
|-----------|--------|-----------------|--------------------|
| <e.g. Button> | <system / shadcn> | default/hover/focus/active/disabled/loading | tokens only · focus-visible ring · 44px touch target · AA contrast |
| <e.g. Table> | <system> | empty/loading/error/populated/paginated | tokens only · keyboard nav · sortable headers announced · AA contrast |
| <e.g. Form field> | <system> | default/focus/error/disabled | label tied to control · error announced · tokens only · AA contrast |

<!-- For any component whose behaviour exceeds a table row (composite widgets,
     bespoke charts), expand below with its anatomy, states, and interaction notes.
     Reference the component name. -->

### <Component> — <title>

<!-- Anatomy, states, keyboard model, edge cases. Optional; only for components
     that need more than a DoD row. -->

## References

<!-- Competitor or aspirational products and EXACTLY what to borrow (and what NOT
     to). Keeps the intent concrete instead of "make it look nice". Source:
     `design_references`. Per reference, the one specific thing worth stealing and
     the one thing to deliberately avoid. -->

| Reference | Borrow this | Avoid this |
|-----------|-------------|------------|
| <product> | <specific pattern> | <specific anti-pattern> |

## Accessibility

<!-- The accessibility floor and the target above it. The kit's baseline is
     WCAG 2.2 AA (the floor in the `frontend-design-guidelines` skill); state the
     committed level and any raised bars (AAA contrast, reduced-motion, larger
     touch targets). Source: `design_a11y_target`. These become DA-NN acceptance
     below — accessibility is a requirement, not a nice-to-have. -->

- **Committed level:** <WCAG 2.2 AA (floor) / AAA / AA + raised bars>
- **Always true:** keyboard-operable, visible focus on every interactive element,
  contrast ≥ AA, respects `prefers-reduced-motion`, no information by colour alone.
- **Raised bars (if any):** <e.g. AAA contrast for body text; 44px touch targets>

## Design Acceptance Criteria

<!-- The observable, checkable rules that define "this UI is done and on-brand".
     Prefer given/when/then or a flat assertion. These are the DESIGN analogue of
     REQUIREMENTS.md#Acceptance Criteria and seed the design clauses of the FIRST
     contract (docs/contracts/) where a UI path is protected. Strongest DA come
     from the a11y floor and the token discipline — restate the load-bearing ones
     here as checks. Source: discovery `design_a11y_target`, `design_components`. -->

- [ ] **DA-01** — Every interactive element shows a visible focus indicator (`:focus-visible`) and is reachable by keyboard.
- [ ] **DA-02** — No magic numbers: colours, spacing, radii, and type come from `design_system.tokens` / the materialized `design-system/theme/` — never ad-hoc hex or px.
- [ ] **DA-03** — Text and meaningful UI meet the committed contrast level on every surface (verified, not assumed).
- [ ] **DA-04** — Every key screen renders its empty, loading, and error states, not just the happy path.
- [ ] **DA-05** — <next design-acceptance rule for this product>

## Traceability

<!-- Map design acceptance ⇄ the screen/component it governs ⇄ the contract that
     gates the protected UI path, so design "done" is visible and, where it touches
     a protected path, gated — closing the "design done is never gated" gap. -->

| Design acceptance | Screen / component | Requirement (FR/NFR) | Contract |
|-------------------|--------------------|----------------------|----------|
| DA-01 | <all interactive> | <NFR — accessibility> | C-001-<slug> |
| DA-02 | <all UI> | <FR/NFR ref> | C-001-<slug> |

---

<!-- The token VALUE for `color_brand` is confirmed during `/ack-spec` and
     materialized by the renderer into `design-system/theme/`; this doc carries the
     intent, never a duplicated hex. When a Key Screen or Component DoD changes,
     update the matching DA-NN and its traceability row in the same change. -->
