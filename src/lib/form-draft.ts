"use client";

import { useEffect, useState } from "react";

const DRAFT_PREFIX = "recorder-draft:";

function storageKey(key: string) {
  return `${DRAFT_PREFIX}${key}`;
}

export function readDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    // Quota / private mode — form still works without persistence.
  }
}

export function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

/**
 * Keep form fields across page reloads (common when switching apps to copy/paste
 * on mobile). Restores once after mount; saves with a short debounce.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  enabled = true
): [T, React.Dispatch<React.SetStateAction<T>>, () => void, boolean] {
  const [state, setState] = useState<T>(initial);
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    const draft = readDraft<T>(key);
    if (draft != null) setState(draft);
    setReady(true);
    // Only restore for this key once on mount / when key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial is intentionally the first mount seed
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || !ready) return;
    const timer = window.setTimeout(() => writeDraft(key, state), 400);
    return () => window.clearTimeout(timer);
  }, [key, state, enabled, ready]);

  return [state, setState, () => clearDraft(key), ready];
}
