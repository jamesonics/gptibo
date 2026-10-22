# 初构 · Firstform Lab

**把技术做成实验，把实验整理成方法。**

初构是一个个人学习实验室。我们在建设网站的过程中理解前端、后端、数据库、部署与 Agent 协作，再把观察与实践整理成知识树、教程和可交互实验。

[实现与内容维护](docs/firstform-lab.md) · [Workers 部署](docs/cloudflare-workers.md) · [验证工作流](.github/workflows/verify.yml) · [MIT License](LICENSE)

## 浏览方式

首页选择学习领域，进入该领域的知识树，展开章节，再进入具体教程。

| 领域 | 页面 |
| --- | --- |
| 前端与交互 | `/learn/frontend` |
| 后端与接口 | `/learn/backend` |
| 数据与存储 | `/learn/data` |
| 部署与工程 | `/learn/engineering` |
| 与 Agent 协作 | `/learn/agents` |

首篇教程为[一个页面为什么看起来舒服](https://jiaotonai.cc/learn/frontend/comfortable-page)，包含信息层级对比、留白调节、实践建议和 Agent 任务描述。其他内容按实际学习逐步补充，当前未发布的节点标为“规划中”。

## 当前实现

- React 19、TypeScript 和 Vite 实现公共学习页面，沿用现有 Tailwind 与组件基础。
- 清爽的领域卡片、可展开知识树、阅读页、亮暗色外观与手机布局。
- 独立 URL、深链接刷新、前进后退及知识树展开状态恢复。
- 学习内容当前随源码发布，不需要新增数据库表。
- Cloudflare Workers 提供部署与已有 API，D1 保留现有数据与健康检查。
- 原有后台、邮件验证与协议适配代码保留供学习，所有真实交易及交易测试开关保持关闭。

Logo 与领域插图是第一版视觉资产，后续会继续共同打磨。

## 本地运行

使用已验证的 Node.js 22.20+，或项目 CI 使用的 Node.js 24，并准备 npm、Git 与 Python 3。

```sh
npm ci
test -e .dev.vars || cp .dev.vars.example .dev.vars
npm run worker:migrate:local
npm run preview:worker
```

访问 `http://127.0.0.1:8787`。仅调试学习页面时也可以运行 `npm run dev`，默认访问 `http://127.0.0.1:5173`。

已有 `.dev.vars` 必须保留。生产配置放在被忽略的 `wrangler.production.jsonc`，沿用已经创建的 Worker 与 D1。按[部署文档](docs/cloudflare-workers.md)完成远程预检和发布，密钥、配置与数据库不入 Git。

## 代码入口

```text
src/learning/          学习首页、知识树、教程、视觉与导航
src/lib/branding.ts    前端展示品牌
src/admin/            既有管理工作台
src/partner/          既有代理工作台
worker/               Workers API 与协议学习代码
migrations/            D1 迁移
emails/               系统邮件模板
tests/                业务与学习站回归测试
docs/                 学习站说明与部署文档
services/storefront/  原项目 Go + PostgreSQL 后端，保留为研究材料
```

公共学习站入口在 `src/Root.tsx`。原商城 `src/App.tsx` 保留为源码研究材料，公共入口已替换；旧商品、订单和推广页面书签会进入学习首页。`/admin`、`/partner`、`/join` 保留既有工作台，不出现在公共学习导航中。

## 开发验证

```sh
npm test
npm run lint
npm run security:scan
npm run worker:dry-run
```

验证工作流还包含新数据库迁移检查、凭据扫描及原 Go 后端测试。自动化交易测试使用隔离数据库和 Mock，不使用真实支付、供货商或生产凭据。公共学习页面的人工验收覆盖路由、返回状态、交互实验、窄屏、亮暗色和键盘操作。

新增文章的目录关系、正文与发布步骤见[维护说明](docs/firstform-lab.md)。

## 项目来源

本项目基于 [GPTibo](https://github.com/CoolkHz/gptibo)（MIT）演进。原项目的界面、状态处理、身份验证和协议实现是学习与分析素材；后续方向是个人技术实验室，不接入真实支付或供货商，不产生真实交易。

代码保留原有开源许可与来源说明。第三方标志和美术资源的来源分别见[品牌素材说明](public/brands/README.md)与[第三方样式说明](src/styles/vendor/README.md)。
