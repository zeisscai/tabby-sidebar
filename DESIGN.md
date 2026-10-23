# Tabby 服务器侧边栏插件设计

> 包名：`tabby-sidebar` · 目标版本：Tabby 1.0.2xx（Angular 15）
>
> 范围：在 Tabby 主窗口左侧提供可收起、可固定的 SSH 服务器列表，单击即可连接。
> 明确不做：不移除/修改顶部「配置和连接」按钮，不集成 SFTP+，不实现任何文件传输功能。

---

## 1. 背景与目标

Tabby 默认界面只有顶部的标签栏和「配置和连接」按钮，查看已有服务器需要先打开配置页。
本插件希望在保留现有 UI 与命令体系的前提下，增加一个常驻左栏：

1. 列出已保存的 SSH 服务器，按 Tabby 的配置分组展示；
2. 单击服务器直接打开连接 Tab；
3. 侧边栏可收起；收起后仅在窗口左缘保留一个可展开的控制柄；
4. 侧边栏可固定：
   - 固定时占据布局空间，始终可见，不自动隐藏；
   - 浮动时覆盖在终端内容上方，选中服务器或点击外部后自动收起；
5. 记住固定状态、收起状态、宽度和分组折叠状态；
6. 适配 Tabby 主题色与 macOS 细边框（thin frame）窗口。

### 非目标

- 不删除或重排顶部工具栏按钮；
- 不修改 Tabby 核心源码，不依赖私有命令；
- 不接管 SFTP+，也不弹出/嵌入任何 SFTP 面板；
- 不提供服务器的新增、编辑、删除功能（仍由 Tabby 原有配置界面负责）；
- 不做多窗口之间实时同步（每个窗口独立挂载侧边栏，配置变更后各自刷新）。

---

## 2. 可行性结论

Tabby 没有官方的「侧边栏扩展」API，但外部插件可以在应用就绪后，将组件挂载到
`app-root .window` 下（与原生 `profile-tree` 同级），通过公开服务读取配置并打开连接。

| 方案 | 说明 | 结论 |
| --- | --- | --- |
| 开启原生 `showProfileTree` | 原生配置目录树；需双击启动、无法固定/浮动、混杂所有类型配置 | 不满足需求 |
| 修改 Tabby 核心模板 | 可直接增加布局区域，但需要维护 fork，升级成本高 | 不采用 |
| 插件挂载自定义组件 | 不改核心，只用公开的服务与 DOM 结构 | **采用** |
| 插件替换/嵌入 SFTP+ | 依赖 SFTP+ 私有声明，且已明确不做 | 不采用 |

侧边栏挂在 `.window` 内、`.content.main` 之前。固定模式下它是 flex 子项，挤占主内容宽度；
浮动模式下改为绝对定位覆盖在主内容之上。Tabby 的模态框层级（Bootstrap modal）高于侧边栏，
因此不会遮挡设置、编辑等弹窗。

已知限制：这种 DOM 挂载方式不是官方扩展点，Tabby 大幅调整 `app-root` 模板后可能需要适配。
插件只依赖稳定的选择器 `app-root .window > .content.main` 与公开 Service，风险可控。

---

## 3. 交互设计

### 3.1 布局

```
app-root
├── title-bar（Tabby 原生，是否显示由外观设置决定）
└── .window
    ├── profile-tree（Tabby 原生，可选）
    ├── tabby-server-sidebar   ← 本插件挂载点
    └── .content.main
        ├── .tab-bar
        └── 终端内容
```

- 侧栏默认宽度 288px，可在 220–480px 之间拖动右边缘调整；
- 使用 Tabby 主题变量（`--theme-bg-more-2`、`--theme-secondary`、`--theme-fg` 等）；
- macOS thin frame 下增加顶部留白与拖拽区，避免遮挡红绿灯按钮；
- 标签栏位于顶部时，浮动层从标签栏下方开始，避免遮挡标签；
- 收起后仅在左缘保留一个竖向展开控制柄。

### 3.2 状态矩阵

| 固定 | 收起 | 表现 |
| --- | --- | --- |
| 是 | 否 | 停靠展开：占据布局宽度，终端区域相应变窄 |
| 是 | 是 | 仅左缘显示展开控制柄，终端占满宽度 |
| 否 | 否 | 浮层展开：覆盖终端左侧，点击外部或选中服务器后收起 |
| 否 | 是 | 仅左缘显示展开控制柄 |

默认状态：**固定 + 展开**。

### 3.3 操作

| 操作 | 结果 |
| --- | --- |
| 单击服务器 | 调用 Tabby 的 profile 打开逻辑新建连接 Tab |
| 单击「固定」 | 在停靠/浮层之间切换 |
| 单击「收起」 | 收起侧栏，保留左缘控制柄 |
| 单击控制柄 | 展开侧栏（浮层模式下仍为浮层） |
| 单击分组标题 | 折叠/展开该分组 |
| 搜索框输入 | 按名称、`user@host:port` 实时过滤；搜索时忽略分组折叠 |
| 拖动右边缘 | 调整并保存宽度 |
| 点击浮层外部 / Esc | 浮层模式下收起 |
| 浮层模式连接成功 | 自动收起 |

### 3.4 空状态

- 没有任何 SSH 配置：显示「尚未配置 SSH 服务器」，并提示通过顶部「配置和连接」创建；
- 有配置但搜索无结果：显示「没有匹配的服务器」。

---

## 4. 数据与过滤规则

使用 `ProfilesService` 的公开 API：

```ts
const groups = await profilesService.getProfileGroups({
  includeProfiles: true,
  includeNonUserGroup: true, // 包含 “未分组” 与 “内置” 分组
})
```

每个分组的配置经过以下过滤：

1. `profile.type === 'ssh'`（只列 SSH 服务器）；
2. `!profile.isTemplate`（排除 “SSH connection” 模板）；
3. 不在 `config.store.profileBlacklist` 中；
4. 过滤后为空的分组不显示。

说明：从 `~/.ssh/config` 导入的配置带有 `isBuiltin = true`，但属于真实服务器，因此**保留**；
只有模板配置被排除。分组排序为：未分组在前，用户分组按名称排序，内置分组在后。

连接动作：

```ts
const tab = await profilesService.openNewTabForProfile(profile)
if (!tab) { /* 提示无法打开 */ }
```

打开成功后由 Tabby 正常的 Tab 体系接管，插件不关心终端生命周期。

### 刷新时机

- 应用 `ready$` 后首次加载；
- `config.changed$` 触发时重新读取分组；
- 侧栏从收起状态展开时重新读取一次。

---

## 5. 技术架构

### 5.1 文件结构

```
tabby-sidebar/
├── DESIGN.md
├── package.json
├── tsconfig.json
├── webpack.config.js
└── src/
    ├── index.ts                        # NgModule 入口
    ├── typings.d.ts                    # *.html / *.css 类型声明
    ├── layout/
    │   ├── sidebar-mount.service.ts    # DOM 挂载与组件创建
    │   ├── server-sidebar.component.ts
    │   ├── server-sidebar.component.html
    │   └── server-sidebar.component.css
    └── models/
        └── sidebar-state.ts            # 持久化状态类型与默认值
```

### 5.2 启动与挂载

插件模块与其他 Tabby 插件一样通过根模块导入。应用就绪后：

1. 等待 `app-root .window` 与 `app-root .window > .content.main` 出现；
2. 创建 `<tabby-server-sidebar>` 宿主节点并插入到 `.content.main` 之前；
3. 通过 `ComponentFactoryResolver.resolveComponentFactory()` 创建组件；
4. `ApplicationRef.attachView()` 纳入变更检测；
5. 为 `.window` 设置 `position: relative`，供浮层模式定位。

```ts
const factory = resolver.resolveComponentFactory(ServerSidebarComponent)
const ref = factory.create(injector, [], hostElement)
appRef.attachView(ref.hostView)
ref.changeDetectorRef.detectChanges()
```

这与 Tabby 自身 `TabsService` 动态创建 Tab 组件的方式一致，可解析插件的声明组件。

### 5.3 布局与样式注入

组件模板与样式在构建时通过 `asset/source` 读取为字符串，直接写入 `@Component`：

```ts
@Component({
  selector: 'tabby-server-sidebar',
  template: TEMPLATE,
  styles: [STYLES],
})
```

避免 Angular JIT 在运行时通过 XHR 加载 `templateUrl` / `styleUrls`（外部插件没有对应的静态资源服务）。
样式保留 Angular 默认的 emulated 封装；`:host(.overlay)`、`:host(.collapsed)` 控制外壳状态。

### 5.4 状态持久化

`localStorage` 键：`tabby-server-sidebar:state`

```ts
interface SidebarState {
  pinned: boolean
  collapsed: boolean
  width: number
  groupCollapsed: Record<string, boolean>
}
```

默认值：`pinned: true`、`collapsed: false`、`width: 288`。
写入前对宽度做 220–480 的夹取；读取失败或字段缺失时回落到默认值。

### 5.5 主题与平台适配

- 颜色全部取 Tabby 主题变量，自动适配亮/暗主题；
- 使用 Font Awesome 6 图标（Tabby 已内置）；
- `profile-icon` 组件复用 `TabbyCoreModule` 导出的 `ProfileIconComponent`，支持普通图标与 HTML/SVG 图标；
- 注入 `HostAppService`、`HostWindowService`、`ConfigService`，在以下条件给宿主加 `mac-inset`：
  `macOS` + 非全屏 + `appearance.frame === 'thin'`；监听窗口 resize 更新。

---

## 6. 构建与安装

### 构建

```bash
npm install
npm run build        # 输出 dist/index.js
npm run typecheck    # TypeScript 检查
```

Webpack 配置：`target: node`、`libraryTarget: commonjs2`，将 `@angular/*`、`rxjs`、`tabby-*`
与 Node 内置模块设为 external，由 Tabby 宿主提供。

### 安装到 Tabby

方式一（本地开发）：将本目录链接到 Tabby 插件目录后重启：

```bash
npm install
npm run build
ln -s "$PWD" "$HOME/Library/Application Support/tabby/plugins/node_modules/tabby-sidebar"
```

方式二（分发）：`npm pack` 生成 tarball，在 Tabby 设置 → 插件 → 从文件安装。

> 仓库已提交构建产物 `dist/`，无需构建即可直接安装；修改源码后需重新执行 `npm run build`。

---

## 7. 测试计划

### 构建与静态检查

- [x] `npm run typecheck` 无错误；
- [x] `npm run build` 产出 `dist/index.js`；
- [x] 检查产物中 Angular/tabby-* 仍为 external，未被打包。

### 功能验证（真实 Tabby 窗口）

- [x] 启动后左侧出现服务器侧栏，顶部按钮保持原样；
- [x] 服务器列表仅显示 SSH 配置，分组与折叠正确（telnet 配置已排除）；
- [x] 单击服务器打开新的 SSH Tab；
- [x] 固定模式下侧栏挤占布局，连接后不收起；
- [x] 浮动模式下侧栏覆盖终端，点击外部/Esc/连接后收起；
- [x] 收起后控制柄可展开；刷新窗口后固定、收起、宽度、分组状态保留；
- [x] 拖动右边缘可调整宽度且被持久化；
- [x] 搜索按名称与 `user@host` 过滤，搜索无结果时显示空状态；
- [ ] 浅色主题、全屏模式下的显示效果（已完成 macOS thin frame + 深色主题验证）；
- [ ] 打开设置/编辑配置等弹窗时，侧栏不遮挡弹窗。

### 回归检查

- [ ] 顶部「配置和连接」按钮及原有命令不受影响；
- [ ] Tabby 原生 `showProfileTree` 开启时两个侧栏可共存（不崩溃）；
- [ ] 未安装 tabby-ssh 时插件正常加载，显示空状态。

> 验证环境：Tabby 1.0.238（Electron 43.7 / Angular 15.2.10，macOS），通过独立的
> `TABBY_CONFIG_DIRECTORY` / `TABBY_PLUGINS` / `--user-data-dir` 启动测试实例，
> 未影响用户日常配置。手动检查项（浅色主题、全屏、弹窗层级、原生侧栏共存、
> 未安装 SSH 插件）建议在发布前补测。

---

## 8. 风险与后续

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 非官方 DOM 挂载点 | Tabby 升级后 `.window` / `.content.main` 结构可能变化 | 挂载前检测选择器，失败时记录日志并放弃挂载，不影响 Tabby 启动 |
| JIT 动态组件创建 | 组件工厂解析失败会报错 | 与核心 `TabsService` 使用同一机制；构建后做真机验证 |
| `localStorage` 状态损坏 | 侧栏状态异常 | 解析失败即使用默认值 |
| 原生 profile-tree 同时开启 | 出现两份列表 | 允许共存；文档说明可关闭原生侧栏 |
| macOS 标题栏/全屏差异 | 顶部留白或拖拽区不准确 | 复用原生 `mac-inset` 规则，并监听 resize |
| 主题差异 | 某些自定义主题变量缺失 | 只使用 Tabby 长期存在的主题变量 |

后续可扩展（不在本次范围）：最近连接置顶、当前 Tab 高亮、自定义宽度/快捷键、按分组过滤等。
