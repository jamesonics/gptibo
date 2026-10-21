import { ApiError, json, type Env } from './platform.ts'
import { boundedResponseText } from './bounded-response.ts'

type Action = 'order_create' | 'admin_send' | 'admin_verify' | 'partner_send' | 'partner_verify' | 'customer_send' | 'customer_verify'
function enabled(env: Env, auth: boolean) {
  return (auth ? env.AUTH_TURNSTILE_ENABLED : env.TURNSTILE_ENABLED) === 'true'
}
function configuration(env: Env) {
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) throw new ApiError('安全验证服务尚未配置，请联系管理员。', 503)
  return { siteKey: env.TURNSTILE_SITE_KEY, secret: env.TURNSTILE_SECRET_KEY }
}

// This public configuration must be available before any buyer/login cookie exists.
export function verificationOptions(request: Request, env: Env) {
  if (request.method !== 'GET') throw new ApiError('请通过 GET 获取验证配置。', 405)
  const purpose = new URL(request.url).searchParams.get('purpose')
  if (purpose !== null && purpose !== 'auth') throw new ApiError('验证用途无效。')
  const auth = purpose === 'auth'
  return json(enabled(env, auth) ? { enabled: true, siteKey: configuration(env).siteKey, ...(auth ? { purpose: 'auth' } : {}) } : { enabled: false })
}

export async function verifyHuman(request: Request, env: Env, data: Record<string, unknown>, action: Action) {
  if (!enabled(env, action !== 'order_create')) return
  const { secret } = configuration(env)
  if (typeof data.turnstileToken !== 'string' || !data.turnstileToken || data.turnstileToken.length > 2048) throw new ApiError('请先完成安全验证。', 403)
  let result: { success?: boolean; hostname?: string; action?: string }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: data.turnstileToken, remoteip: request.headers.get('CF-Connecting-IP') ?? undefined }),
    })
    if (!response.ok) throw new Error('unavailable')
    result = JSON.parse(await boundedResponseText(response, 8192))
  } catch { throw new ApiError('安全验证暂时不可用，请稍后重试。', 503) }
  // Siteverify also rejects expired/reused tokens. Never trust the client alone.
  if (result?.success !== true || result.hostname !== new URL(request.url).hostname || result.action !== action) throw new ApiError('安全验证无效或已过期，请重新验证。', 403)
}
