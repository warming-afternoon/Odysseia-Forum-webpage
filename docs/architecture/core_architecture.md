# 🏗️ 前端核心架构 (Core Architecture)

本项目采用 **Feature-Sliced Design (FSD, 功能模块化设计)** 作为基础架构方法论，结合 React 的组件化生态，实现高内聚、低耦合的可扩展前端业务。

## 1. 技术栈大盘 (Modern Stack)

| 领域           | 核心技术                      | 说明                                                    |
| :------------- | :---------------------------- | :------------------------------------------------------ |
| **视图层UI**   | **React 19**                  | 使用 React 19 新特性 (Actions, use, ref passed as prop) |
| **构建引擎**   | **Vite 8 (Rolldown)**         | 采用 Rust 编写的 Rolldown 引擎，极致的 HMR 与打包速度   |
| **路由控制**   | React Router v6               | 基于组件/Hook形式的前端路由分发                         |
| **服务端状态** | `@tanstack/react-query` v5    | 负责远程数据拉取、缓存、后台静默刷新                    |
| **客户端状态** | `zustand`                     | 轻量级、基于 Hooks 的全局 UI 状态流转                   |
| **样式系统**   | **Tailwind CSS v4**           | **CSS-First** 引擎，取消 JS 配置，原生支持现代 CSS 特性 |
| **动效库**     | **Motion 12**                 | 丝滑的 UI 交互动画，深度适配 React 19                   |
| **类型与规范** | **TypeScript 6.0**, Zod       | 全链路显式类型与运行时校验                              |
| **通信层**     | `axios`, `openapi-typescript` | 基于 OpenAPI 规范自动生成全局类型定义                   |

---

## 🌟 2. 现代化范式 (Modern Paradigms)

为了保持项目的前瞻性并规避旧知识库的误导，请遵循以下 React 19 + Tailwind 4 的开发新范式：

### 2.1 彻底弃用 `forwardRef`

React 19 中，`ref` 已成为普通 prop。在编写组件时，**严禁使用 `forwardRef`**，直接在参数中解构使用即可：

```tsx
// ✅ React 19 标准方案
export const MyComponent = ({ ref, className, ...props }: Props) => (
  <div ref={ref} className={className} {...props} />
);
```

### 2.2 CSS-First 样式配置

项目已彻底移除 `tailwind.config.js`。所有主题扩展（颜色、间距、断点）必须在 `src/shared/styles/globals.css` 的 `@theme` 块中定义：

- **新增颜色**：使用 `--color-xxx` 格式定义。
- **自定义配置**：直接写 CSS 变量，Tailwind v4 会自动映射。

### 2.3 Actions API 表单处理

推荐优先使用 React 19 的 Actions 处理异步表单提交。结合 `useActionState` 和 `useFormStatus` 来替代手动维护 `loading` 和 `error` state。

---

## 3. FSD (Feature-Sliced Design) 分层规范

本项目的 `src/` 目录严格遵循 FSD 分层逻辑。**层级越高，包含的具体业务逻辑就越多。**

> 核心原则 (依赖单向性): **上层模块可以引用下层或同层模块，但下层绝不能引用上层模块！**

### 🧱 6. Shared (共享层)

**职责**：全局公用的基础设施、底层 UI 组件（如 `src/shared/ui`）。

### 📦 5. Entities (实体层)

**职责**：应用中的核心业务对象（User, Thread）。

### ⚙️ 4. Features (功能特性层)

**职责**：用户与应用交互的具体功能（Form, Toggle）。

### 🧩 3. Widgets (部件层)

**职责**：将 Features 和 Entities 组合而成的独立区块（Navbar, Sidebar）。

### 📄 2. Pages (页面层)

**职责**：路由对应的顶层组件。

### 🚀 1. App (应用层)

**职责**：全局初始化（Provider, `globals.css`）。

---

## 4. 数据流流向 (Data Flow)

1. **服务端状态 (React Query)**：通过封装好的 Hooks 直接获取数据，杜绝在 Page 层使用 `useEffect` 手动拉取。
2. **客户端状态 (Zustand)**：仅处理 UI 状态与跨页面临时缓存。
