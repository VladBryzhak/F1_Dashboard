// Donation link for the /support page. Public by design: it is shown on the
// page anyway. Get it in the Monobank app: the jar → "Share" (looks like
// https://send.monobank.ua/jar/XXXXXXXXXX).
// TODO: replace the placeholder with the real jar link before going live.
export const MONO_JAR_URL = 'https://send.monobank.ua/jar/REPLACE_ME'

// While the link is a placeholder the page shows the button inactive with a
// "coming soon" note and the QR marked as a sample.
export const SUPPORT_READY = !MONO_JAR_URL.includes('REPLACE_ME')
// Footer/About links to /support (shown already, so the page can be reviewed).
export const SHOW_SUPPORT_LINKS = true
