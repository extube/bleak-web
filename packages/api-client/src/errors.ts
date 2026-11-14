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
