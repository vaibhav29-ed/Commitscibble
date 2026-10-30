import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { anyApi } from "convex/server";
import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";

/**
 * Function references are resolved at runtime through Convex's proxy. Running
 * `npx convex dev` can replace this with generated, fully typed references.
 */
const convexApi: any = anyApi;

const CONVEX_URL = (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? "";

const RealtimeStatusContext = createContext<"convex" | "polling">("polling");

let client: ConvexReactClient | null = null;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  if (!CONVEX_URL) {
    return <>{children}</>;
  }
  client ??= new ConvexReactClient(CONVEX_URL);
  return (
    <RealtimeStatusContext.Provider value="convex">
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </RealtimeStatusContext.Provider>
  );
}

export function useRealtimeStatus(): "convex" | "polling" {
  return useContext(RealtimeStatusContext);
}

/**
 * Subscribes to the Convex event feed for this user's read key. Incoming events
 * invalidate the persisted API queries, so a reconnecting client always
 * recovers the complete authoritative history from MongoDB.
 */
export function ActivityRealtimeBridge({ readKey }: { readKey: string | null }) {
  if (!CONVEX_URL || !readKey) return null;
  return <ConvexSubscription readKey={readKey} />;
}

function ConvexSubscription({ readKey }: { readKey: string }) {
  const queryClient = useQueryClient();
  const lastSeen = useRef<string | null>(null);
  const events = useQuery(convexApi.activity.recent, { readKey, limit: 20 }) as
    | { eventId?: string }[]
    | undefined;

  useEffect(() => {
    const latest = events?.[0]?.eventId;
    if (!latest || latest === lastSeen.current) return;
    lastSeen.current = latest;
    void queryClient.invalidateQueries({ queryKey: ["activity"] });
    void queryClient.invalidateQueries({ queryKey: ["repositories"] });
    void queryClient.invalidateQueries({ queryKey: ["repository"] });
  }, [events, queryClient]);

  return null;
}
