# GitHub Star Manager

一个本地优先的 GitHub Star 仓库管理工具，基于 Tauri v2 构建，支持标签分类、全文搜索、AI 智能分析。

## 功能特性

- **同步 GitHub Stars** — 一键拉取所有已 Star 的仓库，存储到本地 SQLite 数据库
- **自定义标签** — 为仓库添加自定义分类标签，支持颜色标识
- **全文搜索** — 基于 SQLite FTS5 的全文搜索，支持仓库名、描述、语言等字段
- **多维排序** — 按收藏时间、Stars 数量、更新时间排序，支持升序/降序切换
- **AI 项目分析** — 读取仓库 README 和代码，生成结构化中文总结，自动建议标签
- **仓库笔记** — 为每个仓库添加个人备注，支持自动保存
- **统计面板** — 语言分布、标签分布、Stars 分布、月度收藏趋势可视化
- **GitHub OAuth** — 支持 OAuth 登录或手动 Token 配置
- **深色/浅色主题** — 一键切换

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Tauri v2 |
| 前端 | React 18 + TypeScript |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| 后端 | Rust |
| 数据库 | SQLite + FTS5 全文搜索 |
| AI | 兼容 OpenAI Chat Completions 格式的任意 API |

## 截图

> 首次运行后同步 Stars 即可看到仓库列表

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.70
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/RanceX2023/github-star-manager.git
cd github-star-manager

# 安装前端依赖
npm install

# 开发模式运行
npm run tauri dev

# 打包为桌面应用
npm run tauri build
```

### 配置

1. **GitHub Token** — 首次启动会引导配置，需要 `read:user` 权限的 Personal Access Token
2. **AI 服务（可选）** — 在设置页配置兼容 OpenAI 格式的 API 地址和 Key，支持：
   - DeepSeek: `https://api.deepseek.com/v1`
   - 通义千问: `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - OpenAI: `https://api.openai.com/v1`
   - 本地 Ollama: `http://localhost:11434/v1`

## 项目结构

```
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   ├── hooks/              # 自定义 hooks
│   ├── stores/             # Zustand 状态管理
│   └── lib/                # 工具函数和 Tauri 命令封装
├── src-tauri/              # Rust 后端
│   └── src/
│       ├── commands/       # Tauri 命令（repos, tags, sync, ai, oauth, notes, stats）
│       ├── db/             # SQLite 数据库初始化
│       ├── github/         # GitHub API 客户端
│       └── models/         # 数据模型
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

## AI 分析功能

点击仓库卡片上的 **AI** 按钮，系统会：

1. 获取仓库 README.md
2. 如果 README 信息不足，自动读取项目文件树和关键代码文件
3. 调用 AI 生成结构化分析（功能、技术栈、适用场景、亮点）
4. 建议分类标签，优先复用已有标签
5. 支持一键应用建议标签

## 数据存储

所有数据存储在本地：
- **Windows**: `%LOCALAPPDATA%/github-star-manager/stars.db`
- **macOS**: `~/Library/Application Support/github-star-manager/stars.db`
- **Linux**: `~/.local/share/github-star-manager/stars.db`

## License

MIT
