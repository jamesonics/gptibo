# 初构 · Firstform Lab 部署方案：Cloudflare Workers + D1

更新日期：2026-10-22。适用于本仓库的 Workers 实现，所有命令从当前仓库根目录执行。

## 当前学习站发布范围

公共入口现为「初构 · Firstform Lab」，包含学习领域首页、领域知识树和教程实验。实现与内容维护见 [firstform-lab.md](firstform-lab.md)。已有生产部署继续使用原 Worker、D1、自定义域名和 Secrets，不为了展示名称变化创建新的云资源。

当前项目使用 Workers 免费计划，生产配置省略 `limits.cpu_ms`。所有真实购买与交易测试开关保持 `false`；`workers.dev` 和预览 URL 保持关闭。本文保留的历史收款、供货和交易验收内容仅作为协议研究资料，不作为本学习项目的执行计划。

本次学习内容随静态构建发布，无新增数据库迁移。日常更新的顺序为：

```sh
npm test
npm run lint
npm run security:scan
npm run worker:dry-run
npm run worker:check -- --remote
# 完成代码提交与推送后发布：
npm run worker:deploy
```

发布后检查 `/`、`/learn/frontend`、`/learn/frontend/comfortable-page`、`/api/health`、后台初始化状态及交易关闭状态，并记录 Worker version ID 和代码提交。只有新增迁移时才执行生产迁移；迁移前遵循备份要求。

## 1. 部署范围与当前状态

架构：React 静态资源 + Workers API + D1 数据库 + Cron 补偿任务。邮件由 Resend 发送，收款与实际交付依赖自己的支付商和供货商。

本次兼容修复包括：

- 登录、下单的验证配置接口；可选 Turnstile 服务端验证，未开启时正常使用原有邮箱/TOTP 验证。
- 商品及开票付款页的支付方式加载，支付宝选项与金额/手续费校验。
- 代理订单搜索与详情、收款信息绑定、提现时的收款信息版本校验。
- Workers 专属单店铺设置，支持商品排序、上下架、售价、公告、联系方式。
- 邮件和通知中的域名配置、定时任务、健康检查、生产部署预检。

Workers 当前可使用商城、管理后台、单层代理、订单、退款、统计、客户管理、开票记录及现有供应商适配器。前端会隐藏尚未实现的多店铺/代理自定义域名、分级代理、工单、安全事件审计、代理订单通知配置和质保策略开关。后台收款状态可查看，商户配置与收款开关由部署配置管理。开票接口管理申请和手续费，不等于已经接入真实开票服务。

本次没有创建你的 Cloudflare 资源、发送真实邮件、充值供应商余额或发起真实支付。供应商接口仍需按实际协议验收。仓库不包含独立供货平台和实际执行充值的系统。

## 2. 先选清楚收款与交付路径

| 商品/路径 | 收款 | 交付 | 当前支持情况 |
| --- | --- | --- | --- |
| ChatGPT 充值（Recharge） | 供货平台代收 | 平台 API 自动充值 | 仅 `platform_collect`；需对接兼容供应商 |
| Gmail、Gemini、多邻国、X 赠送 | 你自己的支付宝商户 | 对应供应商 API | 各商品开关、支付与供货配置都需完成 |
| 自己收款后人工给新 ChatGPT 订单代充 | 你自己的商户 | 人工 | 需要另行开发，不能直接切换现有开关实现 |
| 易支付/微信聚合支付 | 第三方商户 | 按实际方案 | Workers 尚未实现；Go 适配器不能直接配置到 Workers |

`worker/manual-fulfillment.ts` 仅兼容部分历史订单，不是面向新订单的通用人工发货模式。

建议先选择一种商品和一种收款路径完成验收，再扩展其他商品。商品可见、网站能打开、支付开关已开启，都不代表供应商实际可用。

## 3. 账号、域名与邮件

准备：Node.js 22.20+（本机已验证）或 24（CI）、npm、Cloudflare 账号、一个由该账号管理 DNS 的域名、Resend 账号。域名可以在其他注册商购买，不要求特定后缀或固定价格。

正式交易建议使用 Workers Paid。基础费用目前为每月 5 美元起，超额另计；静态资源、D1 和邮件的额度按各服务当前定价核对。免费 D1 超过每日读写额度会拒绝查询，不能把“永久免费”作为营业保证。

- Workers 定价：https://developers.cloudflare.com/workers/platform/pricing/
- D1 定价和限额：https://developers.cloudflare.com/d1/platform/pricing/
- D1 备份恢复：https://developers.cloudflare.com/d1/reference/time-travel/

在 Resend 验证发信域名，按控制台实际提供的 DNS 记录配置；不要假定永远只有三条。测试发件人 `onboarding@resend.dev` 有收件范围限制，不适合向客户发送生产邮件。Email Routing 只负责收信转发，不能代替 Resend 的发信功能。

## 4. 本地验证

```sh
npm ci
test -e .dev.vars || cp .dev.vars.example .dev.vars
npm run worker:migrate:local
npm run preview:worker
```

访问 `http://127.0.0.1:8787`，后台 `/admin`，代理入口 `/partner` 或 `/join`。`.dev.vars` 已存在时保留其中配置，不要直接覆盖。

本地管理员登录需要：`ADMIN_USERNAME`、`ADMIN_EMAIL`、`ADMIN_TOTP_SECRET`、`RESEND_API_KEY`、`RESEND_FROM`。代理登录及客户邮箱找回还需要 32 字符以上随机 `PARTNER_AUTH_SECRET`。以下命令仅用于在本机生成自己的密钥，将结果保存在本地秘密文件和自己的验证器中：

```sh
python3 -c 'import base64,secrets; print(base64.b32encode(secrets.token_bytes(20)).decode())'
python3 -c 'import secrets; print(secrets.token_hex(32))'
```

第一条生成 TOTP 密钥，第二条生成邮件登录签名密钥。生产环境单独生成，不与测试环境共用。

本地 `.dev.vars.example` 开启 `ORDER_TESTING_ENABLED=true`，只提供非金融测试订单；模拟付款不会真实收款，也不会执行代充。真实商品开关保持关闭。正式环境必须使用 `ORDER_TESTING_ENABLED=false`。

```sh
npm test
npm run lint
npm run worker:dry-run
```

`worker:dry-run` 使用生产示例模板，只构建和打包，不上传到 Cloudflare。通过它不等于真实支付、供货或云端资源验证通过。

## 5. 创建生产资源与配置

```sh
npx wrangler login
npx wrangler d1 create jiaoton-prod
test -e wrangler.production.jsonc || cp wrangler.production.example.jsonc wrangler.production.jsonc
```

`wrangler.production.jsonc` 已被 Git 忽略，保存你自己的资源标识。模板可提交，真实生产配置和秘密文件不要提交。

编辑生产文件：

1. 设置 `name` 为自己的生产 Worker 名称，例如 `jiaoton-prod`。
2. 将 `INTEREST_DB` 的 `database_id` 换成刚创建的 ID，`database_name` 与实际资源名称一致。绑定名始终是 `INTEREST_DB`。
3. 将 `routes` 中的 `shop.example.invalid` 换成实际商店域名，保留 `custom_domain: true`。
4. 将 `vars.STOREFRONT_ORIGIN` 和 `vars.PAYMENT_NOTIFY_ORIGIN` 都设置成该域名的 HTTPS origin，例如 `https://shop.example.com`，不附带路径或查询参数。前者用于邮件/通知链接，后者用于支付宝回调。
5. 所有购买开关先保持 `false`。`PAYMENT_PROVIDER` 保持 `alipay`。
6. 保留每分钟 Cron、D1、限流和静态资源配置。生产模板包含 `cpu_ms: 30000`，按 Paid 计划使用。

模板已关闭 `workers.dev` 和预览 URL，需要有效的自定义域名才能对外访问。域名也必须属于所登录的 Cloudflare 账号；配置预检不能替代账号和 DNS 权限检查。

```sh
npm run worker:check
npm run worker:migrate:production
```

迁移命令统一使用绑定名 `INTEREST_DB`，避免文档数据库名称与实际配置不一致。当前共有 44 个迁移，新增收款信息表为 `0044_partner_payout_accounts.sql`。新数据库从头执行全部迁移；已有自己的数据库按迁移历史补齐。不要用原项目历史生产数据库套用匿名化迁移。

生产初始化需要以下秘密配置（每个命令交互输入对应值）：

```sh
npx wrangler secret put ADMIN_USERNAME --config wrangler.production.jsonc
npx wrangler secret put ADMIN_EMAIL --config wrangler.production.jsonc
npx wrangler secret put ADMIN_TOTP_SECRET --config wrangler.production.jsonc
npx wrangler secret put PARTNER_AUTH_SECRET --config wrangler.production.jsonc
npx wrangler secret put RESEND_API_KEY --config wrangler.production.jsonc
npx wrangler secret put RESEND_FROM --config wrangler.production.jsonc
```

Wrangler 首次设置 secret 时可能要求创建对应 Worker，请确认名称与生产配置一致。`.dev.vars` 只用于本地运行，不会自动上传到生产。使用 `secret bulk` 时，应将 JSON 文件放在已忽略的 `.secrets/` 下，键名与上面一致。

```sh
npm run worker:check -- --remote
npm run worker:deploy
```

部署预检会拒绝占位数据库、缺失域名/Cron/限流绑定、生产测试开关以及不完整的接入配置；`--remote` 额外检查远程密钥名称是否齐全，不读取或验证密钥值。`worker:deploy` 自动运行远程预检、构建，再发布；不会替你创建 D1、申请商户或打开购买开关。

## 6. 可选人机验证

Workers 已实现 Turnstile 公共配置和服务端 Siteverify：

- `TURNSTILE_ENABLED=true`：保护新订单创建。
- `AUTH_TURNSTILE_ENABLED=true`：保护管理员、代理、客户邮箱找回的验证码发送与验证。
- `TURNSTILE_SITE_KEY`：在生产 `vars` 填入公钥。
- `TURNSTILE_SECRET_KEY`：使用 `wrangler secret put` 设置。

在 Turnstile 控制台允许实际商店域名。开启任一保护后，如果缺少密钥、验证超时、token 过期、用途或域名不匹配，服务端会拒绝操作，不会退化为免验证。未开启时仍保留邮箱验证码、管理员 TOTP、Cookie 和限流保护。

验证说明：https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

## 7. 支付与供货商：需要你提供的资料

先提供商家名称、接口文档、打算卖的商品和收款模式即可判断适配工作。私钥、API Secret 等放入本地秘密文件或 Wrangler Secrets，不要粘贴到聊天或提交到 Git。

### 支付宝官方直收

需要：

- 已可使用所需交易接口的支付宝应用/商户，应用环境（沙盒或正式）。
- `ALIPAY_APP_ID`、`ALIPAY_SELLER_ID`。
- `ALIPAY_APP_PRIVATE_KEY`：应用私钥，现有实现使用 PKCS#8 PEM。
- `ALIPAY_PUBLIC_KEY`：支付宝验签公钥，现有实现使用 SPKI PEM。不要误填应用公钥。
- 采用公钥模式还是证书模式；当前实现按公钥模式，证书模式需要额外适配。
- 收款到账主体、商户费率、退款权限；费率由你的商户合同决定，本站当前不向客户额外加收支付手续费。

公钥模式就绪后，通过 Secrets 保存四项支付宝参数，设置 `PAYMENT_CHECKOUT_ENABLED=true`。该开关控制站内直收、邮件类商品及 X 赠送收款，也控制新开票手续费收款；关闭后仍允许查询已有交易、接收回调和处理既有款项。

回调地址：`https://你的商店域名/api/payments/notify/alipay`；开票手续费回调为 `/api/invoices/notify/alipay`。回调必须可被支付平台访问，不要被登录页、验证码挑战或统一 Access 规则拦住。

默认网关为正式网关。只有明确设置 `ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do` 并配套沙盒商户密钥才是沙盒。`PAYMENT_TEST_ENABLED=true` 是“支付联调订单”开关，不代表假钱；生产预检禁止它，联调应使用单独的测试 Worker、D1、域名和秘密。

### 易支付或其他聚合支付

需要：服务商名称、正式/测试 API 地址、商户 ID、密钥配置方式、签名/验签规则、下单/查询/关单/退款/退款查询文档、支付结果回调示例、支付宝/微信通道标识、金额单位与手续费规则。

此路径需要新增 Workers 适配器与回归测试。不能把 `PAYMENT_PROVIDER` 改成 `gatewaya` 或 `gatewayb` 就开始收款。

### ChatGPT 自动充值平台

需要：

- 供应商名称、完整 API 文档、是否允许 Cloudflare 出口访问、是否要求固定出口 IP。
- `RECHARGE_API_BASE`、`RECHARGE_PARTNER_ID`、`RECHARGE_KEY_ID`、`RECHARGE_CLIENT_SECRET`、`RECHARGE_WEBHOOK_SECRET`。
- 商品列表和实际产品代码；Plus/Pro 等套餐的供货价、售价范围、库存或容量、新开/续费限制。
- 代收款的结算主体、手续费、到账和提现规则。
- 订单幂等规则、超时后查询方式、充值状态/回调样例、失败重试与退款规则。

配置：公开接入参数放在生产 `vars`，秘密放 Secrets。

```json
{
  "RECHARGE_API_BASE": "https://recharge.example.invalid/v1",
  "RECHARGE_NOTIFY_URL": "https://shop.example.invalid/api/recharge/webhook",
  "RECHARGE_COLLECTION_MODE": "platform_collect",
  "RECHARGE_PRODUCT_MAP": "{\"plus\":\"供应商实际商品代码\"}",
  "RECHARGE_CHECKOUT_ENABLED": "false"
}
```

以上为结构示例，不能直接用于生产。当前签名协议包括 Partner/Key ID、时间戳、nonce、请求体签名和幂等键，并非所有供应商都兼容。`RECHARGE_CHECKOUT_ENABLED` 独立控制平台代收，关闭本站 `PAYMENT_CHECKOUT_ENABLED` 不会关闭此路径。

### 自动发货：Gemini / 多邻国

需要 API 文档、API Key、商品 ID、采购结果和失败/退款状态示例，以及允许的最高采购成本。

- `DELIVERY_SUPPLIER_API_BASE`：真实 API 基础地址，已改为可配置。
- `DELIVERY_SUPPLIER_API_KEY`：秘密。
- `DELIVERY_SUPPLIER_PRODUCT_MAP`：JSON 字符串，例如 `{"gemini-pro-18m":{"id":"实际商品ID","maxUsdCents":实际最高美元分}}`。代码中的演示商品 ID 不能投产。
- `DELIVERY_SUPPLIER_CNY_PER_USD`：采购成本记账折算汇率，由你确认。
- 同时完成 `PAYMENT_CHECKOUT_ENABLED`、`EMAIL_PRODUCTS_ENABLED`、`DELIVERY_SUPPLIER_CHECKOUT_ENABLED` 和邮件/支付宝配置。

接口仍按已有协议调用 `/products`、`/order` 等路径，支持带幂等采购编号的查询与恢复。换地址不等于兼容不同协议，需要核对文档。

### Gmail 账号供应商

需要 `ACCOUNT_SUPPLIER_API_BASE`、`ACCOUNT_SUPPLIER_APP_ID`、`ACCOUNT_SUPPLIER_APP_SECRET`、`ACCOUNT_SUPPLIER_GOODS_ID`、`ACCOUNT_SUPPLIER_MAX_COST_CENTS`（人民币分）、商品及卡密格式说明、查询和退款规则。

同时完成支付宝、邮件和 `PAYMENT_CHECKOUT_ENABLED`、`EMAIL_PRODUCTS_ENABLED`、`ACCOUNT_SUPPLIER_CHECKOUT_ENABLED`。采购上限需低于销售/供货价格，具体以接口和项目成本校验为准。

### X 赠送（可选）

需要确认使用 `XGIFT_BACKEND=platform` 还是 `legacy`，并提供对应 API 文档、余额/积分规则、赠送资格校验、幂等下单与结果查询协议。

- platform：`XGIFT_PLATFORM_API_BASE`、`XGIFT_PLATFORM_KEY_ID`、`XGIFT_PLATFORM_CLIENT_SECRET`。
- legacy：`XGIFT_API_BASE`、`XGIFT_USER_ID`、`XGIFT_KEY_ID`、`XGIFT_CLIENT_SECRET`。
- 同时配置支付宝并开启 `PAYMENT_CHECKOUT_ENABLED` 和 `XGIFT_CHECKOUT_ENABLED`。

Telegram 自动开户、飞书提现通知均为可选，不提供相关凭据时保持未启用。

## 8. 上线验收顺序

1. 关闭所有真实购买开关，发布基础站点。检查 `/`、`/admin`、`/partner`、`/api/health`；健康检查会访问 D1，并检查新增迁移表是否可用。
2. 验证管理员邮箱码与 TOTP 登录、代理邮箱登录、客户邮箱找回，以及邮件中真实域名链接。
3. 验证管理员商品/代理/订单页面；代理排序、上下架、售价、公告、联系方式、订单筛选和收款信息保存。
4. 在隔离测试环境验证支付或供应商沙盒：创建、查询、签名回调、重复回调、超时恢复、金额不符拒绝、退款。没有上游沙盒时，先跑 Mock 测试；不能将它当作真实接入成功。
5. 在受控的商品/访问范围内开放所需交易路径，验收一笔小额真实订单和退款。需要真实收款时相应开关必须开启，不能宣称“开关全关着仍测真实订单”。只限制测试商品或页面访问时，仍要保持支付/供货回调通畅。
6. 确认 Cron 实际执行、断开浏览器后交易仍能恢复、已付款未交付订单可查询和处理，再逐步放开商品。

此阶段需要真实账号和你确认的支付/供应商服务，本次代码修复不代替验收。

## 9. 运维与版本保存

生产配置包含每分钟 Cron；支付和充值等核对按代码每五分钟执行。各任务独立运行，一个供应商失败不会跳过其他队列；部分失败会留下固定任务名日志。日志不输出私钥、Session、客户卡密或任意上游异常内容。自动请求日志关闭，避免查询参数中的邮箱进入日志；需要更细追踪时先确定脱敏策略。

```sh
npx wrangler tail --config wrangler.production.jsonc
mkdir -p backups
npx wrangler d1 export INTEREST_DB --remote --config wrangler.production.jsonc --output "backups/storefront-$(date +%F-%H%M%S).sql"
```

迁移前先导出，营业后安排定期备份并演练恢复；仅在 Mac 上手动导出不等于已经实现每日自动备份。备份包含业务数据，`backups/` 已被 Git 忽略。D1 另有 Time Travel，保留周期按当前计划核对。

部署前保存并推送 Git 提交；实际发布时记录 Worker version ID、提交号、迁移版本、开关状态，重要发布添加带说明的 Git 标签。代码回滚不会自动回滚数据库或已发生的付款，处理异常时先关闭新订单入口并继续核对已有交易。

购买关闭状态下，健康检查成功仅代表站点和数据库可用，不代表收款与供货已开通。
