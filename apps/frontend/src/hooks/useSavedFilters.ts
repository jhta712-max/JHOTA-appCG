import { useState, useCallback } from 'react';

export interface SavedFilter<T> {
  id:        string;
  name:      string;
  filters:   T;
  createdAt: string;
}

const STORAGE_KEY = 'jhota:saved-filters';

function readAll(): Record<string, SavedFilter<unknown>[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, SavedFilter<unknown>[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useSavedFilters<T>(namespace: string) {
  const [, forceRender] = useState(0);

  const saved: SavedFilter<T>[] = (readAll()[namespace] ?? []) as SavedFilter<T>[];

  const save = useCallback((name: string, filters: T) => {
    const all = readAll();
    const list = (all[namespace] ?? []) as SavedFilter<T>[];
    const existing = list.findIndex((f) => f.name === name);
    const entry: SavedFilter<T> = {
      id:        existing >= 0 ? list[existing].id : crypto.randomUUID(),
      name,
      filters,
      createdAt: new Date().toISOString(),
    };
    if (existing >= 0) list[existing] = entry;
    else list.push(entry);
    all[namespace] = list as SavedFilter<unknown>[];
    writeAll(all);
    forceRender((n) => n + 1);
  }, [namespace]);

  const remove = useCallback((id: string) => {
    const all = readAll();
    all[namespace] = (all[namespace] ?? []).filter((f) => f.id !== id);
    writeAll(all);
    forceRender((n) => n + 1);
  }, [namespace]);

  return { saved, save, remove };
}
