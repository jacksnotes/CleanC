# CleanC - 智能C盘空间管理工具 | Smart C Drive Space Manager

<p align="center">
  <img src="public/logo.png" alt="CleanC Logo" width="128" height="128">
</p>

<p align="center">
  <strong>🇨🇳 可视化分析 + 一键清理，让C盘管理变得简单</strong><br>
  <strong>🇬🇧 Visual Analysis + One-Click Cleanup for Easy C Drive Management</strong>
</p>

<p align="center">
  <a href="#功能特性--features">功能 Features</a> •
  <a href="#快速开始--quick-start">开始 Start</a> •
  <a href="#开发指南--development">开发 Dev</a> •
  <a href="#联系作者--contact">联系 Contact</a> •
  <a href="#支持项目--support">支持 Support</a>
</p>

---

## 功能特性 | Features

### 🔍 磁盘空间可视化 | Disk Visualization
- 🇨🇳 实时显示C盘使用情况，Treemap 图形化展示空间分布
- EN Real-time C drive usage display with Treemap visualization

### 🧹 智能清理 | Smart Cleanup
- 🇨🇳 自动识别可清理项目（临时文件、缓存、日志等），安全分级提示
- EN Auto-detect cleanable items (temp files, cache, logs) with safety ratings

### 📊 大文件分析 | Large File Analysis
- 🇨🇳 全盘扫描大文件，智能删除建议
- EN Full disk scan for large files with smart deletion suggestions

### ♻️ 恢复区 | Recovery Zone
- 🇨🇳 已删除文件临时存储，支持一键恢复，防止误删
- EN Temporary storage for deleted files with one-click recovery

### 🌐 多语言 | Multilingual
- 简体中文 | English

---

## 快速开始 | Quick Start

### 安装 | Installation
1. 🇨🇳 从 [Releases](https://github.com/jacksnotes/CleanC/releases) 下载最新安装包
2. EN Download the latest installer from [Releases](https://github.com/jacksnotes/CleanC/releases)

### 使用 | Usage
1. 🇨🇳 启动 CleanC → 点击「开始扫描」→ 选择清理项 → 点击「开始清理」
2. EN Launch CleanC → Click "Start Scan" → Select items → Click "Clean"

> **提示 | Tip**: 🇨🇳 部分系统文件需要管理员权限，点击右上角「提升权限」| EN Some system files require admin rights, click "Elevate" in the top-right corner.

---

## 开发指南 | Development

### 环境要求 | Requirements
- Node.js >= 18.0
- npm >= 9.0

### 命令 | Commands
```bash
# 安装依赖 | Install dependencies
npm install

# 开发模式 | Development mode
npm run electron:dev

# 构建安装包 | Build installer
npm run build
```

---

## 技术栈 | Tech Stack

| 类别 Category | 技术 Technology |
|---------------|-----------------|
| 前端 Frontend | Vue 3 + TypeScript |
| 构建 Build | Vite |
| 桌面 Desktop | Electron |
| 图表 Charts | ECharts |
| 打包 Package | electron-builder |

---

## 项目结构 | Project Structure

```
CleanC/
├── electron/          # Electron 主进程 | Main process
├── src/               # Vue 前端代码 | Frontend code
├── public/            # 公共资源 | Public assets
├── build/             # 构建配置 | Build config
└── package.json
```

---

I'm a novice developer who loves to tinker🙏

## 贡献 | Contributing

欢迎贡献代码！如果您想提供帮助或了解当前正在进行的工作，请查看 [open issues](https://github.com/jacksnotes/CleanC/issues) 和 [project roadmap](https://github.com/jacksnotes/CleanC/projects) 来了解项目的当前方向并找到贡献的方式。

Contributions are welcome! If you'd like to help out or see what's currently being worked on, take a look at the [open issues](https://github.com/jacksnotes/CleanC/issues) and the [project roadmap](https://github.com/jacksnotes/CleanC/projects) to understand the current direction of the project and find ways to contribute.

---

## 联系作者 | Contact

<p align="center">
  <a href="https://x.com/huataiceo"><img src="https://img.shields.io/badge/X-@huataiceo-000000?style=for-the-badge&logo=x&logoColor=white" alt="X (Twitter)"></a>
  <a href="https://www.facebook.com/huataixh"><img src="https://img.shields.io/badge/Facebook-huataixh-1877F2?style=for-the-badge&logo=facebook&logoColor=white" alt="Facebook"></a>
</p>

---

## 支持项目 | Support

如果这个项目对您有帮助，欢迎请作者喝杯咖啡 ☕

If this project helps you, consider buying the author a coffee ☕

<p align="center">
  <img src="public/image/wechat_pay.jpg" alt="微信支付 WeChat Pay" width="200">
  <img src="public/image/paypal.jpg" alt="PayPal" width="200">
</p>

---

## 许可证 | License

[MIT License](LICENSE)

---

<p align="center">Made with ❤️ by <a href="https://github.com/jacksnotes">jacksnotes</a></p>
