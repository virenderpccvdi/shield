package com.rstglobal.shield.dnsresolver.service;

import com.rstglobal.shield.dnsresolver.model.DomainInfo;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;

@Service
public class DomainEnrichmentService {

    // ── Domain → App Name (200+ mappings) ──
    private static final Map<String, String> APP_MAP = Map.ofEntries(
        // Social Media
        Map.entry("tiktok.com", "TikTok"), Map.entry("tiktokcdn.com", "TikTok"),
        Map.entry("tiktokv.com", "TikTok"), Map.entry("musical.ly", "TikTok"),
        Map.entry("byteoversea.com", "TikTok"), Map.entry("byteimg.com", "TikTok"),
        Map.entry("instagram.com", "Instagram"), Map.entry("cdninstagram.com", "Instagram"),
        Map.entry("facebook.com", "Facebook"), Map.entry("fbcdn.net", "Facebook"),
        Map.entry("fb.com", "Facebook"), Map.entry("fbsbx.com", "Facebook"),
        Map.entry("facebook.net", "Facebook"), Map.entry("messenger.com", "Messenger"),
        Map.entry("snapchat.com", "Snapchat"), Map.entry("snap.com", "Snapchat"),
        Map.entry("sc-cdn.net", "Snapchat"), Map.entry("snapkit.co", "Snapchat"),
        Map.entry("twitter.com", "X/Twitter"), Map.entry("x.com", "X/Twitter"),
        Map.entry("twimg.com", "X/Twitter"), Map.entry("t.co", "X/Twitter"),
        Map.entry("reddit.com", "Reddit"), Map.entry("redd.it", "Reddit"),
        Map.entry("redditmedia.com", "Reddit"), Map.entry("redditstatic.com", "Reddit"),
        Map.entry("pinterest.com", "Pinterest"), Map.entry("pinimg.com", "Pinterest"),
        Map.entry("linkedin.com", "LinkedIn"), Map.entry("licdn.com", "LinkedIn"),
        Map.entry("tumblr.com", "Tumblr"), Map.entry("threads.net", "Threads"),
        Map.entry("bsky.app", "Bluesky"), Map.entry("mastodon.social", "Mastodon"),

        // Messaging
        Map.entry("whatsapp.com", "WhatsApp"), Map.entry("whatsapp.net", "WhatsApp"),
        Map.entry("telegram.org", "Telegram"), Map.entry("t.me", "Telegram"),
        Map.entry("telegram.me", "Telegram"), Map.entry("telesco.pe", "Telegram"),
        Map.entry("discord.com", "Discord"), Map.entry("discord.gg", "Discord"),
        Map.entry("discordapp.com", "Discord"), Map.entry("discordapp.net", "Discord"),
        Map.entry("signal.org", "Signal"), Map.entry("wechat.com", "WeChat"),
        Map.entry("viber.com", "Viber"), Map.entry("kik.com", "Kik"),
        Map.entry("line.me", "LINE"), Map.entry("kakaocorp.com", "KakaoTalk"),

        // Video Streaming
        Map.entry("youtube.com", "YouTube"), Map.entry("youtu.be", "YouTube"),
        Map.entry("ytimg.com", "YouTube"), Map.entry("googlevideo.com", "YouTube"),
        Map.entry("yt3.ggpht.com", "YouTube"), Map.entry("youtube-nocookie.com", "YouTube"),
        Map.entry("netflix.com", "Netflix"), Map.entry("nflxvideo.net", "Netflix"),
        Map.entry("nflximg.net", "Netflix"), Map.entry("nflxso.net", "Netflix"),
        Map.entry("nflxext.com", "Netflix"),
        Map.entry("disneyplus.com", "Disney+"), Map.entry("disney-plus.net", "Disney+"),
        Map.entry("dssott.com", "Disney+"), Map.entry("bamgrid.com", "Disney+"),
        Map.entry("hulu.com", "Hulu"), Map.entry("hulustream.com", "Hulu"),
        Map.entry("primevideo.com", "Prime Video"), Map.entry("amazonvideo.com", "Prime Video"),
        Map.entry("hbomax.com", "HBO Max"), Map.entry("max.com", "Max"),
        Map.entry("crunchyroll.com", "Crunchyroll"), Map.entry("vrv.co", "VRV"),
        Map.entry("twitch.tv", "Twitch"), Map.entry("twitchcdn.net", "Twitch"),
        Map.entry("jtvnw.net", "Twitch"), Map.entry("ttvnw.net", "Twitch"),
        Map.entry("vimeo.com", "Vimeo"), Map.entry("dailymotion.com", "Dailymotion"),
        Map.entry("peacocktv.com", "Peacock"), Map.entry("paramountplus.com", "Paramount+"),
        Map.entry("pluto.tv", "Pluto TV"), Map.entry("tubi.tv", "Tubi"),

        // Music
        Map.entry("spotify.com", "Spotify"), Map.entry("spotifycdn.com", "Spotify"),
        Map.entry("scdn.co", "Spotify"), Map.entry("spotilocal.com", "Spotify"),
        Map.entry("apple.com", "Apple"), Map.entry("mzstatic.com", "Apple Music"),
        Map.entry("soundcloud.com", "SoundCloud"), Map.entry("sndcdn.com", "SoundCloud"),
        Map.entry("pandora.com", "Pandora"), Map.entry("deezer.com", "Deezer"),
        Map.entry("tidal.com", "Tidal"),

        // Gaming
        Map.entry("roblox.com", "Roblox"), Map.entry("rbxcdn.com", "Roblox"),
        Map.entry("robloxlabs.com", "Roblox"),
        Map.entry("minecraft.net", "Minecraft"), Map.entry("mojang.com", "Minecraft"),
        Map.entry("fortnite.com", "Fortnite"), Map.entry("epicgames.com", "Epic Games"),
        Map.entry("unrealengine.com", "Epic Games"), Map.entry("olg.epicgames.com", "Fortnite"),
        Map.entry("steampowered.com", "Steam"), Map.entry("steamcommunity.com", "Steam"),
        Map.entry("steamcontent.com", "Steam"), Map.entry("steamstatic.com", "Steam"),
        Map.entry("valvesoftware.com", "Steam"),
        Map.entry("ea.com", "EA"), Map.entry("origin.com", "EA"),
        Map.entry("riotgames.com", "Riot Games"), Map.entry("leagueoflegends.com", "League of Legends"),
        Map.entry("blizzard.com", "Blizzard"), Map.entry("battle.net", "Blizzard"),
        Map.entry("playstation.com", "PlayStation"), Map.entry("playstation.net", "PlayStation"),
        Map.entry("xbox.com", "Xbox"), Map.entry("xboxlive.com", "Xbox"),
        Map.entry("supercell.com", "Supercell"), Map.entry("clashroyale.com", "Clash Royale"),
        Map.entry("clashofclans.com", "Clash of Clans"),
        Map.entry("niantic.com", "Niantic"), Map.entry("pokemongo.com", "Pokemon Go"),
        Map.entry("gameloft.com", "Gameloft"), Map.entry("king.com", "King"),
        Map.entry("zynga.com", "Zynga"), Map.entry("unity3d.com", "Unity"),

        // Shopping
        Map.entry("amazon.com", "Amazon"), Map.entry("amazon.in", "Amazon"),
        Map.entry("amazonws.com", "AWS"), Map.entry("amazonaws.com", "AWS"),
        Map.entry("ebay.com", "eBay"), Map.entry("ebaystatic.com", "eBay"),
        Map.entry("etsy.com", "Etsy"), Map.entry("etsystatic.com", "Etsy"),
        Map.entry("shopify.com", "Shopify"), Map.entry("aliexpress.com", "AliExpress"),
        Map.entry("alibaba.com", "Alibaba"), Map.entry("walmart.com", "Walmart"),
        Map.entry("flipkart.com", "Flipkart"), Map.entry("myntra.com", "Myntra"),

        // Education
        Map.entry("khanacademy.org", "Khan Academy"), Map.entry("coursera.org", "Coursera"),
        Map.entry("udemy.com", "Udemy"), Map.entry("edx.org", "edX"),
        Map.entry("duolingo.com", "Duolingo"), Map.entry("quizlet.com", "Quizlet"),
        Map.entry("chegg.com", "Chegg"), Map.entry("brainly.com", "Brainly"),
        Map.entry("wikipedia.org", "Wikipedia"), Map.entry("wikimedia.org", "Wikipedia"),

        // Search / Productivity
        Map.entry("google.com", "Google"), Map.entry("googleapis.com", "Google"),
        Map.entry("gstatic.com", "Google"), Map.entry("bing.com", "Bing"),
        Map.entry("duckduckgo.com", "DuckDuckGo"), Map.entry("yahoo.com", "Yahoo"),
        Map.entry("zoom.us", "Zoom"), Map.entry("zoom.com", "Zoom"),
        Map.entry("teams.microsoft.com", "Teams"), Map.entry("office.com", "Office 365"),
        Map.entry("microsoft.com", "Microsoft"), Map.entry("live.com", "Microsoft"),
        Map.entry("outlook.com", "Outlook"), Map.entry("skype.com", "Skype"),
        Map.entry("slack.com", "Slack"), Map.entry("notion.so", "Notion"),
        Map.entry("trello.com", "Trello"), Map.entry("github.com", "GitHub"),
        Map.entry("gitlab.com", "GitLab"), Map.entry("stackoverflow.com", "StackOverflow"),

        // News
        Map.entry("cnn.com", "CNN"), Map.entry("bbc.com", "BBC"), Map.entry("bbc.co.uk", "BBC"),
        Map.entry("nytimes.com", "NYT"), Map.entry("washingtonpost.com", "Washington Post"),
        Map.entry("reuters.com", "Reuters"), Map.entry("apnews.com", "AP News"),

        // Adult (blocked by default)
        Map.entry("pornhub.com", "Pornhub"), Map.entry("xvideos.com", "XVideos"),
        Map.entry("xnxx.com", "XNXX"), Map.entry("xhamster.com", "xHamster"),
        Map.entry("onlyfans.com", "OnlyFans"), Map.entry("chaturbate.com", "Chaturbate"),
        Map.entry("redtube.com", "RedTube"), Map.entry("youporn.com", "YouPorn"),
        Map.entry("spankbang.com", "SpankBang"), Map.entry("rule34.xxx", "Rule34"),

        // Gambling
        Map.entry("bet365.com", "Bet365"), Map.entry("draftkings.com", "DraftKings"),
        Map.entry("fanduel.com", "FanDuel"), Map.entry("pokerstars.com", "PokerStars"),
        Map.entry("bovada.lv", "Bovada"), Map.entry("888casino.com", "888Casino"),
        Map.entry("betway.com", "Betway"), Map.entry("williamhill.com", "William Hill"),

        // VPN / Proxy (often blocked in parental controls)
        Map.entry("nordvpn.com", "NordVPN"), Map.entry("expressvpn.com", "ExpressVPN"),
        Map.entry("surfshark.com", "Surfshark"), Map.entry("privateinternetaccess.com", "PIA"),
        Map.entry("protonvpn.com", "ProtonVPN"), Map.entry("hidemyass.com", "HideMyAss"),
        Map.entry("torproject.org", "Tor"), Map.entry("psiphon3.com", "Psiphon"),

        // AI
        Map.entry("openai.com", "OpenAI"), Map.entry("chatgpt.com", "ChatGPT"),
        Map.entry("anthropic.com", "Anthropic"), Map.entry("claude.ai", "Claude"),
        Map.entry("bard.google.com", "Gemini"), Map.entry("gemini.google.com", "Gemini"),
        Map.entry("midjourney.com", "Midjourney"), Map.entry("perplexity.ai", "Perplexity")
    );

    // ── Domain → Category ──
    private static final Map<String, String> CATEGORY_MAP = Map.ofEntries(
        Map.entry("tiktok.com", "social_media"), Map.entry("tiktokcdn.com", "social_media"),
        Map.entry("tiktokv.com", "social_media"), Map.entry("byteoversea.com", "social_media"),
        Map.entry("instagram.com", "social_media"), Map.entry("cdninstagram.com", "social_media"),
        Map.entry("facebook.com", "social_media"), Map.entry("fbcdn.net", "social_media"),
        Map.entry("fb.com", "social_media"), Map.entry("snapchat.com", "social_media"),
        Map.entry("snap.com", "social_media"), Map.entry("twitter.com", "social_media"),
        Map.entry("x.com", "social_media"), Map.entry("reddit.com", "social_media"),
        Map.entry("pinterest.com", "social_media"), Map.entry("linkedin.com", "social_media"),
        Map.entry("tumblr.com", "social_media"), Map.entry("threads.net", "social_media"),
        Map.entry("bsky.app", "social_media"), Map.entry("mastodon.social", "social_media"),

        Map.entry("whatsapp.com", "messaging"), Map.entry("whatsapp.net", "messaging"),
        Map.entry("telegram.org", "messaging"), Map.entry("t.me", "messaging"),
        Map.entry("discord.com", "messaging"), Map.entry("discordapp.com", "messaging"),
        Map.entry("signal.org", "messaging"), Map.entry("viber.com", "messaging"),
        Map.entry("kik.com", "messaging"), Map.entry("messenger.com", "messaging"),

        Map.entry("youtube.com", "streaming"), Map.entry("youtu.be", "streaming"),
        Map.entry("netflix.com", "streaming"), Map.entry("nflxvideo.net", "streaming"),
        Map.entry("disneyplus.com", "streaming"), Map.entry("hulu.com", "streaming"),
        Map.entry("primevideo.com", "streaming"), Map.entry("twitch.tv", "streaming"),
        Map.entry("crunchyroll.com", "streaming"), Map.entry("max.com", "streaming"),
        Map.entry("peacocktv.com", "streaming"), Map.entry("paramountplus.com", "streaming"),

        Map.entry("spotify.com", "music"), Map.entry("soundcloud.com", "music"),
        Map.entry("pandora.com", "music"), Map.entry("deezer.com", "music"),
        Map.entry("tidal.com", "music"),

        Map.entry("roblox.com", "gaming"), Map.entry("rbxcdn.com", "gaming"),
        Map.entry("minecraft.net", "gaming"), Map.entry("mojang.com", "gaming"),
        Map.entry("fortnite.com", "gaming"), Map.entry("epicgames.com", "gaming"),
        Map.entry("steampowered.com", "gaming"), Map.entry("steamcommunity.com", "gaming"),
        Map.entry("ea.com", "gaming"), Map.entry("riotgames.com", "gaming"),
        Map.entry("blizzard.com", "gaming"), Map.entry("battle.net", "gaming"),
        Map.entry("supercell.com", "gaming"), Map.entry("king.com", "gaming"),
        Map.entry("zynga.com", "gaming"),

        Map.entry("amazon.com", "shopping"), Map.entry("amazon.in", "shopping"),
        Map.entry("ebay.com", "shopping"), Map.entry("etsy.com", "shopping"),
        Map.entry("shopify.com", "shopping"), Map.entry("aliexpress.com", "shopping"),
        Map.entry("walmart.com", "shopping"), Map.entry("flipkart.com", "shopping"),

        Map.entry("khanacademy.org", "education"), Map.entry("coursera.org", "education"),
        Map.entry("udemy.com", "education"), Map.entry("edx.org", "education"),
        Map.entry("duolingo.com", "education"), Map.entry("quizlet.com", "education"),
        Map.entry("wikipedia.org", "education"), Map.entry("brainly.com", "education"),

        Map.entry("google.com", "search"), Map.entry("bing.com", "search"),
        Map.entry("duckduckgo.com", "search"), Map.entry("yahoo.com", "search"),

        Map.entry("pornhub.com", "adult"), Map.entry("xvideos.com", "adult"),
        Map.entry("xnxx.com", "adult"), Map.entry("xhamster.com", "adult"),
        Map.entry("onlyfans.com", "adult"), Map.entry("chaturbate.com", "adult"),
        Map.entry("redtube.com", "adult"), Map.entry("youporn.com", "adult"),
        Map.entry("spankbang.com", "adult"), Map.entry("rule34.xxx", "adult"),

        Map.entry("bet365.com", "gambling"), Map.entry("draftkings.com", "gambling"),
        Map.entry("fanduel.com", "gambling"), Map.entry("pokerstars.com", "gambling"),
        Map.entry("bovada.lv", "gambling"), Map.entry("betway.com", "gambling"),

        Map.entry("nordvpn.com", "vpn_proxy"), Map.entry("expressvpn.com", "vpn_proxy"),
        Map.entry("surfshark.com", "vpn_proxy"), Map.entry("protonvpn.com", "vpn_proxy"),
        Map.entry("torproject.org", "vpn_proxy"), Map.entry("psiphon3.com", "vpn_proxy"),

        Map.entry("openai.com", "ai"), Map.entry("chatgpt.com", "ai"),
        Map.entry("anthropic.com", "ai"), Map.entry("claude.ai", "ai"),
        Map.entry("midjourney.com", "ai"), Map.entry("perplexity.ai", "ai"),

        Map.entry("cnn.com", "news"), Map.entry("bbc.com", "news"),
        Map.entry("nytimes.com", "news"), Map.entry("reuters.com", "news")
    );

    private static final Set<String> CDN_SUFFIXES = Set.of(
        "cdn.com", "cdninstagram.com", "fbcdn.net", "akamaihd.net", "akamai.net",
        "cloudfront.net", "fastly.net", "edgecastcdn.net", "azureedge.net",
        "googleusercontent.com", "gstatic.com", "ytimg.com", "twimg.com",
        "sc-cdn.net", "scdn.co", "nflximg.net", "rbxcdn.com", "pinimg.com"
    );

    private static final Set<String> TRACKING_DOMAINS = Set.of(
        "doubleclick.net", "googlesyndication.com", "googleadservices.com",
        "google-analytics.com", "googletagmanager.com", "facebook.net",
        "analytics.tiktok.com", "ads.yahoo.com", "advertising.com",
        "adnxs.com", "criteo.com", "taboola.com", "outbrain.com",
        "scorecardresearch.com", "quantserve.com", "moatads.com",
        "appsflyer.com", "adjust.com", "branch.io", "mixpanel.com",
        "amplitude.com", "segment.io", "hotjar.com", "fullstory.com"
    );

    /**
     * Extract root domain from a FQDN. Simple suffix-based approach.
     * e.g. "www.photos.instagram.com" → "instagram.com"
     *      "cdn.roblox.com" → "roblox.com"
     *      "a.b.co.uk" → "b.co.uk"
     */
    public static String extractRootDomain(String domain) {
        if (domain == null || domain.isEmpty()) return domain;
        // Remove trailing dot
        if (domain.endsWith(".")) domain = domain.substring(0, domain.length() - 1);
        domain = domain.toLowerCase();

        String[] parts = domain.split("\\.");
        if (parts.length <= 2) return domain;

        // Handle common two-part TLDs
        Set<String> twoPartTlds = Set.of("co.uk", "co.in", "co.jp", "co.kr", "com.au",
            "com.br", "com.cn", "com.mx", "com.sg", "com.hk", "org.uk", "net.au",
            "ac.uk", "gov.uk", "co.za", "co.nz", "ne.jp", "or.jp");

        if (parts.length >= 3) {
            String lastTwo = parts[parts.length - 2] + "." + parts[parts.length - 1];
            if (twoPartTlds.contains(lastTwo)) {
                if (parts.length >= 4) {
                    return parts[parts.length - 3] + "." + lastTwo;
                }
                return domain;
            }
        }
        return parts[parts.length - 2] + "." + parts[parts.length - 1];
    }

    public DomainInfo enrich(String domain) {
        if (domain == null || domain.isEmpty()) {
            return DomainInfo.builder()
                .originalDomain(domain)
                .rootDomain(domain)
                .build();
        }

        String normalized = domain.toLowerCase();
        if (normalized.endsWith(".")) normalized = normalized.substring(0, normalized.length() - 1);

        String root = extractRootDomain(normalized);

        String appName = APP_MAP.get(root);
        if (appName == null) appName = APP_MAP.get(normalized);

        String category = CATEGORY_MAP.get(root);
        if (category == null) category = CATEGORY_MAP.get(normalized);

        boolean isCdn = CDN_SUFFIXES.contains(root) || normalized.contains(".cdn.");
        boolean isTracking = TRACKING_DOMAINS.contains(root) || TRACKING_DOMAINS.contains(normalized);

        return DomainInfo.builder()
            .originalDomain(domain)
            .rootDomain(root)
            .appName(appName)
            .category(category)
            .cdn(isCdn)
            .tracking(isTracking)
            .build();
    }
}
