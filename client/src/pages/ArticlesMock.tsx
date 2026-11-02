// TEMP: design mock-ups for the articles section (dev only, /mock/articles).
// Removed once a variant is chosen.
import type { CSSProperties, ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Headshot } from '../components/EntityCards'
import { driverPortraitUrl, teamColor } from '../lib/f1meta'
import './Home.css'
import '../components/HeroSlider.css'
import './ArticlesMock.css'

const VARIANTS: { id: string; group: string; label: string }[] = [
  { id: 'a1', group: 'Сторінка «Статті»', label: 'А1 Обкладинка' },
  { id: 'a2', group: 'Сторінка «Статті»', label: 'А2 Редакція' },
  { id: 'a3', group: 'Сторінка «Статті»', label: 'А3 Вікенди' },
  { id: 'c1', group: 'Стаття', label: 'С1 Журнал' },
  { id: 'c2', group: 'Стаття', label: 'С2 Панель даних' },
  { id: 'g1', group: 'Слайд на головній', label: 'Г1 Фото' },
  { id: 'g2', group: 'Слайд на головній', label: 'Г2 Типографіка' },
]

type Cover =
  | { kind: 'photo'; driverId: string; constructorId: string; number: string }
  | { kind: 'type'; constructorId: string | null; big: string; mono?: boolean }

interface MockArticle {
  slug: string
  title: string
  dek: string
  day: string
  date: string
  gp: string
  round: number
  tag: string
  minutes: number
  cover: Cover
}

const CHAMP: MockArticle = {
  slug: 'champion',
  title: 'Антонеллі чемпіон: сезон у п’яти цифрах',
  dek: 'Титул вирішено в Мехіко. Розбираємо, як Кімі набрав відрив у 119 очок і чому вирішальними стали не перемоги, а подіуми.',
  day: 'Між етапами',
  date: '02.11',
  gp: 'Гран-прі Мехіко',
  round: 19,
  tag: 'Аналітика',
  minutes: 6,
  cover: { kind: 'photo', driverId: 'kimi-antonelli', constructorId: 'mercedes', number: '12' },
}

const WEEKEND: MockArticle[] = [
  {
    slug: 'race',
    title: 'Ферстаппен виграє в Мехіко, а святкують у Mercedes',
    dek: 'Перемога Red Bull уже нічого не змінила в чемпіонаті. Що показала гонка про темп на високогір’ї.',
    day: 'Нд',
    date: '01.11',
    gp: 'Гран-прі Мехіко',
    round: 19,
    tag: 'Підсумки гонки',
    minutes: 5,
    cover: { kind: 'type', constructorId: 'red-bull', big: 'P1', mono: true },
  },
  {
    slug: 'quali',
    title: 'Хемілтон на поулі: Ferrari швидка на одному колі',
    dek: 'Перше місце на старті з відривом у дев’ять тисячних. Де Ferrari виграла час у третьому секторі.',
    day: 'Сб',
    date: '31.10',
    gp: 'Гран-прі Мехіко',
    round: 19,
    tag: 'Кваліфікація',
    minutes: 4,
    cover: { kind: 'photo', driverId: 'lewis-hamilton', constructorId: 'ferrari', number: '44' },
  },
  {
    slug: 'friday',
    title: 'П’ятниця в Мехіко: 2240 метрів над морем',
    dek: 'Розріджене повітря, мало притискної сили і перегріті гальма. Хто краще підготувався до висоти.',
    day: 'Пт',
    date: '30.10',
    gp: 'Гран-прі Мехіко',
    round: 19,
    tag: 'Практики',
    minutes: 4,
    cover: { kind: 'type', constructorId: null, big: '2240 м', mono: true },
  },
]

const AUSTIN: MockArticle[] = [
  {
    slug: 'austin-race',
    title: 'Остін: як вибір шин вирішив гонку',
    dek: 'Одна зупинка проти двох і де саме стратегія принесла подіум.',
    day: 'Нд',
    date: '25.10',
    gp: 'Гран-прі США',
    round: 18,
    tag: 'Підсумки гонки',
    minutes: 5,
    cover: { kind: 'photo', driverId: 'lando-norris', constructorId: 'mclaren', number: '1' },
  },
  {
    slug: 'austin-quali',
    title: 'Субота в Остіні: найщільніша кваліфікація сезону',
    dek: 'Десять пілотів у межах трьох десятих.',
    day: 'Сб',
    date: '24.10',
    gp: 'Гран-прі США',
    round: 18,
    tag: 'Кваліфікація',
    minutes: 4,
    cover: { kind: 'type', constructorId: 'mclaren', big: '0.300', mono: true },
  },
  {
    slug: 'midweek-leclerc',
    title: 'Леклер і Ferrari: що змінилось після літньої перерви',
    dek: 'Порівнюємо темп першої і другої половини сезону.',
    day: 'Між етапами',
    date: '21.10',
    gp: 'Гран-прі США',
    round: 18,
    tag: 'Пілоти',
    minutes: 7,
    cover: { kind: 'photo', driverId: 'charles-leclerc', constructorId: 'ferrari', number: '16' },
  },
]

const ARCHIVE = [...WEEKEND, ...AUSTIN]

function CoverArt({ cover, eager = false, className = '' }: { cover: Cover; eager?: boolean; className?: string }) {
  const color = cover.constructorId ? teamColor(cover.constructorId) : 'var(--color-accent)'
  if (cover.kind === 'photo') {
    return (
      <div className={`am-cover am-cover--photo ${className}`} style={{ '--team': color } as CSSProperties}>
        <span className="am-cover-num" aria-hidden="true">
          {cover.number}
        </span>
        <span className="am-cover-stripe" aria-hidden="true" />
        <Headshot
          portraitUrl={driverPortraitUrl(cover.driverId, cover.constructorId, '2026')}
          width={450}
          height={1293}
          eager={eager}
        />
      </div>
    )
  }
  return (
    <div className={`am-cover am-cover--type ${className}`} style={{ '--team': color } as CSSProperties}>
      <span className="am-cover-stripe" aria-hidden="true" />
      <span
        className={`am-cover-big${cover.mono ? ' mono' : ''}`}
        // As large as the frame allows for the text's length.
        style={{ fontSize: `${Math.min(34, 140 / cover.big.length)}cqi` }}
        aria-hidden="true"
      >
        {cover.big}
      </span>
    </div>
  )
}

function Meta({ a, gp = true }: { a: MockArticle; gp?: boolean }) {
  return (
    <p className="am-meta">
      <span className="am-day">{a.day}</span>
      <span className="mono">{a.date}</span>
      {gp && <span>{a.gp}</span>}
      <span>{a.minutes} хв</span>
    </p>
  )
}

function Card({ a, dek = true, className = '' }: { a: MockArticle; dek?: boolean; className?: string }) {
  return (
    <Link to="?v=c1" className={`am-card ${className}`}>
      <CoverArt cover={a.cover} />
      <div className="am-card-body">
        <Meta a={a} gp={false} />
        <h3 className="am-card-title">{a.title}</h3>
        {dek && <p className="am-dek">{a.dek}</p>}
      </div>
    </Link>
  )
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// The lead article as a wide cover with the headline beside it.
function Lead({ a, compact = false }: { a: MockArticle; compact?: boolean }) {
  return (
    <article className={`am-lead${compact ? ' am-lead--compact' : ''}`}>
      <CoverArt cover={a.cover} eager className="am-lead-cover" />
      <div className="am-lead-body">
        <span className="hero-chip">Свіже</span>
        <Meta a={a} />
        <h2 className="am-lead-title">{a.title}</h2>
        <p className="am-dek am-dek--lead">{a.dek}</p>
        <Link to="?v=c1" className="hero-cta">
          Читати статтю <Arrow />
        </Link>
      </div>
    </article>
  )
}

function PageHead() {
  return (
    <header className="am-head">
      <h1 className="am-h1">Статті</h1>
      <p className="am-intro">Розбори кожного дня гоночного вікенду і матеріали між етапами.</p>
    </header>
  )
}

const FILTERS = ['Усі', 'Підсумки сесій', 'Аналітика', 'Пілоти', 'Команди']

function Filters() {
  return (
    <div className="am-filters" role="group" aria-label="Тема">
      {FILTERS.map((f, i) => (
        <button key={f} type="button" className={`am-filter${i === 0 ? ' is-on' : ''}`} aria-pressed={i === 0}>
          {f}
        </button>
      ))}
    </div>
  )
}

// А1: a wide cover for the latest piece, this weekend's three below, then a
// plain archive list by month.
function PageA1() {
  return (
    <>
      <PageHead />
      <Lead a={CHAMP} />
      <section className="am-section">
        <h2 className="am-h2">Цей вікенд: Гран-прі Мехіко</h2>
        <div className="am-grid3">
          {WEEKEND.map((a) => (
            <Card key={a.slug} a={a} />
          ))}
        </div>
      </section>
      <section className="am-section">
        <div className="am-section-head">
          <h2 className="am-h2">Архів</h2>
          <Filters />
        </div>
        <h3 className="am-month">Жовтень 2026</h3>
        <ul className="am-rows">
          {ARCHIVE.map((a) => (
            <li key={a.slug}>
              <Link to="?v=c1" className="am-row">
                <span className="am-row-date mono">{a.date}</span>
                <span className="am-row-title">{a.title}</span>
                <span className="am-row-tag">{a.tag}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

// А2: a newsroom front: the lead card with the latest four beside it, then
// the archive as a card grid with topic filters.
function PageA2() {
  return (
    <>
      <PageHead />
      <div className="am-front">
        <Card a={CHAMP} className="am-card--lead" />
        <ol className="am-latest">
          {[...WEEKEND, AUSTIN[0]].map((a) => (
            <li key={a.slug}>
              <Link to="?v=c1" className="am-latest-item">
                <CoverArt cover={a.cover} className="am-thumb" />
                <span className="am-latest-text">
                  <Meta a={a} gp={false} />
                  <span className="am-latest-title">{a.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <section className="am-section">
        <div className="am-section-head">
          <h2 className="am-h2">Усі статті</h2>
          <Filters />
        </div>
        <div className="am-grid3">
          {ARCHIVE.map((a) => (
            <Card key={a.slug} a={a} dek={false} />
          ))}
        </div>
        <div className="am-more">
          <button type="button" className="btn">
            Показати ще
          </button>
        </div>
      </section>
    </>
  )
}

// А3: the season as a run of race weekends; each round lists its Friday,
// Saturday, Sunday and between-rounds pieces in order.
function Weekend({ round, gp, dates, items }: { round: number; gp: string; dates: string; items: MockArticle[] }) {
  return (
    <section className="am-wk">
      <div className="am-wk-side">
        <span className="am-wk-round mono">{round}</span>
        <span className="am-wk-gp">{gp}</span>
        <span className="am-wk-dates mono">{dates}</span>
      </div>
      <ol className="am-wk-list">
        {items.map((a) => (
          <li key={a.slug}>
            <Link to="?v=c1" className="am-wk-item">
              <span className="am-wk-day">{a.day}</span>
              <span className="am-wk-text">
                <span className="am-wk-title">{a.title}</span>
                <span className="am-dek">{a.dek}</span>
              </span>
              <CoverArt cover={a.cover} className="am-thumb" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

function PageA3() {
  return (
    <>
      <PageHead />
      <Lead a={CHAMP} compact />
      <div className="am-section-head am-section">
        <h2 className="am-h2">Сезон 2026 по етапах</h2>
        <span className="am-season">
          Сезон <span className="mono">2026</span>
        </span>
      </div>
      <Weekend round={19} gp="Гран-прі Мехіко" dates="30.10 · 02.11" items={[CHAMP, ...WEEKEND]} />
      <Weekend round={18} gp="Гран-прі США" dates="21.10 · 25.10" items={AUSTIN} />
    </>
  )
}

// ---------- Article ----------

const STATS: [string, string][] = [
  ['Очки', '380'],
  ['Перемоги', '9'],
  ['Подіуми', '16'],
  ['Відрив', '+119'],
]

function Credit({ children }: { children: ReactNode }) {
  return <span className="am-credit">{children}</span>
}

function Figure() {
  return (
    <figure className="am-figure">
      <CoverArt cover={CHAMP.cover} className="am-figure-art" />
      <figcaption>
        Кімі Антонеллі, Mercedes, сезон 2026.{' '}
        <Credit>
          Фото: <a href="#">Mercedes-AMG F1 Team</a>, медіацентр команди
        </Credit>
      </figcaption>
    </figure>
  )
}

// Instagram loads only on a click: until then nothing goes to instagram.com.
function InstagramFacade() {
  return (
    <figure className="am-ig">
      <div className="am-ig-box">
        <span className="am-ig-label">Пост з Instagram</span>
        <span className="am-ig-handle">@kimi.antonelli</span>
        <p className="am-ig-note">
          Пост завантажиться з instagram.com, коли ти натиснеш кнопку. Instagram може встановити свої cookies.
        </p>
        <button type="button" className="btn">
          Показати пост
        </button>
        <a href="#" className="am-ig-open">
          Відкрити в Instagram
        </a>
      </div>
      <figcaption>
        <Credit>Пост: @kimi.antonelli в Instagram</Credit>
      </figcaption>
    </figure>
  )
}

function StatBlock() {
  return (
    <aside className="am-stats" aria-label="Сезон у цифрах">
      <h2 className="am-stats-title">Сезон у цифрах</h2>
      <dl>
        {STATS.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="mono">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="am-stats-src">Дані: f1db, після етапу 19</p>
    </aside>
  )
}

function Body({ stats = true }: { stats?: boolean }) {
  return (
    <div className="am-prose">
      <p className="am-lede">
        Кімі Антонеллі став чемпіоном світу у 20 років. Титул вирішився в Мехіко: після гонки відрив від другого
        місця перевищив усі очки, які ще можна набрати до кінця сезону.
      </p>
      <h2 id="s1">Стабільність замість серій</h2>
      <p>
        Дев’ять перемог це багато, але головне інше: 16 подіумів. У поганий день Антонеллі все одно привозив
        великі очки, і саме це зробило відрив недосяжним задовго до фіналу.
      </p>
      <Figure />
      <p>
        Порівняння з напарником показує ту саму картину: різниця в кваліфікаціях невелика, а в гонках вона
        росте з кожним етапом. Детальна дуель є в <a href="#">профілі пілота</a>.
      </p>
      {stats && <StatBlock />}
      <h2 id="s2">Що лишилось у сезоні</h2>
      <p>
        Попереду ще п’ять етапів, і боротьба тепер за друге місце та Кубок конструкторів. Наступна зупинка
        Гран-прі Сан-Паулу, <a href="#">розклад вікенду</a> вже на сайті.
      </p>
      <InstagramFacade />
      <h2 id="s3">Джерела</h2>
      <ol className="am-sources">
        <li>
          <a href="#">Офіційні результати Гран-прі Мехіко</a>, formula1.com, 01.11.2026
        </li>
        <li>
          <a href="#">f1db</a>, таблиця чемпіонату після етапу 19
        </li>
        <li>
          <a href="#">OpenF1</a>, результати сесій вікенду
        </li>
      </ol>
    </div>
  )
}

function Related() {
  return (
    <section className="am-section">
      <h2 className="am-h2">Читайте також</h2>
      <div className="am-grid3">
        {WEEKEND.map((a) => (
          <Card key={a.slug} a={a} dek={false} />
        ))}
      </div>
    </section>
  )
}

function Crumbs() {
  return (
    <nav className="breadcrumbs" aria-label="Навігація">
      <Link to="?v=a1">Статті</Link> <span className="sep">/</span> <span aria-current="page">{CHAMP.tag}</span>
    </nav>
  )
}

// С1: a wide cover with the headline over its dark side, then one reading
// column; the numbers sit inside the text.
function ArticleC1() {
  return (
    <>
      <Crumbs />
      <header className="am-ahead">
        <CoverArt cover={CHAMP.cover} eager className="am-ahead-cover" />
        <div className="am-ahead-text">
          <span className="hero-chip">{CHAMP.tag}</span>
          <h1 className="am-atitle">{CHAMP.title}</h1>
          <p className="am-byline">
            Paddock Times <span className="mono">02.11.2026</span> {CHAMP.minutes} хв читання
          </p>
        </div>
      </header>
      <p className="am-cover-credit">
        <Credit>
          Фото: <a href="#">Mercedes-AMG F1 Team</a>, медіацентр команди
        </Credit>
      </p>
      <div className="am-column">
        <p className="am-dek am-dek--lead">{CHAMP.dek}</p>
        <Body />
      </div>
      <Related />
    </>
  )
}

// С2: a plain title block, then the text with a side panel: the numbers,
// links into the site's data and the contents.
function ArticleC2() {
  return (
    <>
      <Crumbs />
      <header className="am-c2-head">
        <span className="hero-chip">{CHAMP.tag}</span>
        <h1 className="am-atitle am-atitle--plain">{CHAMP.title}</h1>
        <p className="am-dek am-dek--lead">{CHAMP.dek}</p>
        <p className="am-byline">
          Paddock Times <span className="mono">02.11.2026</span> {CHAMP.minutes} хв читання
        </p>
      </header>
      <div className="am-c2">
        <div className="am-c2-main">
          <figure className="am-figure am-figure--top">
            <CoverArt cover={CHAMP.cover} eager className="am-figure-art am-figure-art--wide" />
            <figcaption>
              <Credit>
                Фото: <a href="#">Mercedes-AMG F1 Team</a>, медіацентр команди
              </Credit>
            </figcaption>
          </figure>
          <Body stats={false} />
        </div>
        <aside className="am-rail">
          <div className="am-panel">
            <h2 className="am-panel-title">Ключові цифри</h2>
            <dl className="am-rail-stats">
              {STATS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd className="mono">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="am-panel">
            <h2 className="am-panel-title">На сайті</h2>
            <ul className="am-rail-links">
              <li>
                <a href="#">Кімі Антонеллі, профіль</a>
              </li>
              <li>
                <a href="#">Mercedes, команда</a>
              </li>
              <li>
                <a href="#">Гран-прі Мехіко, результати</a>
              </li>
              <li>
                <a href="#">Таблиця чемпіонату</a>
              </li>
            </ul>
          </div>
          <div className="am-panel">
            <h2 className="am-panel-title">Зміст</h2>
            <ol className="am-toc">
              <li>
                <a href="#s1">Стабільність замість серій</a>
              </li>
              <li>
                <a href="#s2">Що лишилось у сезоні</a>
              </li>
              <li>
                <a href="#s3">Джерела</a>
              </li>
            </ol>
          </div>
        </aside>
      </div>
      <Related />
    </>
  )
}

// ---------- Home slider slide ----------

function Dots() {
  return (
    <div className="hero-slider-dots" aria-hidden="true">
      <span className="hs-dot" />
      <span className="hs-dot" />
      <span className="hs-dot is-active" />
    </div>
  )
}

// Г1: the race-number hero with the article's driver.
function SlideG1() {
  const c = CHAMP.cover as Extract<Cover, { kind: 'photo' }>
  const color = teamColor(c.constructorId)
  return (
    <div className="am-slide-frame">
      <div className="hero-slider">
        <div className="hero hero-winner hero-num" style={{ '--team': color } as CSSProperties}>
          <span className="hero-bignum is-ready" aria-hidden="true">
            {c.number}
          </span>
          <span className="hero-stripe" aria-hidden="true" />
          <Headshot
            portraitUrl={driverPortraitUrl(c.driverId, c.constructorId, '2026')}
            width={450}
            height={1293}
            eager
          />
          <div className="hero-content hero-content--winner">
            <span className="hero-chip">Стаття</span>
            <p className="hero-kicker">
              <span>{CHAMP.tag}</span>
              <span>
                <span className="mono">{CHAMP.minutes}</span> хв читання
              </span>
            </p>
            <h2 className="hero-title">
              Сезон Антонеллі <span>у п’яти цифрах</span>
            </h2>
            <p className="am-slide-dek">{CHAMP.dek}</p>
            <Link to="?v=c1" className="hero-cta">
              Читати статтю <Arrow />
            </Link>
          </div>
        </div>
        <Dots />
      </div>
    </div>
  )
}

// Г2: no photo; the article's key number fills the frame in team colour.
function SlideG2() {
  const color = teamColor('ferrari')
  return (
    <div className="am-slide-frame">
      <div className="hero-slider">
        <div className="hero hero-winner hero-num am-slide-type" style={{ '--team': color } as CSSProperties}>
          <span className="hero-stripe" aria-hidden="true" />
          <span className="am-slide-big mono" aria-hidden="true">
            1:16
            <br />
            .514
          </span>
          <div className="hero-content hero-content--winner">
            <span className="hero-chip">Стаття</span>
            <p className="hero-kicker">
              <span>Кваліфікація</span>
              <span>
                <span className="mono">4</span> хв читання
              </span>
            </p>
            <h2 className="hero-title">
              Хемілтон на поулі <span>Ferrari швидка на одному колі</span>
            </h2>
            <p className="am-slide-dek">Перше місце на старті з відривом у дев’ять тисячних.</p>
            <Link to="?v=c1" className="hero-cta">
              Читати статтю <Arrow />
            </Link>
          </div>
        </div>
        <Dots />
      </div>
    </div>
  )
}

const VIEWS: Record<string, () => JSX.Element> = {
  a1: PageA1,
  a2: PageA2,
  a3: PageA3,
  c1: ArticleC1,
  c2: ArticleC2,
  g1: SlideG1,
  g2: SlideG2,
}

export default function ArticlesMock() {
  const [params] = useSearchParams()
  const v = VIEWS[params.get('v') ?? ''] ? params.get('v')! : 'a1'
  const View = VIEWS[v]
  const groups = [...new Set(VARIANTS.map((x) => x.group))]
  return (
    <div className="am">
      <nav className="am-bar" aria-label="Варіанти макетів">
        {groups.map((g) => (
          <div key={g} className="am-bar-group">
            <span className="am-bar-label">{g}</span>
            {VARIANTS.filter((x) => x.group === g).map((x) => (
              <Link key={x.id} to={`?v=${x.id}`} className={`am-bar-link${x.id === v ? ' is-on' : ''}`}>
                {x.label}
              </Link>
            ))}
          </div>
        ))}
        <span className="am-bar-note">Макет: тексти і підписи до фото умовні</span>
      </nav>
      <View />
    </div>
  )
}
