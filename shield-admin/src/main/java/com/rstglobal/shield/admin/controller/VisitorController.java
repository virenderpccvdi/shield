package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.VisitorTrackRequest;
import com.rstglobal.shield.admin.entity.WebsiteVisitor;
import com.rstglobal.shield.admin.service.VisitorService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/visitors")
@RequiredArgsConstructor
public class VisitorController {

    private final VisitorService visitorService;

    /** Public endpoint — called by website JS tracker */
    @PostMapping("/track")
    public ResponseEntity<Map<String, Boolean>> track(
            @RequestBody VisitorTrackRequest req,
            HttpServletRequest httpReq) {
        String ip = getClientIp(httpReq);
        String ua = httpReq.getHeader("User-Agent");
        visitorService.track(req, ip, ua);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(visitorService.stats());
    }

    @GetMapping
    public ResponseEntity<Page<WebsiteVisitor>> list(
            @PageableDefault(size = 50, sort = "visitedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(visitorService.list(pageable));
    }

    private String getClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) return xff.split(",")[0].trim();
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) return realIp;
        return req.getRemoteAddr();
    }
}
