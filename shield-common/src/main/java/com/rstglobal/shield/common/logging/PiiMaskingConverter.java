package com.rstglobal.shield.common.logging;

import ch.qos.logback.classic.pattern.ClassicConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

import java.util.regex.Pattern;

public class PiiMaskingConverter extends ClassicConverter {

    // Regex to mask email addresses: john@example.com → j***@example.com
    private static final Pattern EMAIL = Pattern.compile(
        "([a-zA-Z0-9])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})");
    // Regex to mask IPs: 192.168.1.100 → 192.168.x.x
    private static final Pattern IP = Pattern.compile(
        "(\\d{1,3}\\.\\d{1,3})\\.\\d{1,3}\\.\\d{1,3}");

    @Override
    public String convert(ILoggingEvent event) {
        String msg = event.getFormattedMessage();
        msg = EMAIL.matcher(msg).replaceAll("$1***$2");
        msg = IP.matcher(msg).replaceAll("$1.x.x");
        return msg;
    }
}
