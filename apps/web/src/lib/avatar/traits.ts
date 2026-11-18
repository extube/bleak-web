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
 * Chat color coding (Concept §9.1.5, DESIGN §4.10.5 — supersedes the
 * §7.1.2 four-hue set): the five bright Deepa hues, assigned
 * deterministically per address — `fnv1a(address) % 5` → deepa-1…deepa-5.
 * In the dialog only the INTERLOCUTOR'S bubble takes the speaker's hue;
 * own bubbles stay on the muted neutral surface (§8.1.7). Chats-list cards
 * use the counterpart's hue as the full-opacity card background. The hue
 * names map to `--color-deepa-<n>` tokens in tokens.css (text on a hue
 * pairs with its `--color-deepa-ink-<n>` token); consumers render them as
 * a `deepa-<n>` class, never an inline color. The avatar palette (task:
 * avatar Deepa art) derives from the same five hues.
 */
export const CODE_HUES = ['deepa-1', 'deepa-2', 'deepa-3', 'deepa-4', 'deepa-5'] as const;

export type CodeHue = (typeof CODE_HUES)[number];

export function codeHue(address: string): CodeHue {
  // fnv1a % 5 is always a valid index; the fallback only satisfies
  // noUncheckedIndexedAccess (same pattern as PixelAvatar's pick()).
  return CODE_HUES[fnv1a(address) % CODE_HUES.length] ?? 'deepa-1';
}
