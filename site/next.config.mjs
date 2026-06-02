import nextra from 'nextra'

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx'
})

// Nextra 3 (pages router) i18n: folder-based locales (pages/{locale}/...).
// Nextra reads this i18n block, then unsets next's own i18n and drives
// locale routing via the nextra/locales middleware (see middleware.js).
export default withNextra({
  i18n: {
    locales: ['en', 'pt'],
    defaultLocale: 'en'
  },
  // The home page lives at /en (folder-based locales). The nextra/locales
  // middleware should redirect `/` to the negotiated locale, but on Vercel the
  // bare root can fall through to a 404. This explicit redirect guarantees
  // `/` -> `/en` regardless of middleware execution. Non-permanent (307) so we
  // can change the default locale later without poisoning caches.
  async redirects() {
    return [{ source: '/', destination: '/en', permanent: false }]
  }
})
