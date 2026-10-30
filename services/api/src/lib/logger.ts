import { redactObject } from "@commitscibble/shared";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(level: LogLevel, bindings: LogFields = {}): Logger {
  const emit = (entryLevel: LogLevel, message: string, fields?: LogFields): void => {
    if (LEVEL_WEIGHT[entryLevel] < LEVEL_WEIGHT[level]) return;
    const payload = {
      level: entryLevel,
      time: new Date().toISOString(),
      message,
      ...(redactObject({ ...bindings, ...(fields ?? {}) }) as LogFields),
    };
    const line = JSON.stringify(payload);
    if (entryLevel === "error") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  };

  return {
    debug: (message, fields) => emit("debug", message, fields),
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
    child: (fields) => createLogger(level, { ...bindings, ...fields }),
  };
}
