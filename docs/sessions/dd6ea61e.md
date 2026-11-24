hash: dd6ea61e
role: design
opencode-session: PENDING
parent: process
task: 143
branch: feature/443fe644-searching-badge-inner-redesign
status: done
started: 2026-11-24T10:37:23Z
finished: 2026-11-24T10:47:33Z

## Report

Design pass task 143 (Concept 52): wrote dated DESIGN 4.38 amendment + 4.37 supersession pointer, grounded in read-only live audit. Decisions: bulb PixelIcon 32px (2x of the 16-grid, crisp edges) in the kept 56px slot; 8-rect pixel geometry (dome/walls/filament/neck/base, currentColor); bulb-blink 1.2s ease-in-out opacity 1<->0.3, opacity-only, reduced-motion static at full opacity via the base.css catch-all; remark = FULL line one anchor to /profile/settings (resolve + muted underline, RoomPreview precedent), badge's only interactive element; i18n repurpose people.searching (new title values) + new people.searching_settings, net +1 pair, no orphans. Flags (reversible one-liners): bulb size, muted tone, full-line link pick, blink rhythm. No ADVICE NEEDED.
