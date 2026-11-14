import { BleakClient } from '@bleak/api-client';
import { API_BASE } from '#lib/config';

/** Singleton typed client for the bleak-node REST API. */
export const api = new BleakClient({ baseUrl: API_BASE });

export * from '@bleak/api-client';
