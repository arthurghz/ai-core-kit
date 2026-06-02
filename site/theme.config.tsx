import React from 'react'
import type { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontWeight: 700,
        letterSpacing: '-0.01em'
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <rect width="24" height="24" rx="6" fill="#6366f1" />
        <path
          d="M7 8.5 4.5 12 7 15.5M17 8.5 19.5 12 17 15.5M13.5 6l-3 12"
          stroke="#eef2ff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>ai-core-kit</span>
    </span>
  ),
  project: {
    link: 'https://github.com/stallae/ai-core-kit'
  },
  docsRepositoryBase: 'https://github.com/stallae/ai-core-kit/tree/main/site',
  footer: {
    content: (
      <span>
        ai-core-kit — a forkable standard for production-grade Claude Code
        projects.
      </span>
    )
  },
  color: {
    hue: 250,
    saturation: 70,
    lightness: { light: 50, dark: 65 }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="ai-core-kit docs" />
      <meta
        property="og:description"
        content="Bootstrap methodology, frozen P3 contract, offline cost telemetry, and the skills/agents catalog for ai-core-kit."
      />
    </>
  ),
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  // Language selector in the navbar. `locale` must match the folder names
  // under pages/ (pages/en, pages/pt) and the locales in next.config.mjs.
  i18n: [
    { locale: 'en', name: 'English' },
    { locale: 'pt', name: 'Português' }
  ]
}

export default config
