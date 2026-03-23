/** Shared constants and helpers for child-profile DNS cards across customer/ISP/admin pages. */

export const FILTER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  STRICT:   { bg: '#FFEBEE', text: '#C62828', label: 'Strict' },
  MODERATE: { bg: '#FFF8E1', text: '#F57F17', label: 'Moderate' },
  RELAXED:  { bg: '#E8F5E9', text: '#2E7D32', label: 'Relaxed' },
  CUSTOM:   { bg: '#E3F2FD', text: '#1565C0', label: 'Custom' },
};

export const AVATAR_COLORS = ['#00897B', '#1565C0', '#7B1FA2', '#E53935', '#FB8C00'];

export const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  STARTER:    { bg: '#E3F2FD', text: '#1565C0' },
  GROWTH:     { bg: '#E8F5E9', text: '#1B5E20' },
  ENTERPRISE: { bg: '#FFF8E1', text: '#E65100' },
};

export function getInitials(name?: string, fallback = 'P'): string {
  if (!name) return fallback;
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
