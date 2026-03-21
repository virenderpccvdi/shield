import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '../store/auth.store';

export function useWebSocket(
  topic: string,
  onMessage: (data: unknown) => void,
  enabled = true
) {
  const clientRef = useRef<Client | null>(null);
  const token = useAuthStore((s) => s.accessToken);
  const onMessageRef = useRef(onMessage);

  // Keep ref up-to-date without causing reconnects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled || !token) return;
    const client = new Client({
      brokerURL: `wss://${window.location.host}/ws/shield-ws`,
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        client.subscribe(topic, (msg) => {
          try { onMessageRef.current(JSON.parse(msg.body)); } catch { /* ignore */ }
        });
      },
      reconnectDelay: 5000,
    });
    client.activate();
    clientRef.current = client;
    return () => { client.deactivate(); };
  }, [topic, token, enabled]);

  return clientRef.current;
}
