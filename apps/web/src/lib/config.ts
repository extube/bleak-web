/**
 * Runtime configuration for the SPA.
 *
 * Bases default to same-origin relative paths so that both dev (Vite proxy)
 * and a same-origin production deployment work without CORS. For a split
 * deployment, bake absolute URLs via VITE_* vars at build time.
 */
export const API_BASE: string = import.meta.env.VITE_BLEAK_NODE_URL || '';
export const HELPER_BASE: string = import.meta.env.VITE_HELPER_URL || '/h';
