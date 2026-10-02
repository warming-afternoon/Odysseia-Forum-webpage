import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { customTagSearchQuery } from "@/shared/lib/searchTokenizer";
import { SearchTokenInput } from "./SearchTokenInput";

it("自定义标签显示名称，删除按钮移除对应 token", () => {
  const onChange = vi.fn();
  render(<SearchTokenInput value={customTagSearchQuery({ id: "7914", name: "兽耳" })} onChange={onChange} />);
  expect(screen.getByText("兽耳")).toBeInTheDocument();
  expect(screen.queryByText("7914")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "移除包含 tag: 兽耳" }));
  expect(onChange).toHaveBeenCalledWith("");
});

it("增删 token 保留其他 token 与输入框身份，退场 token 不再可操作", async () => {
  const { rerender } = render(<SearchTokenInput value="$tag:一$ $tag:二$" onChange={vi.fn()} />);
  const remainingButton = screen.getByRole('button', { name: '移除包含 tag: 二' });
  const removedButton = screen.getByRole('button', { name: '移除包含 tag: 一' });
  const input = screen.getByRole('searchbox');
  input.focus();
  rerender(<SearchTokenInput value="$tag:二$ $tag:三$" onChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: '移除包含 tag: 二' })).toBe(remainingButton);
  expect(screen.getByRole('searchbox')).toBe(input);
  expect(input).toHaveFocus();
  expect(screen.getByRole('button', { name: '移除包含 tag: 三' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '移除包含 tag: 一' })).not.toBeInTheDocument();
  expect(removedButton.closest('[inert]')).not.toBeNull();
  await waitFor(() => expect(removedButton).not.toBeInTheDocument());
});
