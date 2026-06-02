# =============================================================================
# scripts/demo/usage.tape
# -----------------------------------------------------------------------------
# A VHS (https://github.com/charmbracelet/vhs) tape that records a terminal
# screencast of the REAL create-ack CLI scaffolding a brand-new ai-core-kit
# child project. It runs in a throwaway temp dir (never scaffolds into the kit)
# and tells the spec-first story: the generated CLAUDE.md + specs/ + product
# docs/, with deliberately MINIMAL code.
#
# Render locally (needs vhs + its deps: ttyd + ffmpeg):
#   brew install vhs ttyd ffmpeg
#   vhs /Users/arthur/dev/stallae/ai-core-kit/scripts/demo/usage.tape
#
# Outputs (written by the Output directives below):
#   docs/demo/ack-usage.gif
#   docs/demo/ack-usage.mp4
#
# NOTE: no `npm install` runs in this tape — create-ack is LLM-free and finishes
# in ~200ms, so the recording stays short (~30-50s) and readable.
# =============================================================================

# --- output targets ---------------------------------------------------------
Output /Users/arthur/dev/stallae/ai-core-kit/docs/demo/ack-usage.gif
Output /Users/arthur/dev/stallae/ai-core-kit/docs/demo/ack-usage.mp4

# --- look & feel: clean, large, readable ------------------------------------
Set Theme "Catppuccin Mocha"
Set FontSize 18
Set FontFamily "JetBrains Mono"
Set Width 1200
Set Height 700
Set Padding 24
Set Margin 0
Set TypingSpeed 45ms
Set PlaybackSpeed 1.0
# A short, clean prompt keeps the focus on the commands, not the shell chrome.
Set Shell "bash"

# --- 0. fresh shell, clean prompt, work in a throwaway temp dir --------------
Hide
Type "export PS1='\033[36m$\033[0m '" Enter
Type "clear" Enter
Type "cd $(mktemp -d)" Enter
Type "clear" Enter
Show

Sleep 600ms

# --- 1. scaffold a NEW child project with the real CLI (LLM-free, ~200ms) ----
Type "node /Users/arthur/dev/stallae/ai-core-kit/bin/create-ack.mjs acme-app --archetype fullstack --yes"
Sleep 700ms
Enter
# The scaffold summary prints instantly; pause so viewers can read it.
Sleep 2500ms

# --- 2. step into the generated project --------------------------------------
Type "cd acme-app"
Sleep 300ms
Enter
Sleep 500ms

# --- 3. what got generated (note: lots of CONTEXT, little code) --------------
Type "ls"
Sleep 400ms
Enter
Sleep 2000ms

# --- 4. CLAUDE.md — the lean spec-first entry point Claude reads every turn ---
Type "sed -n '1,20p' CLAUDE.md"
Sleep 400ms
Enter
Sleep 3500ms

# --- 5. specs/ — the ground-truth narrative the project is built from ---------
Type "ls specs/"
Sleep 400ms
Enter
Sleep 2500ms

# --- 6. docs/ — a ready-to-run product documentation site --------------------
Type "ls docs/"
Sleep 400ms
Enter
Sleep 2500ms

# --- 7. the headline next step -----------------------------------------------
Type "echo 'Next: open in Claude Code and run /ack-spec to generate the full specs'"
Sleep 400ms
Enter
Sleep 3000ms

# --- fin --------------------------------------------------------------------
Sleep 1500ms
