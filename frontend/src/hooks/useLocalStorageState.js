// src/hooks/useLocalStorageState.js
import { useEffect, useState } from "react";

export function useLocalStorageState(key, initial) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch { return initial; }
  });

  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* private mode / quota — ignore */ }
  }, [key, value]);

  return [value, setValue];
}