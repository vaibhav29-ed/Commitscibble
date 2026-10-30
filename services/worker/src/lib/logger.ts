import { redactObject } from "@commitscibble/shared";

export type LogLevel = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
  child(fields: Fields): Logger;
}

export function createLogger(level: LogLevel, bindings: Fields = {}): Logger {
  const emit = (entryLevel: LogLevel, message: string, fields?: Fields): void => {
    if (WEIGHT[entryLevel] < WEIGHT[level]) return;
    const line = JSON.stringify({
      level: entryLevel,
      time: new Date().toISOString(),
      service: "worker",
      message,
      ...(redactObject({ ...bindings, ...(fields ?? {}) }) as Fields),
    });
    if (entryLevel === "error") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (f) => createLogger(level, { ...bindings, ...f }),
  };
}
