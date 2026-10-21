import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const flags = ['ORDER_TESTING_ENABLED', 'PAYMENT_TEST_ENABLED', 'PAYMENT_CHECKOUT_ENABLED', 'EMAIL_PRODUCTS_ENABLED', 'RECHARGE_CHECKOUT_ENABLED', 'ACCOUNT_SUPPLIER_CHECKOUT_ENABLED', 'DELIVERY_SUPPLIER_CHECKOUT_ENABLED', 'XGIFT_CHECKOUT_ENABLED', 'TURNSTILE_ENABLED', 'AUTH_TURNSTILE_ENABLED']
function httpsUrl(value, originOnly = false) {
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || (originOnly && u.pathname !== '/') || /(^|\.)(localhost|invalid|test|example|example\.com|example\.net|example\.org)$/.test(u.hostname) || !u.hostname.includes('.')) return null
    return u
  } catch { return null }
}
export function validateWorkerDeployment(c) {
  const errors = [], v = c.vars ?? {}, origin = httpsUrl(v.STOREFRONT_ORIGIN, true)
  const db = c.d1_databases?.find(d => d.binding === 'INTEREST_DB')
  if (!c.name || /local|example/.test(c.name)) errors.push('name must identify the production Worker')
  if (!db || !db.database_name || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(db.database_id ?? '') || !/[1-9a-f]/i.test(db.database_id) || db.migrations_dir !== 'migrations') errors.push('INTEREST_DB requires a real database ID, database name and migrations directory')
  if (!origin || !c.routes?.some(r => r.custom_domain === true && r.pattern === origin.hostname)) errors.push('STOREFRONT_ORIGIN and a matching custom-domain route are required')
  if (c.workers_dev !== false || c.preview_urls !== false) errors.push('production alternate public URLs must be explicitly disabled')
  if (c.main !== 'worker/index.ts' || c.assets?.binding !== 'ASSETS' || c.assets?.directory !== './dist' || c.assets?.not_found_handling !== 'single-page-application' || !(c.assets?.run_worker_first === true || c.assets?.run_worker_first?.includes('/api/*'))) errors.push('Worker entry point and SPA/API routing are incomplete')
  if (!['INTEREST_LIMITER', 'API_LIMITER', 'EXPENSIVE_LIMITER'].every(name => c.ratelimits?.some(r => r.name === name))) errors.push('all API rate-limit bindings are required')
  if (!c.triggers?.crons?.includes('* * * * *')) errors.push('the every-minute reconciliation Cron is required')
  if (c.observability?.enabled !== true || c.observability?.logs?.invocation_logs !== false) errors.push('enable safe application logs without automatic request logs')
  for (const name of flags) if (!['true', 'false'].includes(v[name])) errors.push(`${name} must explicitly be "true" or "false"`)
  if (v.ORDER_TESTING_ENABLED !== 'false' || v.PAYMENT_TEST_ENABLED !== 'false') errors.push('production cannot enable demo orders or payment test orders')
  if (v.PAYMENT_PROVIDER !== 'alipay') errors.push('the Workers payment adapter currently supports alipay only')
  const callback = httpsUrl(v.PAYMENT_NOTIFY_ORIGIN, true)
  if (!callback || callback.origin !== origin?.origin) errors.push('PAYMENT_NOTIFY_ORIGIN must match STOREFRONT_ORIGIN')
  const secrets = new Set(['ADMIN_USERNAME', 'ADMIN_EMAIL', 'ADMIN_TOTP_SECRET', 'PARTNER_AUTH_SECRET', 'RESEND_API_KEY', 'RESEND_FROM'])
  if (v.PAYMENT_CHECKOUT_ENABLED === 'true') for (const key of ['ALIPAY_APP_ID', 'ALIPAY_SELLER_ID', 'ALIPAY_APP_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY']) secrets.add(key)
  if (v.EMAIL_PRODUCTS_ENABLED === 'true' || v.XGIFT_CHECKOUT_ENABLED === 'true') if (v.PAYMENT_CHECKOUT_ENABLED !== 'true') errors.push('email and X gift checkout require the direct-payment switch')
  if (v.TURNSTILE_ENABLED === 'true' || v.AUTH_TURNSTILE_ENABLED === 'true') {
    if (!v.TURNSTILE_SITE_KEY) errors.push('Turnstile requires TURNSTILE_SITE_KEY')
    secrets.add('TURNSTILE_SECRET_KEY')
  }
  if (v.RECHARGE_CHECKOUT_ENABLED === 'true') {
    const notify = httpsUrl(v.RECHARGE_NOTIFY_URL)
    if (!httpsUrl(v.RECHARGE_API_BASE) || notify?.origin !== origin?.origin || notify?.pathname !== '/api/recharge/webhook') errors.push('Recharge requires a real API base and the storefront webhook URL')
    if (v.RECHARGE_COLLECTION_MODE && v.RECHARGE_COLLECTION_MODE !== 'platform_collect') errors.push('Recharge supports platform_collect only')
    try { const map = JSON.parse(v.RECHARGE_PRODUCT_MAP); if (!map || Array.isArray(map) || !Object.keys(map).length || Object.values(map).some(x => typeof x !== 'string' || !x)) throw Error() } catch { errors.push('RECHARGE_PRODUCT_MAP must contain the supplier product codes') }
    for (const key of ['RECHARGE_PARTNER_ID', 'RECHARGE_KEY_ID', 'RECHARGE_CLIENT_SECRET', 'RECHARGE_WEBHOOK_SECRET']) secrets.add(key)
  }
  if (v.ACCOUNT_SUPPLIER_CHECKOUT_ENABLED === 'true') {
    if (v.EMAIL_PRODUCTS_ENABLED !== 'true' || !httpsUrl(v.ACCOUNT_SUPPLIER_API_BASE) || !/^[1-9]\d*$/.test(v.ACCOUNT_SUPPLIER_GOODS_ID ?? '') || !/^[1-9]\d*$/.test(v.ACCOUNT_SUPPLIER_MAX_COST_CENTS ?? '')) errors.push('account delivery requires email checkout, API base, goods ID and cost ceiling')
    secrets.add('ACCOUNT_SUPPLIER_APP_ID'); secrets.add('ACCOUNT_SUPPLIER_APP_SECRET')
  }
  if (v.DELIVERY_SUPPLIER_CHECKOUT_ENABLED === 'true') {
    if (v.EMAIL_PRODUCTS_ENABLED !== 'true' || !httpsUrl(v.DELIVERY_SUPPLIER_API_BASE) || !(Number(v.DELIVERY_SUPPLIER_CNY_PER_USD) > 0 && Number(v.DELIVERY_SUPPLIER_CNY_PER_USD) <= 100)) errors.push('automatic delivery requires email checkout, real API base and exchange rate')
    try {
      const map = JSON.parse(v.DELIVERY_SUPPLIER_PRODUCT_MAP)
      if (!map || Array.isArray(map) || !Object.keys(map).length || Object.entries(map).some(([plan, m]) => !['gemini-pro-18m', 'duolingo-12m'].includes(plan) || !m || !/^[A-Za-z0-9_-]{1,128}$/.test(m.id ?? '') || m.id.startsWith('DEMO_') || !Number.isSafeInteger(m.maxUsdCents) || m.maxUsdCents < 1 || m.maxUsdCents > 10000000)) throw Error()
    } catch { errors.push('DELIVERY_SUPPLIER_PRODUCT_MAP requires real product IDs and integer USD-cent ceilings') }
    secrets.add('DELIVERY_SUPPLIER_API_KEY')
  }
  if (v.XGIFT_CHECKOUT_ENABLED === 'true') {
    const platform = v.XGIFT_BACKEND === 'platform'
    if (!['platform', 'legacy'].includes(v.XGIFT_BACKEND) || !httpsUrl(platform ? v.XGIFT_PLATFORM_API_BASE : v.XGIFT_API_BASE)) errors.push('X gifting requires an explicit backend and real API base')
    for (const key of platform ? ['XGIFT_PLATFORM_KEY_ID', 'XGIFT_PLATFORM_CLIENT_SECRET'] : ['XGIFT_USER_ID', 'XGIFT_KEY_ID', 'XGIFT_CLIENT_SECRET']) secrets.add(key)
  }
  return { errors, secrets: [...secrets] }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), configAt = args.indexOf('--config')
    const path = resolve(root, configAt === -1 ? 'wrangler.production.jsonc' : args[configAt + 1] ?? '')
    const parsed = ts.parseConfigFileTextToJson(path, readFileSync(path, 'utf8'))
    if (parsed.error || !parsed.config || typeof parsed.config !== 'object') throw new Error('Invalid production JSONC configuration')
    const { errors, secrets } = validateWorkerDeployment(parsed.config)
    if (errors.length) throw new Error(errors.join('\n'))
    if (args.includes('--remote')) {
      const output = execFileSync(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), 'secret', 'list', '--config', path], { cwd: root, encoding: 'utf8', env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] })
      const names = new Set(JSON.parse(output).map(item => item.name))
      const missing = secrets.filter(name => !names.has(name) && !parsed.config.vars?.[name])
      if (missing.length) throw new Error('Missing remote configuration: ' + missing.join(', '))
      console.log('Production configuration and required remote secret names verified. Secret values and integration behavior still require acceptance testing.')
    } else console.log('Public production configuration verified. Required secret names (values not checked): ' + secrets.join(', '))
  } catch (error) {
    console.error('Deployment preflight failed. ' + (error?.code === 'ENOENT' ? 'Copy wrangler.production.example.jsonc to wrangler.production.jsonc and fill in your resources first.' : error?.stderr ? 'Unable to list remote secrets. Check Wrangler login and account permissions.' : error.message))
    process.exitCode = 1
  }
}
