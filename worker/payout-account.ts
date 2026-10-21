import { ApiError, body, json, type Env } from './platform.ts'
import type { Partner } from './partner-auth.ts'

export async function payoutAccount(env: Env, partnerId: string) {
  return await env.INTEREST_DB.prepare('SELECT phone,name,version FROM partner_payout_accounts WHERE partner_id=?').bind(partnerId).first<{ phone: string; name: string; version: number }>() ?? { phone: '', name: '', version: 0 }
}
export async function savePayoutAccount(request: Request, env: Env, partner: Partner) {
  if (request.method !== 'POST') throw new ApiError('请通过保存按钮更新收款信息。', 405)
  const data = await body(request)
  const phone = typeof data.phone === 'string' ? data.phone.trim() : ''
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!/^1[3-9][0-9]{9}$/.test(phone) || !name || name.length > 50 || Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || !Number.isSafeInteger(data.version) || Number(data.version) < 0) throw new ApiError('请填写有效的手机号和收款人姓名。')
  const event = crypto.randomUUID(), now = Date.now()
  await env.INTEREST_DB.batch([
    env.INTEREST_DB.prepare("INSERT INTO admin_audit(id,target_id,action,note,created_at) SELECT ?,id,'payout-account-update','代理更新收款信息',? FROM partners WHERE id=? AND active=1 AND auth_version=? AND COALESCE((SELECT version FROM partner_payout_accounts WHERE partner_id=partners.id),0)=?").bind(event, now, partner.id, partner.auth_version, Number(data.version)),
    env.INTEREST_DB.prepare('INSERT INTO partner_payout_accounts(partner_id,phone,name,version,updated_at) SELECT ?,?,?,1,? WHERE EXISTS(SELECT 1 FROM admin_audit WHERE id=?) ON CONFLICT(partner_id) DO UPDATE SET phone=excluded.phone,name=excluded.name,version=partner_payout_accounts.version+1,updated_at=excluded.updated_at').bind(partner.id, phone, name, now, event),
  ])
  if (!await env.INTEREST_DB.prepare('SELECT id FROM admin_audit WHERE id=?').bind(event).first()) throw new ApiError('收款信息或账号已变化，请刷新后重试。', 409)
  return json({ ok: true })
}
