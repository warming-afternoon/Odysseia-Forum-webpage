import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Booklist, BooklistItem } from '@/entities/booklist/types';
import { BooklistFormModal } from './BooklistFormModal';
import { BooklistItemEditorModal } from './BooklistItemEditorModal';

const booklist = {
  id: 1, title: '原标题', description: '原简介', is_public: true,
  default_sort_method: 'reaction_count', default_sort_order: 'asc',
} as Booklist;

describe('书单编辑草稿', () => {
  it('后台快照刷新不覆盖输入或原排序，关闭再打开使用新快照', async () => {
    const onSubmit = vi.fn();
    const props = { isOpen: true, initialValue: booklist, onClose: vi.fn(), onSubmit };
    const { rerender } = render(<BooklistFormModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('输入书单标题'), { target: { value: '未提交标题' } });
    fireEvent.change(screen.getByPlaceholderText(/写一段简介/), { target: { value: '未提交简介' } });
    const refreshed = { ...booklist, title: '后台标题', item_count: 20 };
    rerender(<BooklistFormModal {...props} initialValue={refreshed} />);
    expect(screen.getByPlaceholderText('输入书单标题')).toHaveValue('未提交标题');
    expect(screen.getByPlaceholderText(/写一段简介/)).toHaveValue('未提交简介');
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: '未提交标题', default_sort_method: 'reaction_count', default_sort_order: 'asc',
    })));
    rerender(<BooklistFormModal {...props} initialValue={refreshed} isOpen={false} />);
    rerender(<BooklistFormModal {...props} initialValue={refreshed} />);
    expect(within(screen.getByRole('dialog', { name: '编辑书单' }))
      .getByPlaceholderText('输入书单标题')).toHaveValue('后台标题');
  });

  it('主动选择既有展示顺序时不附带原排序覆盖用户选择', async () => {
    const onSubmit = vi.fn();
    render(<BooklistFormModal isOpen initialValue={booklist} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ display_type: 2 });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('default_sort_method');
  });

  it.each([false, true])('清空备注时发送空字符串（赛事字段=%s）', async (enableTournamentFields) => {
    const onSubmit = vi.fn();
    render(<BooklistItemEditorModal
      isOpen item={{ title: '帖子', thread_id: '101', comment: '旧备注' } as BooklistItem}
      enableTournamentFields={enableTournamentFields}
      onClose={vi.fn()} onSubmit={onSubmit}
    />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ comment: '' })));
  });
});
