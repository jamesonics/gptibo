import { AnnouncementSettingsPanel } from '@/components/announcement-settings'
import { SupportContactsPanel } from '@/components/support-contacts'
import { CopyButton } from '@/components/copy-button'
import { ProductManagement } from './ProductManagement'
import type { Offer } from './model'

export function WorkersStoreSettings({ prefix, plans, storeUrl, revision, readOnly = false, onSaved }: {
  prefix: string; plans: Offer[]; storeUrl: string; revision: number; readOnly?: boolean; onSaved: () => void
}) {
  return <div className="partner-store-settings">
    <section className="admin-panel"><h2>专属商店</h2><p><a href={storeUrl} target="_blank" rel="noreferrer">打开商店</a> <CopyButton value={storeUrl} label="复制推广链接" /></p></section>
    <ProductManagement endpoint={prefix + '/product-order'} plans={plans} storeUrl={storeUrl} readOnly={readOnly} onSaved={onSaved} />
    <SupportContactsPanel title="商店联系方式" description="显示在这间商店的联系支持入口。" endpoint={prefix + '/support-contacts'} revision={revision} readOnly={readOnly} />
    <AnnouncementSettingsPanel endpoint={prefix + '/announcement'} revision={revision} readOnly={readOnly} />
  </div>
}
