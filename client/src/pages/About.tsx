import { Link } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import { useSeo } from '../hooks/useSeo'
import { useI18n } from '../i18n/core'
import './Doc.css'

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

function AboutEn() {
  return (
    <>
      <h1>About F1 Dashboard</h1>
      <p className="doc-lead">
        F1 Dashboard is an independent, fan-made Formula 1 statistics site. It brings championship
        standings, the race calendar with weekend schedules, full race weekends (race, sprint,
        qualifying and practice), circuit guides, driver and team histories since 1950, head-to-head
        comparisons, telemetry, live timing and race replays together in one place.
      </p>

      <h2>Where the data comes from</h2>
      <ul>
        <li>
          <Ext href="https://github.com/f1db/f1db">f1db</Ext> (
          <Ext href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Ext>) — results,
          standings, schedules, circuits, drivers and teams from 1950 to today. It is refreshed
          after race weekends.
        </li>
        <li>
          <Ext href="https://openf1.org">OpenF1</Ext> — live timing, telemetry, laps, tyres and
          weather, from 2023 onwards.
        </li>
        <li>
          <Ext href="https://commons.wikimedia.org">Wikimedia Commons</Ext> — driver photos and team
          logos/photos under free licences (CC BY-SA or public domain), credited to their authors.
        </li>
        <li>
          <Ext href="https://flagcdn.com">flagcdn</Ext> — flag icons.
        </li>
        <li>
          <Ext href="https://github.com/bacinger/f1-circuits">f1-circuits</Ext> (MIT, © Tomislav
          Bacinger) — circuit geodata; the track outlines are drawn from it.
        </li>
        <li>
          News headlines on the home page come from the Motorsport.com RSS feed and link to the
          original articles.
        </li>
      </ul>

      <h2>Accuracy</h2>
      <p>
        The data comes from community-maintained sources. It can occasionally contain mistakes or
        lag behind the latest session, and it is not official timing or classification. Lap charts
        show the on-track order, before any penalties.
      </p>

      <h2>Independence</h2>
      <p>
        This project is not affiliated with, endorsed by, or associated with Formula 1, Formula One
        Management or the FIA. F1, FORMULA 1 and related marks are trademarks of Formula One
        Licensing B.V.
      </p>

      <h2>Languages</h2>
      <p>
        The site is available in English and Ukrainian. It starts in your browser&apos;s language,
        and the EN / UA switch in the header remembers your choice in this browser.
      </p>

      <h2>Contact</h2>
      <p>
        Found a bug or have an idea? Use the <Link to="/feedback">feedback form</Link>. See also the{' '}
        <Link to="/privacy">privacy policy</Link>.
      </p>
    </>
  )
}

function AboutUk() {
  return (
    <>
      <h1>Про F1 Dashboard</h1>
      <p className="doc-lead">
        F1 Dashboard — незалежний фанатський сайт зі статистикою Формули-1. Тут зібрано турнірні
        таблиці, календар із розкладом вікендів, повні вікенди (гонка, спринт, кваліфікація й
        практики), путівники трасами, історію пілотів і команд з 1950 року, порівняння пілотів,
        телеметрію, live-таймінг і повтори гонок.
      </p>

      <h2>Звідки дані</h2>
      <ul>
        <li>
          <Ext href="https://github.com/f1db/f1db">f1db</Ext> (
          <Ext href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Ext>) — результати,
          заліки, розклади, траси, пілоти й команди з 1950 року до сьогодні. Оновлюється після
          гоночних вікендів.
        </li>
        <li>
          <Ext href="https://openf1.org">OpenF1</Ext> — live-таймінг, телеметрія, кола, шини й
          погода, починаючи з 2023 року.
        </li>
        <li>
          <Ext href="https://commons.wikimedia.org">Wikimedia Commons</Ext> — фото пілотів і
          логотипи/фото команд за вільними ліцензіями (CC BY-SA або суспільне надбання) із
          зазначенням авторів.
        </li>
        <li>
          <Ext href="https://flagcdn.com">flagcdn</Ext> — іконки прапорів.
        </li>
        <li>
          <Ext href="https://github.com/bacinger/f1-circuits">f1-circuits</Ext> (MIT, © Tomislav
          Bacinger) — геодані трас, за якими намальовано схеми трас.
        </li>
        <li>
          Заголовки новин на головній беруться з RSS Motorsport.com і ведуть на оригінальні статті.
        </li>
      </ul>

      <h2>Точність</h2>
      <p>
        Дані надходять із джерел, які підтримує спільнота. Інколи в них трапляються помилки або
        затримки після останньої сесії, і це не офіційний таймінг чи класифікація. Графік позицій
        показує порядок на трасі без урахування штрафів.
      </p>

      <h2>Незалежність</h2>
      <p>
        Проєкт не пов&apos;язаний із Formula 1, Formula One Management чи FIA і не схвалений ними.
        F1, FORMULA 1 та пов&apos;язані знаки є торговельними марками Formula One Licensing B.V.
      </p>

      <h2>Мови</h2>
      <p>
        Сайт доступний англійською та українською. Спершу він відкривається мовою вашого браузера, а
        перемикач EN / UA у хедері запам&apos;ятовує вибір у цьому браузері.
      </p>

      <h2>Зв&apos;язок</h2>
      <p>
        Знайшли помилку чи маєте ідею? Скористайтеся <Link to="/feedback">формою відгуку</Link>.
        Також див. <Link to="/privacy">політику конфіденційності</Link>.
      </p>
    </>
  )
}

export default function About() {
  const { t, lang } = useI18n()
  useSeo({
    title: 'About',
    description:
      'About F1 Dashboard: an independent, fan-made Formula 1 statistics site — where the data comes from (f1db, OpenF1, Wikimedia Commons), accuracy and independence.',
  })
  return (
    <section className="doc">
      <Breadcrumbs
        trail={[
          { name: t('nav.home'), path: '/' },
          { name: t('nav.about'), path: '/about' },
        ]}
      />
      {lang === 'uk' ? <AboutUk /> : <AboutEn />}
    </section>
  )
}
