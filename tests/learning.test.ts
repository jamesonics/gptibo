import test from 'node:test'
import assert from 'node:assert/strict'
import { articleHref, domainHref, findArticle, learningArticles, learningDomains, restoreExpandedBranches } from '../src/learning/content.ts'
import { canonicalLearningPath, readLearningRoute } from '../src/learning/routing.ts'

test('learning tree references each published article in its own domain and branch', () => {
  const seenDomains = new Set<string>(), references = new Map<string, number>()
  for (const domain of learningDomains) {
    assert.ok(!seenDomains.has(domain.id)); seenDomains.add(domain.id)
    const seenBranches = new Set<string>(), seenNodes = new Set<string>()
    for (const branch of domain.branches) {
      assert.ok(!seenBranches.has(branch.id)); seenBranches.add(branch.id)
      assert.ok(branch.nodes.length)
      for (const node of branch.nodes) {
        assert.ok(!seenNodes.has(node.id)); seenNodes.add(node.id)
        if (!node.articleId) continue
        const article = findArticle(domain.id, node.articleId)
        assert.ok(article, 'A readable tree node must have article content')
        assert.equal(article.branchId, branch.id)
        references.set(article.id, (references.get(article.id) ?? 0) + 1)
      }
    }
  }
  assert.equal(seenDomains.size, 5)
  for (const article of learningArticles) assert.equal(references.get(article.id), 1)
})

test('home, domain and article URLs support direct entry and trailing slashes', () => {
  assert.deepEqual(readLearningRoute('/'), { kind: 'home' })
  for (const domain of learningDomains) {
    for (const path of [domainHref(domain.id), domainHref(domain.id) + '/']) assert.deepEqual(readLearningRoute(path), { kind: 'domain', domainId: domain.id })
  }
  for (const article of learningArticles) {
    const path = articleHref(article.domainId, article.id)
    assert.deepEqual(readLearningRoute(path), { kind: 'article', domainId: article.domainId, articleId: article.id })
    assert.equal(canonicalLearningPath(path + '/'), path)
  }
})

test('unknown, malformed and unpublished article URLs cannot resolve as readable content', () => {
  for (const path of ['/learn', '/learn/unknown', '/learn/frontend/card-depth', '/learn/backend/comfortable-page', '/learn/frontend/%2Fcomfortable-page', '/learn/frontend/%', '/learn/frontend/comfortable-page/extra']) {
    assert.deepEqual(readLearningRoute(path), { kind: 'not-found' }, path)
  }
})

test('old commerce entry points canonicalize to the learning homepage', () => {
  for (const path of ['/product/chatgpt', '/product/gmail/', '/orders', '/r/ABC123', '/s/example/product/chatgpt']) {
    assert.deepEqual(readLearningRoute(path), { kind: 'legacy' })
    assert.equal(canonicalLearningPath(path), '/')
  }
  for (const path of ['/products-not-a-route', '/orders-other']) assert.deepEqual(readLearningRoute(path), { kind: 'not-found' })
})

test('tree preferences preserve deliberately collapsed branches and discard removed nodes', () => {
  const restored = restoreExpandedBranches(JSON.stringify({ frontend: [], backend: ['reliability', 'deleted', 'reliability'], invalid: ['branch'] }))
  assert.deepEqual(restored.frontend, [])
  assert.deepEqual(restored.backend, ['reliability'])
  assert.deepEqual(restored.data, ['structure'])
  assert.deepEqual(Object.keys(restored), learningDomains.map(domain => domain.id))
})

test('unavailable, corrupt or incompatible stored preferences yield a usable tree', () => {
  for (const saved of [null, '{broken', 'null', 'true', '[]', '{"frontend":"all"}']) {
    const restored = restoreExpandedBranches(saved)
    for (const domain of learningDomains) assert.deepEqual(restored[domain.id], [domain.branches[0].id])
  }
})
