package com.rstglobal.shield.dnsresolver.service;

import com.rstglobal.shield.dnsresolver.config.DnsProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.xbill.DNS.*;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.time.Duration;

/**
 * Forwards DNS queries to upstream DoH resolvers (Cloudflare primary, Google fallback).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DnsUpstreamService {

    private static final MediaType DNS_MESSAGE = MediaType.parseMediaType("application/dns-message");

    private final WebClient dohWebClient;
    private final DnsProperties dnsProperties;

    /**
     * Forward a raw DNS query packet to upstream DoH and return the response packet.
     */
    public Mono<byte[]> forward(byte[] queryPacket) {
        return forwardTo(dnsProperties.getUpstreamDoh(), queryPacket)
            .onErrorResume(e -> {
                log.warn("Primary DoH failed, trying fallback: {}", e.getMessage());
                return forwardTo(dnsProperties.getUpstreamFallback(), queryPacket);
            })
            .onErrorResume(e -> {
                log.error("All upstream DoH resolvers failed: {}", e.getMessage());
                return Mono.fromCallable(() -> buildServFail(queryPacket));
            });
    }

    private Mono<byte[]> forwardTo(String url, byte[] queryPacket) {
        return dohWebClient.post()
            .uri(url)
            .contentType(DNS_MESSAGE)
            .accept(DNS_MESSAGE)
            .bodyValue(queryPacket)
            .retrieve()
            .bodyToMono(byte[].class)
            .timeout(Duration.ofMillis(dnsProperties.getQueryTimeoutMs()));
    }

    /**
     * Build a SERVFAIL response for the given query.
     */
    public static byte[] buildServFail(byte[] queryPacket) {
        try {
            Message query = new Message(queryPacket);
            Message response = new Message(query.getHeader().getID());
            response.getHeader().setFlag(Flags.QR);
            response.getHeader().setRcode(Rcode.SERVFAIL);
            if (query.getQuestion() != null) {
                response.addRecord(query.getQuestion(), Section.QUESTION);
            }
            return response.toWire();
        } catch (IOException e) {
            log.error("Failed to build SERVFAIL response", e);
            // Return minimal SERVFAIL
            return new byte[]{0, 0, (byte) 0x80, 2, 0, 0, 0, 0, 0, 0, 0, 0};
        }
    }
}
