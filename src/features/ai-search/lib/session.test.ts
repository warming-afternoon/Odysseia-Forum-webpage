import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_SEARCH_CONVERSATIONS_KEY,
  AI_SEARCH_MAX_MESSAGE_LENGTH,
  AI_SEARCH_SESSION_KEY,
  abortAISearchConversation,
  createConversationTitle,
  loadAISearchConversationState,
  registerAISearchController,
  unregisterAISearchController,
  useAISearchConversationStore,
  type AISearchDisplayMessage,
} from './session';

describe('AI 搜索会话历史', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    useAISearchConversationStore.setState({
      activeConversationId: null,
      conversations: [],
      unreadConversationIds: [],
      runningConversationIds: [],
    });
  });

  it('使用第一条用户消息生成精简标题', () => {
    expect(createConversationTitle('  帮我找\n最近很火的角色卡  ')).toBe('帮我找 最近很火的角色卡');
  });

  it('会把输入 Token 转成可读标题', () => {
    expect(createConversationTitle('$tag:角色卡$ $author:123$ 帮我找作品')).toBe(
      '角色卡 作者 123 帮我找作品',
    );
  });

  it('把旧单会话迁移成第一条历史', () => {
    window.localStorage.setItem(
      AI_SEARCH_SESSION_KEY,
      JSON.stringify([{ role: 'user', content: '找角色卡' }]),
    );

    const state = loadAISearchConversationState();
    expect(state.conversations[0]?.title).toBe('找角色卡');
    expect(state.conversations[0]?.messages).toEqual([{ role: 'user', content: '找角色卡' }]);
    expect(window.localStorage.getItem(AI_SEARCH_SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(AI_SEARCH_CONVERSATIONS_KEY)).not.toBeNull();
  });

  it('损坏数据会被清理', () => {
    window.localStorage.setItem(AI_SEARCH_CONVERSATIONS_KEY, '{');
    expect(loadAISearchConversationState()).toEqual({
      activeConversationId: null,
      conversations: [],
      unreadConversationIds: [],
    });
    expect(window.localStorage.getItem(AI_SEARCH_CONVERSATIONS_KEY)).toBeNull();
  });

  it('只隔离超长消息所在会话并保留其他历史', () => {
    window.localStorage.setItem(AI_SEARCH_CONVERSATIONS_KEY, JSON.stringify({
      activeConversationId: 'broken',
      unreadConversationIds: ['broken', 'healthy'],
      conversations: [
        {
          id: 'broken',
          title: '损坏会话',
          createdAt: 1,
          updatedAt: 2,
          messages: [{ role: 'user', content: 'x'.repeat(AI_SEARCH_MAX_MESSAGE_LENGTH + 1) }],
        },
        {
          id: 'healthy',
          title: '正常会话',
          createdAt: 3,
          updatedAt: 4,
          messages: [{ role: 'user', content: '保留我' }],
        },
      ],
    }));

    const state = loadAISearchConversationState();

    expect(state.activeConversationId).toBe('healthy');
    expect(state.conversations.map((conversation) => conversation.id)).toEqual(['healthy']);
    expect(state.unreadConversationIds).toEqual(['healthy']);
  });

  it('恢复 Assistant 消息中的快捷追问', () => {
    window.localStorage.setItem(AI_SEARCH_CONVERSATIONS_KEY, JSON.stringify({
      activeConversationId: 'conversation-1',
      unreadConversationIds: [],
      conversations: [{
        id: 'conversation-1',
        title: '找角色卡',
        createdAt: 1,
        updatedAt: 2,
        messages: [{
          role: 'assistant',
          content: '整理结果',
          followups: [
            { direction: 'broader', text: '放宽条件' },
            { direction: 'narrower', text: '收紧条件' },
            { direction: 'alternate', text: '换个方向' },
          ],
        }],
      }],
    }));

    expect(loadAISearchConversationState().conversations[0]?.messages[0]?.followups).toHaveLength(3);
  });

  it('恢复工具续轮的原始思考内容与抽卡轨道', () => {
    const thread = {
      thread_id: '12345678901234567',
      channel_id: '22345678901234567',
      title: '随机作品',
      created_at: '2026-08-11T00:00:00Z',
      reaction_count: 1,
      reply_count: 2,
      thumbnail_urls: [],
      tags: [],
    };
    window.localStorage.setItem(AI_SEARCH_CONVERSATIONS_KEY, JSON.stringify({
      activeConversationId: 'conversation-1',
      unreadConversationIds: [],
      conversations: [{
        id: 'conversation-1',
        title: '抽一张卡',
        createdAt: 1,
        updatedAt: 2,
        messages: [{
          role: 'assistant',
          content: '',
          hidden: true,
          reasoning_content: '先按偏好卡池抽取',
          tool_calls: [{
            id: 'draw-1',
            type: 'function',
            function: { name: 'draw_threads', arguments: '{"count":1}' },
          }],
          draws: [{ configuration: '1 抽 · 偏好卡池', threads: [thread] }],
        }],
      }],
    }));

    const message = loadAISearchConversationState().conversations[0]?.messages[0];
    expect(message?.reasoning_content).toBe('先按偏好卡池抽取');
    expect(message?.draws?.[0]?.threads[0]?.thread_id).toBe(thread.thread_id);
  });

  it('允许跨页面通过会话 ID 终止运行中的请求', () => {
    const controller = new AbortController();
    expect(registerAISearchController('conversation-1', controller)).toBe(true);

    abortAISearchConversation('conversation-1');
    expect(controller.signal.aborted).toBe(true);

    unregisterAISearchController('conversation-1', controller);
  });

  it('拒绝同一会话同时登记第二个请求', () => {
    const first = new AbortController();
    const second = new AbortController();

    expect(registerAISearchController('conversation-2', first)).toBe(true);
    expect(registerAISearchController('conversation-2', second)).toBe(false);

    abortAISearchConversation('conversation-2');
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    unregisterAISearchController('conversation-2', first);
  });

  it('恢复旧的超限轨迹时保留正文、结果和会话，并记录省略数量', () => {
    const message: AISearchDisplayMessage = {
      role: 'assistant',
      content: '完整正文',
      draws: [{ configuration: '偏好卡池', threads: [] }],
      trace: Array.from({ length: 35 }, (_, index) => ({ type: 'text', content: `阶段 ${index}` })),
    };
    window.localStorage.setItem(AI_SEARCH_CONVERSATIONS_KEY, JSON.stringify({
      activeConversationId: 'long-trace',
      conversations: [{
        id: 'long-trace', title: '长轨迹', createdAt: 1, updatedAt: 2, messages: [message],
      }],
      unreadConversationIds: ['long-trace'],
    }));
    const restored = loadAISearchConversationState();
    const answer = restored.conversations[0].messages[0];
    expect(answer.content).toBe('完整正文');
    expect(answer.draws).toEqual(message.draws);
    expect(answer.trace).toHaveLength(32);
    expect(answer.trace?.[0]).toEqual({ type: 'text', content: '阶段 3' });
    expect(answer.traceTruncatedCount).toBe(3);
    expect(restored.unreadConversationIds).toEqual(['long-trace']);
    expect(loadAISearchConversationState()).toEqual(restored);
  });

  it('轨迹正常化写入遇到配额错误时不删除原有持久化历史', () => {
    const id = useAISearchConversationStore.getState().startConversation('保留历史')!;
    const stored = window.localStorage.getItem(AI_SEARCH_CONVERSATIONS_KEY)!;
    const raw = JSON.parse(stored);
    raw.conversations[0].messages.push({
      role: 'assistant', content: '完整结果',
      trace: Array.from({ length: 33 }, () => ({ type: 'text', content: '过程' })),
    });
    const original = JSON.stringify(raw);
    window.localStorage.setItem(AI_SEARCH_CONVERSATIONS_KEY, original);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(loadAISearchConversationState().conversations[0].id).toBe(id);
    expect(window.localStorage.getItem(AI_SEARCH_CONVERSATIONS_KEY)).toBe(original);
  });

  it('新回答超过轨迹上限也能保存并在刷新后完整显示正文', () => {
    const store = useAISearchConversationStore.getState();
    const id = store.startConversation('开始')!;
    store.appendMessage(id, {
      role: 'assistant', content: '完整回答',
      trace: Array.from({ length: 33 }, () => ({ type: 'reasoning', content: '过程' })),
    });
    const answer = loadAISearchConversationState().conversations[0].messages[1];
    expect(answer.content).toBe('完整回答');
    expect(answer.trace).toHaveLength(32);
    expect(answer.traceTruncatedCount).toBe(1);
  });

  it('ask_user 续跑超过 48 条仍保留当前完整协议回合并可刷新恢复', () => {
    const store = useAISearchConversationStore.getState();
    const id = store.startConversation('检索')!;
    const turn: AISearchDisplayMessage[] = [{ role: 'user', content: '检索' }];
    for (let index = 0; index < 26; index++) {
      const tool = index === 24 ? 'ask_user' : 'search_threads';
      turn.push({
        role: 'assistant', content: '', hidden: true,
        tool_calls: [{
          id: `tool-${index}`, type: 'function',
          function: { name: tool, arguments: '{}' },
        }],
      }, {
        role: 'tool', content: index === 24 ? '{"answer":"剧情"}' : '{"results":[]}',
        tool_call_id: `tool-${index}`, hidden: true,
      });
    }
    turn.push({ role: 'assistant', content: '最终答案' });
    expect(turn).toHaveLength(54);
    store.replaceMessages(id, turn);
    store.appendMessages(id, [
      { role: 'assistant', content: '', hidden: true },
      { role: 'assistant', content: '补充答案' },
    ]);
    expect(loadAISearchConversationState().conversations[0].messages).toHaveLength(56);
    const newTurn: AISearchDisplayMessage[] = [
      { role: 'user', content: '下一轮' },
      { role: 'assistant', content: '下一轮答案' },
    ];
    store.appendMessages(id, newTurn);
    expect(loadAISearchConversationState().conversations[0].messages.map(({ role, content }) =>
      ({ role, content }),
    )).toEqual(newTurn);
  });

  it('第五个会话之后优先淘汰最旧的已结束会话，后台结果仍能写回运行会话', () => {
    const store = useAISearchConversationStore.getState();
    const runningId = store.startConversation('后台检索')!;
    const controller = new AbortController();
    registerAISearchController(runningId, controller);
    store.setConversationRunning(runningId, true);
    const finishedId = store.startConversation('最旧已结束')!;
    for (let index = 0; index < 4; index++) store.startConversation(`新会话 ${index}`);
    expect(useAISearchConversationStore.getState().conversations).toHaveLength(5);
    expect(useAISearchConversationStore.getState().conversations.some(({ id }) =>
      id === finishedId,
    )).toBe(false);
    expect(controller.signal.aborted).toBe(false);
    store.appendMessage(runningId, { role: 'assistant', content: '后台完成结果' });
    store.markConversationUnread(runningId);
    store.setConversationRunning(runningId, false);
    expect(loadAISearchConversationState().conversations.find(({ id }) =>
      id === runningId,
    )?.messages[1].content).toBe('后台完成结果');
    expect(loadAISearchConversationState().unreadConversationIds).toContain(runningId);
    unregisterAISearchController(runningId, controller);
  });

  it('五个会话都运行时拒绝新建且不改变历史，结束一个后可新建', () => {
    const store = useAISearchConversationStore.getState();
    const ids = Array.from({ length: 5 }, (_, index) => {
      const id = store.startConversation(`运行 ${index}`)!;
      store.setConversationRunning(id, true);
      return id;
    });
    const before = useAISearchConversationStore.getState();
    const stored = window.localStorage.getItem(AI_SEARCH_CONVERSATIONS_KEY);
    expect(store.startConversation('第六个')).toBeNull();
    expect(useAISearchConversationStore.getState()).toBe(before);
    expect(window.localStorage.getItem(AI_SEARCH_CONVERSATIONS_KEY)).toBe(stored);
    store.setConversationRunning(ids[2], false);
    expect(store.startConversation('等待后的新会话')).not.toBeNull();
    expect(useAISearchConversationStore.getState().conversations.map(({ id }) => id)).not.toContain(ids[2]);
    expect(useAISearchConversationStore.getState().runningConversationIds).toEqual(ids.filter((_, index) => index !== 2));
  });
});
