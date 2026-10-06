import { Link } from 'react-router-dom'

// Visible breadcrumb trail (Home › Drivers › Lewis Hamilton). Mirrors the
// BreadcrumbList JSON-LD and gives both users and crawlers internal links back
// up the hierarchy. The last item is the current page and isn't linked.
export default function Breadcrumbs({
  trail,
}: {
  trail: { name: string; path: string }[]
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
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
