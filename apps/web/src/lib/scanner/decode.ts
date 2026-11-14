/**
 * QR decoder selection (DESIGN §3.8 detection loop): `BarcodeDetector`
 * (formats: qr_code) where available (Android Chrome), otherwise the
 * lazy-loaded JS fallback `jsqr` (~14 kB, dynamic import — never loaded
 * before the overlay's granted path). Frames are downscaled onto a canvas
 * for the JS fallback; decode attempts are throttled by the caller (≤4/s).
 *
 * Nothing in this module is statically imported by any route chunk: the
 * scanner pulls it in with a dynamic import when the camera starts.
 */

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

/** Frame decoder bound to one overlay lifetime (one instance per overlay). */
export interface FrameDecoder {
  decodeFrame(video: HTMLVideoElement): Promise<string | null>;
}

/** `BarcodeDetector` is Chromium-only; everything else takes the jsqr path. */
export function barcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';
}

/** Maximum downscaled frame side for the jsqr path (speed over coverage). */
const MAX_FRAME_SIDE = 480;

/**
 * Load the decoder for this overlay lifetime: the native detector when
 * supported, else the dynamic `jsqr` import (cached by the module system —
 * one load per session, decoded from downscaled canvas frames).
 */
export async function loadDecoder(): Promise<FrameDecoder> {
  if (barcodeDetectorSupported()) {
    const detector = new window.BarcodeDetector!({ formats: ['qr_code'] });
    return {
      decodeFrame: async (video) => {
        try {
          const codes = await detector.detect(video);
          const first = codes[0];
          return first ? first.rawValue : null;
        } catch {
          return null;
        }
      }
    };
  }

  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { decodeFrame: async () => null };

  return {
    decodeFrame: async (video) => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return null;
      const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(width, height));
      const dw = Math.max(1, Math.round(width * scale));
      const dh = Math.max(1, Math.round(height * scale));
      canvas.width = dw;
      canvas.height = dh;
      ctx.drawImage(video, 0, 0, dw, dh);
      const image = ctx.getImageData(0, 0, dw, dh);
      const result = jsQR(image.data, dw, dh);
      return result ? result.data : null;
    }
  };
}
