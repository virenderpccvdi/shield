import { create } from 'zustand';

export interface AlertItem {
  id: string;
  type: string;
  message: string;
  profileId: string;
  profileName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  read: boolean;
}

interface AlertState {
  alerts: AlertItem[];
  unreadCount: number;
  addAlert: (alert: AlertItem) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  unreadCount: 0,
  addAlert: (alert) =>
    set((state) => ({
      alerts: [{ ...alert, read: false }, ...state.alerts].slice(0, 200),
      unreadCount: state.unreadCount + 1,
    })),
  markRead: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, read: true })),
      unreadCount: 0,
    })),
}));
