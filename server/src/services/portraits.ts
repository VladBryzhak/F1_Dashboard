// Official driver portraits on formula1.com's image CDN — mirrors
// driverPortraitUrl() in client/src/lib/f1meta.ts (keep the maps in step), so
// the server can name the home hero image in the HTML for an early preload.

const TEAM_CAR_SLUG: Record<string, string> = {
  mclaren: "mclaren",
  ferrari: "ferrari",
  mercedes: "mercedes",
  "red-bull": "redbullracing",
  williams: "williams",
  "aston-martin": "astonmartin",
  alpine: "alpine",
  haas: "haas",
  rb: "rb",
  "racing-bulls": "racingbulls",
  "kick-sauber": "kicksauber",
  audi: "audi",
  cadillac: "cadillac",
};

const DRIVER_SLUG: Record<string, string> = {
  "max-verstappen": "maxver01",
  "sergio-perez": "serper01",
  "lewis-hamilton": "lewham01",
  "fernando-alonso": "feralo01",
  "charles-leclerc": "chalec01",
  "lando-norris": "lannor01",
  "carlos-sainz-jr": "carsai01",
  "george-russell": "georus01",
  "oscar-piastri": "oscpia01",
  "lance-stroll": "lanstr01",
  "pierre-gasly": "piegas01",
  "esteban-ocon": "estoco01",
  "alexander-albon": "alealb01",
  "yuki-tsunoda": "yuktsu01",
  "valtteri-bottas": "valbot01",
  "nico-hulkenberg": "nichul01",
  "daniel-ricciardo": "danric01",
  "guanyu-zhou": "guazho01",
  "kevin-magnussen": "kevmag01",
  "liam-lawson": "lialaw01",
  "logan-sargeant": "logsar01",
  "kimi-antonelli": "andant01",
  "isack-hadjar": "isahad01",
  "oliver-bearman": "olibea01",
  "gabriel-bortoleto": "gabbor01",
  "franco-colapinto": "fracol01",
  "jack-doohan": "jacdoo01",
  "arvid-lindblad": "arvlin01",
};

// `width`: the CDN resizes on the fly; the home hero shows the portrait at
// most ~140×400 CSS px, so 300 px covers 2× screens at half the bytes.
export function driverPortraitUrl(
  driverId: string,
  constructorId: string,
  season: number,
  width = 600,
): string | null {
  if (season < 2024) return null;
  const driverSlug = DRIVER_SLUG[driverId];
  const teamSlug = TEAM_CAR_SLUG[constructorId];
  if (!driverSlug || !teamSlug) return null;
  return (
    `https://media.formula1.com/image/upload/c_lfill,w_${width}/q_auto/` +
    `v1740000001/common/f1/${season}/${teamSlug}/${driverSlug}/${season}${teamSlug}${driverSlug}right.webp`
  );
}
