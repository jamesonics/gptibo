import type { AnchorHTMLAttributes } from 'react'

export type Navigate = (href: string, restoreScroll?: boolean) => void

export function LearningLink({ href, navigate, restoreScroll = false, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; navigate: Navigate; restoreScroll?: boolean }) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (props.target && props.target !== '_self') || props.download != null) return
    event.preventDefault()
    navigate(href, restoreScroll)
  }} />
}
