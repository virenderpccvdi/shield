package com.rstglobal.shield.location.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.location.service.VideoCheckinService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/location/video-checkin")
@RequiredArgsConstructor
public class VideoCheckinController {

    private final VideoCheckinService videoCheckinService;

    /** Parent requests a live video check-in from child */
    @PostMapping("/request")
    public ResponseEntity<ApiResponse<Map<String, Object>>> requestVideoCheckin(
            @RequestHeader("X-User-Id") UUID parentUserId,
            @RequestHeader("X-User-Role") String role,
            @RequestBody Map<String, String> body) {
        if (!List.of("GLOBAL_ADMIN", "ISP_ADMIN", "CUSTOMER").contains(role)) {
            return ResponseEntity.status(403).body(ApiResponse.error("FORBIDDEN", "Forbidden"));
        }
        UUID profileId = UUID.fromString(body.get("profileId"));
        Map<String, Object> session = videoCheckinService.requestCheckin(parentUserId, profileId);
        return ResponseEntity.ok(ApiResponse.ok(session, "Video check-in requested"));
    }

    /** Child app (or parent browser) relays a WebRTC signal (offer/answer/ICE candidate) */
    @PostMapping("/signal")
    public ResponseEntity<ApiResponse<Void>> signal(
            @RequestBody Map<String, Object> payload) {
        videoCheckinService.relaySignal(payload);
        return ResponseEntity.ok(ApiResponse.ok(null, "Signal relayed"));
    }

    /** End a video check-in session */
    @PostMapping("/{sessionId}/end")
    public ResponseEntity<ApiResponse<Void>> end(@PathVariable String sessionId) {
        videoCheckinService.endSession(sessionId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Session ended"));
    }
}
