/** Error thrown for any non-2xx bleak-node response. */
export class ApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(status: number, endpoint: string, message: string) {
    super(`bleak-node ${status} on ${endpoint}: ${message}`);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

/**
 * Client-side contract violation the server would answer 400 for (v3
 * limits mirrored from bleak-node: 1..50 interest rows/keys, 1..64-symbol
 * titles, 1..255-symbol contact content). Thrown BEFORE any request is
 * made — the UI can rely on never hitting the wire with a doomed body.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Network-level failure (server unreachable — e.g. venue Wi-Fi drops). */
export class NetworkError extends Error {
  readonly endpoint: string;

  constructor(endpoint: string, cause: unknown) {
    super(`bleak-node unreachable on ${endpoint}`);
    this.name = 'NetworkError';
    this.endpoint = endpoint;
    this.cause = cause;
  }
}
