import { dicts, langFromPath, localizedPath } from '../i18n/core'
import './ErrorScreen.css'

// What a visitor sees when a page fails to render (ErrorBoundary): what
// happened, a reload, the way home and where to report it. It reads the
// language from the address and uses plain links rather than the router or
// the i18n context, so it also works when the error took those down
// (`standalone`: the app's outermost boundary, with no header around it).

// A page's code chunk that can't be loaded: almost always a visitor on the
// previous version after a deploy (App.tsx's lazyPage has already reloaded
// once), so the screen says so.
const isUpdate = (error: Error) =>
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
    String(error?.message ?? ''),
  )

export default function ErrorScreen({ error, standalone = false }: { error: Error; standalone?: boolean }) {
  const lang = langFromPath(window.location.pathname)
  const d = dicts[lang]
  const update = isUpdate(error)

  return (
    <section className={`err${standalone ? ' err--standalone' : ''}`} role="alert">
      <h1>{update ? d['err.updateTitle'] : d['err.title']}</h1>
      <p className="err-lead">{update ? d['err.updateLead'] : d['err.lead']}</p>
      <div className="err-actions">
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          {d['err.reload']}
        </button>
        <a className="btn" href={localizedPath('/', lang)}>
          {d['nf.home']}
        </a>
      </div>
      {!update && (
        <p className="err-note">
          {d['err.report']} <a href={localizedPath('/feedback', lang)}>{d['err.reportLink']}</a>
        </p>
      )}
    </section>
  )
}
