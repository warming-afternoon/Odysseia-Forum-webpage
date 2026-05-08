# 🎨 UI 样式与设计指南 (UI & Style Guide)

本项目使用 **Tailwind CSS v4** 作为原子化 CSS 引擎，核心采用 **CSS-First** 方案。结合 **CSS Variables (`--od-*`)** 来实现流畅主题切换、语义层级和透明风格。

## 1. 核心设计体系 (Tailwind v4)

我们采用 `Tailwind + od-token` 的双轨体系，并在 v4 中实现了全量 CSS 配置化：

- **配置中枢**：所有的主题扩展（颜色、间距、圆角）现在都在 `src/shared/styles/globals.css` 的 `@theme` 块中通过 CSS 变量定义。
- **不再使用 JS 配置**：项目已移除 `tailwind.config.js`，避免了厚重的配置加载，提升了毫秒级的开发体验。
- **自动化扫描**：Tailwind v4 会自动检测源码中的类名，无需手动配置 `content` 路径。

### 1.1 主题色与语义色 (Theming)

所有颜色优先使用语义变量，不直接硬编码 Hex 或原子色类（如 `bg-blue-500`）。

- **基础背景层**：`--od-bg` / `--od-bg-secondary` / `--od-bg-tertiary`
- **容器层**：`--od-card` / `--od-card-hover`
- **边界层**：`--od-border` / `--od-border-strong`
- **文本层级**：
  - `--od-text-primary` / `--od-text-secondary` / `--od-text-tertiary`
  - `--od-text-heading` / `--od-text-label` / `--od-text-meta`
- **状态与高亮**：`--od-accent` (仅用于焦点) / `--od-success` / `--od-warning` / `--od-error`

> **开发要求**: 组件实现时，颜色来源优先顺序是：`--od-*` 语义变量 > 映射后的主题类 (如 `bg-od-bg`) > Tailwind 临时原子类。

### 1.2 排版与层级 (Typography & Hierarchy)

本项目强调“**字重优先**”的层级表达，避免只靠颜色区分主次。

- **语义字号**：`--od-type-title` / `--od-type-hero` / `--od-type-section` / `--od-type-body`
- **语义字重**：`--od-weight-strong` / `--od-weight-medium` / `--od-weight-regular`

---

## 2. 无框流体风格 (Borderless Fluid)

本项目不鼓励“卡片套卡片”的厚重层级，优先无框流体表达。卡片或者不同颜色的主题嵌套绝对不可以超过三层。

- **直接表达**：直接把字放在背景上，不需要容器。这要求文字排版够好，善于用字色、字重去作为设计语言。
- **阅读节奏**：分割线 (`FluidDivider`) 的职责不是把内容框起来，而是把阅读节奏切开。
- **轻量 Surface**：仅将背景色留给真正的交互实体（如帖子卡片、浮层、输入框），页面标题和分区说明默认不加背景容器。

---

## 3. 透明与磨砂玻璃 (Transparency & Glass)

磨砂是高成本效果，必须控制预算：

1. **底层**：`od-operation-base`（底层背景，可启用毛玻璃）。
2. **浮层**：`od-floating-glass`（仅在下拉、预览、Modal 等小面积区域使用磨砂）。
3. **内容层**：使用透明混色 (`color-mix`)，不叠加 `backdrop-filter` 磨砂效果。

---

## 4. 动效与过渡 (Animations)

- **框架支持**：采用 **Motion 12**。
- **现代规范**：在 React 19 下，`motion` 组件直接通过 `ref` 接收引用，不再需要特殊的包装。
- **基础动画**：优先使用 `@plugin 'tailwindcss-animate'` 提供的内置原子类（如 `animate-in`, `fade-in`）。

---

## 5. 开发禁忌与检查清单

### 5.1 禁忌 (Don'ts)

- **严禁新建 `tailwind.config.js`**：所有配置必须在全局 CSS 的 `@theme` 块中完成。
- **严禁过度嵌套**：背景色/容器嵌套超过三层会导致视觉混乱。
- **严禁滥用 Accent**：`--od-accent` 只用于交互激活态，禁止当做通用文本颜色。

### 5.2 提交前检查 (Checklist)

1. 是否优先使用 `src/shared/styles/globals.css` 中定义的样式变量？
2. 是否用字重+字号体现层级（而非只靠颜色）？
3. hover 态是否优先强调图标和文字（而非边框发光）？
4. 设置/筛选页面是否设计了清晰的文本阅读节奏？
