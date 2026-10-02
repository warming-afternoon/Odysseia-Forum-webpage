import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AISearchResponse } from './AISearchResponse';

vi.mock('./AISearchTokenizedMarkdown', () => ({
  AISearchTokenizedMarkdown: ({ text }: { text: string }) => <p>{text}</p>,
}));
vi.mock('./AISearchThreadReference', () => ({ AISearchThreadReference: () => null }));
vi.mock('@/features/discovery/components/DiscoveryThreadCarousel', () => ({
  DiscoveryThreadCarousel: () => null,
}));

describe('AI 回答轨迹省略状态', () => {
  it('保留正文并在折叠标题和详情中标记省略的诊断轨迹', () => {
    render(
      <AISearchResponse
        content="完整回答正文"
        trace={[{ type: 'text', content: '保留的最后阶段' }]}
        traceTruncatedCount={3}
        threads={[]}
        channels={[]}
        onPreview={vi.fn()}
      />,
    );
    expect(screen.getByText('完整回答正文')).toBeInTheDocument();
    expect(screen.getByText('（已省略 3 项）')).toBeVisible();
    expect(screen.getByText('已省略 3 项较早的执行轨迹，正文与结果完整保留。')).toBeInTheDocument();
    expect(screen.getByText('保留的最后阶段')).toBeInTheDocument();
  });
});
