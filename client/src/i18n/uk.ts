import type { Dict } from './en'

// Ukrainian strings. Keys mirror en.ts.
const uk: Dict = {
  // Navigation
  'nav.home': 'Головна',
  'nav.live': 'Наживо',
  'nav.standings': 'Залік',
  'nav.calendar': 'Календар',
  'nav.drivers': 'Пілоти',
  'nav.teams': 'Команди',
  'nav.compare': 'Порівняння',
  'nav.telemetry': 'Телеметрія',
  'nav.feedback': 'Відгук',
  'nav.openMenu': 'Відкрити меню',
  'nav.closeMenu': 'Закрити меню',
  'nav.liveOn': 'Сесія триває зараз',
  'nav.liveOff': 'Зараз немає сесії',
  'lang.label': 'Мова інтерфейсу',

  // Footer
  'footer.tagline': 'Турнірні таблиці, календарі та статистика Формули-1 — з 1950 року до сьогодні.',
  'footer.explore': 'Розділи',
  'footer.credits': 'Дані та джерела',
  'footer.dataBy': 'Дані:',
  'footer.telemetryBy': 'Телеметрія:',
  'footer.flagsBy': 'Іконки прапорів:',
  'footer.photosVia': 'Фото пілотів і логотипи/фото команд з',
  'footer.photosLicense': '(CC BY-SA / суспільне надбання, автори — відповідні правовласники)',
  'footer.legal': 'Правова інформація',
  'footer.trademark':
    'Зображення пілотів і болідів © Formula 1. F1, FORMULA 1 та пов’язані знаки є торговельними марками Formula One Licensing B.V.',
  'footer.independent':
    'Незалежний фанатський проєкт — не пов’язаний із Formula 1, Formula One Management чи FIA і не схвалений ними.',
  'footer.analytics': 'Сайт використовує Google Analytics для вимірювання відвідуваності.',

  // Cookie banner
  'cookie.label': 'Повідомлення про cookie',
  'cookie.text':
    'F1 Dashboard використовує cookie для аналітики, щоб розуміти, як користуються сайтом. Ви можете погодитися або відмовитися.',
  'cookie.decline': 'Відхилити',
  'cookie.accept': 'Прийняти',

  // Common
  'common.loading': 'Завантаження…',
  'common.season': 'Сезон',
  'common.round': 'Етап',
  'common.next': 'Наступна',

  // Sessions
  'session.fp1': 'Практика 1',
  'session.fp2': 'Практика 2',
  'session.fp3': 'Практика 3',
  'session.sq': 'Спринт-кваліфікація',
  'session.sprint': 'Спринт',
  'session.q': 'Кваліфікація',
  'session.race': 'Гонка',

  // Weekend schedule
  'sched.gp': 'Гран-прі {name}',
  'sched.none': 'Розклад сесій ще не опубліковано.',
  'sched.nextSession': 'Наступна сесія',
  'sched.liveNow': 'Зараз наживо',
  'sched.live': 'НАЖИВО',
  'sched.finished': 'Вікенд завершено',
  'sched.addToCalendar': 'Додати в календар',
  'sched.localTime': 'Час у вашому часовому поясі · {tz}',
  'sched.tbc': 'Уточнюється',
  'sched.dayShort': 'д',

  // Calendar page
  'cal.title': 'Результати сезону {season}',
  'cal.loadError': 'Не вдалося завантажити календар: {error}',
  'cal.colGp': 'Гран-прі',
  'cal.colDate': 'Дата',
  'cal.colWinner': 'Переможець',
  'cal.colTeam': 'Команда',
  'cal.upcoming': 'Попереду',
  'cal.sprint': 'Спринт',
  'cal.viewWeekend': 'Відкрити вікенд: {name}',
  'cal.showSchedule': 'Показати розклад вікенду',
  'cal.hideSchedule': 'Сховати розклад вікенду',

  // Home
  'home.nextRace': 'Наступна гонка',
}

export default uk
