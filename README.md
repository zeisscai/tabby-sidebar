# Tabby Sidebar

为 [Tabby](https://github.com/Eugeny/tabby) 增加一个常驻左侧的 SSH 服务器侧边栏，并在同一区域集成 SFTP 文件浏览。

- 按 Tabby 的配置分组列出 SSH 服务器，双击直接连接；
- 顶部「服务器 / SFTP」切换按钮，在服务器列表与当前 SSH 会话的文件系统之间切换；
- 通过设置页的开关整体显示或隐藏侧边栏，不提供固定/收起按钮；
- 适配 Tabby 主题色与 macOS 细边框（thin frame）窗口。

> 目标版本：Tabby 1.0.2xx（Angular 15）。已在 Tabby 1.0.238 / Electron 43.7 / macOS 上验证。

## 功能

### 服务器列表

- 仅显示类型为 `ssh` 的配置，排除模板配置和 `profileBlacklist` 中的条目；
- 分组顺序为：未分组、用户分组（按名称）、内置分组；
- 搜索框按名称或 `user@host:port` 实时过滤；
- 双击服务器打开新的连接标签页，单击不触发连接；
- 分组标题可折叠，折叠状态会保留；
- 拖动右侧边缘调整宽度（220–480px，默认 288px）。

### SFTP 浏览

- 复用 Tabby 内置 `tabby-ssh` 的 SFTP 通道与文件操作，不额外建立连接；
- 绑定当前活动的 SSH 标签页；每个会话缓存独立面板和浏览路径；
- 支持双击进入目录/打开文件、右键菜单、上传、新建目录、路径编辑、过滤与刷新；
- 显示选项：隐藏文件过滤、文件夹优先、日期格式（跟随语言 / 日-月-年 / ISO 8601）、定时自动刷新；
- 当前标签页不是 SSH（如设置页）时显示「未选择 SSH 会话」；会话断开时显示占位，并按设置自动返回服务器列表。

## 环境要求

- Tabby 1.0.2xx（Angular 15）；
- SSH 连接与 SFTP 能力来自 Tabby 内置插件 `tabby-ssh`，无需额外安装。

## 安装

### 使用本地安装包

仓库已提交构建产物 `dist/`，打包后可直接安装：

```bash
npm install --legacy-peer-deps   # 仅首次或依赖变化时需要
npm run build
npm pack
```

`npm pack` 会在当前目录生成 `tabby-sidebar-<version>.tgz`。然后在 Tabby 中：

1. 打开 设置 → 插件（Settings → Plugins）；
2. 点击「从文件安装」（Install from file）；
3. 选择生成的 `.tgz` 文件；
4. 完全退出 Tabby（macOS 使用 Cmd+Q）后重新启动。

### 本地开发

```bash
npm install --legacy-peer-deps
npm run build
ln -s "$PWD" "$HOME/Library/Application Support/tabby/plugins/node_modules/tabby-sidebar"
```

重启 Tabby 后生效。修改源码后需要重新执行 `npm run build` 并完全退出、重启 Tabby；插件没有热重载。

## 使用

- 在左侧列表中双击服务器即可连接；
- 侧边栏顶部的「服务器 / SFTP」按钮用于切换视图；
- SFTP 视图跟随当前活动的 SSH 标签页，切换标签页时会恢复该会话上次浏览的路径；
- 没有活动 SSH 会话时，SFTP 视图会显示提示和「返回服务器列表」按钮。

## 设置

设置 → 服务器侧边栏（Settings → Sidebar）：

### 通用

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| 显示侧边栏 | 开 | 关闭后侧边栏从布局中移除，终端占满窗口；再次打开立即恢复 |
| 隐藏 Tabby 的传输菜单 | 关 | 隐藏标签栏中的原生传输下拉菜单 |

### 功能

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| SFTP 视图 | 开 | 显示顶部视图切换按钮与 SFTP 浏览 |
| 自动刷新间隔（秒） | 0 | 定期重新读取当前目录，0 表示关闭；范围 0–3600 |
| 显示隐藏文件 | 开 | 显示以 `.` 开头的条目 |
| 文件夹优先 | 开 | 文件夹排在文件之前，其余按名称排序 |
| 没有 SSH 会话时返回服务器列表 | 开 | 绑定的 SSH 会话断开约 2.5 秒后自动切回服务器列表 |
| 日期格式 | 跟随 Tabby 语言 | 可选：跟随语言 / 日-月-年 / ISO 8601 |

设置保存在 Tabby 的 `config.yaml` 中，命名空间为 `tabbySidebar`。

## 数据与隐私

- 插件不访问网络，也不收集或上传任何数据；
- 侧栏宽度和分组折叠状态保存在 `localStorage`，键为 `tabby-server-sidebar:state`；
- 服务器配置仍由 Tabby 自身管理，插件不新增、修改或删除配置。

## 已知限制

- 侧边栏通过非官方 DOM 挂载点插入 Tabby 布局；Tabby 大幅调整主界面结构后可能需要适配；
- 只列出 SSH 类型的配置，不支持新增、编辑或删除服务器；
- 不集成 SFTP+，也不提供收藏、工作区、隧道、代码片段或内置传输进度面板；
- 每个窗口独立挂载侧边栏，不做多窗口之间的实时状态同步；
- 上传、下载与右键菜单中的文件操作沿用 Tabby 原生实现。

更多设计细节见 [DESIGN.md](DESIGN.md)。

## 开发

```bash
npm run typecheck   # TypeScript 检查
npm run build       # 构建 dist/index.js
npm run watch       # 开发模式监听
```

技术栈：TypeScript、Angular 15、Webpack 5。构建时 `@angular/*`、`@ng-bootstrap/*`、`rxjs` 与 `tabby-*` 均为 external，由 Tabby 宿主提供。

## License

MIT
