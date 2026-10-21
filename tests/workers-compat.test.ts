import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { customerFixture } from './customer-fixture.ts'
import { emailCheckoutEnabled } from '../worker/email-delivery.ts'
import { xgiftCheckoutEnabled } from '../worker/xgift/service.ts'
import { membershipDeliveryMessage, partnerInvitationMessage } from '../worker/email.ts'
import { runScheduledTasks } from '../worker/scheduled-tasks.ts'
import { call, credentialHash, productMapping } from '../worker/delivery_supplier/client.ts'
import { validateWorkerDeployment } from '../scripts/check-worker-deploy.mjs'

type Context = Parameters<Parameters<typeof test>[1]>[0]
async function setup(t: Context) {
  const s = await customerFixture(); t.after(() => s.db.close())
  const buyer = (await s.request('/api/orders/client', {})).headers.get('Set-Cookie')!.split(';')[0]
  const create = () => s.request('/api/orders', { plan: 'plus', expectedPrice: 13900, email: 'buyer@example.test', key: crypto.randomUUID() }, buyer)
  return { ...s, buyer, create }
}
function enablePayments(s: Awaited<ReturnType<typeof setup>>) {
  Object.assign(s.env, { ORDER_TESTING_ENABLED: 'false', PAYMENT_CHECKOUT_ENABLED: 'true', PAYMENT_PROVIDER: 'alipay', PAYMENT_NOTIFY_ORIGIN: 'https://shop.example.invalid', ALIPAY_APP_ID: 'test-app', ALIPAY_SELLER_ID: 'test-seller', ALIPAY_APP_PRIVATE_KEY: 'test-only-unused-key', ALIPAY_PUBLIC_KEY: 'test-only-unused-key', RESEND_API_KEY: 'test-only-mail-key', RESEND_FROM: 'mail@example.test', EMAIL_PRODUCTS_ENABLED: 'true' })
}

test('verification configuration is public before login and never returns a secret', async t => {
  const s = await setup(t)
  for (const path of ['/api/orders/verification', '/api/orders/verification?purpose=auth']) {
    const r = await s.request(path); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { enabled: false })
  }
  s.env.AUTH_TURNSTILE_ENABLED = 'true'
  assert.equal((await s.request('/api/orders/verification?purpose=auth')).status, 503)
  Object.assign(s.env, { TURNSTILE_SITE_KEY: 'test-public-key', TURNSTILE_SECRET_KEY: 'test-private-key' })
  assert.deepEqual(await (await s.request('/api/orders/verification?purpose=auth')).json(), { enabled: true, siteKey: 'test-public-key', purpose: 'auth' })
  assert.deepEqual(await (await s.request('/api/orders/verification')).json(), { enabled: false })
  assert.equal((await s.request('/api/orders/verification', {})).status, 405)
})

test('all login and recovery actions enforce enabled server-side verification', async t => {
  const s = await setup(t)
  Object.assign(s.env, { AUTH_TURNSTILE_ENABLED: 'true', TURNSTILE_SITE_KEY: 'public-test-key', TURNSTILE_SECRET_KEY: 'private-test-key', RESEND_API_KEY: 'mail-test-key', RESEND_FROM: 'mail@example.test' })
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('must not send mail or validate absent token') })
  for (const [path, data] of [
    ['/api/admin/login/email-code', { username: s.env.ADMIN_USERNAME }],
    ['/api/admin/login', {}],
    ['/api/partner/auth/send', { email: 'partner@example.test' }],
    ['/api/partner/auth/verify', { email: 'partner@example.test' }],
    ['/api/orders/recovery/send', { email: 'buyer@example.test' }],
    ['/api/orders/recovery/verify', {}],
  ] as const) assert.equal((await s.request(path, data)).status, 403, path)
  assert.equal(calls, 0)
})

test('order verification binds token to hostname and action and fails closed on outages', async t => {
  const s = await setup(t)
  Object.assign(s.env, { TURNSTILE_ENABLED: 'true', TURNSTILE_SITE_KEY: 'public-test-key', TURNSTILE_SECRET_KEY: 'private-test-key' })
  assert.equal((await s.create()).status, 403)
  let reply: Record<string, unknown> = { success: true, hostname: 'shop.example.invalid', action: 'order_create' }
  let outage = false
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
    assert.equal(options.redirect, 'manual')
    assert.equal(JSON.parse(String(options.body)).secret, 'private-test-key')
    if (outage) throw Error('sensitive failure')
    return Response.json(reply)
  })
  const input = { plan: 'plus', expectedPrice: 13900, email: 'buyer@example.test', key: crypto.randomUUID(), turnstileToken: 'test-token' }
  for (const invalid of [{ success: false }, { ...reply, hostname: 'other.example.test' }, { ...reply, action: 'admin_verify' }]) {
    const good = reply; reply = invalid
    assert.equal((await s.request('/api/orders', input, s.buyer)).status, 403); reply = good
  }
  outage = true
  const failure = await s.request('/api/orders', input, s.buyer)
  assert.equal(failure.status, 503); assert.doesNotMatch(await failure.text(), /sensitive|private-test-key/)
  outage = false
  assert.equal((await s.request('/api/orders', input, s.buyer)).status, 201)
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM orders').get()!.n, 1)
})

test('catalog, read-only payment settings and payment options match the current UI without starting payment', async t => {
  const s = await setup(t)
  const created = await (await s.create()).json()
  s.db.prepare("UPDATE orders SET mode='live' WHERE id=?").run(created.order.id)
  enablePayments(s)
  t.mock.method(globalThis, 'fetch', async () => { throw Error('options must not call a gateway') })
  const catalog = await (await s.request('/api/catalog')).json()
  assert.equal(catalog.backend, 'workers')
  assert.deepEqual(catalog.paymentMethods, [{ method: 'alipay', name: '支付宝', feeBps: 0 }])
  const endpoint = `/api/orders/${created.order.id}/payment`
  const options = await s.request(endpoint, { action: 'options' }, s.buyer)
  assert.equal(options.status, 200); assert.deepEqual(await options.json(), { payment: null, methods: catalog.paymentMethods })
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM payments').get()!.n, 0)
  assert.equal((await s.request(endpoint, { action: 'create', method: 'wxpay' }, s.buyer)).status, 409)
  assert.equal((await s.request(endpoint, { action: 'create', method: 'alipay', expectedFeeBps: 100 }, s.buyer)).status, 409)
  const other = (await s.request('/api/orders/client', {})).headers.get('Set-Cookie')!.split(';')[0]
  assert.equal((await s.request(endpoint, { action: 'options' }, other)).status, 404)
  assert.equal((await s.request('/api/admin/payments/settings')).status, 401)
  const settings = await (await s.request('/api/admin/payments/settings', undefined, s.admin)).json()
  assert.equal(settings.readOnly, true); assert.equal(settings.checkout, true)
  assert.equal((await s.request('/api/admin/payments/settings', {}, s.admin)).status, 405)
})

test('direct collection switch also gates email/X products and invoice payment choices', async t => {
  const s = await setup(t); enablePayments(s)
  Object.assign(s.env, { XGIFT_CHECKOUT_ENABLED: 'true', XGIFT_BACKEND: 'platform', XGIFT_PLATFORM_API_BASE: 'https://x.example.test/v1', XGIFT_PLATFORM_KEY_ID: 'test-key', XGIFT_PLATFORM_CLIENT_SECRET: 'test-secret' })
  assert.equal(emailCheckoutEnabled(s.env), true); assert.equal(xgiftCheckoutEnabled(s.env), true)
  const agent = await s.agent('开票代理')
  const invoice = { key: crypto.randomUUID(), title: '测试公司', taxNumber: 'TEST', invoiceType: 'ordinary', email: 'test@example.test', baseCents: 14000, includeFee: false }
  assert.equal((await s.request('/api/partner/invoices', invoice, agent.cookie)).status, 201)
  const path = `/api/partner/invoices/${invoice.key}/payment`
  assert.equal((await s.request(path, { action: 'options' }, agent.cookie)).status, 200)
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM invoice_payments').get()!.n, 0)
  s.env.PAYMENT_CHECKOUT_ENABLED = 'false'
  assert.equal(emailCheckoutEnabled(s.env), false); assert.equal(xgiftCheckoutEnabled(s.env), false)
  assert.deepEqual((await (await s.request('/api/catalog')).json()).paymentMethods, [])
  assert.deepEqual((await (await s.request(path, { action: 'options' }, agent.cookie)).json()).methods, [])
  assert.equal((await s.request(path, { action: 'create', method: 'alipay' }, agent.cookie)).status, 503)
})

test('partner order search and detail are scoped and omit internal notes', async t => {
  const s = await setup(t), a = await s.agent('甲'), b = await s.agent('乙')
  const created = await (await s.create()).json(), id = created.order.id
  s.db.prepare('UPDATE orders SET partner_id=?,cost_cents=10000 WHERE id=?').run(a.id, id)
  s.db.prepare("UPDATE order_events SET note='private operational note' WHERE order_id=?").run(id)
  const detail = await s.request(`/api/partner/orders/${id}`, undefined, a.cookie)
  assert.equal(detail.status, 200); assert.doesNotMatch(await detail.text(), /private operational note/)
  assert.equal((await s.request(`/api/partner/orders/${id}`, undefined, b.cookie)).status, 404)
  const list = await (await s.request('/api/partner/orders?q=buyer%40example.test&status=pending', undefined, a.cookie)).json()
  assert.equal(list.total, 1); assert.equal(list.backend, 'workers')
  assert.equal((await (await s.request('/api/partner/orders?q=absent', undefined, a.cookie)).json()).total, 0)
  assert.equal((await s.request(`/api/admin/partners/${a.id}/orders/${id}`, undefined, s.admin)).status, 200)
  assert.equal((await (await s.request('/api/partner/dashboard', undefined, a.cookie)).json()).backend, 'workers')
})

test('saved payout account uses version guards and is snapshotted into each request', async t => {
  const s = await setup(t), agent = await s.agent('代理')
  const created = await (await s.create()).json(), id = created.order.id
  s.db.prepare("UPDATE orders SET partner_id=?,cost_cents=10000,mode='live',payment_status='paid',status='success' WHERE id=?").run(agent.id, id)
  const account = { phone: '13800000000', name: '测试收款人', version: 0 }
  assert.equal((await s.request('/api/partner/payout-account', account)).status, 401)
  assert.equal((await s.request('/api/partner/payout-account', account, agent.cookie)).status, 200)
  assert.equal((await s.request('/api/partner/payout-account', { ...account, name: '过期修改' }, agent.cookie)).status, 409)
  assert.equal((await s.request('/api/partner/payouts', { accountVersion: 0, key: crypto.randomUUID() }, agent.cookie)).status, 409)
  const key = crypto.randomUUID()
  assert.equal((await s.request('/api/partner/payouts', { accountVersion: 1, key, recipient: 'untrusted override' }, agent.cookie)).status, 201)
  assert.equal(s.db.prepare('SELECT recipient FROM partner_payouts WHERE request_key=?').get(key)!.recipient, '13800000000 / 测试收款人')
  assert.equal((await s.request('/api/partner/payout-account', { ...account, name: '新的收款人', version: 1 }, agent.cookie)).status, 200)
  assert.equal((await s.request('/api/partner/payouts', { accountVersion: 1, key }, agent.cookie)).status, 200)
  assert.equal(s.db.prepare('SELECT recipient FROM partner_payouts WHERE request_key=?').get(key)!.recipient, '13800000000 / 测试收款人')
})

test('a payout-account change during supplier reconciliation cannot reserve funds for stale details', async t => {
  const s = await setup(t), agent = await s.agent('代理')
  const { order } = await (await s.create()).json()
  s.db.prepare("UPDATE orders SET partner_id=?,cost_cents=10000,mode='live',payment_status='paid',status='success' WHERE id=?").run(agent.id, order.id)
  await s.request('/api/partner/payout-account', { phone: '13800000000', name: '测试收款人', version: 0 }, agent.cookie)
  const batch = s.env.INTEREST_DB.batch.bind(s.env.INTEREST_DB)
  s.env.INTEREST_DB.batch = async statements => { s.db.prepare('UPDATE partner_payout_accounts SET version=version+1 WHERE partner_id=?').run(agent.id); return batch(statements) }
  assert.equal((await s.request('/api/partner/payouts', { accountVersion: 1, key: crypto.randomUUID() }, agent.cookie)).status, 409)
  assert.equal(s.db.prepare('SELECT payout_id FROM orders WHERE id=?').get(order.id)!.payout_id, null)
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM partner_payouts').get()!.n, 0)
})

test('mail templates use the configured origin without rewriting customer content', async t => {
  const s = await setup(t); s.env.STOREFRONT_ORIGIN = 'https://new.example.test'
  const invite = partnerInvitationMessage(s.env)
  assert.match(invite.html, /https:\/\/new.example.test\/join/); assert.doesNotMatch(invite.html, /shop.example.invalid/)
  const content = '客户文字 https://shop.example.invalid'
  const mail = membershipDeliveryMessage('cdk', 'YMX-TEST', 'CODE', content, 'duolingo-12m', s.env)
  assert.match(mail.text, /https:\/\/new.example.test\/orders/); assert.ok(mail.text.includes(content))
})

test('delivery supplier uses configured API and immutable product/cost selection', async t => {
  const s = await setup(t)
  Object.assign(s.env, { DELIVERY_SUPPLIER_API_BASE: 'https://supplier.example.test/v2', DELIVERY_SUPPLIER_API_KEY: 'test-key', DELIVERY_SUPPLIER_PRODUCT_MAP: JSON.stringify({ 'gemini-pro-18m': { id: 'REAL_TEST_PRODUCT', maxUsdCents: 95 } }) })
  assert.deepEqual(productMapping(s.env, 'gemini-pro-18m'), { id: 'REAL_TEST_PRODUCT', maxUsdCents: 95 })
  assert.throws(() => productMapping(s.env, 'duolingo-12m'))
  t.mock.method(globalThis, 'fetch', async (url: string) => { assert.equal(url, 'https://supplier.example.test/v2/products'); return Response.json({ services: [] }) })
  assert.deepEqual(await call(s.env, '/products'), { services: [] })
  const original = await credentialHash(s.env)
  s.env.DELIVERY_SUPPLIER_API_BASE = 'https://other.example.test/v2'
  assert.notEqual(await credentialHash(s.env), original)
})

test('scheduler still executes independent tasks after an error and reports partial failures', async t => {
  const ran: string[] = [], logged: unknown[][] = []
  t.mock.method(console, 'error', (...args: unknown[]) => { logged.push(args) })
  const failed = await runScheduledTasks([
    { name: 'payments', run: async () => { throw Error('private payload') } },
    { name: 'delivery', run: async () => { ran.push('delivery'); return { failed: 1 } } },
    { name: 'notifications', run: async () => { ran.push('notifications') } },
  ])
  assert.equal(failed, true); assert.deepEqual(ran, ['delivery', 'notifications']); assert.doesNotMatch(JSON.stringify(logged), /private payload/)
})

test('deployment preflight rejects templates, missing Cron and production testing', () => {
  const c = JSON.parse(readFileSync(new URL('../wrangler.production.example.jsonc', import.meta.url), 'utf8'))
  assert.ok(validateWorkerDeployment(c).errors.length)
  c.d1_databases[0].database_id = '11111111-1111-4111-8111-111111111111'
  c.vars.STOREFRONT_ORIGIN = c.vars.PAYMENT_NOTIFY_ORIGIN = 'https://github.com'
  c.routes = [{ pattern: 'github.com', custom_domain: true }]
  assert.deepEqual(validateWorkerDeployment(c).errors, [])
  assert.ok(validateWorkerDeployment(c).secrets.includes('PARTNER_AUTH_SECRET'))
  c.vars.PAYMENT_TEST_ENABLED = 'true'; assert.ok(validateWorkerDeployment(c).errors.length)
  c.vars.PAYMENT_TEST_ENABLED = 'false'; c.triggers.crons = []; assert.ok(validateWorkerDeployment(c).errors.length)
})
