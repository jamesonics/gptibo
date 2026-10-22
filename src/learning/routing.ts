import { findArticle, findDomain, type DomainId } from './content.ts'

export type LearningRoute =
  | { kind: 'home' }
  | { kind: 'domain'; domainId: DomainId }
  | { kind: 'article'; domainId: DomainId; articleId: string }
  | { kind: 'legacy' }
  | { kind: 'not-found' }

export function readLearningRoute(pathname: string): LearningRoute {
  if (pathname === '/') return { kind: 'home' }
  // Existing shop bookmarks lead to the learning homepage; the old checkout UI
  // stays in source for study but is no longer a public entry point.
  if (/^\/(?:product|orders|s|r)(?:\/|$)/.test(pathname)) return { kind: 'legacy' }
  const match = pathname.match(/^\/learn\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?\/?$/)
  if (!match) return { kind: 'not-found' }
  const domain = findDomain(match[1])
  if (!domain) return { kind: 'not-found' }
  if (!match[2]) return { kind: 'domain', domainId: domain.id }
  return findArticle(domain.id, match[2])
    ? { kind: 'article', domainId: domain.id, articleId: match[2] }
    : { kind: 'not-found' }
}

export function canonicalLearningPath(pathname: string) {
  const route = readLearningRoute(pathname)
  if (route.kind === 'legacy') return '/'
  if ((route.kind === 'domain' || route.kind === 'article') && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}
