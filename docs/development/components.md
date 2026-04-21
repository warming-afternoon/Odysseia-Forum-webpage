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

## 5. 组件自检清单

1. 是否使用了 React 19 的普通 `ref` 传参？
2. 是否通过 `interface/type` 完整定义了 Props？
3. `cn()` 是否正确接收了外部传入的 `className`？
4. 是否在小屏幕下进行了响应式适配？
5. 是否可以通过键盘操作（Tab 导航等）？
