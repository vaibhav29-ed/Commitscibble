"use client";

import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";

function periodOf(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC = 29.530588853 * 86_400_000;

const moonPhase = (at: number) => ((at - NEW_MOON) % SYNODIC + SYNODIC) % SYNODIC / SYNODIC;

import { Sun, Moon } from "./sun-moon";

export function Greeting({ name, className }: { name: string; className?: string }) {
  const minute = Math.floor(Date.now() / 60_000);

  let word = "Hello";
  let glyph: React.ReactNode = null;

  if (minute !== null) {
    const now = new Date(minute * 60_000);
    const hour = now.getHours() + now.getMinutes() / 60;
    const period = periodOf(now.getHours());
    word = `Good ${period}`;
    const sunUp = hour >= 6 && hour < 19;
    glyph = sunUp ? <Sun hour={hour} /> : <Moon phase={moonPhase(minute * 60_000)} />;
  }

  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
    }
  }, []);

  return (
    <p
      className={cn(
        "relative flex items-center gap-2.5 text-lg font-medium text-foreground text-center transition-opacity duration-500 ease-out",
        className
      )}
      style={{ opacity: didMount.current ? 1 : 0 }}
    >
      <span aria-hidden className="relative size-5 shrink-0">
        {glyph && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            className="absolute inset-0 size-5 overflow-visible text-foreground"
          >
            {glyph}
          </svg>
        )}
      </span>
      <span className="relative inline-flex whitespace-nowrap">
        <span className="inline-block">{word}</span>
        <span className="ml-2">{name}</span>
      </span>
    </p>
  );
}