import { Link } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import { useSeo } from '../hooks/useSeo'
import { useI18n } from '../i18n/core'
import './Doc.css'

// Bump when the text below changes.
const UPDATED = '2026-10-17'

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

function PrivacyEn({ updated }: { updated: string }) {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="doc-updated">Last updated: {updated}</p>
      <p className="doc-lead">
        F1 Dashboard has no accounts and no ads, and we don&apos;t sell any data. This page explains
        what is collected when you use the site and why.
      </p>

      <h2>Analytics</h2>
      <p>
        The live site uses Google Analytics 4 with Google Consent Mode, and only sets analytics
        cookies if you accept them in the cookie notice. With your consent, Google Analytics
        measures visits and pages viewed using cookies and processes information such as your
        device and browser type and an approximate location derived from your IP address.
      </p>
      <p>
        Until you accept — or if you decline — no analytics cookies are set. Google then receives
        only cookieless signals without an identifier (for example that a page was viewed, the
        browser type and the consent status), which cannot be tied to you across visits. See{' '}
        <Ext href="https://policies.google.com/privacy">Google&apos;s privacy policy</Ext> and{' '}
        <Ext href="https://support.google.com/analytics/answer/9976101">how consent mode works</Ext>.
      </p>
      <p>
        You can change your choice any time with <b>Cookie settings</b> at the bottom of every page;
        declining removes the analytics cookies set earlier. Browser tracking protection or a content
        blocker will also stop it.
      </p>

      <h2>Stored in your browser</h2>
      <ul>
        <li>
          <code>lang</code> — your interface language (EN / UA).
        </li>
        <li>
          <code>cookieConsent</code> — your answer to the cookie notice (accepted / declined).
        </li>
        <li>
          <code>chunkReloaded</code> — a one-off flag used after a site update to reload once.
        </li>
      </ul>
      <p>These stay on your device and are not sent to us.</p>

      <h2>Feedback form</h2>
      <p>
        When you send <Link to="/feedback">feedback</Link>, your message and the optional contact you
        enter are sent to our server and forwarded to the site owner through Telegram, a third-party
        messenger. They are used only to read and reply to your message and to improve the site, and
        are never published. Your IP address is used briefly, in memory, to limit spam and is not
        stored by us. Please don&apos;t include sensitive personal information.
      </p>

      <h2>Content from other services</h2>
      <p>
        To show fonts, photos and flags, your browser loads files directly from Google Fonts, the
        Formula 1 image CDN, Wikimedia Commons and flagcdn. Like any web request, these services
        receive your IP address. News links open Motorsport.com, which has its own policy.
      </p>

      <h2>Hosting</h2>
      <p>
        The site is hosted on Render. As with any hosting, the provider may keep standard technical
        logs (such as IP address and request time) for security and operations.
      </p>

      <h2>Questions</h2>
      <p>
        For questions about this policy or your data, use the <Link to="/feedback">feedback form</Link>.
      </p>
    </>
  )
}

function PrivacyUk({ updated }: { updated: string }) {
  return (
    <>
      <h1>Політика конфіденційності</h1>
      <p className="doc-updated">Оновлено: {updated}</p>
      <p className="doc-lead">
        У F1 Dashboard немає облікових записів і реклами, і ми не продаємо жодних даних. Тут
        пояснено, що збирається під час користування сайтом і навіщо.
      </p>

      <h2>Аналітика</h2>
      <p>
        Робочий сайт використовує Google Analytics 4 з режимом згоди Google (Consent Mode) і
        встановлює аналітичні cookie лише тоді, коли ви їх приймете у повідомленні про cookie. За
        вашої згоди Google Analytics рахує відвідування й переглянуті сторінки за допомогою cookie та
        обробляє інформацію про тип пристрою й браузера і приблизне місцезнаходження за IP-адресою.
      </p>
      <p>
        Доки ви не погодились — або якщо відмовились — аналітичні cookie не встановлюються. Google
        отримує лише сигнали без cookie й без ідентифікатора (наприклад, що сторінку переглянуто, тип
        браузера і стан згоди), за якими вас не можна впізнати між візитами. Див.{' '}
        <Ext href="https://policies.google.com/privacy">політику конфіденційності Google</Ext> і{' '}
        <Ext href="https://support.google.com/analytics/answer/9976101">як працює режим згоди</Ext>.
      </p>
      <p>
        Змінити вибір можна будь-коли кнопкою <b>Налаштування cookie</b> внизу кожної сторінки;
        відмова видаляє аналітичні cookie, встановлені раніше. Аналітику також зупиняє захист від
        стеження у браузері або блокувальник контенту.
      </p>

      <h2>Що зберігається у браузері</h2>
      <ul>
        <li>
          <code>lang</code> — мова інтерфейсу (EN / UA).
        </li>
        <li>
          <code>cookieConsent</code> — ваша відповідь на повідомлення про cookie (прийнято / відхилено).
        </li>
        <li>
          <code>chunkReloaded</code> — разова позначка для одного перезавантаження після оновлення
          сайту.
        </li>
      </ul>
      <p>Ці дані лишаються на вашому пристрої й не надсилаються нам.</p>

      <h2>Форма відгуку</h2>
      <p>
        Коли ви надсилаєте <Link to="/feedback">відгук</Link>, ваше повідомлення та необов&apos;язковий
        контакт передаються на наш сервер і пересилаються власнику сайту через Telegram — сторонній
        месенджер. Вони використовуються лише для того, щоб прочитати повідомлення, відповісти та
        покращити сайт, і ніколи не публікуються. IP-адреса ненадовго використовується в пам&apos;яті
        сервера для захисту від спаму й не зберігається нами. Будь ласка, не додавайте чутливих
        особистих даних.
      </p>

      <h2>Вміст з інших сервісів</h2>
      <p>
        Щоб показати шрифти, фото й прапори, ваш браузер завантажує файли безпосередньо з Google
        Fonts, CDN зображень Formula 1, Wikimedia Commons і flagcdn. Як і за будь-якого вебзапиту,
        ці сервіси отримують вашу IP-адресу. Посилання на новини відкривають Motorsport.com, який
        має власну політику.
      </p>

      <h2>Хостинг</h2>
      <p>
        Сайт розміщено на Render. Як і будь-який хостинг, провайдер може зберігати стандартні
        технічні журнали (наприклад, IP-адресу та час запиту) для безпеки й роботи сервісу.
      </p>

      <h2>Питання</h2>
      <p>
        З питаннями щодо цієї політики чи ваших даних звертайтеся через{' '}
        <Link to="/feedback">форму відгуку</Link>.
      </p>
    </>
  )
}

export default function Privacy() {
  const { t, lang, fmtDate } = useI18n()
  useSeo({
    title: 'Privacy Policy',
    description:
      'How F1 Dashboard handles data: Google Analytics, what is stored in your browser, the feedback form, third-party content and hosting.',
  })
  const updated = fmtDate(UPDATED, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <section className="doc">
      <Breadcrumbs
        trail={[
          { name: t('nav.home'), path: '/' },
          { name: t('nav.privacy'), path: '/privacy' },
        ]}
      />
      {lang === 'uk' ? <PrivacyUk updated={updated} /> : <PrivacyEn updated={updated} />}
    </section>
  )
}
