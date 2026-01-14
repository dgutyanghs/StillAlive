# 🧓 死了吗 (Are You Alive) - 老人平安签到系统

一个基于 Cloudflare Workers + Resend 的极简老人平安签到方案。解决老人不会用复杂 App 的痛点，子女通过邮件推送实时获取老人安全状态。

## 🌟 核心功能

-   **老人端**：极简大按钮设计，一键上报地理位置与平安信息。
-   **子女端**：实时监控面板，显示今日签到时间及位置；若下午 6 点（18:00）未签到，自动触发红色预警。
-   **邮件通知**：利用 Resend 服务，签到成功后自动推送 HTML 精美邮件到子女邮箱。由于手机邮箱（如 Gmail, QQ 邮箱）具有高优先级的后台推送权限，能确保子女第一时间收到提醒。

## 🛠️ 技术栈

-   **Runtime**: Cloudflare Workers
-   **Storage**: Cloudflare Workers KV (用于存储每日记录)
-   **Email**: Resend API
-   **UI**: Vanilla JS + CSS (毛玻璃设计风格)

## 🚀 部署步骤

### 1. 准备工作

-   注册一个 [Cloudflare](https://dash.cloudflare.com/) 账号。
-   注册一个 [Resend](https://resend.com/) 账号并获取 API Key。

### 2. 配置 Cloudflare Workers

1.  创建一个新的 Worker，将 `areyoualive.js` 的内容粘贴进去。
2.  在 Worker 的 **Settings -> Variables** 中添加以下环境变量：
    -   `RESEND_APIKEY`: 你的 Resend API Key。
3.  在 Worker 的 **Settings -> Bindings** 中添加一个 **KV Namespace**：
    -   Variable name: `ARE_YOU_ALIVE_STATUS`
4.  保存并部署。

### 3. 修改配置

在 `areyoualive.js` 的顶部 `CONFIG` 对象中修改：

```javascript
const CONFIG = {
  KV_TTL: 86400,
  NOTIFY_EMAIL: 'your-email@example.com', // 接收通知的子女邮箱
  REMIND_HOUR: 18 // 预警时间（24小时制）
}
```

## 📱 访问方式

-   **老人签到页**：`https://your-worker.workers.dev/`
-   **子女监控页**：`https://your-worker.workers.dev/child`

## 💡 为什么叫这个名字？

起名源于近期 App Store 付费榜的热门创意。它虽然名字听起来硬核，但初衷是温暖的——利用最基础、最可靠的互联网技术（邮件及网页），给独居老人一份简单的守护。

## 📄 开源协议

MIT License
