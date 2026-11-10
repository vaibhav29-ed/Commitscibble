const SECRET_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
  {
    name: "github_token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },
  {
    name: "github_fine_grained_token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },
  {
    name: "groq_key",
    pattern: /\bgsk_[A-Za-z0-9]{20,}\b/g,
    replacement: "[REDACTED_API_KEY]",
  },
  {
    name: "google_api_key",
    pattern: /\bAIza[0-9A-Za-z\-_]{30,}\b/g,
    replacement: "[REDACTED_API_KEY]",
  },
  {
    name: "google_aq_api_key",
    pattern: /\bAQ\.[A-Za-z0-9_-]{30,}\b/g,
    replacement: "[REDACTED_API_KEY]",
  },
  {
    name: "openai_style_key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    replacement: "[REDACTED_API_KEY]",
  },
  {
    name: "slack_token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    replacement: "[REDACTED_TOKEN]",
  },
  {
    name: "razorpay_key",
    pattern: /\brzp_(?:test|live)_[A-Za-z0-9]{10,}\b/g,
    replacement: "[REDACTED_API_KEY]",
  },
  {
    name: "private_key_block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED_PRIVATE_KEY]",
  },
  {
    name: "bearer_header",
    pattern: /\b(Bearer)\s+[A-Za-z0-9._-]{12,}/g,
    replacement: "$1 [REDACTED]",
  },
];

const ASSIGNMENT_PATTERN =
  /((?:password|passwd|secret|token|api[_-]?key|apikey|client[_-]?secret|webhook[_-]?secret|session[_-]?secret)\s*[:=]\s*)(["']?)([^\s"'`,;]{6,})\2/gi;

const CONNECTION_STRING_PATTERN =
  /\b((?:mongodb(?:\+srv)?|redis|rediss|postgres(?:ql)?|mysql|amqp):\/\/[^:\s/@]+:)([^@\s]+)(@)/gi;

const SENSITIVE_KEY_PATTERN =
  /^(.*(token|secret|password|passwd|authorization|cookie|api[_-]?key|private[_-]?key|credential).*)$/i;

export function redactSecrets(input: string): string {
  if (!input) return input;
  let output = input;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  output = output.replace(ASSIGNMENT_PATTERN, (_match, prefix: string, quote: string) => {
    return `${prefix}${quote}[REDACTED]${quote}`;
  });
  output = output.replace(CONNECTION_STRING_PATTERN, "$1[REDACTED]$3");
  return output;
}

const REDACTED = "[REDACTED]";

export function redactObject(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (typeof value === "string") return redactSecrets(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => redactObject(item, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = REDACTED;
    } else {
      output[key] = redactObject(entry, depth + 1, seen);
    }
  }
  return output;
}

const KNOWN_SECRET_MARKERS = [
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gsk_[A-Za-z0-9]{20,}/,
  /AIza[0-9A-Za-z\-_]{30,}/,
  /AQ\.[A-Za-z0-9_-]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

export interface SecretFinding {
  label: string;
  index: number;
}

export function findSecretsInText(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const pattern of KNOWN_SECRET_MARKERS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      findings.push({ label: pattern.source, index: match.index });
    }
  }
  return findings;
}
