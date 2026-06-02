// TerminalCast — embeds the recorded `npx create-ack` bootstrap session as a
// replayable asciinema cast on the landing hero.
//
// asciinema-player is browser-only (it touches the DOM and a Web Worker), so it
// is loaded with a dynamic import INSIDE useEffect — never at module top level —
// which keeps Next.js SSR (this is the pages router) from evaluating it on the
// server. The player CSS is imported once in pages/_app.jsx.
import { useEffect, useRef } from 'react'

export default function TerminalCast({
  src = '/demo/ack-usage.cast',
  // Show a representative frame before play so the hero is never blank.
  poster = 'npt:0:03',
  idleTimeLimit = 2,
  speed = 1.4,
  autoPlay = true,
  loop = true,
}) {
  const mountRef = useRef(null)

  useEffect(() => {
    let player
    let cancelled = false

    import('asciinema-player')
      .then((AsciinemaPlayer) => {
        if (cancelled || !mountRef.current) return
        player = AsciinemaPlayer.create(src, mountRef.current, {
          autoPlay,
          loop,
          preload: true,
          // Always-visible controls (play/pause/scrubber) so the demo reads as a
          // player, not a static block; `fit: 'width'` scales the 92-col cast to
          // the container so no text is ever clipped.
          controls: true,
          fit: 'width',
          idleTimeLimit,
          speed,
          poster,
          theme: 'asciinema',
        })
      })
      .catch(() => {
        // Non-fatal: if the player fails to load, the static command chip below
        // the terminal still tells visitors exactly what to run.
      })

    return () => {
      cancelled = true
      if (player && typeof player.dispose === 'function') player.dispose()
    }
  }, [src, poster, idleTimeLimit, speed, autoPlay, loop])

  return (
    <div className="ack-terminal" aria-label="Terminal recording: npx create-ack bootstrap">
      <div className="ack-terminal-bar" aria-hidden="true">
        <span className="ack-terminal-dot ack-terminal-dot--red" />
        <span className="ack-terminal-dot ack-terminal-dot--amber" />
        <span className="ack-terminal-dot ack-terminal-dot--green" />
        <span className="ack-terminal-title">create-ack — bootstrap</span>
      </div>
      <div className="ack-terminal-screen" ref={mountRef} />
    </div>
  )
}
