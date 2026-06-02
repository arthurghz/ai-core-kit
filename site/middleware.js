// Nextra 3 i18n middleware (pages router, folder-based locales).
// Re-exports nextra/locales, which redirects `/` and unprefixed paths to the
// negotiated locale (cookie -> Accept-Language -> defaultLocale) so requests
// resolve to the matching pages/{locale}/ folder.
export { middleware } from 'nextra/locales'

export const config = {
  // Run on every path EXCEPT Next internals, the API, and static assets.
  // Crucially excludes any path containing a dot (`.*\\..*`) — i.e. files with
  // an extension like /demo/ack-usage.cast, images, og: assets served from
  // public/. Without this the locale middleware rewrites /demo/ack-usage.cast
  // -> /en/demo/... (404), so the asciinema player on the hero has nothing to
  // load. Locale-needing routes (/, /en, /pt/...) have no dot and still match.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
