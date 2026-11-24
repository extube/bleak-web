/** Rule-C invite ledger store tests (TZ13-01, Concept §54.2-C,
 * DESIGN rev. 4 §3.7.3): per-room localStorage ledger
 * `bleak.hostInvites.<room address>`, append-only mint/revoke records,
 * server-authoritative merge with expired/revoked classification, an
 * injectable clock, and nothing-recorded-on-failure guards. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Invite } from '@bleak/api-client';
import { hostInviteLedger, readLedger, setLedgerClock } from '../src/lib/stores/hostInviteLedger';

const ROOM = '0xroom';

function invite(code: string, overrides: Partial<Invite> = {}): Invite {
  return {
    room: ROOM,
    code,
    created_at: '2026-11-24T10:00:00Z',
    expires_at: '2026-11-25T10:00:00Z',
    ...overrides
  };
}

/** Fixed clock: 2026-11-24T12:00:00Z — between the fixtures' mint and expiry. */
const NOW = '2026-11-24T12:00:00Z';

beforeEach(() => {
  localStorage.clear();
  setLedgerClock(() => NOW);
});

afterEach(() => {
  localStorage.clear();
  setLedgerClock(() => new Date().toISOString());
});

describe('recordMint (rule C)', () => {
  it('appends every mint response of this device under bleak.hostInvites.<room>', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    ledger.recordMint(invite('222222'));
    expect(ledger.entries()).toEqual([
      { code: '111111', created_at: '2026-11-24T10:00:00Z', expires_at: '2026-11-25T10:00:00Z' },
      { code: '222222', created_at: '2026-11-24T10:00:00Z', expires_at: '2026-11-25T10:00:00Z' }
    ]);
    expect(localStorage.getItem('bleak.hostInvites.0xroom')).toContain('111111');
  });

  it('is append-only and idempotent per code (a repeated code is not duplicated)', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    ledger.recordMint(invite('111111'));
    expect(ledger.entries().length).toBe(1);
  });

  it('records nothing on a failed/garbage mint response (no shape → no write)', () => {
    const ledger = hostInviteLedger(ROOM);
    // A rejected promise never reaches recordMint; a malformed response
    // (e.g. an error body or partial object) must not be recorded either.
    ledger.recordMint({} as Invite);
    ledger.recordMint(undefined as unknown as Invite);
    ledger.recordMint({ room: ROOM, code: '', created_at: 'x', expires_at: 'y' } as Invite);
    expect(ledger.entries()).toEqual([]);
    expect(localStorage.getItem('bleak.hostInvites.0xroom')).toBeNull();
  });

  it('ledgers of different rooms are independent (per-room key family)', () => {
    const a = hostInviteLedger('0xroom-a');
    const b = hostInviteLedger('0xroom-b');
    a.recordMint(invite('111111'));
    b.recordMint(invite('222222'));
    expect(readLedger('0xroom-a').map((entry) => entry.code)).toEqual(['111111']);
    expect(readLedger('0xroom-b').map((entry) => entry.code)).toEqual(['222222']);
  });

  it('tolerates corrupted storage (reads as an empty ledger, next write rebuilds)', () => {
    localStorage.setItem('bleak.hostInvites.0xroom', '{oops');
    const ledger = hostInviteLedger(ROOM);
    expect(ledger.entries()).toEqual([]);
    ledger.recordMint(invite('333333'));
    expect(ledger.entries().length).toBe(1);
  });
});

describe('recordRevoke (rule C)', () => {
  it('stamps revoked_at on the minted entry (the response date, not the clock)', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    ledger.recordRevoke('111111', '2026-11-24T11:30:00Z');
    expect(ledger.entries()).toEqual([
      {
        code: '111111',
        created_at: '2026-11-24T10:00:00Z',
        expires_at: '2026-11-25T10:00:00Z',
        revoked_at: '2026-11-24T11:30:00Z'
      }
    ]);
  });

  it('falls back to the injectable clock when no date is passed', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    ledger.recordRevoke('111111');
    expect(ledger.entries()[0]!.revoked_at).toBe(NOW);
  });

  it('records nothing when the revoke never happened (no stamp without a call)', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    expect(ledger.entries()[0]).not.toHaveProperty('revoked_at');
  });

  it('a revoked code keeps its expiry — only revoked_at is added (append-only storage)', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    ledger.recordMint(invite('222222'));
    const before = ledger.entries().length;
    ledger.recordRevoke('111111');
    expect(ledger.entries().length).toBe(before); // no new row, no deletion
    expect(ledger.entries()[0]!.expires_at).toBe('2026-11-25T10:00:00Z');
  });

  it('a revoke of an unknown code is still recorded (revoked-only entry)', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordRevoke('999999', '2026-11-24T11:00:00Z');
    expect(ledger.entries()).toEqual([
      {
        code: '999999',
        created_at: '2026-11-24T11:00:00Z',
        expires_at: '2026-11-24T11:00:00Z',
        revoked_at: '2026-11-24T11:00:00Z'
      }
    ]);
  });

  it('stamping twice is a no-op (the first revocation date wins)', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    ledger.recordRevoke('111111', '2026-11-24T11:30:00Z');
    ledger.recordRevoke('111111', '2026-11-24T11:59:00Z');
    expect(ledger.entries()[0]!.revoked_at).toBe('2026-11-24T11:30:00Z');
  });
});

describe('merge — server-authoritative (rule C, DESIGN §3.7.3 item 4)', () => {
  it('active is the server list passed through; server codes are never double-rendered', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    ledger.recordMint(invite('222222'));
    const server = [invite('111111')];
    const { active, history } = ledger.merge(server);
    expect(active).toEqual(server);
    expect(active).toHaveLength(1);
    expect(history.map((entry) => entry.code)).toEqual(['222222']);
  });

  it('ledger entries missing from the server list are history', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    ledger.recordMint(invite('222222'));
    const { history } = ledger.merge([invite('111111')]);
    expect(history).toHaveLength(1);
    expect(history[0]!.code).toBe('222222');
  });

  it('a past expiry without revoked_at classifies as expired', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(
      invite('111111', { created_at: '2026-11-24T10:00:00Z', expires_at: '2026-11-24T11:00:00Z' })
    );
    const { history } = ledger.merge([]);
    expect(history).toEqual([
      {
        code: '111111',
        created_at: '2026-11-24T10:00:00Z',
        expires_at: '2026-11-24T11:00:00Z',
        classification: 'expired'
      }
    ]);
  });

  it('a stamped revoked_at classifies as revoked even before expiry', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111'));
    ledger.recordRevoke('111111', '2026-11-24T11:30:00Z');
    const { history } = ledger.merge([]);
    expect(history).toEqual([
      {
        code: '111111',
        created_at: '2026-11-24T10:00:00Z',
        expires_at: '2026-11-25T10:00:00Z',
        revoked_at: '2026-11-24T11:30:00Z',
        classification: 'revoked'
      }
    ]);
  });

  it('an unexpired, unstamped code missing from the server list was revoked elsewhere (classification revoked)', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(invite('111111')); // unexpired at NOW, no revoked_at
    const { history } = ledger.merge([]);
    expect(history).toHaveLength(1);
    expect(history[0]!.classification).toBe('revoked');
  });

  it('the classification clock is injectable (expiry moves with the clock)', () => {
    const ledger = hostInviteLedger(ROOM);
    ledger.recordMint(
      invite('111111', { expires_at: '2026-11-24T12:30:00Z' }) // future at NOW
    );
    expect(ledger.merge([]).history[0]!.classification).toBe('revoked'); // missing → revoked elsewhere
    const restore = setLedgerClock(() => '2026-11-24T13:00:00Z'); // past expiry now
    expect(ledger.merge([]).history[0]!.classification).toBe('expired');
    setLedgerClock(restore);
  });

  it('a poll tick with an empty ledger yields only the server list (no fake history)', () => {
    const ledger = hostInviteLedger(ROOM);
    const server = [invite('111111'), invite('222222')];
    const { active, history } = ledger.merge(server);
    expect(active).toEqual(server);
    expect(history).toEqual([]);
  });

  it('an empty server list + empty ledger is the §3.7.3 empty state input', () => {
    const ledger = hostInviteLedger(ROOM);
    const { active, history } = ledger.merge([]);
    expect(active).toEqual([]);
    expect(history).toEqual([]);
  });
});
