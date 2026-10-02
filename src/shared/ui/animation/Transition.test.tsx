import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Transition } from './Transition';

afterEach(() => vi.restoreAllMocks());

describe('浮层进出场', () => {
  it('退场立即隐藏语义并禁用交互，动画完成才清理 DOM', async () => {
    const { rerender } = render(<Transition show role="dialog"><button>操作</button></Transition>);
    const panel = screen.getByRole('dialog');
    rerender(<Transition show={false} role="dialog"><button>操作</button></Transition>);
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('inert');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel).toHaveStyle({ pointerEvents: 'none' });
    expect(screen.queryByRole('button', { name: '操作' })).not.toBeInTheDocument();
    await waitFor(() => expect(panel).not.toBeInTheDocument());
  });

  it('退场尚未结束时重开仍创建新草稿，并清理旧节点', async () => {
    const { rerender } = render(<Transition show><input defaultValue="原草稿" /></Transition>);
    const oldInput = screen.getByRole('textbox');
    fireEvent.change(oldInput, { target: { value: '未保存修改' } });
    rerender(<Transition show={false}><input defaultValue="新快照" /></Transition>);
    rerender(<Transition show><input defaultValue="新快照" /></Transition>);
    const activeInput = screen.getByRole('textbox');
    expect(activeInput).not.toBe(oldInput);
    expect(activeInput).toHaveValue('新快照');
    expect(oldInput.closest('[inert]')).not.toBeNull();
    await waitFor(() => expect(oldInput).not.toBeInTheDocument());
  });

  it('减少动态效果时不使用位移或缩放，关闭仍正确清理', async () => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...media, media: query, matches: query === '(prefers-reduced-motion: reduce)',
    }));
    const { rerender } = render(<Transition show type="scale" role="dialog">内容</Transition>);
    const panel = screen.getByRole('dialog');
    expect(panel.style.transform).toBe('');
    rerender(<Transition show={false} type="scale" role="dialog">内容</Transition>);
    await waitFor(() => expect(panel).not.toBeInTheDocument());
  });
});
