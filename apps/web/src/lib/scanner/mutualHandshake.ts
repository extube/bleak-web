/**
 * TOMBSTONE (TZ2-06 Part A): the v1 two-POST mutual-handshake client
 * routine was deleted by the v2 credentials scope (ARCHITECTURE §10.7,
 * Concept §6.4) — the server-mediated replacement lives in
 * `lib/scanner/mutual.ts` (single `POST /api/handshake/mutual`, 410/403
 * states, no already-mutual precheck).
 *
 * This file could not be unlinked with the worker's permitted command set
 * (`rm` / `git rm` are denied); it is emptied deliberately and must be
 * removed from the tree during merge processing. It has no exports and no
 * runtime cost.
 */
export {};
