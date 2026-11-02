"use client";

import { useCallback, useState } from "react";

function read<T>(key: string, initial: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return initial;
    // Valores viejos guardados como texto plano ("kanban", "admin") no son JSON.
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  } catch {
    return initial; // sin localStorage (navegación privada, etc.)
  }
}

/** useState que se recuerda en localStorage. Solo para preferencias del navegador. */
export function useStoredState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => (typeof window === "undefined" ? initial : read(key, initial)));

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(v));
        } catch {
          // sin localStorage: el estado en memoria sigue funcionando
        }
        return v;
      });
    },
    [key]
  );

  return [value, set];
}
