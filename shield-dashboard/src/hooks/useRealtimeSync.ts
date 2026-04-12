import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '../store/auth.store';
import { useAlertStore } from '../store/alert.store';

// Request browser notification permission once
if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
  Notification.requestPermission().catch(() => {});
}

function showBrowserNotification(title: string, body: string, tag?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/icons/icon-192.png', tag });
    setTimeout(() => n.close(), 8000);
  } catch { /* silent */ }
}

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const user        = useAuthStore(s => s.user);
  const addAlert    = useAlertStore(s => s.addAlert);

  useEffect(() => {
    if (!user) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = (import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}/ws`) + '/websocket';

    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      onConnect: () => {
        // ── User-specific events ───────────────────────────────────────
        client.subscribe(`/topic/sync/${user.id}`, (msg) => {
          try {
            const event = JSON.parse(msg.body);
            if (event.type === 'DNS_RULES_CHANGED') queryClient.invalidateQueries({ queryKey: ['rules'] });
            if (event.type === 'SCHEDULE_CHANGED')  queryClient.invalidateQueries({ queryKey: ['schedule'] });
            if (event.type === 'BUDGET_CHANGED')    queryClient.invalidateQueries({ queryKey: ['budgets'] });
            if (event.type === 'PROFILE_CHANGED')   queryClient.invalidateQueries({ queryKey: ['profiles'] });
            if (event.type === 'ALERT') {
              queryClient.invalidateQueries({ queryKey: ['alerts'] });
              _handleAlert(event, addAlert);
            }
          } catch { /* ignore malformed */ }
        });

        // ── Tenant-wide events ─────────────────────────────────────────
        if (user.tenantId) {
          client.subscribe(`/topic/tenant/${user.tenantId}`, (msg) => {
            try {
              const event = JSON.parse(msg.body);
              if (event.type === 'DNS_RULES_CHANGED') queryClient.invalidateQueries({ queryKey: ['rules'] });
              if (event.type === 'PROFILE_CHANGED')   queryClient.invalidateQueries({ queryKey: ['profiles'] });
              if (event.type === 'DEVICE_CHANGED')    queryClient.invalidateQueries({ queryKey: ['devices'] });
            } catch { /* ignore malformed */ }
          });

          // ── Critical alert topic ─────────────────────────────────────
          client.subscribe(`/topic/alerts/${user.tenantId}`, (msg) => {
            try {
              const event = JSON.parse(msg.body);
              queryClient.invalidateQueries({ queryKey: ['alerts'] });
              _handleAlert(event, addAlert);
            } catch { /* ignore malformed */ }
          });
        }
      },
      onStompError: () => { /* silently retry */ },
      onDisconnect: () => { /* will auto-reconnect */ },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, [user?.id, user?.tenantId, queryClient, addAlert]);
}

type AddAlertFn = ReturnType<typeof useAlertStore.getState>['addAlert'];

function _handleAlert(event: Record<string, unknown>, addAlert: AddAlertFn) {
  const type        = (event.type as string) ?? 'ALERT';
  const severity    = (event.severity as string) ?? 'MEDIUM';
  const profileId   = (event.profileId as string) ?? '';
  const profileName = (event.profileName as string) ?? 'Child';
  const message     = (event.message as string) ?? '';

  // Add to in-app alert store
  addAlert({
    id:          (event.alertId as string) ?? `ws-${Date.now()}`,
    type,
    message,
    profileId,
    profileName,
    severity:    severity.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    timestamp:   (event.timestamp as string) ?? new Date().toISOString(),
    read:        false,
  });

  // Show browser notification for high-priority alerts
  const isCritical = type === 'SOS_ALERT' || type === 'PANIC_ALERT' ||
                     type === 'GEOFENCE_BREACH' || type === 'GEOFENCE_BREACH_HIGH' ||
                     severity === 'CRITICAL';

  if (isCritical) {
    const title = type === 'SOS_ALERT' || type === 'PANIC_ALERT'
      ? `🚨 SOS Alert — ${profileName}`
      : type === 'GEOFENCE_BREACH' || type === 'GEOFENCE_BREACH_HIGH'
      ? `📍 Geofence Alert — ${profileName}`
      : `⚠️ Shield Alert — ${profileName}`;

    showBrowserNotification(title, message || `${profileName} needs attention`, type);
  }
}
