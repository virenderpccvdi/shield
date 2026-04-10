import api from './axios';

export const createCheckout = (planId: string) =>
  api.post('/admin/billing/checkout', { planId }).then(r => r.data?.data || r.data);

export const getSubscription = () =>
  api.get('/admin/billing/subscription').then(r => r.data?.data || r.data);

export const cancelSubscription = () =>
  api.post('/admin/billing/subscription/cancel').then(r => r.data);

export const getMyInvoices = (page = 0, size = 20) =>
  api.get('/admin/billing/invoices/my', { params: { page, size } }).then(r => r.data?.data || r.data);

export const getAllInvoices = (page = 0, size = 20) =>
  api.get('/admin/invoices', { params: { page, size } }).then(r => r.data?.data || r.data);

export const getActivePlans = () =>
  api.get('/admin/plans', { params: { all: false } }).then(r => {
    const d = r.data?.data || r.data;
    return (Array.isArray(d) ? d : d?.content || []).filter((p: any) => p.active);
  });

/** ISP-level plans only — for ISP admins to subscribe to platform plans */
export const getIspPlans = () =>
  api.get('/admin/plans/isp').then(r => {
    const d = r.data?.data || r.data;
    return (Array.isArray(d) ? d : d?.content || []).filter((p: any) => p.active);
  });

export const syncPlanToStripe = (planId: string) =>
  api.post(`/admin/plans/${planId}/sync-stripe`).then(r => r.data);

/**
 * Open invoice PDF in a new browser tab.
 * The backend endpoint returns either:
 *   - 302 redirect → Stripe hosted PDF URL (browser follows automatically)
 *   - 200 HTML     → rendered invoice page
 * We rely on the JWT token being passed via a temporary link to avoid
 * cross-origin Stripe CORS issues.
 */
export async function openInvoicePdf(invoiceId: string, admin = false): Promise<void> {
  const path = admin
    ? `/admin/invoices/${invoiceId}/pdf`
    : `/admin/billing/invoices/${invoiceId}/pdf`;

  // Fetch with full auth headers — get the response content/redirect URL
  const resp = await api.get(path, {
    responseType: 'arraybuffer',
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const contentType = (resp.headers['content-type'] as string) || '';

  if (contentType.includes('application/pdf')) {
    const blob = new Blob([resp.data], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } else {
    // HTML invoice — decode and open in new tab
    const html = new TextDecoder().decode(resp.data as ArrayBuffer);
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}
