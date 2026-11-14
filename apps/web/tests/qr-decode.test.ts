/** decode.ts tests (TZ-04): BarcodeDetector selection, lazy jsqr fallback
 * (dynamic import, mocked), downscaled canvas frame decode. */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { barcodeDetectorSupported, loadDecoder } from '../src/lib/scanner/decode';

const jsqr = vi.hoisted(() =>
  vi.fn(
    (_data: Uint8ClampedArray, _width: number, _height: number): { data: string } | null => ({
      data: 'http://localhost:5173/?code=654321'
    })
  )
);
vi.mock('jsqr', () => ({ default: jsqr }));

describe('decoder selection', () => {
  beforeEach(() => {
    jsqr.mockClear();
    // happy-dom has no BarcodeDetector — the jsqr fallback path applies.
    delete (window as { BarcodeDetector?: unknown }).BarcodeDetector;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('BarcodeDetector is unsupported in the test environment', () => {
    expect(barcodeDetectorSupported()).toBe(false);
  });

  it('falls back to the lazy jsqr decoder and decodes a downscaled frame', async () => {
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16) }))
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );

    const decoder = await loadDecoder();
    const video = { videoWidth: 960, videoHeight: 720 } as HTMLVideoElement;
    const text = await decoder.decodeFrame(video);

    expect(text).toBe('http://localhost:5173/?code=654321');
    expect(jsqr).toHaveBeenCalledTimes(1);
    // Downscaled to MAX_FRAME_SIDE (480): 960x720 → 480x360.
    expect(ctx.drawImage).toHaveBeenCalledWith(video, 0, 0, 480, 360);
    expect(jsqr.mock.calls[0]?.[1]).toBe(480);
    expect(jsqr.mock.calls[0]?.[2]).toBe(360);
  });

  it('returns null for a frame without dimensions (video not ready)', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn()
    } as unknown as CanvasRenderingContext2D);

    const decoder = await loadDecoder();
    const video = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;
    expect(await decoder.decodeFrame(video)).toBeNull();
    expect(jsqr).not.toHaveBeenCalled();
  });

  it('returns null when no QR is found in the frame', async () => {
    jsqr.mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16) }))
    } as unknown as CanvasRenderingContext2D);

    const decoder = await loadDecoder();
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
    expect(await decoder.decodeFrame(video)).toBeNull();
  });
});
