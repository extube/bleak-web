/**
 * DEPRECATED — must be deleted (TZ-10 fix-up, item 8a).
 *
 * The real `jsqr` dependency is installed centrally and ships its own
 * TypeScript types (`node_modules/jsqr/dist/index.d.ts`). This file was the
 * TZ-04 temporary ambient declaration; it is now neutralized (contains no
 * `declare module` block, so it cannot shadow the real types) because the
 * worker sandbox does not grant file deletion. Physical removal is a
 * one-liner for the process during merge.
 */
