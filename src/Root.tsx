import { WorkspaceBoot } from './components/workspace-loading'
import { lazy, Suspense } from 'react'
import LearningApp from './learning/LearningApp'

const Admin = lazy(() => import('./admin/Admin'))
const Partner = lazy(() => import('./partner/Partner'))
export default function Root() {
  return location.pathname === '/admin' || location.pathname.startsWith('/admin/')
    ? <Suspense fallback={<WorkspaceBoot />}><Admin /></Suspense>
    : ['/join', '/join/', '/partner', '/partner/'].includes(location.pathname)
      ? <Suspense fallback={<WorkspaceBoot />}><Partner /></Suspense>
      : <LearningApp />
}
