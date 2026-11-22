hash: aef20dd9
role: worker
opencode-session: ses_dfb65abf4fferwCE9yICLz4Qnb
parent: process
task: 124
branch: feature/aef20dd9-tz12-08-widths-thirds
status: done
started: 2026-11-22T18:44:42Z
finished: 2026-11-22T19:01:45Z

## Report

tz12-08 widths/thirds (task 124, Concept §36 + DESIGN §4.24): all 4 owner items built on feature/aef20dd9-tz12-08-widths-thirds — (1) 80% container max(80%,280px) centered + header via container breakout (negative-margin calc, no vw), sticky 12px z10, keep-list unchanged; blur audit: backdrop-filter WAS applied/unoverridden - root cause 92% fill over near-black; two-tier fill implemented (92% fallback floor + 88% @supports tier, blur-inclusive AA 5.2:1); (2) opaque narrower lead: solid --color-surface pixel-frame, square corners (header = only rounded surface), fills its third (~288px@1280), headline clamp(22px,3.5vw,44px); (3) thirds grid repeat(3,1fr): lead col1 / BLEAK col3 / col2 EMPTY (video shows through), 4.23.D 1fr/360px row retired; (4) phone open state: .canvas padding-top calc(200dvh/3) at <720px, desktop no offset, sticky chip floats over pure video. i18n zero delta 23/23. Untouched: video layer/attrs/gating, vignette+wash, dots, BLEAK naming, income surfaces, step blocks, footer, RU/EN mechanisms, tokens. Gates: lint clean, test 966 (49+8+909; landing 51/51), build OK. Commit 4473425. Deviation (workaround): committed via explicit 7-file pathspec (the instructed add -A excludes cannot unstage the pre-staged background-img.jpg/docs-logs leftovers; git show --stat verified the commit clean — no media/logs); leftovers remain staged for the process.
