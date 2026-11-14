import { HELPER_BASE } from '#lib/config';

/**
 * Thin client for the helper service (invite-code mapping + QR).
 * Only three endpoints exist (see apps/helper/src/app.ts).
 */
export interface InviteInfo {
  code: string;
  room_address: string;
}

export interface InvitePayload {
  room: { address: string; name: string };
  code: string;
  invite_url: string;
}

export class HelperError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HelperError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${HELPER_BASE}${path}`, init);
  if (response.status < 200 || response.status >= 300) {
    const body = await response.text();
    throw new HelperError(response.status, body || response.statusText);
  }
  return (await response.json()) as T;
}

/** Resolve a 6-digit invite code to its room address. */
export function resolveInvite(code: string): Promise<InviteInfo> {
  return request<InviteInfo>(`/rooms/${encodeURIComponent(code)}`);
}

/** Host: create a room (gated by the host token) and get code + invite URL. */
export function createRoom(
  input: { name: string; description?: string; language?: string },
  hostToken: string
): Promise<InvitePayload> {
  return request<InvitePayload>('/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-host-token': hostToken },
    body: JSON.stringify(input)
  });
}

/** Host: QR PNG encoding the invite URL for a code. */
export function inviteQrUrl(code: string): string {
  return `${HELPER_BASE}/rooms/${encodeURIComponent(code)}/qr`;
}
