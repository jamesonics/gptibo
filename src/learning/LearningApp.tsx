import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, ChevronRight, Moon, Sun } from 'lucide-react'
import { BRAND_NAME, BRAND_ENGLISH_NAME, BRAND_FULL_NAME, BRAND_TAGLINE } from '@/lib/branding'
import { applyAppearance } from '@/lib/appearance'
import { articleHref, domainHref, findArticle, findDomain, learningDomains, restoreExpandedBranches, type DomainId, type LearningDomain } from './content'
import { canonicalLearningPath, readLearningRoute } from './routing'
import { DomainArt } from './DomainArt'
import { LearningLink, type Navigate } from './Link'
import ComfortablePage from './ComfortablePage'
import './learning.css'

const treeStorageKey = 'firstform.knowledge-tree.v1'

function readTreePreferences() {
  try { return restoreExpandedBranches(localStorage.getItem(treeStorageKey)) }
  catch { return restoreExpandedBranches(null) }
}

function Home({ navigate }: { navigate: Navigate }) {
  return <>
    <header className="ff-home-intro"><div><p className="ff-kicker">PERSONAL LEARNING LAB</p><h1 className="ff-title">从好奇开始，<br />把理解做成作品。</h1></div><p className="ff-description">设计、代码与工程。<br />沿着知识树，动手探索每一个问题。</p></header>
    <div className="ff-domains">
      {learningDomains.map((domain, index) => <LearningLink key={domain.id} className={'ff-domain' + (index > 1 ? ' ff-domain-small' : '')} href={domainHref(domain.id)} navigate={navigate} aria-label={'探索' + domain.title + '知识树'}>
        <h2>{domain.title}</h2><p>{domain.summary}</p><DomainArt domain={domain.id} compact={index > 1} />
        <div className="ff-domain-foot"><span>{domain.topics}</span><span className="ff-domain-cta">探索知识树 <ArrowUpRight size={16} aria-hidden="true" /></span></div>
      </LearningLink>)}
    </div>
  </>
}

function KnowledgeTree({ domain, expanded, toggleBranch, navigate }: { domain: LearningDomain; expanded: string[]; toggleBranch: (id: string) => void; navigate: Navigate }) {
  const firstArticle = domain.branches.flatMap(branch => branch.nodes).find(node => node.articleId)
  return <>
    <nav className="ff-breadcrumb" aria-label="当前位置"><LearningLink href="/" navigate={navigate} restoreScroll>学习领域</LearningLink><span aria-hidden="true">/</span><span aria-current="page">{domain.title}</span></nav>
    <header className="ff-tree-intro"><p className="ff-kicker">KNOWLEDGE TREE</p><h1 className="ff-title">{domain.title}</h1><p className="ff-description">{domain.description}</p></header>
    <div className={'ff-tree-layout' + (!firstArticle ? ' ff-tree-layout-single' : '')}>
      <div><div className="ff-tree-list">
        {domain.branches.map(branch => {
          const open = expanded.includes(branch.id)
          const id = 'learning-branch-' + domain.id + '-' + branch.id
          return <section className="ff-branch" data-open={open} key={branch.id}>
            <h2><button type="button" className="ff-branch-toggle" aria-expanded={open} aria-controls={id} onClick={() => toggleBranch(branch.id)}><span><strong>{branch.title}</strong><small>{branch.description}</small></span><ChevronRight className="ff-chevron" size={18} aria-hidden="true" /></button></h2>
            <div className="ff-branch-body" id={id} inert={!open} aria-hidden={!open}><div className="ff-branch-inner"><div className="ff-leaves">
              {branch.nodes.map(node => node.articleId
                ? <LearningLink className="ff-leaf" data-ready="true" href={articleHref(domain.id, node.articleId)} navigate={navigate} key={node.id}><span>{node.title}</span><small>阅读 <ArrowRight size={12} aria-hidden="true" /></small></LearningLink>
                : <div className="ff-leaf" data-ready="false" key={node.id}><span>{node.title}</span><small>规划中</small></div>)}
            </div></div></div>
          </section>
        })}
      </div><p className="ff-planning">{firstArticle ? '内容随学习逐步补充。你可以从一个具体问题开始。' : '这是这一领域的内容规划，教程会随实际学习逐步补充。'}</p></div>
      {firstArticle?.articleId && <aside className="ff-tree-feature"><span className="ff-kicker">从一个问题开始</span><DomainArt domain={domain.id} /><h2>{firstArticle.title}</h2><p>先看见重点，再读懂细节。<br />从你每天看到的界面，开始理解设计。</p><LearningLink className="ff-primary" href={articleHref(domain.id, firstArticle.articleId)} navigate={navigate}>开始阅读 <ArrowRight size={15} aria-hidden="true" /></LearningLink></aside>}
    </div>
  </>
}

export default function LearningApp() {
  const [path, setPath] = useState(() => canonicalLearningPath(location.pathname))
  const pathRef = useRef(path)
  const scrollPositions = useRef(new Map<string, number>())
  const pendingScroll = useRef({ top: 0, focus: false, anchor: location.hash.slice(1) })
  const main = useRef<HTMLElement>(null)
  const about = useRef<HTMLDetailsElement>(null)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [expanded, setExpanded] = useState(readTreePreferences)
  const [hasNavigated, setHasNavigated] = useState(false)
  const route = readLearningRoute(path)

  useEffect(() => {
    document.documentElement.lang = 'zh-CN'
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const canonical = canonicalLearningPath(location.pathname)
    if (canonical !== location.pathname) history.replaceState(history.state, '', canonical === '/' ? '/' : canonical + location.search + location.hash)
    const onHistory = () => {
      const next = canonicalLearningPath(location.pathname)
      if (next === pathRef.current) return
      scrollPositions.current.set(pathRef.current, window.scrollY)
      if (next !== location.pathname) history.replaceState(history.state, '', next)
      pendingScroll.current = { top: scrollPositions.current.get(next) ?? 0, focus: true, anchor: location.hash.slice(1) }
      pathRef.current = next; setPath(next); setHasNavigated(true)
    }
    const closeAbout = (event: PointerEvent) => { if (about.current && !about.current.contains(event.target as Node)) about.current.open = false }
    addEventListener('popstate', onHistory)
    document.addEventListener('pointerdown', closeAbout)
    return () => { history.scrollRestoration = previous; removeEventListener('popstate', onHistory); document.removeEventListener('pointerdown', closeAbout) }
  }, [])

  useEffect(() => { try { localStorage.setItem(treeStorageKey, JSON.stringify(expanded)) } catch { /* Keep navigation usable without storage. */ } }, [expanded])
  useEffect(() => {
    applyAppearance(dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#191d24' : '#f6f7f9')
  }, [dark])

  useLayoutEffect(() => {
    const pending = pendingScroll.current
    const target = pending.anchor ? document.getElementById(pending.anchor) : null
    if (target) target.scrollIntoView({ behavior: 'instant' })
    else window.scrollTo({ top: pending.top, behavior: 'instant' })
    if (pending.focus) main.current?.focus({ preventScroll: true })
    if (about.current) about.current.open = false
  }, [path])

  useEffect(() => {
    const current = readLearningRoute(path)
    const domain = current.kind === 'domain' || current.kind === 'article' ? findDomain(current.domainId) : undefined
    const article = current.kind === 'article' ? findArticle(current.domainId, current.articleId) : undefined
    const title = article?.title ?? domain?.title ?? (current.kind === 'not-found' ? '未找到页面' : '')
    document.title = title ? title + ' · ' + BRAND_FULL_NAME : BRAND_FULL_NAME
    document.querySelector('meta[name="description"]')?.setAttribute('content', article?.description ?? domain?.description ?? BRAND_TAGLINE + '探索前端、后端、数据、部署与 Agent 协作的知识树。')
  }, [path])

  const navigate: Navigate = (href, restoreScroll = false) => {
    const url = new URL(href, location.href)
    const next = canonicalLearningPath(url.pathname)
    scrollPositions.current.set(pathRef.current, window.scrollY)
    pendingScroll.current = { top: restoreScroll ? scrollPositions.current.get(next) ?? 0 : 0, focus: true, anchor: url.hash.slice(1) }
    if (next === pathRef.current) { window.scrollTo({ top: pendingScroll.current.top, behavior: 'instant' }); main.current?.focus({ preventScroll: true }); return }
    history.pushState(history.state, '', next + url.search + url.hash)
    pathRef.current = next; setPath(next); setHasNavigated(true)
  }
  const toggleBranch = (domainId: DomainId, branchId: string) => setExpanded(previous => ({ ...previous, [domainId]: previous[domainId].includes(branchId) ? previous[domainId].filter(id => id !== branchId) : [...previous[domainId], branchId] }))

  return <div className="firstform-lab">
    <a className="ff-skip-link" href="#learning-main" onClick={() => main.current?.focus()}>跳转至主要内容</a>
    <div className="ff-container">
      <header className="ff-header">
        <LearningLink className="ff-brand" href="/" navigate={navigate} restoreScroll aria-label="初构首页"><span className="ff-mark" aria-hidden="true">f</span><span className="ff-brand-name">{BRAND_NAME}<small>{BRAND_ENGLISH_NAME}</small></span></LearningLink>
        <nav className="ff-nav" aria-label="主导航"><LearningLink className="ff-text-button" href="/" navigate={navigate} restoreScroll aria-current={route.kind === 'home' ? 'page' : undefined}>学习领域</LearningLink>
          <button type="button" className="ff-theme-button" aria-label={dark ? '切换亮色外观' : '切换深色外观'} aria-pressed={dark} onClick={() => setDark(value => !value)}>{dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</button>
          <details className="ff-about" ref={about} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary>关于初构</summary><p>在建设这个网站的过程中，理解设计、代码与工程，再把经验整理成可以探索、实践和复用的方法。</p></details>
        </nav>
      </header>
      <main ref={main} tabIndex={-1} id="learning-main" className="ff-main">
        <div className={'ff-view' + (hasNavigated ? ' ff-transition' : '')} key={path}>
          {route.kind === 'home' || route.kind === 'legacy' ? <Home navigate={navigate} /> : route.kind === 'domain'
            ? <KnowledgeTree domain={findDomain(route.domainId)!} expanded={expanded[route.domainId]} toggleBranch={id => toggleBranch(route.domainId, id)} navigate={navigate} />
            : route.kind === 'article' ? <ComfortablePage navigate={navigate} />
              : <section className="ff-not-found"><p className="ff-kicker">404</p><h1 className="ff-title">未找到这个页面</h1><p className="ff-description">可以回到学习领域，沿着知识树继续探索。</p><LearningLink href="/" navigate={navigate} className="ff-primary">回到学习领域 <ArrowRight size={15} aria-hidden="true" /></LearningLink></section>}
        </div>
      </main>
      <footer className="ff-footer"><span>{BRAND_FULL_NAME}</span><span>{BRAND_TAGLINE}</span></footer>
    </div>
  </div>
}
