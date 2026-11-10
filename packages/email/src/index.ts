export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export * from "./templates.js";

export interface EmailSettings {
  apiKey: string;
  from: string;
}

export interface EmailSender {
  readonly enabled: boolean;
  send(message: EmailMessage): Promise<boolean>;
}

export interface EmailSenderOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  onError?: (message: string) => void;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function createEmailSender(
  settings: EmailSettings | null,
  options: EmailSenderOptions = {},
): EmailSender {
  if (!settings) {
    return { enabled: false, send: async () => false };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  return {
    enabled: true,
    async send(message: EmailMessage): Promise<boolean> {
      if (!message.to.includes("@")) {
        options.onError?.("Email recipient is not a valid address");
        return false;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: settings.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          options.onError?.(`Email provider responded with status ${response.status}`);
          return false;
        }
        return true;
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        options.onError?.(
          aborted
            ? `Email request timed out after ${timeoutMs}ms`
            : `Email request failed: ${error instanceof Error ? error.message : "unknown error"}`,
        );
        return false;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
