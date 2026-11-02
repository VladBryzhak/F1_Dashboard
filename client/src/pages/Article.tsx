import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ArticleCover, { ArticleMeta } from '../components/ArticleCover'
import Breadcrumbs from '../components/Breadcrumbs'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n, type TKey } from '../i18n/core'
import { articleLd, breadcrumbLd } from '../lib/jsonld'
import { seoText } from '../lib/seoText'
import NotFound from './NotFound'
import './Article.css'

const INSTAGRAM = 'https://www.instagram.com'

// The text comes from the server as HTML (services/articles.ts). Two things
// in it need the app: links to our own pages move within the app instead of
// reloading it, and an Instagram post loads only when the reader presses its
// button. Until then nothing is fetched from Instagram; then the post's own
// embed frame takes the placeholder's place.
function useArticleBody(ref: React.RefObject<HTMLDivElement>, html: string | undefined) {
  const navigate = useNavigate()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const show = target.closest<HTMLButtonElement>('.art-ig-show')
      if (show) {
        const fig = show.closest<HTMLElement>('.art-ig')
        const url = fig?.dataset.ig
        const box = fig?.querySelector('.art-ig-box')
        if (!url || !box) return
        const frame = document.createElement('iframe')
        frame.className = 'art-ig-frame'
        frame.src = `${url}embed/captioned/`
        frame.title = show.textContent ?? 'Instagram'
        frame.setAttribute('scrolling', 'no')
        box.replaceWith(frame)
        return
      }
      const link = target.closest('a')
      if (!link || link.target || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const href = link.getAttribute('href') ?? ''
      if (!href.startsWith('/') || href.startsWith('//')) return
      e.preventDefault()
      // Ukrainian links carry /uk, which the router adds itself.
      navigate(href.replace(/^\/uk(?=\/|$)/, '') || '/')
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [ref, html, navigate])

  // The embed frame tells the page how tall the post is.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== INSTAGRAM || typeof e.data !== 'string') return
      let msg: { type?: string; details?: { height?: number } }
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      const height = msg.type === 'MEASURE' ? msg.details?.height : undefined
      if (!height) return
      ref.current?.querySelectorAll<HTMLIFrameElement>('iframe.art-ig-frame').forEach((f) => {
        if (f.contentWindow === e.source) f.style.height = `${Math.ceil(height)}px`
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [ref])
}

// /articles/:slug: the cover with the headline, one reading column, and three
// more articles to read next.
export default function Article() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { t, lang, fmtDate } = useI18n()
  const { data: a, loading, error, notFound } = useAsync(() => api.article(slug, lang), [slug, lang])
  const body = useRef<HTMLDivElement>(null)
  useArticleBody(body, a?.html)

  const trail = a
    ? [
        { name: t('nav.home'), path: '/' },
        { name: t('art.title'), path: '/articles' },
        { name: a.title, path: `/articles/${a.slug}` },
      ]
    : []
  useSeo({
    skip: notFound,
    ...(a ? seoText.article(a) : {}),
    jsonLd: a ? [articleLd(a), breadcrumbLd(trail)] : undefined,
  })

  if (notFound) return <NotFound kind="article" />
  if (loading) return <p className="muted">{t('common.loading')}</p>
  if (error || !a) return <p className="banner">{t('art.loadOneError', { error: error ?? '' })}</p>

  return (
    <article className="art">
      <Breadcrumbs trail={trail} />
      <header className="art-head">
        <ArticleCover cover={a.cover} season={a.season} eager caption className="art-head-cover" />
        <div className="art-head-text">
          <span className="hero-chip">{t(`art.tag.${a.tag}` as TKey)}</span>
          <h1 className="art-title">{a.title}</h1>
          <p className="art-byline">
            <span>Paddock Times</span>
            <time className="mono" dateTime={a.date}>
              {fmtDate(a.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </time>
            <span>{t('art.minRead', { n: a.minutes })}</span>
          </p>
        </div>
      </header>
      {a.cover.credit && (
        <p className="art-cover-credit">
          <span className="art-credit">
            {t('art.photo')}: {a.cover.credit}
          </span>
        </p>
      )}

      <div className="art-column">
        <p className="art-dek art-dek--lead">{a.description}</p>
        <div className="art-prose" ref={body} dangerouslySetInnerHTML={{ __html: a.html }} />
      </div>

      {a.related.length > 0 && (
        <section className="art-related">
          <h2 className="art-related-title">{t('art.related')}</h2>
          <div className="art-grid">
            {a.related.map((r) => (
              <Link key={r.slug} to={`/articles/${r.slug}`} className="art-card">
                <ArticleCover cover={r.cover} season={r.season} />
                <div className="art-card-body">
                  <ArticleMeta a={r} gp={false} />
                  <span className="art-card-title">{r.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
