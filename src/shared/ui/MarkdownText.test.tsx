import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownText } from './MarkdownText';

describe('MarkdownText', () => {
  const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

  beforeEach(() => {
    openSpy.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('将危险协议渲染为普通文本而非链接', () => {
    render(<MarkdownText text={'[danger](javascript:alert(1))'} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('[danger](javascript:alert(1))')).toBeInTheDocument();
  });

  it('点击 Discord 链接时不弹警告', () => {
    render(<MarkdownText text={'https://discord.com/channels/1/3'} />);
    const link = screen.getByRole('link');

    fireEvent.click(link);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('点击非 Discord 链接时显示警告并在确认后打开', () => {
    render(<MarkdownText text={'https://example.com/post'} />);
    const link = screen.getByRole('link');

    fireEvent.click(link);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByText('example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '继续前往' }));

    expect(openSpy).toHaveBeenCalledWith('https://example.com/post', '_blank', 'noopener,noreferrer');
  });

  it('外部带标签链接保留锚点标签，点击标签仍进入外链确认', () => {
    const { container } = render(<MarkdownText text={'[文档](https://example.com/post)'} />);
    const link = screen.getByRole('link', { name: '文档' });
    expect(link).toHaveAttribute('href', 'https://example.com/post');
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(link.textContent).toBe('文档');
    fireEvent.click(screen.getByText('文档'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '继续前往' }));
    expect(openSpy).toHaveBeenCalledWith('https://example.com/post', '_blank', 'noopener,noreferrer');
  });

  it('行内代码中的 URL 和格式符号保持字面值，不产生链接', () => {
    const { container } = render(<MarkdownText text={'`https://example.com/post **原样**`'} />);
    expect(container.querySelector('code')?.textContent).toBe('https://example.com/post **原样**');
    expect(container.querySelector('code a')).toBeNull();
    expect(container.querySelector('code strong')).toBeNull();
  });

  it('带行内代码的链接标签恢复嵌套片段，不泄漏占位符', () => {
    const { container } = render(<MarkdownText text={'[`文档`](https://example.com/post)'} />);
    expect(screen.getByRole('link', { name: '文档' })).toHaveTextContent('文档');
    expect(container.querySelector('a code')).toHaveTextContent('文档');
    expect(container.textContent).not.toContain('ODMARKDOWNFRAGMENT');
  });

  it('引用在 HTML 转义后仍正确解析，引用内部保留强调', () => {
    const { container } = render(<MarkdownText text={'> **引用**\n普通文本'} />);
    expect(container.querySelector('blockquote strong')).toHaveTextContent('引用');
    expect(container).toHaveTextContent('普通文本');
  });

  it('分别渲染行内代码和围栏代码块', () => {
    const { container } = render(<MarkdownText text={'`xx`\n```\nxxx\n```'} />);

    expect(container.querySelector('code.inline-code')?.textContent).toBe('xx');
    expect(container.querySelector('pre.code-block code')?.textContent).toBe('xxx');
  });

  it('围栏代码块内部的反引号不会被当作行内代码解析', () => {
    const { container } = render(<MarkdownText text={'```\nconst x = `xx`;\n```'} />);

    expect(container.querySelectorAll('code.inline-code')).toHaveLength(0);
    expect(container.querySelector('pre.code-block code')?.textContent).toBe('const x = `xx`;');
  });

  it('不渲染只有空白内容的围栏代码块', () => {
    const { container } = render(<MarkdownText text={'前文\n```\n\n```\n后文'} />);

    expect(container.querySelector('pre.code-block')).toBeNull();
    expect(container).toHaveTextContent('前文');
    expect(container).toHaveTextContent('后文');
  });

  it('只高亮 Markdown 文本节点，不破坏链接与代码', () => {
    const { container } = render(
      <MarkdownText
        text={'**Odysseia** [Odysseia](https://discord.com/channels/1/3) `Odysseia`'}
        highlight="Odysseia"
      />,
    );

    expect(container.querySelectorAll('mark')).toHaveLength(2);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://discord.com/channels/1/3');
    expect(container.querySelector('code.inline-code')).toHaveTextContent('Odysseia');
    expect(container.querySelector('code.inline-code mark')).toBeNull();
  });

  it('按需渲染 Markdown 表格并保留单元格内的行内格式', () => {
    const { container } = render(
      <MarkdownText
        text={'| 名称 | 状态 |\n| --- | --- |\n| **甲** | 完成 |\n| 乙 | 进行中 |'}
        enableTables
      />,
    );

    expect(container.querySelector('.markdown-table-scroll')).toBeInTheDocument();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.querySelector('td strong')).toHaveTextContent('甲');
    expect(container.querySelector('.od-md')).not.toHaveClass('inline');
  });

  it('默认不启用表格解析', () => {
    const { container } = render(
      <MarkdownText text={'| 名称 | 状态 |\n| --- | --- |\n| 甲 | 完成 |'} />,
    );

    expect(container.querySelector('table')).toBeNull();
  });
});
