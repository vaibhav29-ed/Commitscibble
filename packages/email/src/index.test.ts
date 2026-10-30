import { describe, expect, it, vi } from "vitest";
import { createEmailSender, type EmailMessage } from "./index.js";

const message: EmailMessage = {
  to: "user@example.com",
  subject: "Hello",
  text: "Plain",
  html: "<p>HTML</p>",
};

describe("createEmailSender", () => {
  it("is disabled and never calls the network when no settings exist", async () => {
    const fetchImpl = vi.fn();
    const sender = createEmailSender(null, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(sender.enabled).toBe(false);
    await expect(sender.send(message)).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the message to Resend and reports success", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: "email-1" }), { status: 200 }),
    );
    const sender = createEmailSender(
      { apiKey: "re_test", from: "docs@example.com" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    await expect(sender.send(message)).resolves.toBe(true);
    expect(sender.enabled).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "docs@example.com",
      to: ["user@example.com"],
      subject: "Hello",
      text: "Plain",
      html: "<p>HTML</p>",
    });
  });

  it("rejects an address without an @ before calling the provider", async () => {
    const fetchImpl = vi.fn();
    const onError = vi.fn();
    const sender = createEmailSender(
      { apiKey: "re_test", from: "docs@example.com" },
      { fetchImpl: fetchImpl as unknown as typeof fetch, onError },
    );

    await expect(sender.send({ ...message, to: "not-an-address" })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Email recipient is not a valid address");
  });

  it("returns false and reports non-2xx responses", async () => {
    const onError = vi.fn();
    const sender = createEmailSender(
      { apiKey: "re_test", from: "docs@example.com" },
      {
        fetchImpl: (async () => new Response("nope", { status: 429 })) as unknown as typeof fetch,
        onError,
      },
    );

    await expect(sender.send(message)).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith("Email provider responded with status 429");
  });

  it("swallows network errors and reports them", async () => {
    const onError = vi.fn();
    const sender = createEmailSender(
      { apiKey: "re_test", from: "docs@example.com" },
      {
        fetchImpl: (async () => {
          throw new Error("socket closed");
        }) as unknown as typeof fetch,
        onError,
      },
    );

    await expect(sender.send(message)).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith("Email request failed: socket closed");
  });

  it("reports a timeout when the provider aborts", async () => {
    const onError = vi.fn();
    const sender = createEmailSender(
      { apiKey: "re_test", from: "docs@example.com" },
      {
        timeoutMs: 25,
        fetchImpl: ((_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          })) as unknown as typeof fetch,
        onError,
      },
    );

    await expect(sender.send(message)).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith("Email request timed out after 25ms");
  });
});
