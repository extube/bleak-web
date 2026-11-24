/** Join step machine + services (TZ-03 + TZ2-06 Part B, DESIGN §3.1 rev. 3):
 * code validation, §3.1/§2.9 error mapping, deep-link parsing (u + m),
 * step transitions with the vault step, and the API orchestration against
 * mocked clients (vi.mock('#lib/api/client') + the invite-resolve seam +
 * the crypto token generator). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, type Room, type User } from '@bleak/api-client';

vi.mock('#lib/api/invite-resolve', () => {
  class InviteResolveError extends Error {
    readonly kind: 'malformed' | 'not_found';
    constructor(kind: 'malformed' | 'not_found') {
      super(kind);
      this.name = 'InviteResolveError';
      this.kind = kind;
    }
  }
  return { InviteResolveError, resolveInviteCode: vi.fn() };
});

vi.mock('#lib/crypto/secrets', () => ({ generateTokenSecret: vi.fn(() => 'generated-raw-token') }));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoom: vi.fn(),
    listRoomUsers: vi.fn(),
    getRoomUser: vi.fn(),
    createRoomUser: vi.fn()
  }
}));

import { InviteResolveError, resolveInviteCode } from '#lib/api/invite-resolve';
import { api } from '#lib/api/client';
import {
  codeErrorOf,
  createPersona,
  initialJoinState,
  initialWizardState,
  isValidInviteCode,
  parseJoinDeepLink,
  personaErrorOf,
  reduce,
  reduceWizard,
  resolveRoomByCode,
  vaultErrorOf,
  verifyVaultEntry,
  wizardOrderIndex,
  wizardPersonaDraft,
  type PersonaDraft,
  type WizardState
} from '#lib/join';
import type { VaultEntry } from '#lib/stores/tokenVault';

const mockedResolve = vi.mocked(resolveInviteCode);
const mockedApi = vi.mocked(api);

const room: Room = {
  address: '0xroom123',
  name: 'Хостел «Пиксель»',
  description: 'Митап',
  language: 'ru',
  max_user: 50,
  created_at: '',
  updated_at: '',
  deleted_at: null
};

function user(address: string, name: string): User {
  return {
    active: true,
    address,
    room: room.address,
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: '',
    updated_at: '',
    deleted_at: null
  };
}

function vaultEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    roomAddress: '0xoldroom',
    userAddress: '0xold',
    token: 'stored-vault-token',
    name: 'Старая персона',
    savedAt: '2026-11-14T10:00:00Z',
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('invite-code validation', () => {
  it('accepts exactly six digits', () => {
    expect(isValidInviteCode('123456')).toBe(true);
    expect(isValidInviteCode('000000')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidInviteCode('12345')).toBe(false);
    expect(isValidInviteCode('1234567')).toBe(false);
    expect(isValidInviteCode('12345a')).toBe(false);
    expect(isValidInviteCode('')).toBe(false);
  });
});

describe('codeErrorOf (§3.1 interaction states)', () => {
  it('maps the seam malformed kind to the malformed inline error', () => {
    expect(codeErrorOf(new InviteResolveError('malformed')).kind).toBe('malformed');
  });

  it('maps the seam not_found kind to the unknown-code inline error', () => {
    expect(codeErrorOf(new InviteResolveError('not_found')).kind).toBe('not_found');
  });

  it('maps network failure to the banner kind', () => {
    expect(codeErrorOf(new NetworkError('/api/invite/123456', new Error('offline'))).kind).toBe(
      'network'
    );
  });

  it('maps a deleted room (bleak-node 404) to the gone card state', () => {
    expect(codeErrorOf(new ApiError(404, '/api/room/0xroom123', 'room not found')).kind).toBe(
      'gone'
    );
  });

  it('maps other bleak-node errors to the api banner with server text', () => {
    const err = new ApiError(500, '/api/room', 'boom');
    const mapped = codeErrorOf(err);
    expect(mapped.kind).toBe('api');
    expect(mapped.text).toBe('boom');
  });
});

describe('personaErrorOf (§3.1 + §2.9)', () => {
  it('maps 409 to the name-taken copy', () => {
    expect(personaErrorOf(new ApiError(409, '/api/room/r/user', 'name taken')).kind).toBe(
      'name_taken'
    );
  });

  it('maps 404 to the gone card state', () => {
    expect(personaErrorOf(new ApiError(404, '/api/room/r/user', 'room not found')).kind).toBe(
      'gone'
    );
  });

  it.each([401, 403, 410])(
    'maps %i on create to the §2.9 invite-code state (invalid/expired/revoked code)',
    (status) => {
      const mapped = personaErrorOf(
        new ApiError(status, '/api/room/r/user', 'invite code rejected')
      );
      expect(mapped.kind).toBe('invite');
    }
  );

  it('maps 400 to a field-level server-text error', () => {
    const mapped = personaErrorOf(new ApiError(400, '/api/room/r/user', 'name is empty'));
    expect(mapped.kind).toBe('api');
    expect(mapped.text).toBe('name is empty');
  });

  it('maps network failure to the banner copy', () => {
    expect(personaErrorOf(new NetworkError('/api/room/r/user', null)).kind).toBe('network');
  });
});

describe('vaultErrorOf (dead-entry state, §3.1 + §4.11.1 return flow)', () => {
  it('maps 404/403 to the dead-entry state with the server text', () => {
    expect(vaultErrorOf(new ApiError(404, '/api/room/r/user/0xold', 'not found'))).toEqual({
      kind: 'dead',
      text: 'not found'
    });
    expect(vaultErrorOf(new ApiError(403, '/api/room/r/user/0xold', 'wrong record'))).toEqual({
      kind: 'dead',
      text: 'wrong record'
    });
  });

  it('maps a 401 to the dead-entry state too — the row shows the dead-note and the flow does not enter (the §2.8 global gate has fired underneath)', () => {
    expect(vaultErrorOf(new ApiError(401, '/api/room/r/user/0xold', 'bad token'))).toEqual({
      kind: 'dead',
      text: 'bad token'
    });
  });

  it('maps network failure to the banner kind', () => {
    expect(vaultErrorOf(new NetworkError('/api', null)).kind).toBe('network');
  });
});

describe('deep-link parsing (§3.1 AC 19)', () => {
  it('parses a valid ?code= as the invite deep link', () => {
    expect(parseJoinDeepLink(new URLSearchParams('code=123456'))).toEqual({
      kind: 'code',
      code: '123456'
    });
  });

  it('parses ?u= without m as the single-direction persona deep link', () => {
    expect(parseJoinDeepLink(new URLSearchParams('u=0xalice'))).toEqual({
      kind: 'user',
      userAddress: '0xalice',
      mutualCode: null
    });
  });

  it('parses ?u=…&m=… as the full mutual persona deep link', () => {
    expect(parseJoinDeepLink(new URLSearchParams('u=0xalice&m=one-time-code'))).toEqual({
      kind: 'user',
      userAddress: '0xalice',
      mutualCode: 'one-time-code'
    });
  });

  it('ignores invalid or absent params', () => {
    expect(parseJoinDeepLink(new URLSearchParams('code=12ab56'))).toBeNull();
    expect(parseJoinDeepLink(new URLSearchParams('u='))).toBeNull();
    expect(parseJoinDeepLink(new URLSearchParams(''))).toBeNull();
  });
});

describe('step machine transitions (return-to-event vault screen)', () => {
  it('enters the room preview when the code resolves', () => {
    const next = reduce(initialJoinState, { type: 'resolved', room, members: [user('0xa', 'A')] });
    expect(next.step).toBe('room');
    expect(next.room).toBe(room);
    expect(next.members).toHaveLength(1);
  });

  it('choose-create opens the persona form', () => {
    const atRoom = reduce(initialJoinState, { type: 'resolved', room, members: [] });
    const next = reduce(atRoom, { type: 'choose-create' });
    expect(next.step).toBe('persona');
  });

  it('choose-return opens the vault step from the code entry (no server room picker)', () => {
    const next = reduce(initialJoinState, { type: 'choose-return' });
    expect(next.step).toBe('vault');
    expect(next.room).toBeNull();
  });

  it('back navigation: vault (return screen) → code entry, persona → room preview, room → code entry', () => {
    const atRoom = reduce(initialJoinState, { type: 'resolved', room, members: [] });
    expect(reduce(atRoom, { type: 'back' }).step).toBe('code');
    const atPersona = reduce(atRoom, { type: 'choose-create' });
    expect(reduce(atPersona, { type: 'back' }).step).toBe('room');
    const atVault = reduce(initialJoinState, { type: 'choose-return' });
    expect(reduce(atVault, { type: 'back' }).step).toBe('code');
  });

  it('change-code resets to a clean code entry', () => {
    const atRoom = reduce(initialJoinState, { type: 'resolved', room, members: [] });
    const next = reduce(atRoom, { type: 'change-code' });
    expect(next).toEqual(initialJoinState);
  });
});

describe('services against the mocked clients (v2)', () => {
  it('resolveRoomByCode: invite-resolve seam → room → members (public reads)', async () => {
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([user('0xa', 'Алиса')]);

    const result = await resolveRoomByCode('123456');

    expect(mockedResolve).toHaveBeenCalledWith('123456');
    expect(mockedApi.getRoom).toHaveBeenCalledWith(room.address);
    expect(mockedApi.listRoomUsers).toHaveBeenCalledWith(room.address);
    expect(result.room.name).toBe('Хостел «Пиксель»');
    expect(result.members).toHaveLength(1);
  });

  it('createPersona generates a client token and sends the exact CreateUserRequestV2 body (invite_code + token, trimmed)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    const draft: PersonaDraft = { name: '  Я  ', publicBio: '', privateBio: 'секрет' };

    const { user: created, token } = await createPersona(room.address, '123456', draft);

    expect(token).toBe('generated-raw-token');
    expect(created.address).toBe('0xme');
    expect(mockedApi.createRoomUser).toHaveBeenCalledWith(room.address, {
      name: 'Я',
      private_bio: 'секрет',
      invite_code: '123456',
      token: 'generated-raw-token'
    });
  });

  it('verifyVaultEntry validates the stored token with ITS OWN credential (the return-flow explicit-token read)', async () => {
    mockedApi.getRoomUser.mockResolvedValue(user('0xold', 'Старая персона'));
    const entry = vaultEntry();

    await verifyVaultEntry(entry);

    expect(mockedApi.getRoomUser).toHaveBeenCalledTimes(1);
    expect(mockedApi.getRoomUser).toHaveBeenCalledWith('0xoldroom', '0xold', {
      token: 'stored-vault-token'
    });
  });
});

describe('creation wizard step machine (Concept §22.3 item 2, DESIGN §4.16.2)', () => {
  const walked = (
    ...events: Parameters<typeof reduceWizard>[1][]
  ): WizardState => events.reduce(reduceWizard, { ...initialWizardState });

  /** The interview walked to the contact-value question, answers filled. */
  const toContactValue = (): WizardState =>
    walked(
      { type: 'start' },
      { type: 'name', name: 'Я' },
      { type: 'next' },
      { type: 'public-bio', value: 'виден' },
      { type: 'next' },
      { type: 'private-bio', value: 'секрет' },
      { type: 'next' },
      { type: 'contact-kind', kind: 'phone' as const },
      { type: 'contact-value', value: '+7 999' }
    );

  /** …then advanced past the contact question (at the theme badges). */
  const toThemes = (): WizardState => reduceWizard(toContactValue(), { type: 'next' });

  it('starts at the intro and walks the interview order name → bios → contact → interests', () => {
    expect(initialWizardState.step).toBe('intro');
    const atName = reduceWizard(initialWizardState, { type: 'start' });
    expect(atName.step).toBe('name');
    const atPublic = reduceWizard({ ...atName, name: 'Я' }, { type: 'next' });
    expect(atPublic.step).toBe('public_bio');
    expect(reduceWizard(atPublic, { type: 'next' }).step).toBe('private_bio');
    const atPrivate = reduceWizard(atPublic, { type: 'next' });
    expect(reduceWizard(atPrivate, { type: 'next' }).step).toBe('contact_type');
  });

  it('stores the name/bio answers verbatim and ignores answer events at other steps', () => {
    const atPublic = reduceWizard(reduceWizard(initialWizardState, { type: 'start' }), {
      type: 'name',
      name: 'Я'
    });
    expect(atPublic.step).toBe('name');
    expect(atPublic.name).toBe('Я');
    const named = reduceWizard(atPublic, { type: 'next' });
    const answered = reduceWizard(named, { type: 'public-bio', value: 'художник' });
    expect(answered.publicBio).toBe('художник');
    // The private-bio answer is only stored at the private-bio step.
    expect(reduceWizard(answered, { type: 'private-bio', value: 'x' }).privateBio).toBe('');
  });

  it('contact: the KIND is chosen first, then the value; skip clears both (§14.1.3 — local-only, optional)', () => {
    const atContact = walked(
      { type: 'start' },
      { type: 'name', name: 'Я' },
      { type: 'next' },
      { type: 'next' },
      { type: 'next' }
    );
    expect(atContact.step).toBe('contact_type');
    const atValue = reduceWizard(atContact, { type: 'contact-kind', kind: 'nickname' });
    expect(atValue.step).toBe('contact_value');
    expect(atValue.contactKind).toBe('nickname');
    expect(atValue.contactValue).toBe('');
    const valued = reduceWizard(atValue, { type: 'contact-value', value: 'tg:@me' });
    expect(valued.contactValue).toBe('tg:@me');
    const atThemes = reduceWizard(valued, { type: 'next' });
    expect(atThemes.step).toBe('themes');
    // Skip (from the type question) jumps past the whole contact question.
    const skipped = walked(
      { type: 'start' },
      { type: 'next' },
      { type: 'next' },
      { type: 'next' },
      { type: 'skip' }
    );
    expect(skipped.step).toBe('themes');
    expect(skipped.contactKind).toBeNull();
    expect(skipped.contactValue).toBe('');
  });

  it('themes: a theme opens its topics; toggles are a multi-select set capped at MAX_INTERESTS (§23.2 5.5)', () => {
    const atThemes = toThemes();
    const atTopics = reduceWizard(atThemes, { type: 'interest-group', group: 1 });
    expect(atTopics.step).toBe('topics');
    expect(atTopics.interestGroup).toBe(1);
    const one = reduceWizard(atTopics, { type: 'toggle-interest', key: 8 });
    expect(one.interestKeys).toEqual([8]);
    const two = reduceWizard(one, { type: 'toggle-interest', key: 7 });
    expect(two.interestKeys).toEqual([8, 7]);
    // Re-toggle removes.
    expect(reduceWizard(two, { type: 'toggle-interest', key: 8 }).interestKeys).toEqual([7]);
    // Toggle events at other steps are ignored.
    expect(reduceWizard(atThemes, { type: 'toggle-interest', key: 999 })).toBe(atThemes);
  });

  it('the themes loop (§23.2 5.7): theme-done returns to the badges with the keys kept; only Ready (or skip) reaches creating', () => {
    const atThemes = toThemes();
    const atTopics = reduceWizard(atThemes, { type: 'interest-group', group: 0 });
    const picked = reduceWizard(atTopics, { type: 'toggle-interest', key: 2 });
    // Done with the theme → BACK to the badges, keys accumulate.
    const backAtThemes = reduceWizard(picked, { type: 'theme-done' });
    expect(backAtThemes.step).toBe('themes');
    expect(backAtThemes.interestKeys).toEqual([2]);
    expect(backAtThemes.interestGroup).toBe(0);
    // Another theme, more topics — still no creating.
    const secondTopics = reduceWizard(backAtThemes, { type: 'interest-group', group: 1 });
    const secondPicked = reduceWizard(secondTopics, { type: 'toggle-interest', key: 8 });
    const themesAgain = reduceWizard(secondPicked, { type: 'theme-done' });
    expect(themesAgain.step).toBe('themes');
    expect(themesAgain.interestKeys).toEqual([2, 8]);
    // topics' next/theme-done never jumps forward; only Ready/skip/finish do.
    expect(reduceWizard(themesAgain, { type: 'ready' }).step).toBe('creating');
    expect(reduceWizard(themesAgain, { type: 'skip' }).step).toBe('creating');
    expect(reduceWizard(themesAgain, { type: 'finish' }).step).toBe('creating');
    // 'next' at themes is inert (the Ready button is the forward path).
    expect(reduceWizard(themesAgain, { type: 'next' }).step).toBe('themes');
  });

  it('back navigation walks the interview backwards; a skipped contact reopens the type question; creating returns to the badges', () => {
    expect(reduceWizard({ ...initialWizardState }, { type: 'back' }).step).toBe('intro');
    const atContactValue = toContactValue();
    expect(reduceWizard(atContactValue, { type: 'back' }).step).toBe('contact_type');
    const atThemes = reduceWizard(atContactValue, { type: 'next' });
    expect(reduceWizard(atThemes, { type: 'back' }).step).toBe('contact_value');
    const atTopics = reduceWizard(atThemes, { type: 'interest-group', group: 1 });
    expect(reduceWizard(atTopics, { type: 'back' }).step).toBe('themes');
    // A skipped contact: back from the themes badges reopens the type pick.
    const skipped = walked(
      { type: 'start' },
      { type: 'next' },
      { type: 'next' },
      { type: 'next' },
      { type: 'skip' }
    );
    expect(reduceWizard(skipped, { type: 'back' }).step).toBe('contact_type');
  });

  it('wizardOrderIndex sorts creating past the whole interview', () => {
    expect(wizardOrderIndex('intro')).toBe(0);
    expect(wizardOrderIndex('themes')).toBe(6);
    expect(wizardOrderIndex('topics')).toBe(7);
    expect(wizardOrderIndex('creating')).toBe(8);
  });

  it('wizardPersonaDraft composes the draft: interests ride as topic keys, contact is the caller text', () => {
    const state = reduceWizard(reduceWizard(toThemes(), { type: 'interest-group', group: 1 }), {
      type: 'toggle-interest',
      key: 8
    });
    const draft = wizardPersonaDraft(state, 'Телефон: +7 999');
    expect(draft).toEqual({
      name: 'Я',
      publicBio: 'виден',
      privateBio: 'секрет',
      contact: 'Телефон: +7 999',
      interests: [8]
    });
    const empty = wizardPersonaDraft({ ...initialWizardState });
    expect(empty.contact).toBeUndefined();
    expect(empty.interests).toBeUndefined();
  });

  it('the composed draft keeps the createPersona body UNCHANGED (no contact, no interests on the wire)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    const draft = wizardPersonaDraft(toContactValue(), 'Телефон: +7 999');
    await createPersona(room.address, '123456', draft);
    const body = mockedApi.createRoomUser.mock.calls[0]?.[1] as unknown as Record<
      string,
      unknown
    >;
    expect(body).toEqual({
      name: 'Я',
      public_bio: 'виден',
      private_bio: 'секрет',
      invite_code: '123456',
      token: 'generated-raw-token'
    });
    expect('contact' in body).toBe(false);
    expect('interests' in body).toBe(false);
  });
});
