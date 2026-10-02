# 持续代码审查记录

日期：2026-10-02
状态：已收口；按哥哥 2026-10-02 的新指令停止扩展审查，转入缺陷修复。
本次为有边界的审查交付，不代表全仓穷尽审计或线上验收完成。

最终累计：26 项已确认问题，其中 P1 1 项、P2 23 项、P3 2 项；尚无已确认 P0。
这里的数量不是目标或配额，未确认风险和已排除候选不计入。

## 目标与边界

审查当前前端仓库，将可核对的问题、反证、验证结果和未覆盖范围记录成文档。
不修改业务代码，不提交或推送，不访问真实模型服务，不执行生产业务写入。
额度耗尽无法从当前工具直接判定；不把重复检查或空转作为完成证据。
原先持续消耗额度的目标已由哥哥要求收口；不再以消耗额度作为工作完成标准。
后续修复记录已[归档](../archive/plans/review-remediation-2026-10-02.md)，本文件保留原始缺陷证据。

起始 HEAD：`da9b81cd5b7292771c2e123d9cf96f9341ea6ae7`。
起始工作区已有 TagRelationTree.tsx、TagRelationTree.test.tsx、TargetTagSection.tsx、
tag-pool.css 修改及未跟踪 mermaid-diagram.png，均保留，不归属本审查。

## 已核对领域

- 认证失效、用户数据缓存及退出生命周期。
- AI 搜索：Provider 响应、工具执行、取消、会话恢复与持久化。
- 普通搜索：URL、分页、请求取消和缓存键。
- 标签治理：权限、绑定提交、合并与关系图；区分既有代码和未提交修改。
- 书单与赛事：表单、写操作、缓存失效与分页。
- 通知、关注、偏好：身份边界和状态同步。
- 共享组件：可访问性、图片恢复、解析与链接处理。
- 部署入口与 OG：输入、缓存、响应及错误行为。

各领域并未完整覆盖；具体反证、开放问题和未验证范围保留在下文。
已执行的轮次沿调用链核对候选问题，必要时使用聚焦、无外部副作用的 runnable check。
没有为维持运行重复相同证据，也没有默认执行全套 lint、类型检查、测试与构建。

## 已确认问题

### CR-008 [P1] 关系尚未加载时，仅保存别名也会误删现有标签关系

位置：`src/features/tags/components/LiveTagPool.tsx:45`、`:59`、`:79`；
写入点：`src/features/tags/lib/savePoolTag.ts:31`。

关系、分类和标签池是三个独立查询。页面只等待池和分类，关系未返回时却用空数组
生成每个标签的 parents/excludes；编辑和保存仍然可用。管理员此时打开标签编辑，
只改一个别名，草稿已经携带错误的空关系快照。

保存函数会重新请求真实关系，然后把不在草稿空集合中的全部现有上级和互斥关系删除。
它无法区分“用户主动移除所有关系”和“初始关系尚未加载”。
即使关系在打开编辑后才完成加载，既有草稿也不会自动补齐；只在保存瞬间检查查询成功
不能修复已经建立的错误草稿。关系请求失败而其他查询成功时也存在同样的入口，
但本次直接复现的是关系查询仍 pending 的场景。

影响不是只显示空关系，而是发出实体关系 DELETE，改变共享标签图。
管理员原本仅修改别名，却可能删除多个关系并影响后续推导和互斥判断，因此列 P1。
现有审计记录可帮助人工调查，不等于提供了自动撤销或避免数据丢失。

验证：JSDOM 中加载当前真实 LiveTagPool、TagPoolBrowser、savePoolTag，
使用真实 React Query QueryClient。池和分类立即返回；首次 relations 查询保持 pending，
保存函数的第二次 relations 调用返回已有上级边 7→8 和互斥边 9↔7。
真实点击“测试标签 → 编辑”，仅在别名框填入“新增别名”，再点击保存。
观察到：

```json
{
  "relationLoadPendingAtSave": true,
  "removed": [["7","8","implies"],["7","9","excludes"]],
  "aliasOnlyEdit": true
}
```

所有 API 均为内存替身。路由、权限结果和与本次操作无关的展示组件被替换，
没有调用真实删除接口。关键页面交互、草稿状态、查询时序及保存差集逻辑来自当前源码。
探针已输出上述结果；结束时存在 React Query 的遗留计时器，手动终止了该探针进程，
退出码为 143，不能将整条命令描述为退出码 0 的测试通过。

最小修复方向：关系数据成功加载前不能创建可保存的既有标签编辑草稿；
未初始化或失败的关系状态不得被映射为可写的“空集合”。
不需要增加第二套关系缓存或静默 fallback。
关闭条件：关系慢加载、初始失败及打开编辑后才返回三种场景下，
仅改别名均不发送 removeRelation；用户在完整快照上主动删除关系仍可保存。
未执行数据库或真实浏览器写操作；现有 savePoolTag 单测传入的草稿关系已经正确初始化，
不能覆盖这个上游快照时序问题。

### CR-001 [P2] AI 轨迹超过恢复上限后，刷新会删除整个会话

位置：`src/features/ai-search/lib/session.ts:141`、`:231`、`:245`。

运行时追加消息直接序列化到 localStorage，未把轨迹限定为 32 项；恢复时 messageSchema
却要求 trace 最多 32 项。任意一条消息不满足 Schema，就会使整个 conversation 的
safeParse 失败。恢复逻辑将其从 conversations 中过滤，并把过滤结果写回同一存储键。
这不是只隐藏多余轨迹，而是删除该对话全部历史。

可达链：`agent.ts:158` 最多执行 8 个模型步骤，`:145` 逐项追加不同工具轨迹，
`:186` 还会追加中间文本；Provider 解析器没有工具调用总数上限。
例如前 6 轮每轮 5 个不同工具调用、附带中间文本，第 7 轮最终回答，即可超过 32 项；
页面 `src/pages/AISearchPage/index.tsx:354` 原样保存 result.trace。
恢复上限没有成为运行时的对应不变量。

验证：通过 TypeScript transpileModule 在 Node 中加载当前 session.ts，
用 Map 模拟 window.localStorage。startConversation 后 appendMessage 写入带有 33 项
合法 text 轨迹的 assistant 消息，再调用 loadAISearchConversationState。
结果为：

```json
{"beforeReload":1,"afterReload":0,"persistedAfterReload":0}
```

该检查执行了真实 store 追加、序列化、恢复和回写逻辑，没有写文件或真实浏览器存储。
尚未执行完整 Provider → 页面 → 浏览器刷新集成复现。

最小修复方向：统一运行时与恢复契约；旧数据中仅展示轨迹超限不应导致完整会话丢失。
不要仅提高一个固定数字而继续允许生产者无界写入。
关闭条件：正常多工具会话可刷新恢复，已有超限轨迹对话不被删除。

### CR-002 [P2] 从“我的关注”取消后，作品菜单仍使用旧的已关注状态

位置：`src/features/follows/hooks/useFollowsData.ts:76`；
消费者：`src/features/threads/components/ThreadMoreMenuContent.tsx:50`。

触发链：用户先从作品菜单关注作品，useToggleThreadFollow 的 onMutate 将
`["follows", "state", threadId]` 设为 true；随后在 MePage 的关注列表取消同一作品，
`MePage/index.tsx:474` 调用 useUnfollowThread。这个入口成功时只 invalidateQueries，
不写入 false 或删除前面的手工缓存。该 state key 没有对应的 useQuery/queryFn，
标记失效不能让它从后端重新加载。

作品菜单通过 getQueryData 优先取这个缓存，并没有检查 isInvalidated；即使传入的作品
viewer flags 已经是不关注，也仍显示“取消关注作品”。再次点击会执行 DELETE 而不是
重新关注，用户在缓存回收或整页重载前不能通过这个菜单正常重新关注。
此外，useUnfollowThread 没有像菜单 toggle 那样失效搜索、发现等 viewer flag 消费者。

验证：Node 中执行当前两个 hook 的真实 mutation 回调，使用当前安装版本的真实
QueryClient；仅以替身提供 useMutation/useQueryClient 和通知函数，不发网络请求。
先执行 toggle 的 onMutate/onSuccess，再执行 unfollow 的成功回调，读取 state 和
菜单使用的取值表达式，结果：

```json
{"afterUnfollowSuccess":true,"invalidated":true,"menuWithFreshUnfollowedThread":true}
```

最小修复方向：两个真实写入口成功后都同步同一个作品状态及相同消费者；
或者移除没有查询所有者的长期手工状态，以刷新后的 viewer flags 为准。
关闭条件：菜单关注 → 我的关注取消 → 返回作品菜单，可看到并执行重新关注。
未做完整页面点击集成；现有 useFollowsData.test.tsx 只覆盖菜单 toggle 的成功和回滚，
不覆盖两个写入口的连续操作。

### CR-003 [P2] 清空书单备注或参赛说明后，保存无法删除原文本

位置：`src/features/booklists/components/BooklistItemEditorModal.tsx:112`。

编辑表单将空白备注映射成 undefined。页面原样传给 useUpdateBooklistItem，
booklistsApi.updateItem 再原样 PATCH；JSON 序列化会移除 undefined 字段。
因此清空已有备注后，请求不是“把 comment 设为空”，而是“不修改 comment”。
保存仍可成功并关闭弹窗，后续刷新又显示原备注。赛事管理页复用相同编辑器，
对应的“参赛说明”也受影响。

前端调用证据：`BooklistDetailPage/index.tsx:597`、
`TournamentManagePage/index.tsx:309`、
`src/features/booklists/api/booklistsApi.ts:224`。
本地后端契约证据：
`/Users/macbookair/Odysseia-Forum/src/api/v1/schemas/booklist/booklist_item_update_request.py:10`
接受空字符串或 null；
`src/core/booklist_item_repository.py:161` 使用 model_dump(exclude_unset=True)，
只有请求实际出现的字段才赋给实体。不将本地后端源码视为已部署版本证明。

验证：JSDOM 中渲染当前真实编辑器，使用真实 React Hook Form、Zod resolver 和
Testing Library，从初值“已有备注”清空 textarea，再提交 form。只替换了本次不涉及的
日期转换导入；submit 只收集 payload，不发请求。结果：

```json
{"inputAfterClearing":"","wireJSON":"{\"display_order\":0}","hasCommentFieldOnWire":false}
```

最小修复方向：编辑已有项时明确提交空字符串，保留“清空”与“不修改”的区别。
关闭条件：清空书单备注和赛事参赛说明后，PATCH 含有清空字段，重新读取不再出现原文本。
已证明组件提交行为；未执行数据库写入或真实 API 集成。

### CR-004 [P2] 翻页会把分享链接的 AND 条件改成本地 OR 偏好

位置：`src/features/search/hooks/useSearchParams.ts:201`。

协议规定 URL 缺少 tag_logic 时解析为 and；本地偏好只用于发起新搜索。
但 setParams 每次发现原 URL 没有 tag_logic，就把本地偏好塞进 nextUpdates，
不区分新搜索、翻页、排序或其他操作。

可达场景：本地设置为 or，打开 `q=$tag:A$ $tag:B$` 的分享链接；
第一页按 and 搜索。用户只点击第二页，SearchPage/index.tsx:678 调用
setParams({ page: 2 })，URL 被写入 tag_logic=or，后续请求变成标签并集。
这不再是同一搜索的下一页，数量、排序和结果集合都可能变化。
sort-only 等操作同样能触发，不另计重复问题。

验证：JSDOM + 真实 MemoryRouter/renderHook 加载当前 hook 与当前 searchTokenizer，
在模拟 localStorage 设置 or，打开双标签且无 tag_logic 的链接，
实际执行 setParams({ page: 2 })，结果：

```json
{
  "before": {"tagLogic":"and","search":"?q=%24tag%3AA%24+%24tag%3AB%24"},
  "after": {"tagLogic":"or","search":"?q=%24tag%3AA%24+%24tag%3AB%24&page=2&tag_logic=or"}
}
```

最小修复方向：本地偏好初始化应由新搜索入口负责；已有 URL 的无 tag_logic 语义
应在翻页等无关操作中保持 and。不要通过把所有旧链接补成本地偏好来处理。
关闭条件：本地 or 不改变已有 and 分享链接的翻页、排序等操作；主动发起新搜索仍能
应用偏好。现有 URL 测试未覆盖“本地偏好不同 + 分享链接缺少 tag_logic + 翻页”的组合。

### CR-005 [P2] 外部 Markdown 链接被二次解析，标签脱离可点击锚点

位置：`src/shared/ui/MarkdownText.tsx:142`；关联生成器 `:48`。

`[文档](https://example.com/post)` 先生成完整 a 标签，其中 favicon span 的
style 属性含有 `https://example.com/favicon.ico`。后续自动链接正则继续扫描整个
生成后的 HTML，只排除紧邻 href 的 URL，却不排除 style 等属性中的 URL。
它在属性内插入另一段 a/span HTML，破坏原链接结构。

验证：用当前真实 MarkdownText、urlSafety 和 React renderToStaticMarkup 生成 HTML，
交给 JSDOM 解析。普通外部 Markdown 链接结果为：

```json
{
  "input": "[文档](https://example.com/post)",
  "links": [{"href":"https://example.com/post","label":"https://example.com/favicon.ico')\">"}],
  "visibleText": "https://example.com/favicon.ico')\">文档"
}
```

DOM 中“文档”不在锚点内，只有误生成的 favicon 地址字符串是链接标签。
同次验证的 Discord Markdown 链接标签正常，因为其 favicon 不包含 HTTP URL，
不会触发这次二次扫描。单纯裸 URL 也没有经过前面的 Markdown 链接生成，
不能用它的正确结果反证此问题。

真实消费者包括帖子预览、帖子列表摘要、公告内容和 AI 回复。
现有 MarkdownText.test.tsx 的外部链接用例仅使用裸 URL，
带标签的链接用例使用 Discord URL，均未覆盖这个组合。

最小修复方向：已生成的链接片段不再参与自动链接扫描；
自动链接应处理文本区域，而不是全部 HTML 字符串。不要求引入新依赖。
关闭条件：外部带标签链接的 textContent 为原标签，标签属于正确 a 标签，
点击原标签能触发现有外部链接确认流程。
已验证生成结果与 DOM 结构，未执行真实浏览器点击或视觉验收。
本问题不包含已确认的脚本执行或 XSS 结论。

### CR-006 [P3] 行内代码中的 URL 仍被转换成链接

位置：`src/shared/ui/MarkdownText.tsx:131`、`:142`。

围栏代码通过占位符绕过后续解析，但行内代码直接生成 code HTML，
随后自动链接仍扫描其文本。输入 `` `https://example.com/post` `` 后，
DOM 中出现该 URL 的 a 标签，而不是只读代码文本。点击代码中的示例地址会进入跳转流程，
不符合当前组件注释中的代码渲染语义，也与围栏代码的保护行为不一致。

验证：与 CR-005 相同的真实组件渲染检查，行内代码案例的链接数量为 1，
href 为 `https://example.com/post`。既有测试只检查 `xx` 之类不含 URL 的行内代码。

最小修复方向：行内代码也隔离于后续 Markdown/自动链接变换。
关闭条件：行内代码的 URL、链接语法和格式标记保留文本，不生成可点击链接；
代码外的自动链接继续有效。

### CR-007 [P3] 引用块规则在 HTML 转义后永远无法匹配原始引用符

位置：`src/shared/ui/MarkdownText.tsx:115`、`:146`。

输入中的 `>` 先被替换为 `&gt;`，之后却仍用 `^> ` 识别引用。
正常输入 `> 引用文本` 无法产生 blockquote，只显示大于号和普通文字。
这是当前注明支持的引用能力的实际失效，不是引用样式偏好。

验证：真实组件渲染到 JSDOM 后，blockquote 数量为 0，
textContent 为 `> 引用文本`。现有 MarkdownText 测试没有引用块案例。

最小修复方向：在当前转义协议中识别对应的安全引用前缀，继续保持原文先转义的边界。
关闭条件：正常引用输入产生 blockquote，不把任意未转义原文作为 HTML 插入。

## 已核对的反证与开放问题

### 认证缓存：暂不报告切号泄露

App.tsx 的认证失效回调只清理 auth 与 custom-tags；通知、自己的书单等查询键没有身份字段。
但 AppSidebar 手动退出后使用 window.location.href 跳转，真实登录也经外部 OAuth 整页导航。
因此不能仅凭静态 query key 推导正常退出再登录的跨账号缓存泄露。
后续需要核查自动 401、在途请求、回调入口和同页身份变化是否存在完整可达链。

### AI 持久化的其他长度约束

消息正文、工具参数、工具数量、聚合 reasoning、轨迹字段也存在恢复长度限制。
目前尚未逐一确认生产者约束和真实触发条件，不能将它们全部计为独立缺陷。

### 偏好首次加载：不报告绕过路由守卫的默认值误保存

MePreferencesSection 的保存按钮只检查 isSaving，没有检查 isLoading；
但实际 MePage 位于 RequiredSetupGate 下，守卫和页面使用相同 user/guild 的偏好查询。
正常首次请求 pending 且 fetching 时，守卫先显示加载界面，不会挂载可操作的 MePage。
SearchPage 的默认排序保存也显式检查加载、错误及 preferences 是否存在。
因此“普通首次进入就能点保存，默认空值覆盖旧设置”的候选被当前上游路径排除，
不能在只挂载子组件、跳过守卫的探针中人为制造它。
这里未验证离线 paused 查询、缓存被外部删除等不同生命周期，不把这些尚未构成完整链的
特殊状态补写成同一个确认缺陷。CR-014 复现的是已有缓存的后台读取，不受首次守卫阻挡。

### 普通搜索 offset 与 exclude_thread_ids：排除一项误报候选

无限滚动从非第一页开始时，前端每次请求保留 `(currentPage - 1) * 24` 的 offset，
同时累积排除已加载 ID。本地后端 search_service.py:227 在排序前排除 ID，
`:480` 对剩余集合施加 offset；固定排序且数据稳定时，原先被跳过的前置结果仍在，
所以继续跳过同一段并不会额外丢失结果。不能仅凭“两个分页参数同时出现”报告漏页。
这里未验证实时数据变化导致的分页漂移，也未证明线上后端与本地完全一致。

### 关注乐观更新：不报告不存在的在途 state 查询竞争

全 src 搜索确认 followsKeys.state 仅被菜单 getQueryData 读取及 mutation 写入，
没有真实 useQuery/queryFn 生产者。因此缺少 cancelQueries 不能单独构成“旧查询覆盖
乐观状态”的问题；当前可证问题是 CR-002 的两个 mutation 入口状态不同步。

### OG 版本与缓存：仍需补齐内容版本证据

Cloudflare 图片 URL 使用 DTO.updated_at 与布局 revision；独立 Vercel 服务有 v 参数的
成功响应宣告一年 immutable 缓存，但渲染时只读取当前 DTO，不校验或读取历史版本。
作者 DTO.updated_at 来自 Author.last_updated，卡片同时渲染最新作品、代表作品及聚合统计。
本地 Author 模型更新时间属于资料行，不能仅从该字段证明作品和统计变化必然换版本。
后端 author/cog.py 存在资料刷新，需要继续核对新作品、回复和资料刷新的完整时序，
以及线上 CDN 的实际缓存行为，暂不计入确定缺陷。

### OG 当前已核对的边界

四类主站 Function 均设置 crawlerOnly，普通浏览器和非数字 ID 返回 shell。
分享元数据 fetch 仅提供机器令牌和 Accept，不转发来访者 Cookie 或 Authorization。
缺少机器令牌、后端 fetch/JSON 失败进入静态 shell 回退。
后端主资源公开性检查发生在元数据缓存命中前；这是本地源码事实，不是线上部署保证。

中间 fallback builder 使用 booklist.image_url，但正式 DTO 为 cover_image_url；
正式成功链会用 Vercel 图片 URL 覆盖 image，因此不能把这个中间字段差异直接报成
“所有书单分享封面失效”。独立服务的书单布局本身主要展示 works，主站文档已明确这一点。

`scripts/check-booklist-og.mjs` 已执行并通过，覆盖四类 crawler HTML 的本地改写、
普通浏览器不访问内部 API、机器令牌缺失回退及部分 builder 字段规则。
该脚本的 FakeHTMLRewriter 用字符串替换实现，不能验证 Cloudflare 真正 HTMLRewriter 的
转义、条件请求、Header 缓存继承或边缘行为，也没有调用 Vercel 图片生成路由。

独立图片服务位置：playground/og-satori，
当前 HEAD `45ed06668961933ed46592972524076f2a9ffbfa`；
发现该独立仓库已有 README.md 修改，未触碰。

### 标签合并与绑定：已核对的恢复边界

TagMergeActions 要求同名目标、先预检、再显式确认，并提交预检 version；
收到 stale_merge 时清掉确认入口，不自动重试写入。
TargetTagSection 的绑定替换提交 baseline.version，发生 stale_version 后保留本地选择，
等待用户核对最新快照，不直接重试。普通提议按项提交，已成功项从选择中移除，
只保留失败项以便重试。这里只核对当前源码和既有定向测试内容，
没有重跑全部标签测试，也没有执行真实合并。

### 本地后端与前端标签契约存在版本差异

本地后端 HEAD 为 `e1aadc0064ae435fb8deae82e8e0e9f9175755e5`。
对当前前端 openapi.json 使用 JSON 解析器读取 paths，包含：

```text
/v1/tags/{tag_id}/merge-preview
/v1/tags/{tag_id}/merge
```

本地后端 src/api/v1/routers/tags.py 没有这两个路由。
本地 custom_tag_service.py 的关系目标仍要求 source=custom，和前端正式升级文档中的
统一实体规则也不一致。由于尚未核查已部署后端，本轮不把它报成前端不可用，
也不修改本地后端或重新生成 Schema。
后续跨仓契约审查必须明确基线，不能让旧本地实现否定前端正式 OpenAPI 契约。

### 通知：本轮没有新增确认缺陷

已读线程和全部已读使用 notifications 根键失效，并覆盖 search、discovery、authors、
关注列表/未读计数及 booklists。标签审核通知只失效 notifications，
其语义不是作品阅读，不能机械要求同一组作品消费者失效。
强制公告按通知 ID 作为 key 挂载，多个公告切换不会直接复用上一条 reachedEnd 状态。
静态已读时间只允许前进，并通过自定义事件及 storage 事件同步多个组件。
作者筛选扫描全部通知分页属于代码明确记录的受限实现，不另报成无界重构建议。

上述为源码及既有测试内容核对，未重跑通知测试套件；没有据此关闭通知队列。
静态 Feed 外部字段校验、通知开关的真实消费入口、身份切换和实际分页变化仍未完整验证。

### Provider 流：读取器退出清理仍缺真实连接证据

当前 parseStreamCompletion 在收到 [DONE] 或 JSON 解析异常时离开函数，
没有 cancel/releaseLock 的 finally；页面正常 finally 也仅注销 controller，不 abort。
以未关闭的内存 ReadableStream 模拟终止标记与错误事件，真实 createChatCompletion
分别返回回答和明确的解析错误，但两种情况 response.body.locked 均为 true，
cancel 回调均未触发。探针结束时主动关闭替身 stream，正常退出，没有真实网络请求。

这证明了代码没有主动清理读取器，不足以证明真实 Provider/浏览器连接持续占用、
浏览器不会回收资源或用户额外付费。因此保留为开放生命周期风险，不计入 CR 数量。
后续需要核对真实 fetch body 在终止标记后未关闭及解析失败时的网络/取消行为，
并区分协议终止、HTTP 流关闭和 AbortSignal 取消，不能仅凭内存锁状态推导网络泄漏。

## 已确认问题（续）

### CR-009 [P2] 新会话淘汰仍在生成的会话，请求继续执行但结果丢失

位置：`src/features/ai-search/lib/session.ts:316`、`:344`、`:389`；
页面入口：`src/pages/AISearchPage/index.tsx:113`、`:416`；
历史入口：`src/widgets/layout/AppSidebar.tsx:467`。

startConversation 无条件保留最新五个会话，不检查 runningConversationIds，
也不终止被淘汰会话的 AbortController。appendMessages 遇到不存在的会话直接返回；
页面 finally 又会为该已删除 ID 写入未读标记。
因此请求仍然消耗时间和 Provider 额度，但完成的结果和原始问题已经没有保存位置，
历史栏也没有可进入、可停止该任务的会话。

普通 Header 的禁用仅针对当前选中的会话，不是所有后台任务。
可先切到已完成会话继续创建新对话；其他对话陆续完成时，慢任务仍可被五个新对话淘汰。
外部“AI 探索相似”的自动发送入口也会无条件创建新会话，不检查后台运行数量。
这不是要求取消已完成历史的五条上限，而是运行任务和其结果所有者的生命周期脱节。

验证：加载真实 session store/controller 注册函数，用 Map 替代 localStorage。
为会话 A 注册未终止的 AbortController 并标记 running，再创建五个新会话；
随后模拟当前页面的成功结果追加与 finally 未读标记。命令退出码 0，输出：

```json
{
  "retainedConversations": 5,
  "originalRetained": false,
  "requestAborted": false,
  "originalStillRunning": true,
  "resultRetained": false,
  "orphanUnread": true
}
```

这里直接验证 store 生命周期，UI 入口可达性来自页面和侧栏源码核对，
没有声称执行了整页浏览器点击或真实付费请求。
最小修复方向：运行中会话不能作为普通历史淘汰对象；淘汰策略与任务控制必须由同一处
维护不变量。若产品选择允许取消淘汰，必须明确取消行为与结果提示，而非静默丢弃。
关闭条件：后台任务未结束时创建足够多新会话，原任务仍可停止且成功结果可访问，
或明确执行了可见的取消；完成后无孤立 running/unread ID。

### CR-010 [P2] 合法的询问续跑超过消息上限，会清空整个当前对话

位置：`src/features/ai-search/lib/session.ts:205`、`:350`；
生产链：`src/features/ai-search/lib/agent.ts:158`、`:189`、`:314`；
询问回答：`src/pages/AISearchPage/index.tsx:455`。

裁剪取最后 48 条消息，再找首条 role=user；找不到就返回空数组。
计数包含隐藏的 assistant 工具声明和 tool 结果，不是界面上可见的用户/回答条数。
ask_user 的用户选择被保存为 tool 消息，继续执行时不会创建新的 user 边界，
同时新建工具运行时又重新给予搜索、抽卡和详情配额。

一个受支持的逻辑回合可以跨两次 Agent 执行：首次七个工具步骤后询问，
回答后再执行七个工具步骤并最终回答。两次都在八个模型步骤上限内，
每次都只用三次帖子搜索、两次赛事搜索、两次抽卡、八篇帖子详情、四个赛事详情。
如果详情每次读取一个资源，每次可产生十九条 tool 结果和七条隐藏 assistant 声明。
首次加询问与原始 user 共 28 条，用户选择后 29 条，续跑加最终回答共 56 条。
最后 48 条内没有 user，保存成功结果时整段历史变成 []，并立即覆盖持久化数据。

验证：Node 加载真实 agent、tools、prompt、responseParser 与 session，
模型回应及论坛 API 用内存替身，所有工具调用通过真实 Schema、授权集合和配额逻辑。
两次执行各八个模型步骤；各调用十九个工具，未产生任何工具错误。
按页面当前规则追加询问、回答 tool 和最终结果。命令退出码 0，关键结果：

```json
{
  "modelSteps": 16,
  "allToolsSucceeded": true,
  "toolCallsPerExecution": 19,
  "firstPendingMessageCount": 28,
  "beforeContinuationSave": 29,
  "rawMessageCount": 56,
  "finalAnswer": "已经完成搜索。",
  "retainedMessageCount": 0,
  "persistedMessageCount": 0
}
```

这是同一逻辑用户回合的成功路径，不依赖非法参数、配额错误、刷新或超长响应。
最终 trace 只有十九项，不触发 CR-001；两者根因和触发时机不同。
最小修复方向：完整回合裁剪不能删除唯一的当前回合。
需要统一当前回合协议消息预算、运行限制与持久化上限；不能只把运行时放宽，
留下恢复 Schema 的另一处固定上限，也不能保留缺少工具声明/回复的半截协议。
关闭条件：上述合法询问续跑最终仍保留原始问题和可访问的回答，刷新后也可恢复；
多轮历史超限时只裁剪完整旧回合，不制造孤立工具消息。

### CR-011 [P2] 快捷书单只改推荐语时，不刷新被修改的书单条目

位置：`src/features/booklists/components/QuickAddToBooklistModal.tsx:117`；
失效所有者：`src/features/booklists/lib/invalidateBooklistQueries.ts:19`。

快捷弹窗允许保持勾选不变、只填写推荐语后保存，提交 comment 到既有目标书单。
成功回调只把 added_to_booklist_ids 和 removed_from_booklist_ids 交给失效函数，
忽略 unchanged_booklist_ids 与本次提交的已有 target_booklist_ids。
这里的 unchanged 指帖子归属未变，不代表推荐语未变。
失效函数默认只刷新 list/mine；只有显式传入 ID 才失效 detail/items/cover-items。

本地后端 booklist_service.py:269 会更新 existing_target_ids 的推荐语，
但返回值仍将这些书单列入 unchanged_booklist_ids。当前前端 OpenAPI 的同步响应
也包含该字段，没有单独的 updated IDs。这里不是要求旧后端支持新标签契约：
核对的是与前端已声明同步契约一致的书单推荐语路径。
线上写入行为未实测；缓存失效缺口在前端当前实现中可独立复现。

可达消费者：BooklistDetailPage 使用 useBooklistItems 的缓存，
将 item.comment 传给帖子列表/卡片；两种帖子组件均可打开同一个快捷书单弹窗。
在详情页修改推荐语后，提示成功并关闭弹窗，但已有条目仍显示旧内容；
直到后续独立 refetch，修改才会反映出来。

验证：JSDOM 挂载真实 QuickAddToBooklistModal 与 Checkbox，
使用真实 React Query QueryClient、活动 QueryObserver 和当前失效函数。
书单选择查询替身返回已勾选书单 1；条目缓存为“旧推荐语”且仍在 60 秒 fresh 窗口。
只输入“新推荐语”并点击保存。syncItems 替身更新内存服务值，
返回 added=[]、removed=[]、unchanged=[1]。命令退出码 0，输出：

```json
{
  "serverComment": "新推荐语",
  "cachedComment": "旧推荐语",
  "itemQueryInvalidated": false,
  "detailQueryInvalidated": false,
  "mineListInvalidated": true,
  "activeItemRefetches": 0,
  "dialogClosed": true
}
```

接口和书单选择查询为替身，真实组件提交、成功回调、查询键与失效逻辑未替换；
不声称执行了真实后端写入。既有快捷弹窗测试只检查加入/移出提交，
未覆盖仅修改推荐语后的条目消费者。
最小修复方向：失效集合也包含本次修改推荐语的已有目标书单，不需要全仓缓存清空。
关闭条件：归属不变但推荐语变化时，活动 items 查询重新获得新文本；
混合加入、移出和已有目标修改时，每个受影响书单消费者均被正确失效。

### CR-012 [P2] 快捷书单按 Escape，会连同父级帖子预览一起关闭

位置：`src/widgets/thread-preview/ThreadPreviewOverlay.tsx:115`；
子层监听：`src/features/booklists/components/QuickAddToBooklistModal.tsx:73`。

帖子预览在 window 上监听 Escape，只有存在 dialog[open] 时才让出事件。
快捷书单的弹窗是 div[role=dialog]，不匹配这个条件，也没有隔离 Escape。
两层 window 监听收到同一个键：子层关闭快捷弹窗，父层同时启动 300ms 关闭动画，
随后调用 onClose，用户无法只返回原来正在阅读的帖子预览。
父层对 quickAddOpen 的滚轮和触摸关闭已有避让，键盘路径没有同样的边界。

验证：JSDOM 挂载真实 ThreadPreviewOverlay 与 QuickAddToBooklistModal，
用真实 MemoryRouter 和 QueryClient；通过菜单替身调用当前 onAddToBooklist 回调
打开子层，触发一次 window Escape，等待真实父层关闭计时器执行。
两个组件的 effect、监听、状态和关闭回调均使用当前源码。
不相关内容展示、认证及数据查询用替身，禁止任何 API 写入。
命令退出码 0，结果：

```json
{
  "dialogsBeforeEscape": 2,
  "nativeDialogsBeforeEscape": 0,
  "quickAddClosed": true,
  "parentCloseCount": 1
}
```

这是客观事件复现，不涉及视觉间距或动画观感验收。
最小修复方向：父层键盘监听在子层打开时让出 Escape，
并确保该条件读取最新状态；是否统一使用原生 dialog 属于更大的组件选择，
不是修复这个具体问题的前置要求。
关闭条件：打开快捷书单后第一次 Escape 只关闭子层，帖子预览和阅读位置保留；
子层关闭后再次 Escape 才关闭父层，原生对话框的既有避让仍有效。

### CR-013 [P2] 标签合并未失效关注列表，卡片继续搜索已删除的旧 ID

位置：`src/features/tags/components/TagMergeActions.tsx:26`；
消费者：`src/features/follows/hooks/useFollowsData.ts:14`、
`src/features/threads/components/ThreadTagList.tsx:26`、
`src/features/tags/components/CustomTagChip.tsx:8`。

合并成功会失效 custom-tags、search、booklists、authors、discovery、notifications，
没有 follows。关注页的数据属于 ["follows","list",params]，
线程卡片和列表项直接从该响应的 custom_tags 渲染标签，再由 CustomTagChip 按 ID 搜索。
它们不是 TargetTagSection 的独立目标查询，因此失效 ["custom-tags"] 无法更新此处快照。

正式前端 OpenAPI 的 TagMergePreviewResponse 将 source_tag_id 明确为
“即将软删除的标签 ID”，target_tag_id 为保留 ID，并返回有效绑定影响数量。
当前计划也要求刷新目标与列表。合并影响一个已关注帖子的本地绑定时，
其列表快照仍携带旧实体 ID，卡片上的同名标签看起来正常，点击却生成旧 $tagid 条件。
这是新生成的搜索动作使用过期列表数据，不是要求自动迁移用户原有 URL 的旧 ID。
TargetTagSection 的绑定刷新已经包含 follows，不能据此认为合并入口也覆盖了它。

验证拆成两段：独立真实 useFollowedThreads hook 内存探针确认查询生产者，
一次读取后成功返回；随后 JSDOM 挂载真实 TagMergeActions 与 CustomTagChip，
用当前 followsKeys 和真实 QueryClient/活动 QueryObserver 保留一个 fresh 关注快照。
预检和合并 API 替身模拟成功合并及服务端绑定 ID 从 1 变为 2；
实际选择、预检、确认、成功回调和搜索路由均来自当前组件。
Select 仅替换为等价受控选择器，window.confirm 返回明确确认。
第二段命令退出码 0，结果：

```json
{
  "serverTagId": "2",
  "cachedTagId": "1",
  "followQueryInvalidated": false,
  "followRefetches": 0,
  "clickedQuery": "$tagid:1|%E7%BA%AF%E7%88%B1$"
}
```

首次尝试将查询消费者和标签列表一起挂载的探针，在等待关注标签出现时失败，
退出码 1；没有用它证明仓库缺陷或声称组合测试通过。
最终证据来自上述两段独立验证及真实消费者源码链；第二段未挂载整张关注卡片，
不覆盖真实服务器合并、部署契约或完整 MePage 交互。
最小修复方向：合并成功的消费者失效集合包含关注线程列表，不需要迁移旧搜索 URL。
关闭条件：带源标签绑定的已关注帖子，在合并后刷新列表快照；
重新点击标签仅生成保留实体 ID；既有旧 ID URL 的明确错误语义保持不变。

### CR-014 [P2] 在途偏好读取会覆盖已保存的新偏好缓存

位置：`src/features/preferences/hooks/useUserPreferences.ts:42`、`:50`；
可达保存入口：`src/pages/MePage/index.tsx:340`、
`src/pages/SearchPage/index.tsx:122`。

偏好保存成功后直接 setQueryData，但没有取消或隔离已经发出的同 key 读取。
偏好缓存 staleTime 为一分钟；再次挂载页面的 hook 可触发后台读取，
此时仍有旧缓存，isLoading=false、isFetching=true。
RequiredSetupGate 不会阻挡这种后台刷新，MePreferencesSection 的保存只检查 isSaving，
SearchPage 也未把 isFetching 当成禁用条件。

如果旧 GET 已取得快照但响应较慢，用户保存 PUT 先成功，缓存会先显示新设置；
随后旧 GET 完成，React Query 把旧响应写入同一缓存，新排序、屏蔽项等又回到旧值。
服务端其实已经保存成功，界面及依赖缓存的后续操作却使用错误状态。
MePage 成功回调还会清除 isDirty，表单同步 effect 随后可重新采用旧快照。
不需要两个并发保存，不依赖请求错误或跨账号切换。

验证：JSDOM 中使用真实 useUserPreferences、QueryClient 与 renderHook；
认证和偏好 API 为内存替身，按相同 user/guild 查询键预置超过一分钟的旧缓存。
挂载后 GET 保持 pending，PUT 立即更新内存服务并返回新值，
最后让之前的 GET 返回它开始时的旧快照。命令退出码 0，结果：

```json
{
  "beforeSave": {"isLoading": false, "isFetching": true},
  "serverAfterSave": "created_at",
  "cacheAfterSave": "created_at",
  "cacheAfterOldRead": "last_active",
  "serverTags": ["新偏好"],
  "cachedTags": ["旧偏好"]
}
```

真实 hook 的读取与保存回调、缓存行为未替换，未发出真实请求，
没有声称验证整页表单或服务端并发事务。
最小修复方向：提交前隔离同一偏好查询的旧读取结果，并让保存响应成为当前成功状态。
是否暂停后台读取或取消查询可沿现有 QueryClient 能力实现，不需要额外状态库。
关闭条件：在旧 GET 晚于 PUT 返回的时序下，缓存保持保存成功的偏好；
后续普通刷新仍可正常更新，保存失败也不伪装成成功。

### CR-015 [P2] 同一份偏好被拆成两个缓存，AI 抽卡继续使用保存前的屏蔽项

位置：`src/features/preferences/hooks/useUserPreferences.ts:23`、`:50`；
消费入口：`src/pages/AISearchPage/index.tsx:72`、`:120`。

正式前端 OpenAPI 的 GET/PUT /v1/preferences/users/{user_id} 只有 user_id 路径参数，
描述均明确“固定使用配置的主服务器 ID”，没有 guild_id 查询参数。
本地 preferences.py:45、:89 也使用注入的 main_guild_id，不读取前端传入 guild_id。
因此当前受支持契约只有同一份用户偏好，不存在由这些请求选项选择的两份记录。

普通页面、TopBar 和设置守卫传入 GUILD_ID，AI 页面却调用无参数 useUserPreferences。
hook 把 options.guildId || 0 放入缓存键，保存又只更新当前键：
同一服务端记录因此被拆成主服务器 ID 和 0 两份缓存。
用户先访问 AI 页面，再去“我的偏好”修改屏蔽项并迅速返回 AI 页面，
0 键仍在一分钟 fresh 窗口，不发起读取，也未被保存回调失效。
AI 动态上下文及 scope=preferences 抽卡配方继续使用旧屏蔽项。
新偏好不是服务端未保存，也不是普通搜索 API 未应用偏好。

验证：真实 useUserPreferences、QueryClient、偏好映射、AI context 和工具运行时。
先挂载无参数 hook 读取旧屏蔽后卸载，再挂载带 guildId 的 hook 保存新屏蔽并卸载，
随后在 fresh 窗口内重新挂载无参数 hook。GET/PUT 内存替身维护同一份服务值，
符合前端正式接口的固定主服务器语义。
将返回偏好按 AI 页面规则转换为 drawPreferences，执行真实 draw_threads；
仅 discovery API 替身记录传入条件。命令退出码 0，结果：

```json
{
  "serverExcludedTags": ["新屏蔽"],
  "scopedCacheExcludedTags": ["新屏蔽"],
  "aiCacheExcludedTags": ["旧屏蔽"],
  "aiCacheInvalidated": false,
  "refetchesOnReturningToAI": 0,
  "aiContextStillOld": true,
  "drawExcludedTags": ["旧屏蔽"]
}
```

没有挂载完整 AI 页面、调用模型或抽取真实帖子；
证明的是当前页面使用的 hook/context/工具配方链，不声称线上已观察到具体不良抽卡。
最小修复方向：偏好缓存身份应与接口实际记录身份一致，当前契约不支持 guild 隔离。
如果仅修调用参数，仍需检查旧键和全部当前消费者；不增加虚构的跨服务器配置能力。
关闭条件：上述导航与保存顺序后，AI 上下文和偏好抽卡立即使用新屏蔽条件；
同一个用户不存在同时表示同一服务记录却独立更新的缓存副本。

### CR-016 [P2] 登录回调提前删除返回路径，认证失败重试后丢失原页面

位置：`src/pages/AuthPage/CallbackPage.tsx:42`、`:45`、`:72`。

CallbackPage 从 sessionStorage 取出原页面后，立即删除 login_redirect，
随后才等待 700ms 并确认认证状态。若确认最终失败，页面回到没有 redirect 参数的
/login，但原路径已不在存储中。再次完成登录或重新进入回调，只能取默认 /。
用户从受保护的书单、作品或搜索页面登录时，会丢失原有返回目标。
这不要求攻击输入，也不是 sanitizeInternalRedirect 拒绝外部链接的预期行为。

开发入口 src/main.tsx 使用 StrictMode，其额外 effect 生命周期也触发同一根因：
首次 effect 消耗路径后被取消，下一次 effect 没有存储值。这里只算同一个提前消费问题，
没有将开发重复挂载另计一项生产故障。

验证一：真实 CallbackPage、MemoryRouter、QueryClient 和 navigationSafety，
sessionStorage 保存 /booklists/7?from=share，认证 API 替身第一次返回最终网络失败。
回到登录页后，用新的 QueryClient 再挂载回调，模拟一次新的登录确认，API 返回成功。
未启用 StrictMode；错误查询设置 retry=false，以直接模拟业务层看到的最终失败，
不是声称执行了 App 的实际重试预算。命令退出码 0：

```json
{
  "strictMode": false,
  "expectedOriginalDestination": "/booklists/7?from=share",
  "failedDestination": "/login",
  "redirectAfterFailure": null,
  "retryDestination": "/"
}
```

验证二：同一真实组件、认证始终成功，比较有无 StrictMode 的挂载。
无 StrictMode 返回 /booklists/7?from=share，有 StrictMode 返回 /；
两组均只确认认证一次，命令退出码 0。
加载展示与 toast 替换为空组件/回调；没有真实 OAuth、Cookie 操作或生产导航。

最小修复方向：只有确认成功且实际使用返回路径时才消费该存储值；
失败、取消或重复挂载不能提前删除尚未完成的导航目标。
关闭条件：最终确认失败后再次登录仍返回原路径；开发 StrictMode 也保持该语义；
外部地址、双斜线和反斜线的既有安全过滤不放宽。

### CR-017 [P2] 缩略图修复只去重等待项，同一帖子在途时仍会重复请求

位置：`src/features/threads/lib/thumbnailRepairQueue.ts:105`、`:110`、`:152`。

flushQueue 开始时先清空 flushTimer，再从 pending 删除当前批次 ID，
随后才 await fetchImagesApi.refresh。reportBrokenThreadThumbnail 的去重只检查 pending，
没有覆盖已派发但未完成的 ID。第一次批次等待时，同一个帖子的另一张图片报错，
可以重新入队并在 800ms 后发出第二次刷新，两次请求会并发。

真实生产者 ThreadListItem 为同一个帖子挂载最多四个 LazyImage；
各图独立 onError，均上报同一 threadId。失效链接的错误到达不要求同步，
第二个错误完全可能晚于第一次派发而早于其返回。缓存批量更新要等响应成功，
所以无法在该窗口阻止其他图继续上报。
一次帖子修复会向 /fetch-images/ 发出请求；本地后端进一步用 Bot 请求首楼消息，
重复请求增加网络、服务端和上游成本，并非仅重复绘制骨架。
未测量生产请求数量，也不声称形成了无上限自动循环。

验证：加载真实队列，window.setTimeout 由内存调度器保存回调；
refresh 替身保持两条可控的 pending Promise，按两次 800ms 调度模拟异步上报。
第一次派发 thread 101 后，在响应前再次上报 101，执行第二个定时回调。
命令退出码 0：

```json
{
  "sameThread": "101",
  "requestsBeforeFirstCompleted": 2,
  "maxConcurrent": 2,
  "batches": [["101"], ["101"]]
}
```

探针最后解析所有替身 Promise，没有遗留网络或计时器；
没有挂载整张帖子列表，也没有真实 Bot 请求。当前单测只覆盖成功结果的缓存扫描，
未覆盖在途重复上报。
最小修复方向：同一 thread ID 的去重所有权应覆盖等待、派发、完成整个请求窗口；
完成或失败后再按现有恢复语义释放，不需要另建请求管理框架。
关闭条件：第一次修复 pending 时连续上报相同 ID，仍只有一条在途请求；
不同 ID 可进入后续批次，真实失败后的恢复不被永久锁死。

### CR-018 [P2] Banner 列表缩短时，索引重置尚未执行就触发页面错误

位置：`src/widgets/layout/BannerCarousel.tsx:117`、`:187`、`:188`；
消费者：`src/pages/PlazaPage/index.tsx:211`。

轮播在 effect 中处理 currentIndex 超过 displayBanners.length，但当前 render
已经先执行 displayBanners[currentIndex] 并读取 currentBanner.id。
当原来两张 Banner 正停在索引 1，活动列表刷新为一张时，currentBanner 是 undefined，
render 直接抛 TypeError，effect 没机会把索引复位。

广场的活动 Banner 来自可刷新查询，不是固定静态数组。
查询已有数据时后台更新不会进入 isLoading 骨架分支；从两条有效数据更新为一条，
会继续使用同一个 BannerCarousel。列表项到期、筛选结果变化后的读取均可能缩短数组，
不是需要调用一个当前没有生产者的内部 setter 才可到达。
本次未运行实际 reconnect、活动到期或 API 刷新，触发可达性来自正式消费者链。

验证：JSDOM 中挂载当前真实 BannerCarousel 与 BannerFadeMedia。
先传入两张 Banner，真实点击“下一张”到第二张，再将 props 更新为只含第一张。
图片展示、申请弹窗、手势和场景资源替换为与本次索引无关的替身；
关闭自动播放以隔离主动切换，错误由探针 ErrorBoundary 捕获。
命令退出码 0，结果：

```json
{
  "currentIndexBeforeRefresh": 1,
  "previousCount": 2,
  "newCount": 1,
  "error": "Cannot read properties of undefined (reading 'id')",
  "errorBoundaryEntered": true
}
```

这不是运行日志中的普通图片失败，而是轮播 render 错误；应用外层 ErrorBoundary
会将它接走。未验证生产错误页最终覆盖范围或整页交互。
最小修复方向：用于本次渲染的索引必须先满足当前列表边界，不能依赖渲染后的 effect；
保留现有轮播状态，不为普通数组变化新增状态机。
关闭条件：最后一项时从多条缩到一条或默认场景，仍能展示合法 Banner 并继续切换；
不进入错误边界，用户主动前后切换行为保持。

### CR-019 [P2] 旧图片解码完成会冒充新图片已加载，关闭新图超时回退

位置：`src/shared/ui/LazyImage.tsx:106`、`:110`、`:166`；
实际换图消费者：`src/widgets/layout/BannerCarousel.tsx:250`。

src 变化会重置 isLoaded，但上一张图 onLoad 创建的 decode Promise 仍可在之后完成，
then/catch 无条件执行 setIsLoaded(true)，没有核对它所属的图片是否仍是当前图片。
BannerCarousel 切换时复用同一个 LazyImage，内部仅为 img 设置 currentSrc key；
这会替换图片 DOM，却不会取消前一个 Promise 的组件状态回调。

因此从 A 换到 B，A 的解码完成可以在 B 从未触发 load 时把 B 标为已加载。
骨架被隐藏，更重要的是 Banner 的 4500ms 超时 effect 因 isLoaded=true 被清理，
当前 B 网络一直挂起时，不再按配置回退到默认背景。
这不是主观动画衔接评价，也不要求 B 返回错误；正常 error 回退和超时回退是不同入口。

验证：真实 LazyImage、图片优化与恢复模块，JSDOM 中控制 IntersectionObserver 入视，
为 A 的 HTMLImageElement.decode 提供 pending Promise。
触发 A 的 load 后复用组件切换到 B，确认 B 初始 opacity-0 且存在 4500ms 回退 timer；
未触发 B 的 load，只解析 A 的 decode，随后 B 变为 opacity-100，timer 被清理。
window 定时器用内存集合保存和清理，命令退出码 0：

```json
{
  "currentImage": "https://review.invalid/new.png",
  "newImageLoadDispatched": false,
  "oldDecodeResolved": true,
  "fallbackTimersBeforeOldDecode": 1,
  "fallbackTimersAfterOldDecode": 0,
  "newImageMarkedLoaded": true
}
```

图片设置、入视观察器、解码完成及计时器均为可控替身；
真实组件状态、effect 清理和 src 重用逻辑未替换。没有网络加载、截图或视觉验收。
当前 LazyImage 单测只覆盖图片关闭模式，不覆盖解码完成与换图的竞争。
最小修复方向：异步解码结果只更新它所属的仍有效图片，过期结果不改变新图状态；
继续保留 decode 失败时显示同一张已加载图片的正常恢复语义。
关闭条件：A 解码晚于切到 B 时，B 仍保持自身加载和超时状态；
B 自己 load 后才完成显示，B 挂起时既有回退计时器仍会生效。

### CR-020 [P2] 同类详情路由切换后，旧条目草稿会提交到新的书单或赛事

位置：`src/pages/BooklistDetailPage/index.tsx:82`、`:110`、`:592`；
`src/pages/TournamentManagePage/index.tsx:58`、`:83`、`:301`；
提交目标：`src/features/booklists/hooks/useBooklistsData.ts:327`。

这两个页面都把 editingItem 保存在页面本地状态中，路由只改变参数，不为页面设置
资源 key，也没有随资源 ID 清空编辑状态。条目弹窗仍收到旧 item，
但 useUpdateBooklistItem 已使用新的路由 ID。浏览器历史后退到另一份同类资源后，
页面标题和列表变为 B，弹窗里的 A 草稿继续存在；保存时请求目标却是 B。

当 A、B 属于同一用户且含有相同帖子时，这不是可被权限或条目不存在自动挡住的请求：
B 的备注、权重及赛事参赛时间可能被 A 草稿覆盖。这里不声称绕过后端授权。
新增帖子弹窗也缺少资源身份，但本项直接验证的是已有条目编辑，不把未经运行的
批量新增表现当作复现结果。

验证：分别加载真实 BooklistDetailPage、TournamentManagePage、条目编辑弹窗和全部
书单查询/mutation hooks，使用真实 QueryClient、MemoryRouter 和 React Hook Form。
内存缓存预装同一所有者的 A、B，二者都含帖子 101，备注不同。
历史初始位置为 A，上一条记录为 B；在 A 打开条目编辑并改备注，
调用 navigate(-1) 后核对页面 h1 已是 B、编辑框仍是 A 草稿，再点击真实保存按钮。
API、认证和与编辑无关的显示组件用替身；书单页条目显示替身只调用页面提供的
managementActions.onEdit，赛事页使用真实“编辑参赛信息”按钮。
修正后的组合探针正常退出，退出码 0：

```json
[
  {
    "page": "booklist",
    "currentPath": "/booklists/2",
    "editingStartedOn": "1",
    "write": {
      "booklistId": "2",
      "threadId": "101",
      "payload": {"comment":"Edited A draft","display_order":0}
    }
  },
  {
    "page": "tournament",
    "currentPath": "/tournaments/manage/2",
    "editingStartedOn": "1",
    "write": {
      "booklistId": "2",
      "threadId": "101",
      "payload": {
        "comment":"Edited A draft",
        "display_order":0,
        "tournament_participated_at":null
      }
    }
  }
]
```

没有实际浏览器历史操作、权限请求或持久化写入；JSDOM 为 native dialog 提供
showModal 属性替身。路由参数更新、页面状态保留、表单草稿和提交 ID 来自真实代码。
最小修复方向：草稿必须归属于创建它的资源，跨资源导航应关闭或重新建立编辑状态；
不要把“当前路由 ID”自动当作旧草稿的写入目标。
关闭条件：两页从 A 历史后退或导航到 B 后不能把 A 草稿写入 B；
同一资源内的普通重新渲染仍保留未提交编辑。

### CR-021 [P2] 在途书单写请求完成后，失效缓存的 ID 会跟随新路由变化

位置：`src/features/booklists/hooks/useBooklistsData.ts:320`、`:334`；
实际消费者：`src/pages/BooklistDetailPage/index.tsx:110`、
`src/pages/TournamentManagePage/index.tsx:83`。

useUpdateBooklistItem 的请求变量只有 threadId/payload，书单 ID 取自 hook 参数；
onSuccess 也使用该参数，而不使用本次请求捕获的资源身份。
当前 React Query 在同一 mutation observer 的参数更新时，会让 pending mutation
采用新的 options。因此先向 A 发出写请求，再导航到 B，A 完成时的成功回调变为 B：
只 invalidate B 的 detail/items，A 已修改的缓存仍保持有效。
页面关闭编辑的回调同样会作用于当前 B 页面，而不是请求原页面。

这是 CR-020 的另一种时序，写入本身仍正确地发给 A，错误发生在请求完成之后；
只清空跨路由草稿不能修复它。本项没有把 onSuccess 动态更新当作库缺陷，
需要调用方为请求结果和资源身份建立稳定关联。

验证：真实 useUpdateBooklistItem、失效函数、QueryClient 和 MemoryRouter；
A、B 的 detail/items 缓存都预装，API 更新 A 返回 deferred Promise。
mutation 启动后导航到同一路由 B，再解析 A 的请求，得到：

```json
{
  "actualWriteResource":"1",
  "callbackResource":"2",
  "originalDetailInvalidated":false,
  "originalItemsInvalidated":false,
  "currentDetailInvalidated":true,
  "currentItemsInvalidated":true
}
```

探针退出码 0；缓存消费者不保持活动，以便直接检查 invalidated 标记，
不是通过禁用真实 mutation 回调得到的结果。未复现完整页的第二个编辑窗口关闭，
也未测试写请求跨浏览器会话或卸载到不同页面；这两类场景不作为本项证据。
其他使用闭包书单 ID 的写 hook 具有相邻模式，但当前直接执行的只有更新条目。
最小修复方向：成功后的资源失效使用本次请求身份，页面级完成效果不得误操作
另一资源的新草稿；不需要取消服务器已经受理的写请求。
关闭条件：A 请求在 B 页面完成后仍失效 A 的 detail/items；
B 的新编辑不被无关 A 完成回调关闭。

### CR-022 [P2] 后台读取会重新初始化已打开的书单编辑草稿

位置：`src/features/booklists/components/BooklistFormModal.tsx:74`、`:83`；
`src/features/booklists/components/QuickAddToBooklistModal.tsx:43`；
详情轮询：`src/features/booklists/hooks/useBooklistsData.ts:147`。

BooklistFormModal 以整个 initialValue 对象为 reset 依赖，没有把“打开草稿”
与“服务器快照刷新”区分开。详情的 item_count、publish_status 等无关字段发生变化，
查询产生新对象，弹窗会 reset 全部字段，直接丢掉用户未提交的标题、简介等编辑。
关联讨论帖期间 detail hook 每 3 秒轮询；页面允许同时编辑书单，
关联状态结束时就是当前系统内明确可达的无关快照变化。

快捷收藏有同类草稿所有权问题：内容组件的 key 带 dataUpdatedAt。
每次成功读取都会重建整个内容组件，丢掉勾选、推荐语及本地 mutation observer；
不要求本次后台读取改变目标帖子的 membership。
两者实现不同，但都是把可刷新查询快照当作当前交互草稿的初始化身份，合并报告。

验证一：真实 BooklistFormModal、Checkbox、useBooklistDetail、QueryClient。
打开书单并输入未提交标题和简介；内存服务器只更新 item_count/publish_status，
调用真实 query.refetch 返回新详情后，两项输入均恢复旧值：

```json
{
  "serverChangedOnly":["item_count","publish_status"],
  "draftTitleAfterRead":"Original title",
  "draftDescriptionAfterRead":"Original description"
}
```

验证二：真实 QuickAddToBooklistModal、useMyBooklistsList、Checkbox、QueryClient。
API 初始返回一份未勾选书单，用户勾选并填推荐语；
真实 refetchQueries 触发第二次读取，仅条目计数变化，结果为：

```json
{
  "reads":2,
  "membershipChangedOnServer":false,
  "unsavedSelectionAfterRefresh":false,
  "unsavedCommentAfterRefresh":"",
  "saveDisabledAfterRefresh":true
}
```

两项修正后的探针都正常退出，退出码 0；请求和通知是内存替身，
没有等待真实 3 秒轮询，也没有执行实际断网重连或服务器发布操作。
纯相同详情经过结构共享可能不会触发表单 reset，不把每次详情读取都称为必现；
快捷弹窗依赖更新时间，范围更广。
最小修复方向：在打开或目标身份变化时初始化草稿，普通快照更新不覆盖未提交输入；
仍保留关闭后重新打开获得最新数据的现有行为。
关闭条件：上述无关刷新保留用户输入；切换资源或主动重新打开不会沿用旧资源草稿。

### CR-023 [P2] 编辑书单标题也会把受支持的既有排序改成“加入时间降序”

位置：`src/features/booklists/components/BooklistFormModal.tsx:36`、`:81`、`:106`；
`src/features/booklists/api/booklistsApi.ts:153`；
本地后端映射：`../Odysseia-Forum/src/api/v1/routers/booklists.py:87`、`:656`。

正式 OpenAPI 的书单排序支持 hot、created_at、reaction_count、reply_count、
collection_count、last_active_at、join_time、display_order 及 asc/desc。
前端编辑表单只有旧 display_type 两种状态：仅 display_order/asc 被映为 2，
任何其他已有组合都被映为 1。保存时无论用户是否改排序，都会提交 display_type，
API 不提交原有 default_sort_method/default_sort_order。

因此受支持的 reaction_count/asc 等记录，用户仅改标题也无法往返保留排序。
这里的问题不是“需要添加所有排序功能”，而是普通字段编辑不能隐式改写
自己未编辑的持久化字段；保留原值即可，不必为了修复增加庞大的排序 UI。

验证：真实 BooklistFormModal、Checkbox、React Hook Form、booklistsApi.update，
底层 apiClient.put 用内存记录。初始排序 reaction_count/asc，仅修改标题再提交，
没有触碰排序控件，探针退出码 0：

```json
{
  "originalSort":["reaction_count","asc"],
  "sortControlTouched":false,
  "selectedSort":"1",
  "wire":{
    "url":"/booklist/update/1",
    "params":{
      "title":"Only title edited",
      "description":"Original description",
      "cover_image_url":"",
      "is_public":true,
      "display_type":1
    }
  }
}
```

另以 Python AST 提取并执行本地后端真实 _resolve_sort_params，
枚举来自该 checkout 的真实枚举文件，未加载整个路由或访问数据库：
display_type=1 返回 join_time/desc，断言成功、退出码 0。
本地更新路由会把此结果写给 repository；当前线上后端映射未验证，
不把本地旧 checkout 等同于部署现状。前端无法保留正式契约已有排序的事实已独立确认。
最小修复方向：未修改排序时保留原排序参数，或者不发送排序更新；
若选择省略，仍需核对服务端省略是否确实保持原值，本地旧路由会主动解析默认值，
不能仅凭 PATCH 式直觉认定该 PUT 已支持“不变”。
关闭条件：任一受支持排序的书单单改标题后，排序仍与保存前一致；
用户主动选现有两种展示顺序时仍能明确更新。

### CR-024 [P2] 抽卡旧请求的失败与结束状态会污染仍在进行的新抽卡

位置：`src/pages/DrawPage/index.tsx:301`、`:333`、`:340`、`:552`。

主抽卡按钮按 isDrawing 禁用，但已有历史结果时，“再来一次”没有忙碌禁用，
handleDraw 也没有统一阻止该入口。于是同一页面可以有 A、B 两个在途请求。
成功分支检查 sequenceId，过期成功不写结果；catch 和 finally 不检查序号，
过期 A 失败仍设置全局 error，finally 仍把 B 的 isDrawing 清为 false。

B 成功不会清掉在 B 开始后才写入的 A 错误，因此页面能同时显示最新成功结果和
“哎呀，抽卡失败了”。B 尚未返回时主按钮也已经重新启用，可以继续扩大并发。
这里不把每次并发都算成数据覆盖；当前成功结果已有序号保护。

验证：真实 DrawPage 和历史区按钮；JSDOM 内存 localStorage 预装一次旧结果，
关闭揭晓动画，API 提供两个 deferred Promise。点击主单抽 A，再点击未禁用的
历史“再来一次” B；拒绝 A 时 B 保持 pending，再让 B 成功。退出码 0：

```json
{
  "requests":2,
  "repeatEnabledDuringPending":true,
  "busyClearedWhileLatestPending":true,
  "latestResult":"2",
  "staleErrorStillVisible":true,
  "persistedHistory":["2"]
}
```

动画、历史卡片展示、未打开的揭晓层、频道/偏好 hook 是替身；
请求序号、错误状态、真实按钮与历史持久化来自页面原代码。
旧请求拒绝产生一条预期错误日志；探针记录它，没有当作未解释的测试报错。
无真实请求或浏览器存储写入。
最小修复方向：所有抽卡入口共享忙碌规则，异步成功、失败、结束均归属于本次序号；
不让过期请求清除新请求的忙碌状态。
关闭条件：A 过期后无论成功还是失败，都不改变 B 的错误、结果和 busy；
历史入口和主入口对正在抽卡采用一致约束。

### CR-025 [P2] 自选频道为空时，历史抽卡入口会改为请求全社区

位置：`src/pages/DrawPage/index.tsx:217`、`:274`、`:552`；
请求序列化：`src/features/discovery/api/discoveryApi.ts:92`。

自选模式没有选择频道时，界面显示“请选择频道”，主按钮按 canDraw 禁用；
但历史“再来一次”仍可点击，handleDraw 不检查 canDraw。
effectiveChannelIds 此时把空自选列表转为 null，API 将它序列化成未提供 channel_ids，
即不限定频道的请求。用户在明确无效的自选配置下，并没有主动选择全社区。
这不是权限绕过，而是抽取范围与当前 UI 状态不一致。

验证：真实 DrawPage、DrawSettingsPanel、discoveryApi；底层 apiClient 用替身记录。
内存历史有旧结果、关闭揭晓动画，频道 hook 返回一个可选频道。
通过真实按钮打开设置、切为“自选频道”，不选择任何频道，
主抽卡已禁用，再点击历史按钮，退出码 0：

```json
{
  "customMode":true,
  "selectedChannels":0,
  "mainButtonDisabled":true,
  "repeatEnabled":true,
  "wire":{
    "url":"/discovery/random",
    "params":{"limit":1,"include_tags":[],"exclude_tags":[],"tag_logic":"and"}
  }
}
```

只记录最终请求参数，没有请求真实后端，也没有断言返回作品属于哪个频道。
修复不能只给某个按钮增加样式：进入 handler 的条件应与可执行配方一致，
而空自选范围不应被隐式解释为全社区。
关闭条件：有历史记录时，自选零频道也不会发出抽卡请求；
选中频道后各入口都按该频道集合发请求，主动全社区模式仍正常可用。

### CR-026 [P2] 十连请求失败后，重试会发送上一次成功抽卡的数量

位置：`src/pages/DrawPage/index.tsx:173`、`:303`、`:486`、`:588`。

lastDrawCount 初值为 1，只在 API 成功返回后更新。
如果第一次点击“十连发现”就失败，错误区“重试一下”使用的仍是 1，
而不是失败请求的 10。此前成功过十连后单抽失败，也会沿用相反的旧数量。
揭晓层的 onRetry 同样读取该状态，但当前直接运行的是关闭动画的页面重试入口。

验证：真实 DrawPage 和 discoveryApi，底层 API 第一次拒绝、第二次成功；
关闭揭晓动画后点击“十连发现”，等待真实错误按钮出现，再点“重试一下”。
最终请求 limit 为 `[10, 1]`，不是 `[10, 10]`；退出码 0。
预期拒绝日志已记录，无真实网络请求。

最小修复方向：失败重试使用失败操作的数量，不把“上一次成功结果的数量”
当作“当前操作的数量”；不需要引入新重试框架或自动重试。
关闭条件：首次十连失败、单抽成功后十连失败、十连成功后单抽失败，
主动重试均保持最近失败操作的数量，两种揭晓设置一致。

## 分轮进度

第二轮已核对 AI 页面提交、取消与重试入口，普通搜索 URL/结果/API 链，
帖子和作者关注 hooks、偏好 hook，以及书单/赛事单项编辑器与本地后端 PATCH 所有者。
本轮新增三个已复现问题 CR-002 至 CR-004，不修改业务实现。
审查队列仍未整体完成；AI Provider 流关闭、跨页运行与会话淘汰，
标签合并/权限、书单批量写入、通知与共享组件及 OG 仍需继续。

第三轮核对主站 OG Function、纯逻辑自检、独立图片服务准备/渲染/响应入口，
并对照本地后端的公开性、元数据缓存与作者更新时间来源。OG 新候选暂缺完整证据，
不新增确认缺陷。共享 Markdown 新增 CR-005 至 CR-007，均已通过真实组件生成和
JSDOM DOM 结构检查复现。链接安全和站内跳转工具做了静态读取，
没有据此声称完整安全审计通过。

第四轮核对标签池查询装配、草稿、实体分段保存、关系选择、合并、
绑定替换与提议部分成功流程。新增 CR-008，包含实际组件时序与删除调用的复现证据。
工作区关系树修改仅读取，未重写；本轮问题来自未改动的 LiveTagPool/savePoolTag，
不是哥哥尚未提交的关系树改动造成的回归。
标签队列仍未整体关闭：大规模 DAG 渲染、合并后的所有消费者失效、
目标切换的在途请求和实际线上契约尚需进一步核对。

第五轮继续核对 AI 会话裁剪、后台 controller 所有权与 ask_user 续跑协议，
新增 CR-009、CR-010。两项均由当前源码 runnable check 复现；后者覆盖真实 Agent
及工具运行时的完整成功序列，不是只向 store 塞入任意超长数组。
本轮随后继续通知与 Provider 流生命周期审查，未调用真实模型或论坛写接口。
通知暂未新增确认问题，Provider 清理问题保留为开放风险。
书单同步新增 CR-011；叠层快捷弹窗键盘边界新增 CR-012，分别由真实组件/QueryClient
和真实两层事件监听复现。新增探针均完成资源清理并正常退出。
未完整覆盖静态 Feed、通知偏好消费、批量书单失败与并发提交。
继续核对标签合并后新增 CR-013，确认遗漏 follows 快照消费者。
未把 tags/stats 或 meta/channels 未失效直接报告成缺陷：尚未证明本次实体合并
对这些旧接口统计/频道来源字段的具体影响，不能只按 queryKey 清单推导。

第六轮核对认证检查、失效订阅、登录确认、页面守卫及偏好读取/保存/AI 消费。
新增 CR-014 至 CR-016，分别覆盖旧读取回写、同记录缓存分裂与回调返回路径提前消费。
正常首次偏好加载的误保存候选被实际守卫链排除，没有用脱离路由的子组件制造问题。
认证失效会 cancel auth 查询再写 loggedIn=false，仍未证明正常真实登录链的跨账号缓存泄露。
本轮聚焦探针均正常退出，无真实认证、模型或业务 API 请求；
未验证离线状态、自动 401 的完整跨页交互及多浏览器窗口间的会话变化。
随后沿共享图片加载、缩略图修复与广场 Banner 链新增 CR-017 至 CR-019。
验证分别覆盖真实队列派发、真实轮播 props 缩短和真实 LazyImage 过期解码回调；
不以纯 DOM 状态替代人工视觉验收。图片 HTTP 200 单项失败的冷却处理、
失效签名链接和实际 CDN/浏览器缓存行为仍待进一步核对。

第七轮沿书单/赛事同类详情路由、编辑草稿、在途写入回调和后台读取继续审查，
新增 CR-020 至 CR-023。CR-020 对两个真实页面分别复现错目标写入；
CR-021 独立覆盖提交后才导航的缓存失效错位，不能仅靠关闭跨资源弹窗修复。
CR-022 包含详情表单 reset 和快捷收藏组件重新挂载两个已运行的草稿丢失入口；
CR-023 对照正式排序契约、真实表单/API 参数及本地旧后端映射，未验证线上持久化。
批量新增 ID 仍以字符串提交，现有前端测试覆盖关闭重开清空及失败保留输入；
这些测试不覆盖路由资源身份或后台快照更新。批量新增响应是成功条目数组，
本地 repository 会跳过已存在条目，但尚未证明线上成功子集、失败回滚和 UI 提示
之间的具体违例，未按 response.data 未使用直接添加确认问题。
书单/赛事 hooks 使用同一套 key，未发现另一套赛事缓存遗漏失效；
TournamentDetailPage 对 Banner 越界已有条件渲染，不复用 CR-018 的崩溃结论。
本轮没有修改业务文件，没有执行真实写入。

第八轮开始沿抽卡及搜索时序核对，新增 CR-024 至 CR-026。
真实抽卡页面复现了旧失败污染新操作、历史入口绕过空频道配方、
失败重试数量沿用旧成功状态。三个探针场景均正常退出，未调用外部 API。
普通搜索遗漏作者字段的候选被源码链排除：includeAuthors/excludeAuthors 来自 query
中的 token，hook 原样传 query，searchApi 再解析并加入正反作者字段；
不能只看 hook 没有传独立数组就报告筛选丢失。本轮未新跑搜索作者集成探针。
偏好 Snowflake 数组也有专用 text 读取与字符串修补，不把公共 client
未覆盖数组的注释直接推导成偏好 ID 精度缺陷；未新执行精度探针。
哥哥要求审查收口后停止了新候选的验证，不继续探索发现内容轮播和限流边界。
截至收口共有 26 项确认问题；开放风险保留，不自动升级成缺陷或修复任务。

## 验证账目

- 已完成：文档与当前源码对照；认证退出链反证核查；CR-001 内存 Storage runnable check；
  CR-002 真实 QueryClient/当前 mutation 回调检查；CR-003 真实编辑组件 JSDOM 提交；
  CR-004 真实路由 hook JSDOM 往返；普通搜索分页及关注查询反证核查；
  CR-005 至 CR-007 真实 Markdown 组件生成与 DOM 结构检查；OG 本地纯逻辑自检；
  CR-008 真实标签组件/保存函数时序探针得到预期误删输出，探针因遗留计时器手动终止，
  不作为正常退出的整套测试通过记录；
  CR-009 真实 store/controller 内存探针；CR-010 真实 Agent/工具/会话组合探针，
  二者均正常退出且断言通过；
  CR-011 真实快捷弹窗与活动条目缓存探针；CR-012 真实父子层 Escape 事件探针；
  Provider 流内存终止/错误清理探针，结果保留为开放风险；
  CR-013 独立关注 hook 生产者检查、真实合并/活动关注缓存/标签搜索探针；
  CR-014 真实偏好 hook 请求时序探针；CR-015 真实偏好生命周期/context/抽卡配方探针；
  CR-016 真实回调最终失败重进与 StrictMode 对照探针；
  CR-017 真实修复队列在途重复探针；CR-018 真实轮播列表缩短探针；
  CR-019 真实图片组件异步解码探针，全部正常退出且断言通过；
  CR-020 两个真实页面/路由/编辑器/写 hook 组合探针；
  CR-021 真实在途写 hook/路由/缓存失效探针；
  CR-022 真实详情 hook/表单及快捷收藏 hook/组件背景读取探针；
  CR-023 真实表单/API 出参探针及本地后端排序函数 AST 聚焦检查，
  修正后的命令全部正常退出且断言通过；
  CR-024 真实抽卡页面双请求时序探针；
  CR-025、CR-026 真实抽卡页面/设置/请求序列化组合探针，
  均正常退出且断言通过。
- 探针失败：CR-013 首次组合挂载未等待到标签，退出码 1；已换用拆分验证获得明确证据，
  未将失败归类为仓库测试失败，也未把该组合探针算作通过。
- 第七轮探针定位失败：首次双页面探针在赛事页误点无动作的展示替身，
  未等待到 textarea，退出码 1；改为真实“编辑参赛信息”按钮后两页均通过。
  首次表单组合探针误用按钮名称“保存”，实际名称是“保存修改”，退出码 1；
  改为真实 submit 按钮后草稿和出参检查均通过。失败不归类为仓库回归。
- 未执行：全仓测试、lint、类型检查、构建、浏览器诊断及人工视觉验收。
- 未访问：生产写接口、外部模型服务、实时后端 OpenAPI。
- 审查阶段仅修改本审查文档，未修复业务代码；修复阶段另用执行计划跟踪关闭结果。
