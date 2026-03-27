package com.rstglobal.shield.dns.config;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Master registry of filterable content categories.
 * Key = internal category key (used in dns_rules.enabled_categories JSONB).
 * Value = display label.
 */
public final class ContentCategories {

    private ContentCategories() {}

    /** Returns ordered map of all categories. */
    public static Map<String, String> all() {
        Map<String, String> m = new LinkedHashMap<>();
        // Safety (always recommended on)
        m.put("malware",          "Malware & Viruses");
        m.put("phishing",         "Phishing & Scams");
        m.put("csam",             "Child Abuse Material");
        m.put("ransomware",       "Ransomware");
        // Adult
        m.put("adult",            "Adult Content");
        m.put("pornography",      "Pornography");
        m.put("dating",           "Dating Sites");
        m.put("nudity",           "Nudity");
        // Social & Communication
        m.put("social_media",     "Social Media");
        m.put("messaging",        "Messaging Apps");
        m.put("forums",           "Forums & Boards");
        m.put("chat",             "Chat Platforms");
        // Entertainment
        m.put("streaming",        "Video Streaming");
        m.put("music",            "Music Streaming");
        m.put("podcasts",         "Podcasts");
        m.put("live_streaming",   "Live Streaming");
        // Gaming
        m.put("gaming",           "Gaming");
        m.put("online_gaming",    "Online Multiplayer");
        m.put("esports",          "eSports");
        m.put("game_stores",      "Game Stores");
        // Restricted
        m.put("gambling",         "Gambling");
        m.put("alcohol",          "Alcohol");
        m.put("tobacco",          "Tobacco & Vaping");
        m.put("drugs",            "Drugs");
        m.put("weapons",          "Weapons");
        m.put("violence",         "Violence & Gore");
        m.put("hate_speech",      "Hate Speech");
        // Privacy & Security
        m.put("vpn_proxy",        "VPN & Proxies");
        m.put("anonymizers",      "Anonymizers");
        m.put("tor",              "Tor Networks");
        // Productivity (block during school hours)
        m.put("ads",              "Ads & Tracking");
        m.put("shopping",         "Online Shopping");
        m.put("news",             "News & Media");
        m.put("sports",           "Sports");
        m.put("entertainment",    "General Entertainment");
        m.put("humor",            "Humor & Memes");
        // Education
        m.put("education",        "Educational Content");
        m.put("search_engines",   "Search Engines");
        m.put("reference",        "Reference & Research");
        // Tech
        m.put("downloads",        "File Downloads");
        m.put("software",         "Software Sites");
        m.put("hacking",          "Hacking Tools");
        m.put("crypto",           "Cryptocurrency");
        return m;
    }

    /** Default categories enabled for STRICT filter level (true = blocked, i.e. disabled). */
    public static Map<String, Boolean> defaultsForFilterLevel(String filterLevel) {
        Map<String, Boolean> cats = new LinkedHashMap<>();
        // Safety categories: always blocked (false = blocked = not enabled)
        all().keySet().forEach(k -> cats.put(k, true)); // start: all allowed
        // Always block regardless of level
        cats.put("malware",    false);
        cats.put("phishing",   false);
        cats.put("csam",       false);
        cats.put("ransomware", false);
        cats.put("hacking",    false);
        cats.put("vpn_proxy",  false);
        cats.put("anonymizers",false);
        cats.put("tor",        false);
        cats.put("adult",      false);
        cats.put("pornography",false);
        cats.put("nudity",     false);
        cats.put("dating",     false);
        cats.put("hate_speech",false);
        cats.put("violence",   false);
        cats.put("weapons",    false);

        switch (filterLevel) {
            case "MAXIMUM" -> {
                cats.put("gambling",       false);
                cats.put("alcohol",        false);
                cats.put("tobacco",        false);
                cats.put("drugs",          false);
                cats.put("gaming",         false);
                cats.put("online_gaming",  false);
                cats.put("esports",        false);
                cats.put("social_media",   false);
                cats.put("messaging",      false);
                cats.put("streaming",      false);
                cats.put("music",          false);
                cats.put("live_streaming", false);
                cats.put("chat",           false);
                cats.put("downloads",      false);
                cats.put("crypto",         false);
                cats.put("shopping",       false);
            }
            case "STRICT" -> {
                cats.put("gambling",       false);
                cats.put("alcohol",        false);
                cats.put("tobacco",        false);
                cats.put("drugs",          false);
                cats.put("gaming",         false);
                cats.put("online_gaming",  false);
                cats.put("esports",        false);
                cats.put("social_media",   false);
                cats.put("messaging",      false);
                cats.put("streaming",      false);
                cats.put("live_streaming", false);
                cats.put("chat",           false);
                cats.put("crypto",         false);
                cats.put("shopping",       false);
            }
            case "MODERATE", "STANDARD" -> {
                cats.put("gambling",       false);
                cats.put("alcohol",        false);
                cats.put("tobacco",        false);
                cats.put("drugs",          false);
                cats.put("crypto",         false);
            }
            case "LIGHT", "MINIMAL" -> {
                // Only safety + adult blocked (already set above)
            }
        }
        return cats;
    }
}
