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
 * Open invoice PDF in a new tab.
 * Fetches via authenticated axios, then opens the result:
 * - If backend redirects to Stripe PDF URL, opens that URL directly.
 * - If backend returns HTML, opens a blob URL with the HTML content.
 */
export async function openInvoicePdf(invoiceId: string, admin = false): Promise<void> {
  const url = admin
    ? `/admin/invoices/${invoiceId}/pdf`
    : `/admin/billing/invoices/${invoiceId}/pdf`;

  const resp = await api.get(url, {
    maxRedirects: 0,
    validateStatus: (s) => s >= 200 && s < 400,
    responseType: 'arraybuffer',
  });

  // If axios followed a redirect (302 -> Stripe PDF), the final response is the PDF itself
  // But in practice, the browser/axios may follow the redirect automatically.
  // Check the content-type to decide what to do.
  const contentType = resp.headers['content-type'] || '';

  if (contentType.includes('text/html')) {
    // Backend returned HTML invoice — open in new tab via blob URL
    const blob = new Blob([resp.data], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } else if (contentType.includes('application/pdf')) {
    // Got a PDF (redirect was followed) — open via blob
    const blob = new Blob([resp.data], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } else {
    // Likely a redirect URL in the Location header (shouldn't happen with axios follow)
    // Try to extract redirect URL from response
    const location = resp.headers['location'];
    if (location) {
      window.open(location, '_blank');
    } else {
      // Fallback: try to open as HTML
      const text = new TextDecoder().decode(resp.data);
      const blob = new Blob([text], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  }
}
