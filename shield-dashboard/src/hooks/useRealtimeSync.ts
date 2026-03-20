import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '../store/auth.store';

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (!user) return;

    const wsUrl = (import.meta.env.VITE_WS_URL || 'wss://shield.rstglobal.in/ws') + '/websocket';

    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      onConnect: () => {
        // Subscribe to user-specific sync events
        client.subscribe(`/topic/sync/${user.id}`, (msg) => {
          try {
            const event = JSON.parse(msg.body);
            if (event.type === 'DNS_RULES_CHANGED') queryClient.invalidateQueries({ queryKey: ['rules'] });
            if (event.type === 'SCHEDULE_CHANGED') queryClient.invalidateQueries({ queryKey: ['schedule'] });
            if (event.type === 'BUDGET_CHANGED') queryClient.invalidateQueries({ queryKey: ['budgets'] });
            if (event.type === 'PROFILE_CHANGED') queryClient.invalidateQueries({ queryKey: ['profiles'] });
            if (event.type === 'ALERT') queryClient.invalidateQueries({ queryKey: ['alerts'] });
          } catch {
            // Ignore malformed messages
          }
        });

        // Also subscribe to tenant-wide events if user has tenantId
        if (user.tenantId) {
          client.subscribe(`/topic/tenant/${user.tenantId}`, (msg) => {
            try {
              const event = JSON.parse(msg.body);
              if (event.type === 'DNS_RULES_CHANGED') queryClient.invalidateQueries({ queryKey: ['rules'] });
              if (event.type === 'PROFILE_CHANGED') queryClient.invalidateQueries({ queryKey: ['profiles'] });
              if (event.type === 'DEVICE_CHANGED') queryClient.invalidateQueries({ queryKey: ['devices'] });
            } catch {
              // Ignore malformed messages
            }
          });
        }
      },
      onStompError: () => {
        // Silently handle connection errors — reconnectDelay will retry
      },
      onDisconnect: () => {
        // Will auto-reconnect via reconnectDelay
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [user?.id, user?.tenantId, queryClient]);
}
