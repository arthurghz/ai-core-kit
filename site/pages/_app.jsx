// Custom App required by Nextra 3 (pages directory).
// Imports the theme stylesheet so Nextra's docs theme renders correctly.
import 'nextra-theme-docs/style.css'
// asciinema-player styles for the landing-hero terminal cast (TerminalCast.jsx).
// Global CSS may only be imported from _app in the pages router, so it lives here.
import 'asciinema-player/dist/bundle/asciinema-player.css'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
