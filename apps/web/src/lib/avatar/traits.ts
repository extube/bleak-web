/**
 * Deterministic avatar trait derivation (DESIGN §4.3): a user's `address`
 * seeds a 32-bit FNV-1a hash; successive 4-bit slices pick each trait.
 * Same address ⇒ same portrait everywhere, no storage.
 */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Trait palette sizes (DESIGN §4.3): skin 4, hairstyle 8, hair color 5,
 * facial hair 4, glasses 3, backdrop 5. */
export const TRAIT_COUNTS = {
  skin: 4,
  hairstyle: 8,
  hairColor: 5,
  facialHair: 4,
  glasses: 3,
  backdrop: 5
} as const;

export interface AvatarTraits {
  skin: number;
  hairstyle: number;
  hairColor: number;
  facialHair: number;
  glasses: number;
  backdrop: number;
}

/** 4-bit hash slice modulo the trait count, per §4.3 ("successive slices"). */
export function deriveTraits(address: string): AvatarTraits {
  const hash = fnv1a(address);
  const slice = (shift: number, count: number): number => ((hash >>> shift) & 0xf) % count;
  return {
    skin: slice(0, TRAIT_COUNTS.skin),
    hairstyle: slice(4, TRAIT_COUNTS.hairstyle),
    hairColor: slice(8, TRAIT_COUNTS.hairColor),
    facialHair: slice(12, TRAIT_COUNTS.facialHair),
    glasses: slice(16, TRAIT_COUNTS.glasses),
    backdrop: slice(20, TRAIT_COUNTS.backdrop)
  };
}

/** An unparseable (empty/blank) address renders the fixed "pixel ghost". */
export function isParseableAddress(address: string | null | undefined): address is string {
  return typeof address === 'string' && address.trim().length > 0;
}

/**
 * Chat color coding (Concept §7.1.2, DESIGN §4.8.1): four bright functional
 * hues, assigned deterministically per address — `fnv1a(address) % 4` →
 * yellow/orange/blue/violet. Both sides of a transcript use the same rule:
 * a bubble takes the hue of the address that speaks (mine included — it is
 * NOT a fixed yellow). The hue names map to `--color-bubble-<hue>` tokens
 * in tokens.css; consumers render them as a `code-<hue>` class, never an
 * inline color.
 */
export const CODE_HUES = ['yellow', 'orange', 'blue', 'violet'] as const;

export type CodeHue = (typeof CODE_HUES)[number];

export function codeHue(address: string): CodeHue {
  // fnv1a % 4 is always a valid index; the fallback only satisfies
  // noUncheckedIndexedAccess (same pattern as PixelAvatar's pick()).
  return CODE_HUES[fnv1a(address) % CODE_HUES.length] ?? 'yellow';
}
