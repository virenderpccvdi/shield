-- Shield Notification — V3: ISP Customer Communication broadcast table
CREATE TABLE IF NOT EXISTS notification.isp_communications (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID         NOT NULL,
    subject          VARCHAR(300) NOT NULL,
    body             TEXT         NOT NULL,
    channel          VARCHAR(20)  NOT NULL DEFAULT 'EMAIL',
    sent_by          UUID         NOT NULL,
    sent_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    recipient_count  INT          NOT NULL DEFAULT 0,
    status           VARCHAR(20)  NOT NULL DEFAULT 'SENT'
);
CREATE INDEX idx_isp_comm_tenant ON notification.isp_communications(tenant_id, sent_at DESC);
