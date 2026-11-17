'use client';

import { useCallback, useEffect, useState } from 'react';

export type NotificationPermissionState = NotificationPermission | 'unsupported';
const POLL_INTERVAL_MS = 30_000;

export function useNotifications() {
  // Start as 'unsupported' so server and client first renders match; real value is read after mount.
  const [permission, setPermission] = useState<NotificationPermissionState>('unsupported');

  useEffect(() => {
    if (!('Notification' in window)) return;
    void Promise.resolve().then(() => setPermission(Notification.permission));
  }, []);

  const enable = useCallback(async () => {
    if (!('Notification' in window)) return;
    setPermission(await Notification.requestPermission());
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/notifications/check');
        if (!res.ok || cancelled) return;
        const { notifications } = (await res.json()) as { notifications: { id: number; title: string; due_date: string | null }[] };
        for (const n of notifications) {
          new Notification('Todo reminder', { body: `${n.title}${n.due_date ? ` — due ${n.due_date.replace('T', ' ')}` : ''}`, tag: `todo-${n.id}` });
        }
      } catch {
        // Network errors are transient; the next poll retries.
      }
    };
    void check();
    const timer = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [permission]);

  return { permission, enable };
}
