/**
 * REMOVED in v2 (ARCHITECTURE §10.10): the invite-code → room-address
 * mapping store is retired — bleak-node resolves invite codes natively
 * (CONCEPT §7.2) and the helper is now stateless (health + QR PNG only).
 *
 * This file is an empty tombstone: the physical deletion of the path was
 * outside this worker's shell permissions (rm/git rm denied) and is left as
 * a one-liner follow-up (TZ2-05, worker 3647f949). No module may import it.
 */
export {};
