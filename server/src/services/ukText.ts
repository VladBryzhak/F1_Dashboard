// Ukrainian wording helpers for the server's page titles, descriptions and
// crawler text (the app has its own copies in client/src/i18n/uk.ts).

const rules = new Intl.PluralRules("uk-UA");

// "1 перемога" / "3 перемоги" / "5 перемог" / "1,5 очка": forms are
// [one, few, many, other], as Ukrainian plural rules pick them.
export function ukPlural(n: number, forms: [string, string, string, string]): string {
  const i = { one: 0, few: 1, many: 2, other: 3 }[rules.select(n) as "one" | "few" | "many" | "other"] ?? 3;
  const num = Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
  return `${num} ${forms[i]}`;
}

export const UK = {
  titles: ["титул чемпіона світу", "титули чемпіона світу", "титулів чемпіона світу", "титулу чемпіона світу"],
  ctitles: ["Кубок конструкторів", "Кубки конструкторів", "Кубків конструкторів", "Кубка конструкторів"],
  // Same wording as the app (client/src/i18n/uk.ts, plural.*).
  wins: ["перемога в Гран-прі", "перемоги в Гран-прі", "перемог у Гран-прі", "перемоги в Гран-прі"],
  podiums: ["подіум", "подіуми", "подіумів", "подіуму"],
  poles: ["поул-позиція", "поул-позиції", "поул-позицій", "поул-позиції"],
  starts: ["старт", "старти", "стартів", "старту"],
  races: ["гонка", "гонки", "гонок", "гонки"],
  points: ["очко", "очки", "очок", "очка"],
  turns: ["поворот", "повороти", "поворотів", "повороту"],
  grandsPrix: ["Гран-прі", "Гран-прі", "Гран-прі", "Гран-прі"],
} satisfies Record<string, [string, string, string, string]>;

// Country name in Ukrainian from an ISO code ("nl" → "Нідерланди").
const regions = new Intl.DisplayNames(["uk"], { type: "region" });
export function ukCountry(code: string | null | undefined): string {
  if (!code) return "";
  try {
    return regions.of(code.toUpperCase()) ?? "";
  } catch {
    return "";
  }
}

export const ukDate = (iso: string) =>
  new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
