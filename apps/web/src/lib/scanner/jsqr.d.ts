/**
 * TEMPORARY ambient declaration for `jsqr` (TZ-04): the dependency is
 * declared in apps/web/package.json but is not yet materialized in
 * node_modules in this worktree, so svelte-check needs these types to
 * resolve the lazy `import('jsqr')` in decode.ts.
 *
 * Remove this file once `jsqr` is installed (it ships its own TypeScript
 * types — `dist/index.d.ts`); keeping it would shadow the real types.
 */
declare module 'jsqr' {
  export interface QRCode {
    data: string;
  }
  export interface Options {
    /** Overrides; the scanner uses defaults. */
    inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst';
  }
  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    providedOptions?: Options
  ): QRCode | null;
}
