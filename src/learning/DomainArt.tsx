import { Check, Cloud, GitBranch } from 'lucide-react'
import type { DomainId } from './content'

export function DomainArt({ domain, compact = false }: { domain: DomainId; compact?: boolean }) {
  return <div className={'ff-art' + (compact ? ' ff-art-small' : '')} aria-hidden="true">
    {domain === 'frontend' && <>
      <div className="ff-window ff-window-back" />
      <div className="ff-window ff-window-front"><div className="ff-window-dots"><b /><b /><b /></div><div className="ff-window-row"><span className="ff-window-sidebar" /><div className="ff-window-content"><span /><span /></div></div></div>
    </>}
    {domain === 'backend' && <><div className="ff-request"><small>REQUEST</small><strong>{'{ }'}</strong></div><div className="ff-response">200 OK<span>RESPONSE</span></div></>}
    {domain === 'data' && <div className="ff-db"><span /><span /><span /></div>}
    {domain === 'engineering' && <><div className="ff-deploy-cloud"><Cloud size={34} strokeWidth={1.5} /></div><div className="ff-deploy-branch"><GitBranch size={22} strokeWidth={1.5} /></div></>}
    {domain === 'agents' && <><div className="ff-agent-sheet"><span /><span /><span /></div><div className="ff-agent-check"><Check size={23} strokeWidth={1.5} /></div></>}
  </div>
}
