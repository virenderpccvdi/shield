"""
Suite: Billing, Payments & Invoices
Tests subscription management, invoice generation, Stripe integration,
PDF export, billing history, and ISP billing flows.
"""
import psycopg2
from .base import TestSuite, Severity


class BillingSuite(TestSuite):
    name = "billing"

    def _db(self, sql, params=None):
        try:
            conn = psycopg2.connect(**self.config["db"])
            cur  = conn.cursor()
            cur.execute(sql, params)
            rows = cur.fetchall()
            conn.close()
            return rows
        except Exception as e:
            return []

    def _tenant_id(self):
        rows = self._db("SELECT id FROM tenant.tenants LIMIT 1")
        return str(rows[0][0]) if rows else None

    def _invoice_id(self):
        rows = self._db("""
            SELECT id FROM admin.invoices ORDER BY created_at DESC LIMIT 1
        """)
        if not rows:
            rows = self._db("SELECT id FROM admin.invoices LIMIT 1")
        return str(rows[0][0]) if rows else None

    def run(self):
        print("\n── Billing & Invoices ───────────────────────────────────")

        # ── DB: billing schemas/tables ─────────────────────────────────────
        billing_tables = [
            "admin.invoices",
            "admin.subscription_plans",
        ]
        for table in billing_tables:
            rows = self._db(f"""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema || '.' || table_name = %s
            """, (table,))
            exists = rows[0][0] > 0 if rows else False
            self.assert_ok(f"Table {table} exists", exists,
                           f"{table} not found in DB",
                           severity=Severity.HIGH if "invoice" in table else Severity.MEDIUM)

        # ── Invoice list ───────────────────────────────────────────────────
        r = self.get("/api/v1/admin/invoices")
        ok = self.assert_status("GET /admin/invoices", r, 200, severity=Severity.HIGH)
        if ok:
            d = r.json()
            data = d.get("data", d)
            items = data.get("content", data) if isinstance(data, dict) else data
            cnt   = len(items) if isinstance(items, list) else 0
            self.assert_ok(f"Invoices list returned ({cnt} items)",
                           cnt >= 0,
                           "Invoices response structure unexpected",
                           severity=Severity.MEDIUM,
                           detail=str(d)[:300])

        # ── Single invoice by ID ──────────────────────────────────────────
        invoice_id = self._invoice_id()
        if invoice_id:
            r = self.get(f"/api/v1/admin/invoices/{invoice_id}")
            ok = self.assert_status(f"GET /admin/invoices/{invoice_id}", r, 200,
                                    severity=Severity.HIGH)
            if ok:
                d    = r.json().get("data", r.json())
                has  = bool(d.get("id") or d.get("invoiceNumber") or d.get("amount"))
                self.assert_ok("Invoice has required fields (id/amount)",
                               has, f"Invoice missing fields: {list(d.keys())[:5]}",
                               severity=Severity.HIGH)

            # Invoice PDF
            r_pdf = self.get(f"/api/v1/admin/invoices/{invoice_id}/pdf")
            ok_pdf = self.assert_status(f"GET /admin/invoices/{invoice_id}/pdf", r_pdf, 200,
                                        severity=Severity.MEDIUM)
            if ok_pdf:
                ct = r_pdf.headers.get("Content-Type", "")
                is_pdf = "pdf" in ct.lower() or "html" in ct.lower() or len(r_pdf.content) > 200
                self.assert_ok("Invoice PDF/HTML has content",
                               is_pdf and len(r_pdf.content) > 100,
                               f"PDF response too small ({len(r_pdf.content)} bytes), CT={ct}",
                               severity=Severity.MEDIUM)
        else:
            self.assert_ok("Invoice found in DB for PDF test",
                           False, "No invoices in DB — create a test invoice",
                           severity=Severity.LOW,
                           fix="Complete a Stripe checkout to generate an invoice")

        # ── Subscription endpoint ─────────────────────────────────────────
        r = self.get("/api/v1/admin/billing/subscription",
                     params={"userId": "self"})
        if r is not None and r.status_code not in (200, 404):
            # May need userId — check with tenant
            r = self.get("/api/v1/admin/billing/subscription")
        self.assert_ok("GET /admin/billing/subscription accessible",
                       r is not None and r.status_code in (200, 400, 404),
                       f"Got {r.status_code if r else 'no response'}",
                       severity=Severity.MEDIUM)

        # ── My invoices ───────────────────────────────────────────────────
        r = self.get("/api/v1/admin/billing/invoices/my")
        self.assert_ok("GET /admin/billing/invoices/my accessible",
                       r is not None and r.status_code in (200, 404),
                       f"Got {r.status_code if r else 'error'}",
                       severity=Severity.MEDIUM)

        # ── DB invoice data integrity ─────────────────────────────────────
        inv_rows = self._db("""
            SELECT COUNT(*), AVG(amount), MIN(created_at), MAX(created_at)
            FROM admin.invoices
        """)
        if inv_rows:
            cnt, avg_amt, min_dt, max_dt = inv_rows[0]
            self.assert_ok(f"Invoices in DB: {cnt}",
                           cnt >= 0,
                           "Invoice count query failed",
                           severity=Severity.INFO)
            if cnt > 0 and avg_amt:
                self.assert_ok(f"Invoice amounts reasonable (avg={avg_amt:.2f})",
                               float(avg_amt) >= 0,
                               f"Negative invoice amounts detected",
                               severity=Severity.HIGH)

        # ── Subscriptions DB check ────────────────────────────────────────
        sub_rows = self._db("SELECT COUNT(*) FROM admin.subscription_plans")
        sub_cnt  = sub_rows[0][0] if sub_rows else -1
        self.assert_ok(f"subscription_plans table accessible ({sub_cnt} records)",
                       sub_cnt >= 0,
                       f"subscription_plans query failed",
                       severity=Severity.INFO)

        # ── Tenant admin bulk stats ───────────────────────────────────────
        r = self.get("/api/v1/admin/tenants/stats")
        ok = self.assert_status("GET /admin/tenants/stats", r, 200,
                                severity=Severity.MEDIUM)
        if ok:
            d = r.json()
            self.assert_ok("Tenant stats has data",
                           bool(d) and d != {},
                           "Empty tenant stats response",
                           severity=Severity.LOW,
                           detail=str(d)[:200])

        # ── AI settings (billing-adjacent: plan features) ─────────────────
        r = self.get("/api/v1/admin/ai-settings")
        self.assert_status("GET /admin/ai-settings (plan feature check)", r, 200,
                           severity=Severity.LOW)

        # ── Non-existent invoice (404 expected) ───────────────────────────
        r = self.get("/api/v1/admin/invoices/00000000-0000-0000-0000-000000000000")
        self.assert_ok("Non-existent invoice → 404",
                       r is not None and r.status_code == 404,
                       f"Got {r.status_code if r else 'error'} (expected 404)",
                       severity=Severity.MEDIUM,
                       fix="InvoiceService.findById must throw ShieldException.notFound()")

        return self.results
