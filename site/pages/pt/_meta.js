// Top-level section order and sidebar/nav labels.
// Nextra 3 (pages dir) reads _meta.{js,jsx,ts,tsx} — _meta.json was removed.
// Keys are filenames/directory names (without .mdx); values are labels.
export default {
  index: {
    title: 'Visão geral',
    type: 'page',
    display: 'hidden',
    theme: { layout: 'raw', sidebar: false, toc: false, breadcrumb: false, pagination: false }
  },
  'getting-started': 'Primeiros passos',
  commands: 'Comandos',
  concepts: 'Conceitos',
  archetypes: 'Arquétipos',
  features: 'Recursos',
  build: 'Construindo o kit',
  reference: 'Referência',
  contributing: 'Contribuindo',
  roadmap: 'Roadmap'
}
