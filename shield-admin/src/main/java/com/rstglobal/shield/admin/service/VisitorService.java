package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.VisitorTrackRequest;
import com.rstglobal.shield.admin.entity.WebsiteVisitor;
import com.rstglobal.shield.admin.repository.WebsiteVisitorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class VisitorService {

    private final WebsiteVisitorRepository repo;
    private final RestTemplate restTemplate;

    @Async
    public void track(VisitorTrackRequest req, String ip, String userAgent) {
        try {
            String country = null, region = null, city = null;
            Double lat = null, lon = null;
            boolean isMobile = userAgent != null &&
                    (userAgent.contains("Mobile") || userAgent.contains("Android") || userAgent.contains("iPhone"));

            if (ip != null && !ip.startsWith("127.") && !ip.startsWith("::1") && !ip.startsWith("192.168.")) {
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> geo = restTemplate.getForObject(
                        "http://ip-api.com/json/" + ip + "?fields=status,country,regionName,city,lat,lon",
                        Map.class
                    );
                    if (geo != null && "success".equals(geo.get("status"))) {
                        country = (String) geo.get("country");
                        region  = (String) geo.get("regionName");
                        city    = (String) geo.get("city");
                        if (geo.get("lat") instanceof Number n) lat = n.doubleValue();
                        if (geo.get("lon") instanceof Number n) lon = n.doubleValue();
                    }
                } catch (Exception e) {
                    log.debug("GeoIP lookup failed for {}: {}", ip, e.getMessage());
                }
            }

            WebsiteVisitor v = WebsiteVisitor.builder()
                    .sessionId(req.getSessionId())
                    .ipAddress(ip)
                    .country(country)
                    .region(region)
                    .city(city)
                    .latitude(lat)
                    .longitude(lon)
                    .pagePath(req.getPagePath())
                    .referrer(req.getReferrer())
                    .userAgent(userAgent)
                    .isMobile(isMobile)
                    .build();
            repo.save(v);
        } catch (Exception e) {
            log.warn("Failed to track visitor: {}", e.getMessage());
        }
    }

    public Map<String, Object> stats() {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime startOfToday = now.toLocalDate().atStartOfDay().atOffset(now.getOffset());

        long today       = repo.countByVisitedAtAfter(startOfToday);
        long week        = repo.countByVisitedAtAfter(now.minusDays(7));
        long total       = repo.count();
        long uniqueToday = repo.countDistinctSessionsSince(startOfToday);

        List<Object[]> byCountry = repo.countByCountry();
        Map<String, Long> countryMap = new LinkedHashMap<>();
        for (Object[] row : byCountry) {
            if (row[0] != null) countryMap.put(row[0].toString(), ((Number) row[1]).longValue());
        }

        return Map.of(
            "total", total,
            "today", today,
            "week", week,
            "uniqueToday", uniqueToday,
            "byCountry", countryMap
        );
    }

    public Page<WebsiteVisitor> list(Pageable pageable) {
        return repo.findAll(pageable);
    }
}
