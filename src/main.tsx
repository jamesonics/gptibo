import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.tsx'
import { BRAND_NAME } from './lib/branding'

// Apply the saved appearance before React mounts to avoid a light flash.
try { if (localStorage.getItem('ymx-theme') === 'dark') document.documentElement.classList.add('dark') } catch { /* default light */ }

// Existing protected workspaces retain their own entry points.
if (location.pathname === '/admin' || location.pathname.startsWith('/admin/') || ['/join', '/join/', '/partner', '/partner/'].includes(location.pathname)) {
  document.title = location.pathname.startsWith('/admin') ? `管理工作台 · ${BRAND_NAME}` : `代理工作台 · ${BRAND_NAME}`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
