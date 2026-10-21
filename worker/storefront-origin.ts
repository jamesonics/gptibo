import { ApiError, type Env } from './platform.ts'

export function storefrontOrigin(env: Pick<Env, 'STOREFRONT_ORIGIN' | 'PAYMENT_NOTIFY_ORIGIN'> = {}) {
  try {
    const url = new URL(env.STOREFRONT_ORIGIN ?? env.PAYMENT_NOTIFY_ORIGIN ?? 'https://shop.example.invalid')
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('invalid')
    return url.origin
  } catch { throw new ApiError('商店域名未正确配置。', 503) }
}
