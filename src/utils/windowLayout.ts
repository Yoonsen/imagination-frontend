import { useCallback, useEffect, useState } from 'react';
import type { RndDragCallback, RndResizeCallback } from 'react-rnd';

export interface WindowLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowLayoutOptions {
  key: string;
  defaultLayout: WindowLayout;
  minWidth: number;
  minHeight: number;
}

const STORAGE_PREFIX = 'imagination.window-layout.v1.';

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStoredLayout(storageKey: string): WindowLayout | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WindowLayout>;
    const x = toFiniteNumber(parsed.x);
    const y = toFiniteNumber(parsed.y);
    const width = toFiniteNumber(parsed.width);
    const height = toFiniteNumber(parsed.height);
    if (x === null || y === null || width === null || height === null) return null;
    return { x, y, width, height };
  } catch {
    return null;
  }
}

function getWorkspaceSize(): { width: number; height: number } {
  const workspace = document.querySelector('.workspace-zone') as HTMLElement | null;
  if (workspace) {
    const rect = workspace.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
  }
  return {
    width: Math.max(320, window.innerWidth - 40),
    height: Math.max(320, window.innerHeight - 40)
  };
}

function clampLayout(layout: WindowLayout, minWidth: number, minHeight: number): WindowLayout {
  const bounds = getWorkspaceSize();
  const width = Math.max(minWidth, Math.min(layout.width, bounds.width));
  const height = Math.max(minHeight, Math.min(layout.height, bounds.height));
  const x = Math.max(0, Math.min(layout.x, Math.max(0, bounds.width - width)));
  const y = Math.max(0, Math.min(layout.y, Math.max(0, bounds.height - height)));
  return { x, y, width, height };
}

function normalizeLayout(layout: WindowLayout, minWidth: number, minHeight: number): WindowLayout {
  return {
    x: Number.isFinite(layout.x) ? layout.x : 0,
    y: Number.isFinite(layout.y) ? layout.y : 0,
    width: Math.max(minWidth, Number.isFinite(layout.width) ? layout.width : minWidth),
    height: Math.max(minHeight, Number.isFinite(layout.height) ? layout.height : minHeight)
  };
}

export function useWindowLayout({
  key,
  defaultLayout,
  minWidth,
  minHeight
}: WindowLayoutOptions) {
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const [layout, setLayout] = useState<WindowLayout>(() => {
    if (typeof window === 'undefined') return defaultLayout;
    const stored = readStoredLayout(storageKey);
    return clampLayout(stored || defaultLayout, minWidth, minHeight);
  });

  const persistLayout = useCallback((candidate: WindowLayout) => {
    if (typeof window === 'undefined') return candidate;
    // Persist free-form position during active session.
    // Layout is clamped when window mounts/reopens (initial state) and on viewport resize.
    const normalized = normalizeLayout(candidate, minWidth, minHeight);
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota or private mode errors.
    }
    return normalized;
  }, [minWidth, minHeight, storageKey]);

  const setAndPersist = useCallback((candidate: WindowLayout) => {
    const clamped = persistLayout(candidate);
    setLayout(clamped);
  }, [persistLayout]);

  const onDragStop = useCallback<RndDragCallback>((_event, data) => {
    setAndPersist({ ...layout, x: data.x, y: data.y });
  }, [layout, setAndPersist]);

  const onResizeStop = useCallback<RndResizeCallback>((_event, _direction, ref, _delta, position) => {
    setAndPersist({
      x: position.x,
      y: position.y,
      width: ref.offsetWidth,
      height: ref.offsetHeight
    });
  }, [setAndPersist]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setLayout((prev) => clampLayout(prev, minWidth, minHeight));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minWidth, minHeight]);

  return {
    layout,
    onDragStop,
    onResizeStop
  };
}

