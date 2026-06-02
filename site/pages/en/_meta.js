// Top-level section order and sidebar/nav labels.
// Nextra 3 (pages dir) reads _meta.{js,jsx,ts,tsx} — _meta.json was removed.
// Keys are filenames/directory names (without .mdx); values are labels.
export default {
  index: {
    title: 'Overview',
    type: 'page',
    display: 'hidden',
    theme: { layout: 'raw', sidebar: false, toc: false, breadcrumb: false, pagination: false }
  },
  'getting-started': 'Getting Started',
  commands: 'Commands',
  concepts: 'Concepts',
  archetypes: 'Archetypes',
  features: 'Features',
  build: 'Building the Kit',
  reference: 'Reference',
  contributing: 'Contributing',
  roadmap: 'Roadmap'
}
