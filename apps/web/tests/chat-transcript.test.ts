/** ChatTranscript tests (DESIGN §4.18, tz11-09): the REAL main-room chat
 * machinery — message-list rendering + scrolling/autoscroll — extracted
 * from routes/chats/[address] and shared with the creation chat (the
 * wizard drives it; no simulated replica). Covers: the ChatLine →
 * MessageBubble rendering contract (agent hue + mascot avatar, mine
 * muted, the /chats meta row, the accessible «speaker: text» name), the
 * date label placement, the smooth §24-item-12 pin on the CALLER'S
 * scroller (new lines + pinKey swaps, bounded rAF re-assert), and the
 * behavior-neutral guarantees for the main room (no entrance animation
 * without the mascot, instant stick mode untouched — its isNearBottom
 * contract is proven in chats-view.test.ts).
 * @testing-library/svelte over happy-dom. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import ChatTranscript, { type ChatLine } from '../src/lib/components/chats/ChatTranscript.svelte';
import { codeHue } from '../src/lib/avatar/traits';

const MASCOT = 'bleak-mascot';

function agent(text: string): ChatLine {
  return { who: 'agent', text, hueSeed: MASCOT, mascot: true, label: `Bleak: ${text}` };
}
function mine(text: string): ChatLine {
  return { who: 'me', text };
}
function roomLine(text: string): ChatLine {
  return {
    who: 'agent',
    text,
    hueSeed: '0xa',
    meta: { speaker: 'Алиса', time: '14:05' },
    label: `Алиса: ${text}`
  };
}

function mount(lines: ChatLine[], props: Record<string, unknown> = {}): HTMLElement {
  const scroller = document.createElement('div');
  document.body.appendChild(scroller);
  const { container } = render(ChatTranscript, {
    props: { lines, scroller, ...props }
  });
  return container;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('ChatTranscript — the ChatLine rendering contract', () => {
  it('renders lines through the shared MessageBubble: agent rows take the hue seed + the mascot avatar, mine stay muted', () => {
    const container = mount([agent('Как тебя зовут?'), mine('Аня')]);
    const rows = container.querySelectorAll('ol.transcript > li.row');
    expect(rows).toHaveLength(2);
    const agentRow = rows[0] as HTMLElement;
    expect(agentRow.querySelector('.bubble')?.classList.contains(codeHue(MASCOT))).toBe(true);
    expect(agentRow.querySelector('.avatar svg')).toBeTruthy();
    expect(agentRow.getAttribute('aria-label')).toBe('Bleak: Как тебя зовут?');
    const mineRow = rows[1] as HTMLElement;
    expect(mineRow.classList.contains('mine')).toBe(true);
    expect(
      [...(mineRow.querySelector('.bubble')?.classList ?? [])].some((c) => c.startsWith('deepa-'))
    ).toBe(false);
    expect(mineRow.querySelector('.avatar')).toBeNull();
  });

  it('the main-room line shape: the meta row (speaker + hh:mm) and NO avatar — behavior-neutral rendering', () => {
    const container = mount([roomLine('Привет!')]);
    const row = container.querySelector('li.row') as HTMLElement;
    expect(row.querySelector('.avatar')).toBeNull();
    const speaker = row.querySelector('.meta .speaker');
    const time = row.querySelector('.meta .time');
    expect(speaker?.textContent).toBe('Алиса');
    expect(time?.textContent).toBe('14:05');
    // No entrance animation without the creation mascot (the main room
    // never animates on poll arrivals).
    expect(row.classList.contains('animated')).toBe(false);
  });

  it('the date label renders only when provided (main room), above the first message', () => {
    const plain = mount([agent('Привет')]);
    expect(plain.querySelector('.date-label')).toBeNull();
    const dated = mount([agent('Привет')], { dateLabel: '8 сентября' });
    const label = dated.querySelector('.date-label');
    expect(label?.textContent).toBe('8 сентября');
    // The label precedes the transcript list in the column flow.
    expect(dated.firstElementChild).toBe(label);
  });
});

describe('ChatTranscript — the smooth pin (the creation chat, §24 item 12 / tasks 107+109)', () => {
  it('pins the CALLER\'S scroller smoothly on new lines and pinKey swaps, with a bounded settled-layout re-assert', async () => {
    const frames: (FrameRequestCallback | undefined)[] = [];
    const raf = vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const caf = vi.fn((id: number) => {
      frames[id - 1] = undefined;
    });
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);
    function flushFrames(): void {
      const batch = frames.splice(0);
      for (const cb of batch) cb?.(16);
    }
    try {
      const scroller = document.createElement('div');
      document.body.appendChild(scroller);
      // The spy is in place BEFORE the mount effect runs so the very
      // first pin is captured too.
      const spy = vi.spyOn(scroller, 'scrollTo').mockImplementation(() => {});
      const { rerender } = render(ChatTranscript, {
        props: { lines: [agent('Как тебя зовут?')], scroller, smooth: true, pinKey: 'name' }
      });
      await tick();
      expect(spy.mock.contexts.at(-1)).toBe(scroller);
      const syncCalls = spy.mock.calls.length;
      expect(syncCalls).toBeGreaterThanOrEqual(1);
      expect(spy.mock.calls.at(-1)).toEqual([
        { top: scroller.scrollHeight, behavior: 'smooth' }
      ]);
      // A new line re-pins synchronously...
      rerender({
        lines: [agent('Как тебя зовут?'), mine('Аня'), agent('Приятно познакомиться!')],
        scroller,
        smooth: true,
        pinKey: 'public'
      });
      await tick();
      expect(spy.mock.calls.length).toBeGreaterThan(syncCalls);
      // ...and the bounded re-assert fires two rAFs later, against the
      // same scroller, to the same smooth bottom target.
      flushFrames(); // frame 1 (schedules frame 2)
      flushFrames(); // frame 2 → pinToBottom
      expect(spy.mock.calls.length).toBeGreaterThan(syncCalls + 1);
      expect(spy.mock.calls.at(-1)).toEqual([
        { top: scroller.scrollHeight, behavior: 'smooth' }
      ]);
      expect(raf).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('smooth mode never shows the jump chip (the creation chat always pins; the chip is the main room\'s stick affordance)', () => {
    const container = mount([agent('Привет'), mine('И тебе')], { smooth: true });
    expect(container.querySelector('.jump-chip')).toBeNull();
  });

  it('instant mode (the main room default): no smooth pin runs — the stick contract owns the scroll', async () => {
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    const scrollTo = vi.spyOn(scroller, 'scrollTo');
    render(ChatTranscript, {
      props: { lines: [roomLine('Привет!')], scroller }
    });
    await tick();
    // The instant pin writes scrollTop directly (the §3.5 AC 3 contract);
    // scrollTo is never called.
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scroller.scrollTop).toBe(scroller.scrollHeight);
    // No chip while stuck at the bottom.
    expect(document.querySelector('.jump-chip')).toBeNull();
  });
});
