# 初构 · Firstform Lab：首版结构与维护

更新：2026-10-22。

初构是个人学习实验室。网站本身是实践成果，内容记录实践中的观察、原理、实验与可复用方法。视觉采用已讨论的清爽留白、统一层次、柔和图形和克制动效；Logo 与领域插图先使用初版，后续继续共同精修。

## 当前可用内容

| 层级 | 地址 | 作用 |
| --- | --- | --- |
| 首页 | `/` | 前端、后端、数据、部署、Agent 协作五个领域入口 |
| 领域知识树 | `/learn/frontend` 等 | 展开章节，区分可阅读文章与规划中内容 |
| 首篇教程 | `/learn/frontend/comfortable-page` | 信息层级、留白、排版对比实验与 Agent 任务描述 |

其他领域路径为 `/learn/backend`、`/learn/data`、`/learn/engineering`、`/learn/agents`。首版只发布第一篇教程，其他节点标记为“规划中”，不生成虚假的文章链接。

页面使用真实 URL。直接访问、刷新、浏览器前进后退均保留路由语义。知识树展开状态保存在浏览器的 `firstform.knowledge-tree.v1`；保存失败时仍可正常使用。文章返回知识树时恢复已展开章节和本次访问中的滚动位置。

## 实现入口

| 文件 | 负责什么 |
| --- | --- |
| `src/Root.tsx` | 公共学习站与既有受保护工作台的入口分流 |
| `src/learning/LearningApp.tsx` | 页面导航、知识树、主题、元信息与滚动恢复 |
| `src/learning/content.ts` | 领域、章节、文章节点及已发布文章的对应关系 |
| `src/learning/routing.ts` | 深链接解析、规划中内容校验和旧商城地址兼容 |
| `src/learning/ComfortablePage.tsx` | 首篇正文与可交互排版实验 |
| `src/learning/DomainArt.tsx` | 当前阶段的 CSS 图形与图标组合 |
| `src/learning/learning.css` | 三页共用的布局、字体、材质、手机适配与减少动效规则 |
| `src/lib/branding.ts`、`emails/brand.ts` | 页面和系统邮件的展示品牌 |

内容当前随代码发布，没有新增 CMS、在线编辑接口或数据库表。后续需要学习内容管理时，再围绕明确需求设计数据模型。已部署的 Workers、D1、管理员身份与邮件配置继续复用。

## 添加内容的顺序

1. 在对应领域的章节中建立内容节点；没有正文时保持规划状态，不填写 `articleId`。
2. 完成正文和有意义的交互实验，在文章注册表中加入领域、章节与文章 ID。
3. 增加对应的正文组件和路由渲染。不要让不同 URL 共用不匹配的正文。
4. 检查目录关系、直接访问、刷新、前进后退、键盘与手机排版，再提交并发布。

每个主题逐步形成“讲解 + 实验 + 可复用说明”。文章中的例子、设计理由和参数需要能够回到实现中核对；未经实现的功能明确写作规划。

## 旧代码与边界

- 原商城界面和支付/供货适配器保留为协议与实现研究材料，公共入口已切换到学习站。
- `/product/*`、`/orders`、`/r/*`、`/s/*` 的旧书签进入学习首页；其他未知页面显示可返回首页的未找到页面。
- `/admin`、`/partner` 和 `/join` 保留既有受保护工作台，未加入学习站的公共导航。
- 所有真实交易及交易测试开关继续为 `false`。不配置真实支付或供货商，不发生真实交易。
- 生产资源名称与展示品牌是独立的。沿用已有的生产 Worker 和 D1，不因为品牌改名新建或删除云端资源。
- 生产配置、密钥、数据库和私密验收记录继续被 Git 忽略。公开文档不记录密钥和云资源 ID。

## 本地开发与验证

```sh
npm ci
test -e .dev.vars || cp .dev.vars.example .dev.vars
npm run worker:migrate:local
npm run preview:worker
```

公共学习内容也可以用 `npm run dev` 单独预览；需要检查后台 API 时同时运行本地 Worker。业务开关以仓库当前学习约束为准，不能为了浏览界面打开交易。

```sh
npm test
npm run lint
npm run security:scan
npm run worker:dry-run
npm run worker:check -- --remote
```

手动验收至少覆盖：五个领域入口、章节展开、正文链接、文章实验、返回时恢复树状态、深链接刷新、浏览器前进后退、亮暗色、窄屏与键盘操作。部署按 `docs/cloudflare-workers.md` 当前学习站步骤执行。
