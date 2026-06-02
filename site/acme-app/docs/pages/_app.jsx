// Custom App required by Nextra 3 (pages directory).
// Imports the theme stylesheet so Nextra's docs theme renders correctly.
import 'nextra-theme-docs/style.css'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
