# Tabby 服务器侧边栏插件设计

> 包名：`tabby-sidebar` · 目标版本：Tabby 1.0.2xx（Angular 15）
>
> 范围：在 Tabby 主窗口左侧提供常驻的 SSH 服务器列表，双击即可连接；同一侧栏内通过顶部
> 「服务器 / SFTP」切换按钮提供 SFTP 文件浏览，并提供对应的插件设置页。
>
> SFTP 部分参考 `tabby-better-sidebar` 的交互与设置项，只借鉴文件浏览能力：不引入其收藏、工作区、
> 隧道、代码片段、内置传输面板等功能。明确不做：不移除/修改顶部「配置和连接」按钮，不集成 SFTP+。

---

## 1. 背景与目标

Tabby 默认界面只有顶部的标签栏和「配置和连接」按钮，查看已有服务器需要先打开配置页。
本插件希望在保留现有 UI 与命令体系的前提下，增加一个常驻左栏：

1. 列出已保存的 SSH 服务器，按 Tabby 的配置分组展示；
2. 双击服务器直接打开连接 Tab；
3. 侧边栏停靠在主窗口左侧，始终占据布局空间，不自动隐藏；
4. 通过设置 → 通用 → 「显示侧边栏」整体显示/隐藏侧边栏，行为与 `tabby-better-sidebar` 一致；
5. 记住侧栏宽度和分组折叠状态；
6. 适配 Tabby 主题色与 macOS 细边框（thin frame）窗口；
7. 侧栏顶部提供「服务器 / SFTP」切换按钮，SFTP 视图浏览当前活动 SSH 会话的文件系统；
8. SFTP 视图跟随活动 SSH Tab：每个会话缓存一个文件面板并记住浏览路径；会话失效时显示占位，
   可按配置自动切回服务器列表；
9. 提供插件设置页：通用（显示侧边栏、隐藏 Tabby 原生传输菜单）、功能（SFTP 视图开关与显示选项）；
10. 不引入参考插件的收藏、工作区、隧道、代码片段、传输列表等其余能力。

### 非目标

- 不删除或重排顶部工具栏按钮；
- 不修改 Tabby 核心源码，不依赖私有命令；
- 不集成 SFTP+；SFTP 能力直接基于 `tabby-ssh` 的 `SFTPPanelComponent` 扩展；
- 不提供服务器的新增、编辑、删除功能（仍由 Tabby 原有配置界面负责）；
- 不做多窗口之间实时同步（每个窗口独立挂载侧边栏，配置变更后各自刷新）。

---

## 2. 可行性结论

Tabby 没有官方的「侧边栏扩展」API，但外部插件可以在应用就绪后，将组件挂载到
`app-root .window` 下（与原生 `profile-tree` 同级），通过公开服务读取配置并打开连接。

| 方案 | 说明 | 结论 |
| --- | --- | --- |
| 开启原生 `showProfileTree` | 原生配置目录树；需双击启动、无法整体隐藏、混杂所有类型配置 | 不满足需求 |
| 修改 Tabby 核心模板 | 可直接增加布局区域，但需要维护 fork，升级成本高 | 不采用 |
| 插件挂载自定义组件 | 不改核心，只用公开的服务与 DOM 结构 | **采用** |
| 插件替换/嵌入 SFTP+ | 依赖 SFTP+ 私有声明，且已明确不做 | 不采用 |
| 子类化 `tabby-ssh` 的 `SFTPPanelComponent` | 复用原生 SFTP 通道、文件操作与右键菜单，只替换模板 | **采用** |
| 自建 SFTP 协议客户端 | 重复实现传输、权限、符号链接等细节，维护成本高 | 不采用 |

SFTP 视图不是独立窗口，而是侧栏内的第二种模式：顶部切换按钮在「服务器列表 / SFTP 文件浏览」
之间切换。文件面板通过 `session.openSFTP()` 取得当前 SSH 会话的 SFTP 通道，不额外建立连接。

侧边栏挂在 `.window` 内、`.content.main` 之前，作为 flex 子项挤占主内容宽度；关闭「显示侧边栏」后
宿主元素变为 `display: none`，主内容自动占满窗口。Tabby 的模态框层级（Bootstrap modal）高于侧边栏，
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
- 背景在主题底色上混入 10% 前景色，呈深灰色，与纯黑终端区形成可见分界；
- macOS thin frame 下增加顶部留白与拖拽区，避免遮挡红绿灯按钮；
- 侧栏可见时，标签栏紧随侧栏，原 macOS 红绿灯留白被隐藏；关闭显示开关后恢复。

### 3.2 显示状态

| 设置「显示侧边栏」 | 表现 |
| --- | --- |
| 开（默认） | 停靠在左侧，占据布局宽度，终端区域相应变窄 |
| 关 | 侧边栏从布局中移除，终端占满宽度；可在设置中重新打开 |

### 3.3 操作

| 操作 | 结果 |
| --- | --- |
| 双击服务器 | 调用 Tabby 的 profile 打开逻辑新建连接 Tab |
| 设置 → 通用 → 显示侧边栏 | 整体显示/隐藏侧边栏，修改即时生效 |
| 单击分组标题 | 折叠/展开该分组 |
| 搜索框输入 | 按名称、`user@host:port` 实时过滤；搜索时忽略分组折叠 |
| 拖动右边缘 | 调整并保存宽度 |

### 3.4 空状态

- 没有任何 SSH 配置：显示「尚未配置 SSH 服务器」，并提示通过顶部「配置和连接」创建；
- 有配置但搜索无结果：显示「没有匹配的服务器」。

### 3.5 视图切换与 SFTP 浏览

顶部「服务器 / SFTP」分段按钮仅在功能设置中启用 SFTP 视图时显示：

| 操作 | 结果 |
| --- | --- |
| 点击「服务器」 | 显示搜索框与服务器列表 |
| 点击「SFTP」 | 绑定当前活动 SSH Tab，显示文件浏览面板 |
| 当前 Tab 不是 SSH（如设置页） | 显示「未选择 SSH 会话」，切回 SSH Tab 后面板恢复 |
| 没有任何活动 SSH 会话 | 显示「没有活动的 SSH 会话」占位和「返回服务器列表」按钮 |
| 绑定会话断开/关闭 | 占位提示会话已断开；开启自动返回后在 2.5 秒宽限期后切回服务器列表 |
| 切换 SSH Tab | 每个 Tab 使用独立面板与路径缓存，互不影响 |

SFTP 面板内的操作沿用 `tabby-ssh` 原生能力：双击进入目录/打开文件、右键菜单、上传文件/文件夹、
新建目录、路径编辑、过滤、刷新；显示层额外支持隐藏文件过滤、文件夹优先、日期格式与自动刷新。

### 3.6 插件设置页

设置 → 服务器侧边栏，分为「通用」「功能」两个子页：

| 分组 | 设置项 | 默认值 | 说明 |
| --- | --- | --- | --- |
| 通用 | 显示侧边栏 | 开 | 关闭后侧边栏从布局中移除，修改即时生效 |
| 通用 | 隐藏 Tabby 的传输菜单 | 关 | 隐藏标签栏中的原生传输下拉菜单 |
| 功能 | SFTP 视图 | 开 | 显示侧栏顶部切换按钮与 SFTP 浏览 |
| 功能 | 自动刷新间隔（秒） | 0 | 0 表示关闭；范围 0–3600 |
| 功能 | 显示隐藏文件 | 开 | 是否显示以 `.` 开头的条目 |
| 功能 | 文件夹优先 | 开 | 目录排在文件之前，其余按名称排序 |
| 功能 | 没有 SSH 会话时返回服务器列表 | 开 | 会话断开 2.5 秒后自动返回列表 |
| 功能 | 日期格式 | 跟随 Tabby 语言 | 可选 跟随语言 / 日/月/年 / ISO 8601 |

「隐藏 Tabby 的传输菜单」默认关闭：本插件没有自己的传输进度面板，关闭时用户仍可在原生菜单中
查看上传/下载进度。启用后通过 `body.tabby-sidebar-hide-transfers` 全局类隐藏原生菜单，选择器与
参考插件一致（`.btn-group.background > div[ngbDropdown]`、`transfers-menu`）。

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
- 「显示侧边栏」从关闭切回开启时重新读取一次。

### SFTP 会话绑定规则

目标会话取 `AppService.activeTab`；若是 `SplitTabComponent`，取 `getFocusedTab()`。用结构化类型判断会话可用：

```ts
tab.sshSession?.open === true
&& tab.session != null
&& typeof tab.openSFTP === 'function'
```

这样不依赖 `tabby-ssh` 是否导出 `SSHTabComponent` 类型，也避免重复模块实例导致 `instanceof` 失效。
面板在以下时机同步绑定：

- `activeTabChange$`、`tabsChanged$`、`tabClosed$`、`tabRemoved$`；
- 每秒一次的低频轮询（覆盖会话内部状态变化）；
- SFTP 模式被打开时。

每个 SSH Tab 缓存一个 `SftpBrowserComponent` 实例与最近路径：切走时从 DOM 分离并暂停自动刷新，
切回时恢复。Tab 关闭或会话对象变化时销毁实例。SFTP 通道没有独立关闭方法，会随 SSH 会话结束而失效。

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
    ├── index.ts                        # NgModule 入口、Provider 注册
    ├── config-provider.ts              # tabbySidebar 配置项与默认值
    ├── typings.d.ts                    # *.html / *.css 类型声明
    ├── layout/
    │   ├── sidebar-mount.service.ts    # DOM 挂载、全局样式注入
    │   ├── server-sidebar.component.ts # 列表、视图切换、显示开关、传输菜单显隐
    │   ├── server-sidebar.component.html
    │   └── server-sidebar.component.css
    ├── sftp/
    │   ├── sftp-view.component.ts      # 会话解析、面板缓存、自动返回
    │   ├── sftp-view.component.html
    │   ├── sftp-view.component.css
    │   ├── sftp-browser.component.ts   # 继承 SFTPPanelComponent，自定义显示选项
    │   ├── sftp-browser.component.html # 紧凑侧栏布局
    │   └── sftp-browser.component.css
    ├── settings/
    │   ├── settings-tab.provider.ts    # SettingsTabProvider 注册
    │   ├── settings-tab.component.ts
    │   ├── settings-tab.component.html
    │   └── settings-tab.component.css
    └── models/
        └── sidebar-state.ts            # 持久化状态类型与默认值
```

### 5.2 启动与挂载

插件模块与其他 Tabby 插件一样通过根模块导入。应用就绪后：

1. 等待 `app-root .window` 与 `app-root .window > .content.main` 出现；
2. 创建 `<tabby-server-sidebar>` 宿主节点并插入到 `.content.main` 之前；
3. 通过 `ComponentFactoryResolver.resolveComponentFactory()` 创建组件；
4. `ApplicationRef.attachView()` 纳入变更检测。

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
样式保留 Angular 默认的 emulated 封装；`:host(.hidden)` 控制侧栏显隐，`:host(.mac-inset)` 处理 macOS 顶部留白。

### 5.4 状态持久化

`localStorage` 键：`tabby-server-sidebar:state`

```ts
interface SidebarState {
  width: number
  groupCollapsed: Record<string, boolean>
}
```

默认值：`width: 288`。写入前对宽度做 220–480 的夹取；读取失败或字段缺失时回落到默认值。
旧版本写入的 `pinned` / `collapsed` 字段会被忽略，不影响加载。显示与否由配置项
`tabbySidebar.showSidebar` 控制，与窗口状态无关。

### 5.5 主题与平台适配

- 颜色全部取 Tabby 主题变量，自动适配亮/暗主题；侧栏背景由主题底色混入 10% 前景色；
- 使用 Font Awesome 6 图标（Tabby 已内置）；
- `profile-icon` 组件复用 `TabbyCoreModule` 导出的 `ProfileIconComponent`，支持普通图标与 HTML/SVG 图标；
- 注入 `HostAppService`、`HostWindowService`、`ConfigService`，在以下条件给宿主加 `mac-inset`：
  `macOS` + 非全屏 + `appearance.frame === 'thin'`；监听窗口 resize 更新；
- 侧边栏可见时给 `.window` 加 `tabby-sidebar-docked` 类，并注入一条全局样式隐藏
  `.tab-bar > .inset.background`（macOS 红绿灯留白）；关闭显示开关或插件销毁时移除该类。

### 5.6 SFTP 视图

`SftpBrowserComponent` 继承 `tabby-ssh` 的 `SFTPPanelComponent`，复用其 `open()`、`upload()`、
`openCreateDirectoryModal()`、`showContextMenu()`、`navigate()` 等实现，只提供侧栏尺寸的模板与样式。
构造函数把 `NgbModal`、`NotificationsService`、`PlatformService` 与可选的右键菜单 Provider 传给父类。

显示增强在子类内完成，不修改继承实现：

- `visibleFileList`：自行实现过滤，避免依赖较新 Tabby 才有的 `filteredFileList`；
- `applyDisplayOptions()`：隐藏文件过滤、文件夹优先排序；
- `formatDate()`：`locale` / `dmy` / `iso` 三种格式；
- `startAutoRefresh()`：按配置周期性 `navigate(path, false)`；
- 上传、新建目录、打开文件等操作捕获异常并通过通知提示。

`SftpViewComponent` 负责生命周期：动态创建面板、`ApplicationRef.attachView()`、把根节点挂到
`.sftp-panel-host`；切走时 `detachView()` 并移除节点。面板按 SSH Tab 缓存，避免重复打开 SFTP 通道。

### 5.7 配置与设置页注册

```ts
providers: [
  { provide: ConfigProvider, useClass: TabbySidebarConfigProvider, multi: true },
  { provide: SettingsTabProvider, useClass: TabbySidebarSettingsTabProvider, multi: true },
]
```

配置命名空间为 `config.store.tabbySidebar`，默认值见 3.6 表格。设置组件监听 `config.changed$`，
写入后调用 `config.save()`；侧栏与 SFTP 面板同样订阅配置变更，因此修改后即时生效。

### 5.8 隐藏原生传输菜单

启用该设置时给 `document.body` 添加 `tabby-sidebar-hide-transfers`，由挂载服务注入的全局样式隐藏：

```css
body.tabby-sidebar-hide-transfers .btn-group.background > div[ngbDropdown] { display: none !important; }
body.tabby-sidebar-hide-transfers transfers-menu { display: none !important; }
```

关闭设置、侧栏销毁时移除该类。选择器与参考插件一致；若 Tabby 调整标签栏结构，需要同步更新。

---

## 6. 构建与安装

### 构建

```bash
npm install --legacy-peer-deps
npm run build        # 输出 dist/index.js
npm run typecheck    # TypeScript 检查
```

Webpack 配置：`target: node`、`libraryTarget: commonjs2`，将 `@angular/*`、`@ng-bootstrap/*`、
`rxjs`、`tabby-*` 与 Node 内置模块设为 external，由 Tabby 宿主提供。

开发依赖包含 `tabby-ssh`、`tabby-settings` 与 `@ng-bootstrap/ng-bootstrap`：仅用于类型检查和
编译期继承 `SFTPPanelComponent`，运行时不打包。项目使用 TypeScript 5.6，而 Angular 15 的
`@angular/compiler-cli` 声明只支持 TS < 5.0，安装时需加 `--legacy-peer-deps`。

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
- [x] 双击服务器打开新的 SSH Tab，单击不触发连接；
- [x] 侧栏停靠时挤占布局，连接后保持显示；
- [x] 侧栏不再显示固定/收起按钮，也没有收起后的边缘控制柄；
- [x] 设置 → 通用 → 「显示侧边栏」可即时显示/隐藏；隐藏时终端占满宽度、红绿灯留白恢复；
- [x] 重启后显示状态保持（关闭时不显示侧栏），宽度与分组状态保留；
- [x] 拖动右边缘可调整宽度且被持久化；
- [x] 搜索按名称与 `user@host` 过滤，搜索无结果时显示空状态；
- [x] 侧栏可见时隐藏标签栏的 macOS 红绿灯留白；
- [x] 侧栏深灰背景与纯黑主界面边界清晰；
- [ ] 浅色主题、全屏模式下的显示效果（已完成 macOS thin frame + 深色主题验证）；
- [ ] 打开设置/编辑配置等弹窗时，侧栏不遮挡弹窗。

### SFTP 与设置（隔离实例 + 本地 sshd）

- [x] 顶部「服务器 / SFTP」切换正常，服务器列表与 SFTP 面板互斥显示；
- [x] 双击服务器连接后，SFTP 视图绑定当前会话并列出文件（名称、大小、修改日期）；
- [x] 双击目录进入、面包屑返回根目录、手输路径跳转均正常；
- [x] 隐藏文件过滤、文件夹优先、日期格式（locale / ISO 8601）即时生效；
- [x] 自动刷新设为 1 秒后，远端新建文件无需手动刷新即可出现；
- [x] 无活动会话时显示「没有活动的 SSH 会话」；切到设置页时显示「未选择 SSH 会话」，切回 SSH Tab 恢复；
- [x] 关闭全部 SSH 标签后约 2.5 秒自动返回服务器列表；
- [x] 设置页「通用 / 功能」渲染正常，选项写入 `config.yaml` 并即时生效；
- [x] 隐藏原生传输菜单开关正确添加/移除全局类，原生下拉菜单变为 `display: none`；
- [ ] 上传/下载、右键菜单等真实文件写入操作（建议发布前用非测试账号补测）。

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
| `SFTPPanelComponent` 内部 API 变化 | 继承字段/方法在 Tabby 升级后改名或移除 | 固定的 `session`、`navigate`、`open`、`upload` 等核心成员较稳定；发布前对目标 Tabby 版本回归 |
| npm `tabby-ssh` 类型落后于运行时 | 类型检查缺少新字段 | 不使用 `filteredFileList` 等新成员，过滤与显示逻辑在子类自行实现 |
| 传输菜单 DOM 结构变化 | 隐藏设置失效 | 选择器集中在挂载服务的全局样式中，升级时单点调整 |
| SFTP 面板动态挂载 | 面板根节点未纳入变更检测 | 与 Tabby 动态创建 Tab 相同：`attachView` + 手动 append，并在销毁时 `detachView` |

后续可扩展（不在本次范围）：最近连接置顶、当前 Tab 高亮、自定义宽度/快捷键、按分组过滤；
SFTP 侧可增加可排序列、收藏目录、拖拽上传/下载、内置传输进度面板等。
