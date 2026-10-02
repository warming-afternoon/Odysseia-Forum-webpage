import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { customTagsApi } from "../api/customTagsApi";
import { LiveTagPool } from "./LiveTagPool";

vi.mock("../api/customTagsApi", () => ({
  customTagsApi: {
    categories: vi.fn(), relations: vi.fn(), poolAll: vi.fn(),
    aliases: vi.fn(), update: vi.fn(), addRelation: vi.fn(), removeRelation: vi.fn(),
  },
  tagError: (error: Error) => ({ message: error.message }),
}));
vi.mock("../hooks/useTagRole", () => ({
  useTagRole: () => ({ data: { is_bot_admin: true } }),
}));
vi.mock("./TagMergeActions", () => ({ TagMergeActions: () => null }));
vi.mock("./TagRelationFields", () => ({ TagRelationFields: () => null }));
vi.mock("@/shared/ui/loaders/WordLoader", () => ({ WordLoader: () => null }));

const edges = [
  { source_id: "7", target_id: "8", kind: "implies" as const },
  { source_id: "9", target_id: "7", kind: "excludes" as const },
];
const clients: QueryClient[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(customTagsApi.categories).mockResolvedValue([{ name: "背景", value: 1 }] as never);
  vi.mocked(customTagsApi.poolAll).mockResolvedValue([
    { id: "7", name: "测试标签", category_name: "背景", enabled: true, source: "custom", aliases: [] },
    { id: "8", name: "上级标签", category_name: "背景", enabled: true, source: "custom", aliases: [] },
    { id: "9", name: "互斥标签", category_name: "背景", enabled: true, source: "custom", aliases: [] },
  ] as never);
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

function mountPool() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><LiveTagPool /></MemoryRouter></QueryClientProvider>);
  return client;
}

it("关系仍在加载时不能创建编辑草稿，完整加载后仅改别名不删除关系", async () => {
  let resolveRelations!: (value: typeof edges) => void;
  vi.mocked(customTagsApi.relations).mockImplementationOnce(
    () => new Promise((resolve) => { resolveRelations = resolve; }),
  ).mockResolvedValue(edges);
  mountPool();
  fireEvent.click(await screen.findByRole("button", { name: "测试标签" }));
  expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "新增标签" })).not.toBeInTheDocument();

  await act(async () => resolveRelations(edges));
  fireEvent.click(await screen.findByRole("button", { name: "编辑" }));
  fireEvent.change(screen.getByRole("textbox", { name: "别名" }), { target: { value: "新增别名" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(customTagsApi.aliases).toHaveBeenCalledWith("7", ["新增别名"]));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "别名" })).not.toBeInTheDocument());
  expect(customTagsApi.removeRelation).not.toHaveBeenCalled();
  expect(customTagsApi.addRelation).not.toHaveBeenCalled();
});

it("关系初次失败时保持只读，重试成功后才能编辑", async () => {
  vi.mocked(customTagsApi.relations).mockRejectedValueOnce(new Error("关系暂不可用")).mockResolvedValue(edges);
  mountPool();
  fireEvent.click(await screen.findByRole("button", { name: "测试标签" }));
  expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "重试关系" }));
  expect(await screen.findByRole("button", { name: "编辑" })).toBeEnabled();
  expect(customTagsApi.removeRelation).not.toHaveBeenCalled();
});

it("编辑期间关系读取失败不提交，恢复后保留已有草稿", async () => {
  vi.mocked(customTagsApi.relations).mockResolvedValue(edges);
  const client = mountPool();
  fireEvent.click(await screen.findByRole("button", { name: "测试标签" }));
  fireEvent.click(await screen.findByRole("button", { name: "编辑" }));
  fireEvent.change(screen.getByRole("textbox", { name: "别名" }), { target: { value: "未保存别名" } });
  vi.mocked(customTagsApi.relations).mockRejectedValueOnce(new Error("关系刷新失败"));
  await act(async () => client.refetchQueries({ queryKey: ["custom-tags", "relations"] }));
  await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  expect(customTagsApi.aliases).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "重试关系" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
  expect(screen.getByRole("textbox", { name: "别名" })).toHaveValue("未保存别名");
});

it("管理员连续切换标签并往返编辑后，不残留旧的关系溯源", async () => {
  vi.mocked(customTagsApi.relations).mockResolvedValue(edges);
  mountPool();
  await screen.findByRole("button", { name: "新增标签" });
  const list = within(screen.getByRole("region", { name: "背景标签" }));
  for (const name of ["测试标签", "上级标签", "互斥标签", "测试标签", "互斥标签"]) {
    fireEvent.click(list.getByRole("button", { name }));
    expect(screen.getAllByRole("region", { name: "标签关系树" })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "关系溯源" })).toHaveLength(1);
  }
  fireEvent.click(screen.getByRole("button", { name: "编辑" }));
  expect(screen.queryByRole("region", { name: "标签关系树" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.getAllByRole("region", { name: "标签关系树" })).toHaveLength(1);
  expect(screen.getAllByText("未找到关系")).toHaveLength(1);
});
