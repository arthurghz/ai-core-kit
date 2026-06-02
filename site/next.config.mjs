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
  }
})
