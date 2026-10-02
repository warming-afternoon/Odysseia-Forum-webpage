import { afterEach, describe, expect, it, vi } from 'vitest';
import { withViewTransition } from './viewTransition';

type NativeTransition = ReturnType<Document['startViewTransition']>;
const originalStart = document.startViewTransition;

afterEach(() => {
  document.startViewTransition = originalStart;
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme-transition');
});

function pendingTransition() {
  let finish!: () => void;
  let cancel!: (error: Error) => void;
  const finished = new Promise<void>((resolve, reject) => { finish = resolve; cancel = reject; });
  const transition: NativeTransition = {
    finished, ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition: vi.fn(),
  };
  return { transition, finish, cancel };
}

describe('原生视图过渡', () => {
  it('连续切换跳过旧动画，旧完成不能清理新动画标记', async () => {
    const first = pendingTransition();
    const second = pendingTransition();
    document.startViewTransition = vi.fn()
      .mockReturnValueOnce(first.transition).mockReturnValueOnce(second.transition);
    withViewTransition(vi.fn(), 'wipe-right');
    withViewTransition(vi.fn(), 'wipe-down');
    expect(first.transition.skipTransition).toHaveBeenCalledOnce();
    first.finish();
    await first.transition.finished;
    expect(document.documentElement).toHaveAttribute('data-theme-transition', 'wipe-down');
    second.finish();
    await second.transition.finished;
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
  });

  it('浏览器取消动画也清理标记，不产生未处理拒绝', async () => {
    const pending = pendingTransition();
    document.startViewTransition = vi.fn().mockReturnValue(pending.transition);
    withViewTransition(vi.fn(), 'circle');
    pending.cancel(new Error('动画取消'));
    await expect(pending.transition.finished).rejects.toThrow('动画取消');
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
  });

  it('减少动态效果时直接执行更新，不创建快照', () => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...media, media: query, matches: query === '(prefers-reduced-motion: reduce)',
    }));
    const start = vi.fn();
    document.startViewTransition = start;
    const update = vi.fn();
    withViewTransition(update, 'circle');
    expect(update).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });
});
