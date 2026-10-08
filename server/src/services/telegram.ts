// Forwards a feedback message to a private Telegram chat via the Bot API.
//
// The bot token and chat id are SECRETS, so they come only from environment
// variables (set them on Render, never commit them). The browser never sees
// them — it POSTs to /api/feedback and this server talks to Telegram.
//
// Setup:
//   1. Create a bot with @BotFather → it gives you a token.
//   2. Message your new bot once, then open
//      https://api.telegram.org/bot<TOKEN>/getUpdates and copy the
//      "chat":{"id": ...} value (your personal chat id).
//   3. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the environment.
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export function feedbackConfigured(): boolean {
  return Boolean(TOKEN && CHAT_ID);
}

export async function sendFeedback(
  message: string,
  contact?: string,
): Promise<void> {
  if (!TOKEN || !CHAT_ID) {
    throw new Error("Feedback is not configured on the server.");
  }

  const lines = ["🏁 New F1 Dashboard feedback", "", message];
  if (contact) lines.push("", `Contact: ${contact}`);

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: lines.join("\n"),
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram API error ${res.status}: ${detail.slice(0, 200)}`);
  }
}
