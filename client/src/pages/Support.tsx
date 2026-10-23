import { Link } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import QrCode from '../components/QrCode'
import { useSeo } from '../hooks/useSeo'
import { useI18n } from '../i18n/core'
import { trackEvent } from '../lib/analytics'
import { MONO_JAR_URL, SUPPORT_READY } from '../lib/support'
import './Doc.css'
import './Support.css'

// "Support the project": a Monobank jar (any bank card, Apple / Google Pay)
// as a plain link plus a QR code for scanning from a desktop screen. No
// third-party widgets or scripts — the payment happens on monobank's page.
export default function Support() {
  const { t } = useI18n()
  useSeo({
    title: 'Support F1 Dashboard',
    description:
      'F1 Dashboard is free, with no ads and no accounts. Donations help pay for hosting and development.',
  })

  return (
    <section className="doc sup">
      <Breadcrumbs
        trail={[
          { name: t('nav.home'), path: '/' },
          { name: t('sup.title'), path: '/support' },
        ]}
      />
      <h1>{t('sup.title')}</h1>
      <p className="doc-lead">{t('sup.lead')}</p>

      <div className="sup-card">
        <div className="sup-main">
          <span className="sup-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M8 3h8M9 3v3.2C6.6 7.1 5 9.3 5 12v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6c0-2.7-1.6-4.9-4-5.8V3M9 13h6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h2 className="sup-name">{t('sup.jarTitle')}</h2>
          <p className="sup-text">{t('sup.jarText')}</p>
          {SUPPORT_READY ? (
            <a
              className="sup-btn"
              href={MONO_JAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('donate_click', { provider: 'monobank' })}
            >
              {t('sup.donate')}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 17 17 7M9 7h8v8"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          ) : (
            <p className="sup-soon">{t('sup.soon')}</p>
          )}
        </div>
        <figure className="sup-qr">
          <div className={SUPPORT_READY ? undefined : 'sup-qr-sample'}>
            <QrCode value={MONO_JAR_URL} label={t('sup.qrLabel')} />
            {!SUPPORT_READY && <span className="sup-qr-tag">{t('sup.sample')}</span>}
          </div>
          <figcaption>{t('sup.qrCaption')}</figcaption>
        </figure>
      </div>

      <h2>{t('sup.whereTitle')}</h2>
      <ul>
        <li>{t('sup.where1')}</li>
        <li>{t('sup.where2')}</li>
        <li>{t('sup.where3')}</li>
      </ul>
      <p>{t('sup.voluntary')}</p>

      <h2>{t('sup.otherTitle')}</h2>
      <p>
        {t('sup.otherText')} <Link to="/feedback">{t('sup.otherFeedback')}</Link>.
      </p>
    </section>
  )
}
