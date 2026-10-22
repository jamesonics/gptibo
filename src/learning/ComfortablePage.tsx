import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { domainHref } from './content'
import { LearningLink, type Navigate } from './Link'

export default function ComfortablePage({ navigate }: { navigate: Navigate }) {
  const [hierarchy, setHierarchy] = useState<'clear' | 'flat'>('clear')
  const [space, setSpace] = useState(26)
  return <>
    <nav className="ff-breadcrumb" aria-label="当前位置">
      <LearningLink href="/" navigate={navigate} restoreScroll>学习领域</LearningLink><span aria-hidden="true">/</span>
      <LearningLink href={domainHref('frontend')} navigate={navigate} restoreScroll>前端与交互</LearningLink><span aria-hidden="true">/</span>
      <span aria-current="page">页面与信息设计</span>
    </nav>
    <header className="ff-article-heading"><p className="ff-kicker">页面设计 · 讲解与实验</p><h1>一个页面，<br />为什么看起来舒服？</h1><p className="ff-description">舒服，往往来自一组彼此配合的选择：先看见什么、内容怎样分组，以及视觉重量如何分配。</p></header>
    <div className="ff-article-grid">
      <article className="ff-reading">
        <section id="lesson-hierarchy"><h2>先看见重点，再读懂细节</h2>
          <p>打开一个页面时，我们通常先扫视，再决定从哪里读起。标题、说明和操作之间需要有明确的轻重关系，让视线找到落点。</p>
          <p>下面保留同一份内容，调整文字的层级。观察哪种状态更容易让你理解：<strong>这里是什么，以及接下来可以做什么。</strong></p>
          <div className="ff-experiment">
            <div className="ff-experiment-tools"><span>同样的内容，两种层级</span><div className="ff-segments" role="group" aria-label="切换排版层级">
              <button type="button" aria-pressed={hierarchy === 'clear'} onClick={() => setHierarchy('clear')}>重点清楚</button>
              <button type="button" aria-pressed={hierarchy === 'flat'} onClick={() => setHierarchy('flat')}>平均用力</button>
            </div></div>
            <div className="ff-sample-area"><div className="ff-sample" data-hierarchy={hierarchy} style={{ padding: space }}>
              <small>一个小小的实践</small><h3>搭一个自己的小网站</h3><p>从页面开始，连接数据，<br />再把它发到互联网上。</p><span className="ff-sample-action">进入实验 →</span>
            </div></div>
            <label className="ff-space-control" htmlFor="learning-space"><span>卡片留白</span><input id="learning-space" type="range" min={16} max={36} value={space} step={1} onChange={event => setSpace(Number(event.target.value))} /><output htmlFor="learning-space">{space}px</output></label>
          </div>
          <p className="ff-caption">“进入实验”是用于观察排版的示意文字。试着调整留白，比较文字与边缘的距离，以及各部分之间的关系。</p>
          <p>这里同时改变了字号、字重和颜色，用来观察它们共同作用的结果。实际设计时，可以每次只调整一个参数，判断是哪一项让重点变得更清楚。</p>
        </section>
        <section id="lesson-space"><h2>空间也在组织信息</h2>
          <p>靠近的内容容易被看作一组。标题和解释可以相互靠近；进入下一段主题时，则需要更明显的间隔。这样的距离关系，会帮助读者理解内容的结构。</p>
          <p>设计时，可以先确定几个稳定的间距档位，再根据内容调整。重要的是让相同关系使用相近的距离，让每次留白都有作用。</p>
          <p>例如，在初构首页，领域标题和说明放在一起，插图占据中间的空间，进入知识树的操作放在底部。卡片之间再留出距离，形成几个可以独立浏览的区域。</p>
        </section>
        <section id="lesson-method"><h2>把观察整理成方法</h2>
          <ul><li>为页面确定一个明确的视觉重点。</li><li>用字号、字重和颜色表达信息的轻重。</li><li>让相关内容靠近，让不同主题之间留出空间。</li><li>放入真实文字，再检查手机上的阅读节奏。</li></ul>
          <p>这些选择要一起看：放大标题后，需要重新检查换行和留白；改变卡片宽度后，也要重新看文字是否拥挤。一个具体数值适合当前页面，并不意味着它适合所有内容。</p>
        </section>
        <section id="lesson-practice"><h2>试着亲手改一次</h2>
          <p>先选首页的一张领域卡片，画出标题、说明、插图和操作的位置。写下你希望访客先看见什么，再调整一个参数，对照桌面和手机的效果。</p>
          <p>可以从三个问题开始：标题变长后还能看清重点吗？说明增加一行后是否仍然从容？使用键盘时，能看清当前聚焦的位置吗？</p>
          <details className="ff-source-note"><summary>找到这个实验的实现</summary><p><code>src/learning/ComfortablePage.tsx</code> 保存实验的选择状态与留白数值；<code>src/learning/learning.css</code> 中的 <code>.ff-sample</code> 控制视觉表现。先改一个数值，再观察实际页面。</p></details>
        </section>
        <details className="ff-prompt"><summary>怎样把这个要求讲给 Agent</summary><pre>{`请先说明页面最重要的信息，以及用户接下来要做的事。
围绕这个顺序安排标题、说明和操作的视觉层级。
把相同关系使用的间距整理为一组参数，并解释取舍。
完成后放入真实内容，检查手机端、长标题和键盘操作。
一次只修改一个小范围，让我能理解变化与结果的关系。`}</pre></details>
        <div className="ff-article-bottom"><LearningLink className="ff-text-button" href={domainHref('frontend')} navigate={navigate} restoreScroll><ArrowLeft size={15} /> 返回前端知识树</LearningLink><span>继续探索：布局、组件与动效</span></div>
      </article>
      <aside className="ff-toc" aria-label="本文目录"><span>这一篇里</span>
        <a href="#lesson-hierarchy">先看见重点</a><a href="#lesson-space">空间与分组</a><a href="#lesson-method">可复用的方法</a><a href="#lesson-practice">亲手改一次</a>
      </aside>
    </div>
  </>
}
