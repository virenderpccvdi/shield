package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.ContactSubmitRequest;
import com.rstglobal.shield.admin.dto.LeadUpdateRequest;
import com.rstglobal.shield.admin.entity.ContactLead;
import com.rstglobal.shield.admin.service.ContactLeadService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/contact")
@RequiredArgsConstructor
public class ContactController {

    private final ContactLeadService contactLeadService;

    /** Public endpoint — website contact form submission (no auth) */
    @PostMapping("/submit")
    public ResponseEntity<Map<String, Object>> submit(
            @RequestBody ContactSubmitRequest req,
            HttpServletRequest httpReq) {
        String ip = getClientIp(httpReq);
        String ua = httpReq.getHeader("User-Agent");
        ContactLead lead = contactLeadService.submit(req, ip, ua);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "id", lead.getId().toString(),
                "message", "Thank you! We'll be in touch shortly."));
    }

    /** Admin: list leads (GLOBAL_ADMIN / ISP_ADMIN) */
    @GetMapping("/leads")
    public ResponseEntity<Page<ContactLead>> list(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(contactLeadService.list(status, pageable));
    }

    @GetMapping("/leads/stats")
    public ResponseEntity<Map<String, Long>> stats() {
        return ResponseEntity.ok(contactLeadService.stats());
    }

    @GetMapping("/leads/{id}")
    public ResponseEntity<ContactLead> get(@PathVariable UUID id) {
        return ResponseEntity.ok(contactLeadService.get(id));
    }

    @PutMapping("/leads/{id}")
    public ResponseEntity<ContactLead> update(@PathVariable UUID id, @RequestBody LeadUpdateRequest req) {
        return ResponseEntity.ok(contactLeadService.update(id, req));
    }

    @DeleteMapping("/leads/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        contactLeadService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private String getClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) return xff.split(",")[0].trim();
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) return realIp;
        return req.getRemoteAddr();
    }
}
