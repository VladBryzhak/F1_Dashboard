import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/core'

// Visible breadcrumb trail (Home › Drivers › Lewis Hamilton). Mirrors the
// BreadcrumbList JSON-LD and gives both users and crawlers internal links back
// up the hierarchy. The last item is the current page and isn't linked.
export default function Breadcrumbs({
  trail,
}: {
  trail: { name: string; path: string }[]
}) {
  const { t } = useI18n()
  return (
    <nav className="breadcrumbs" aria-label={t('nav.breadcrumb')}>
      {trail.map((t, i) => {
        const last = i === trail.length - 1
        return (
          <span className="crumb" key={t.path}>
            {last ? (
              <span aria-current="page">{t.name}</span>
            ) : (
              <>
                <Link to={t.path}>{t.name}</Link>
                <span className="sep" aria-hidden="true">
                  ›
                </span>
              </>
            )}
          </span>
        )
      })}
    </nav>
  )
}
