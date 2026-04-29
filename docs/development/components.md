# 🧩 组件开发指南 (Components Guide)

本指南介绍如何在 Odysseia Forum 项目中编写高质量、可维护的 React 组件。

## 1. 组件标准 (React 19)

自项目升级至 **React 19** 后，组件编写方式发生了重大变化。

### 1.1 弃用 `forwardRef`

在 React 19 中，`ref` 作为一个普通的 Prop 传递。**禁止再写这种包裹代码**：

```tsx
// ❌ 旧写法 (已过时)
const MyButton = forwardRef((props, ref) => <button ref={ref} {...props} />);

// ✅ React 19 标准写法
export const MyButton = ({ ref, ...props }: Props) => (
  <button ref={ref} {...props} />
);
```

### 1.2 使用 Actions 处理表单

处理表单提交时，推荐使用 `useActionState`。这能自动处理提交中 (`pending`) 和结果 (`data/error`) 状态：

```tsx
const [state, action, pending] = useActionState(submitForm, null);

return (
  <form action={action}>
    <input name="username" />
    <button disabled={pending}>提交</button>
  </form>
);
```

---

## 2. 目录结构

组件应按 FSD 规范存放在对应的 `ui/` 或 `components/` 目录下。较复杂的组件应包含以下文件：

- `index.ts` - 导出
- `MyComponent.tsx` - 视图逻辑
- `MyComponent.test.tsx` - 测试 (Vitest)
- `styles.css` - (可选) 局部覆盖样式

---

## 3. 样式与原子类

- **优先使用语义类**：如 `text-od-text-primary` 而非 `text-white`。
- **动态类生成**：使用 `cn()` 函数合并类名。
- **禁止硬编码颜色**：始终通过 `globals.css` 中的 `@theme` 变量操作。

---

## 4. 动画规范

- **进场动画**：使用 `animate-in` 系列原子类。
- **核心组件**：使用 `motion` (来自 `motion/react`)。
- **性能**：避免在循环渲染的大量节点中应用复杂的 `layout` 动画。

---

## 5. 跨层交互与 URL 状态控制

涉及重度交互的过滤器面板（例如 `src/features/search/components/SearchFilterPanel.tsx`）不应在内部缓存提交状态，而必须使用受控的 Props，将变更交由 URL Controller 处理：

- **完备的状态注入**: 接收并展示精确解析后的组合状态（包含 `mergedIncludeTags`、`mergedExcludeTags` 用于高亮标签面板，`includeAuthorTokens` 与 `excludeAuthorTokens` 用于展示选中的作者胶囊，以及 `includeAuthorDraft`、`excludeAuthorDraft` 文本框草稿输入状态，同时包含 `tagLogic`、`timeFrom`、`timeTo`、`preferenceIncludeTags`、`preferenceExcludeTags` 等附加偏好）。
- **受控事件冒泡**: 内部操作不持有副本，完全触发外部回调（例如 `onToggleTagToken`、`onSubmitAuthorDraft`、`onRemoveAuthorToken`、`onIncludeAuthorDraftChange`、`onExcludeAuthorDraftChange` 等），让 TopBar Controller 统一接管路由的 `SearchSearchParams` 变更。

---

## 6. 交互引导与漫游指南 (Onboarding & Tour)

为了配合全局的 `OnboardingManager` (新手引导系统)，任何可能成为引导步骤锚点的基础组件或业务区块，都应当预留或直接赋予 `data-tour` 属性。

- **属性定义**: 通过 `data-tour="xxx"` 的格式将组件暴露给全局漫游向导查找（底层通过 `document.querySelector` 捕获位置）。
- **组件透传**: 对于高度封装的业务组件（如 `SearchFilterPanel`）或底层基础组件（如 `Button`），如果有需要，可以通过 Props 透传 `data-tour` 属性，以确保引导气泡能够准确定位。

示例：

```tsx
export function SearchFilterPanel({ "data-tour": dataTour, ...props }: Props) {
  return (
    <div data-tour={dataTour || "filter-panel"} className="p-4">
      {/* ... */}
    </div>
  );
}
```

---

## 7. 组件自检清单

1. 是否使用了 React 19 的普通 `ref` 传参？
2. 是否通过 `interface/type` 完整定义了 Props？
3. `cn()` 是否正确接收了外部传入的 `className`？
4. 是否在小屏幕下进行了响应式适配？
5. 是否可以通过键盘操作（Tab 导航等）？
