
// Mirror of client/src/lib/gpNames.ts (keep the two in step).
export type Lang = "en" | "uk";

// Ukrainian names for f1db Grand Prix names: [short, full title]. Ukrainian
// puts the place in the genitive after "Гран-прі" ("Гран-прі Італії"), so the
// full title can't be built from the short name.
const UK: Record<string, [string, string]> = {
  '70th Anniversary': ['70-річчя', 'Гран-прі 70-річчя'],
  'Abu Dhabi': ['Абу-Дабі', 'Гран-прі Абу-Дабі'],
  Argentina: ['Аргентина', 'Гран-прі Аргентини'],
  Australia: ['Австралія', 'Гран-прі Австралії'],
  Austria: ['Австрія', 'Гран-прі Австрії'],
  Azerbaijan: ['Азербайджан', 'Гран-прі Азербайджану'],
  Bahrain: ['Бахрейн', 'Гран-прі Бахрейну'],
  'Barcelona-Catalunya': ['Барселона-Каталонія', 'Гран-прі Барселони-Каталонії'],
  Belgium: ['Бельгія', 'Гран-прі Бельгії'],
  Brazil: ['Бразилія', 'Гран-прі Бразилії'],
  'Caesars Palace': ['Цезарс-Пелас', 'Гран-прі Цезарс-Пелас'],
  Canada: ['Канада', 'Гран-прі Канади'],
  China: ['Китай', 'Гран-прі Китаю'],
  Dallas: ['Даллас', 'Гран-прі Далласа'],
  Detroit: ['Детройт', 'Гран-прі Детройта'],
  Eifel: ['Айфель', 'Гран-прі Айфеля'],
  'Emilia Romagna': ['Емілія-Романья', 'Гран-прі Емілії-Романьї'],
  Europe: ['Європа', 'Гран-прі Європи'],
  France: ['Франція', 'Гран-прі Франції'],
  Germany: ['Німеччина', 'Гран-прі Німеччини'],
  'Great Britain': ['Велика Британія', 'Гран-прі Великої Британії'],
  Hungary: ['Угорщина', 'Гран-прі Угорщини'],
  India: ['Індія', 'Гран-прі Індії'],
  Indianapolis: ['Індіанаполіс', 'Інді-500'],
  Italy: ['Італія', 'Гран-прі Італії'],
  Japan: ['Японія', 'Гран-прі Японії'],
  Korea: ['Корея', 'Гран-прі Кореї'],
  'Las Vegas': ['Лас-Вегас', 'Гран-прі Лас-Вегаса'],
  Luxembourg: ['Люксембург', 'Гран-прі Люксембургу'],
  Malaysia: ['Малайзія', 'Гран-прі Малайзії'],
  Mexico: ['Мексика', 'Гран-прі Мексики'],
  Miami: ['Маямі', 'Гран-прі Маямі'],
  Monaco: ['Монако', 'Гран-прі Монако'],
  Morocco: ['Марокко', 'Гран-прі Марокко'],
  Netherlands: ['Нідерланди', 'Гран-прі Нідерландів'],
  Pacific: ['Тихоокеанське', 'Гран-прі Тихого океану'],
  Pescara: ['Пескара', 'Гран-прі Пескари'],
  Portugal: ['Португалія', 'Гран-прі Португалії'],
  Qatar: ['Катар', 'Гран-прі Катару'],
  Russia: ['Росія', 'Гран-прі Росії'],
  Sakhir: ['Сахір', 'Гран-прі Сахіра'],
  'San Marino': ['Сан-Марино', 'Гран-прі Сан-Марино'],
  'Saudi Arabia': ['Саудівська Аравія', 'Гран-прі Саудівської Аравії'],
  Singapore: ['Сінгапур', 'Гран-прі Сінгапуру'],
  'South Africa': ['Південна Африка', 'Гран-прі Південної Африки'],
  Spain: ['Іспанія', 'Гран-прі Іспанії'],
  Styria: ['Штирія', 'Гран-прі Штирії'],
  Sweden: ['Швеція', 'Гран-прі Швеції'],
  Switzerland: ['Швейцарія', 'Гран-прі Швейцарії'],
  'São Paulo': ['Сан-Паулу', 'Гран-прі Сан-Паулу'],
  Turkey: ['Туреччина', 'Гран-прі Туреччини'],
  Tuscany: ['Тоскана', 'Гран-прі Тоскани'],
  'United States': ['США', 'Гран-прі США'],
  'United States West': ['Захід США', 'Гран-прі Заходу США'],
}

// Short place name for tables ("Italy" / "Італія").
export function gpShort(name: string, lang: Lang): string {
  return lang === 'uk' ? (UK[name]?.[0] ?? name) : name
}

// Full title ("Italy GP" / "Гран-прі Італії").
export function gpTitle(name: string, lang: Lang): string {
  if (lang === 'uk') return UK[name]?.[1] ?? `Гран-прі ${name}`
  return name === 'Indianapolis' ? 'Indianapolis 500' : `${name} GP`
}
