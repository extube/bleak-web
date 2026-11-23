# Bug: iOS keyboard viewport fix ineffective (iPhone/iPad) — task 134

- **Reported:** owner, 2026-11-23 (via concept)
- **Shipped in:** `fcc66be` (task 134, worker `5de72e33`, DESIGN §4.31.1)
- **Severity:** high (core creation flow broken on iOS Safari)
- **Surface:** `/income/[income_code]/create` — the creation chat (persona step)

## Symptom

When the on-screen keyboard opens on the creation chat (iPhone/iPad, Safari):
the screen does NOT shrink; the whole page pans up out of view (sometimes
stays panned after the keyboard closes).

## Root cause (deterministic, CSS — diagnosis complete, do not re-investigate)

`routes/+layout.svelte:64` declares the shell as `.app-shell { min-height:
100dvh; … }`. The two §44.4.2 shell gates in
`apps/web/src/lib/components/join/JoinFlow.svelte`
(`:global(.app-shell:has(> .join > .persona-step))` ~line 640,
`:global(.app-shell:has(> .join > .form-step))` ~line 672) set
`height: var(--app-height, 100dvh)` but **never override `min-height`**.

CSS computes height = max(min-height, height): on iOS the keyboard does NOT
resize the layout viewport (unlike Chrome/Android), so `100dvh` stays
full-height while the visualViewport listener correctly writes a shrunk
`--app-height` — `min-height: 100dvh` pins the shell to the un-shrunk
height, the composer stays behind the keyboard, and iOS pans the document
up to reveal the focused input. The wrapper gates already carry
`min-height: 0` — only the two `.app-shell` gates miss it.

## Fix (accepted)

1. `min-height: 0` on BOTH `.app-shell` gates (lines ~640 and ~672).
2. In the same persona-step `$effect` (~lines 404–424): also lock
   **documentElement** overflow (body-only lock does not stop iOS keyboard
   panning) and pin the window during keyboard pan —
   `viewport.addEventListener('scroll', () => window.scrollTo(0, 0))` —
   restored fully on teardown (same no-leaks contract).
3. Untouched: the `--app-height` write/restore logic, the fallback chain
   `100vh → 100dvh → var(--app-height, 100dvh)`, the §24–§29 two-fixed-
   areas layout, every other join step/surface (behavior-neutral outside
   the persona step).
