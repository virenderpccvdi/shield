package com.rstglobal.shield.admin.dto;

import lombok.Getter;

/**
 * Represents the result of resolving an invoice PDF.
 * Either a redirect URL (to Stripe-hosted PDF) or inline HTML content.
 */
@Getter
public class InvoicePdfResult {

    public enum Type { REDIRECT, HTML }

    private final Type type;
    private final String value;

    private InvoicePdfResult(Type type, String value) {
        this.type = type;
        this.value = value;
    }

    public static InvoicePdfResult redirect(String url) {
        return new InvoicePdfResult(Type.REDIRECT, url);
    }

    public static InvoicePdfResult html(String htmlContent) {
        return new InvoicePdfResult(Type.HTML, htmlContent);
    }

    public boolean isRedirect() {
        return type == Type.REDIRECT;
    }
}
