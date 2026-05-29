"use client";

import * as React from "react";

import {
  getCanvasHistory,
  listCanvasSessions,
} from "@/lib/canvasai-api";
import type { SessionSummary, SessionTurn } from "@/lib/canvasai-types";

// Lightweight Tanstack-style query cache. Holds a single in-memory store per
// browser tab, keyed by a string queryKey. Each entry tracks its data, the
// timestamp it was fetched at, the inflight promise (for de-duplication), and
// a set of subscribers so cross-component reads stay in sync without a render
// loop. Keeps the dependency footprint tiny while still giving us:
//   - stale-while-revalidate semantics (staleTime + background refetch)
//   - in-flight request deduplication (multiple components, one fetch)
//   - prefetch() so we can warm the cache before the user navigates
//   - useQuery() hook with the familiar { data, isLoading, isStale } shape

type Entry<T> = {
  data: T | undefined;
  updatedAt: number;
  inflight: Promise<T> | null;
  error: unknown;
  subscribers: Set<() => void>;
};

const store = new Map<string, Entry<unknown>>();

function getOrCreate<T>(key: string): Entry<T> {
  let entry = store.get(key) as Entry<T> | undefined;
  if (!entry) {
    entry = {
      data: undefined,
      updatedAt: 0,
      inflight: null,
      error: null,
      subscribers: new Set(),
    };
    store.set(key, entry as Entry<unknown>);
  }
  return entry;
}

function notify(entry: Entry<unknown>) {
  for (const fn of entry.subscribers) fn();
}

export async function fetchQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { staleTime?: number; force?: boolean } = {},
): Promise<T> {
  const entry = getOrCreate<T>(key);
  const staleTime = options.staleTime ?? 30_000;
  const isFresh = entry.data !== undefined && Date.now() - entry.updatedAt < staleTime;
  if (!options.force && isFresh) return entry.data as T;
  if (entry.inflight) return entry.inflight;

  entry.inflight = (async () => {
    try {
      const data = await fetcher();
      entry.data = data;
      entry.updatedAt = Date.now();
      entry.error = null;
      return data;
    } catch (err) {
      entry.error = err;
      throw err;
    } finally {
      entry.inflight = null;
      notify(entry as Entry<unknown>);
    }
  })();
  return entry.inflight;
}

export function getCached<T>(key: string): T | undefined {
  return store.get(key)?.data as T | undefined;
}

export function setCached<T>(key: string, data: T) {
  const entry = getOrCreate<T>(key);
  entry.data = data;
  entry.updatedAt = Date.now();
  notify(entry as Entry<unknown>);
}

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { staleTime?: number; enabled?: boolean } = {},
) {
  const entry = getOrCreate<T>(key);
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  const enabled = options.enabled ?? true;
  const staleTime = options.staleTime ?? 30_000;

  React.useEffect(() => {
    entry.subscribers.add(force);
    return () => {
      entry.subscribers.delete(force);
    };
  }, [entry, force]);

  React.useEffect(() => {
    if (!enabled) return;
    void fetchQuery(key, fetcher, { staleTime }).catch(() => {
      force();
    });
  }, [enabled, key, fetcher, staleTime]);

  return {
    data: entry.data,
    error: entry.error,
    isLoading: entry.data === undefined && entry.inflight !== null,
    isFetching: entry.inflight !== null,
    // `isStale` would have to call Date.now() during render. We expose `refetch`
    // and let callers decide explicitly when to bust the cache.
    refetch: () => fetchQuery(key, fetcher, { staleTime, force: true }),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Canvas-session-specific helpers
// ──────────────────────────────────────────────────────────────────────────────

export const SESSIONS_KEY = "sessions:list";
export const sessionHistoryKey = (id: string) => `sessions:history:${id}`;

export type CanvasHistory = { turns: SessionTurn[] };

export function prefetchSessions(staleTime = 15_000) {
  return fetchQuery<SessionSummary[]>(SESSIONS_KEY, listCanvasSessions, { staleTime });
}

export function prefetchSessionHistory(id: string, staleTime = 60_000) {
  return fetchQuery<CanvasHistory>(
    sessionHistoryKey(id),
    () => getCanvasHistory(id),
    { staleTime },
  );
}

// Warm the cache for the top-N most recent sessions so navigating into them
// renders instantly. Called from the sidebar after the session list arrives.
export function prefetchTopSessions(sessions: SessionSummary[], limit = 3) {
  return Promise.allSettled(
    sessions.slice(0, limit).map((session) => prefetchSessionHistory(session.id)),
  );
}
