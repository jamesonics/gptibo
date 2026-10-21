import { ApiError, type Env } from '../platform.ts'
import { alipay } from './alipay.ts'
import type { PaymentProvider } from './types.ts'

export function alipayConfigured(env: Env) { return Boolean(env.ALIPAY_APP_ID && env.ALIPAY_SELLER_ID && env.ALIPAY_APP_PRIVATE_KEY && env.ALIPAY_PUBLIC_KEY) }
export function directCheckoutEnabled(env: Env) {
  if (env.ORDER_TESTING_ENABLED === 'true' || env.PAYMENT_CHECKOUT_ENABLED !== 'true' || !alipayConfigured(env) || (env.PAYMENT_PROVIDER && env.PAYMENT_PROVIDER !== 'alipay')) return false
  try {
    const url = new URL(env.PAYMENT_NOTIFY_ORIGIN ?? '')
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
  } catch { return false }
}
export function paymentMethods(env: Env) {
  return directCheckoutEnabled(env) ? [{ method: 'alipay', name: '支付宝', feeBps: 0 }] : []
}
export function validatePaymentSelection(data: Record<string, unknown>) {
  if (data.method !== undefined && data.method !== 'alipay') throw new ApiError('当前仅支持支付宝，请刷新后重新选择。', 409)
  if (data.expectedFeeBps !== undefined && data.expectedFeeBps !== 0) throw new ApiError('支付手续费已更新，请刷新后重试。', 409)
}
// Resolve using the payment's persisted provider, not today's checkout default.
export function paymentProvider(env: Env, id: string): PaymentProvider {
  if (id === 'alipay' && alipayConfigured(env)) return alipay({ ALIPAY_APP_ID: env.ALIPAY_APP_ID!, ALIPAY_SELLER_ID: env.ALIPAY_SELLER_ID!, ALIPAY_APP_PRIVATE_KEY: env.ALIPAY_APP_PRIVATE_KEY!, ALIPAY_PUBLIC_KEY: env.ALIPAY_PUBLIC_KEY!, ALIPAY_GATEWAY: env.ALIPAY_GATEWAY })
  throw new ApiError('该订单的支付渠道尚未配置，请联系支持。', 503)
}
