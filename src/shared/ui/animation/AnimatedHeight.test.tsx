import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedHeight } from './AnimatedHeight';
import { Transition } from './Transition';

afterEach(() => vi.restoreAllMocks());

describe('自然高度过渡', () => {
  it('内容尺寸变化更新高度，不重建输入或缩放内容，卸载停止观察', async () => {
    let height = 100;
    let notify!: () => void;
    const disconnect = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => height);
    vi.spyOn(globalThis, 'ResizeObserver').mockImplementation(class {
      constructor(callback: ResizeObserverCallback) {
        notify = () => callback([], this as ResizeObserver);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnect;
    });
    const { unmount } = render(<AnimatedHeight><input aria-label="内容输入" /></AnimatedHeight>);
    const input = screen.getByRole('textbox');
    const panel = input.parentElement!.parentElement!;
    expect(panel).toHaveStyle({ height: '0px' });
    await waitFor(() => expect(panel).toHaveStyle({ height: '100px' }));
    height = 240;
    act(() => notify());
    await waitFor(() => expect(panel).toHaveStyle({ height: '240px' }));
    expect(screen.getByRole('textbox')).toBe(input);
    expect(panel.style.transform).toBe('');
    await waitFor(() => expect(panel).toHaveClass('overflow-visible'));
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('收起立即停止交互，退场完成后卸载内容', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160);
    const view = (show: boolean) => <Transition show={show}>
      <AnimatedHeight><button>发现内容</button></AnimatedHeight>
    </Transition>;
    const { rerender } = render(view(true));
    const button = screen.getByRole('button');
    rerender(view(false));
    expect(button.closest('[inert]')).not.toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await waitFor(() => expect(button).not.toBeInTheDocument());
  });
});
