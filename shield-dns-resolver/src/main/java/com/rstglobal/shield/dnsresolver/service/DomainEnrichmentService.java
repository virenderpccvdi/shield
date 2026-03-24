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
    // NOTE: Redis cache (shield:domcat:*) is checked FIRST in enrich().
    //       These in-memory entries serve as fallback when Redis is unavailable.
    private static final Map<String, String> CATEGORY_MAP;
    static {
        Map<String, String> m = new java.util.HashMap<>();
        // ── Social Media ──
        m.put("tiktok.com",    "social_media"); m.put("tiktokcdn.com", "social_media");
        m.put("tiktokv.com",   "social_media"); m.put("byteoversea.com","social_media");
        m.put("byteimg.com",   "social_media"); m.put("musical.ly",    "social_media");
        m.put("ttwstatic.com", "social_media"); m.put("ibytedtos.com", "social_media");
        m.put("amemv.com",     "social_media"); m.put("snssdk.com",    "social_media");
        m.put("instagram.com", "social_media"); m.put("cdninstagram.com","social_media");
        m.put("instagramstatic-a.akamaihd.net","social_media");
        m.put("facebook.com",  "social_media"); m.put("fbcdn.net",     "social_media");
        m.put("fb.com",        "social_media"); m.put("fbsbx.com",     "social_media");
        m.put("facebook.net",  "social_media"); m.put("messenger.com", "social_media");
        m.put("snapchat.com",  "social_media"); m.put("sc-cdn.net",    "social_media");
        m.put("snapkit.com",   "social_media"); m.put("snap.com",      "social_media");
        m.put("twitter.com",   "social_media"); m.put("x.com",         "social_media");
        m.put("twimg.com",     "social_media"); m.put("t.co",          "social_media");
        m.put("reddit.com",    "social_media"); m.put("redd.it",       "social_media");
        m.put("redditmedia.com","social_media");m.put("redditstatic.com","social_media");
        m.put("reddituploads.com","social_media");
        m.put("pinterest.com", "social_media"); m.put("pinimg.com",    "social_media");
        m.put("linkedin.com",  "social_media"); m.put("licdn.com",     "social_media");
        m.put("tumblr.com",    "social_media"); m.put("assets.tumblr.com","social_media");
        m.put("threads.net",   "social_media"); m.put("bsky.app",      "social_media");
        m.put("bsky.social",   "social_media"); m.put("mastodon.social","social_media");
        m.put("bereal.com",    "social_media"); m.put("bere.al",       "social_media");
        // ── Discord ──
        m.put("discord.com",   "messaging"); m.put("discord.gg",      "messaging");
        m.put("discordapp.com","messaging"); m.put("discordapp.net",   "messaging");
        m.put("dl.discordapp.net","messaging");
        // ── Messaging ──
        m.put("whatsapp.com",  "messaging"); m.put("whatsapp.net",    "messaging");
        m.put("wa.me",         "messaging");
        m.put("telegram.org",  "messaging"); m.put("t.me",            "messaging");
        m.put("telegram.me",   "messaging"); m.put("telesco.pe",      "messaging");
        m.put("signal.org",    "messaging"); m.put("wechat.com",      "messaging");
        m.put("viber.com",     "messaging"); m.put("kik.com",         "messaging");
        m.put("line.me",       "messaging"); m.put("kakaocorp.com",   "messaging");
        // ── YouTube ──
        m.put("youtube.com",   "streaming"); m.put("youtu.be",        "streaming");
        m.put("ytimg.com",     "streaming"); m.put("googlevideo.com", "streaming");
        m.put("yt3.ggpht.com", "streaming"); m.put("youtube-nocookie.com","streaming");
        // ── Streaming ──
        m.put("netflix.com",   "streaming"); m.put("nflxvideo.net",   "streaming");
        m.put("nflximg.net",   "streaming"); m.put("nflxso.net",      "streaming");
        m.put("nflxext.com",   "streaming");
        m.put("disneyplus.com","streaming"); m.put("disney-plus.net", "streaming");
        m.put("dssott.com",    "streaming"); m.put("bamgrid.com",     "streaming");
        m.put("hulu.com",      "streaming"); m.put("primevideo.com",  "streaming");
        m.put("max.com",       "streaming"); m.put("hbomax.com",      "streaming");
        m.put("twitch.tv",     "streaming"); m.put("twitchcdn.net",   "streaming");
        m.put("jtvnw.net",     "streaming"); m.put("ttvnw.net",       "streaming");
        m.put("crunchyroll.com","streaming");m.put("peacocktv.com",   "streaming");
        m.put("paramountplus.com","streaming");
        m.put("hotstar.com",   "streaming"); m.put("jiocinema.com",   "streaming");
        m.put("sonyliv.com",   "streaming"); m.put("zee5.com",        "streaming");
        m.put("voot.com",      "streaming"); m.put("pluto.tv",        "streaming");

        // ── Music ──
        m.put("spotify.com",   "music"); m.put("spotifycdn.com",  "music");
        m.put("scdn.co",       "music"); m.put("soundcloud.com",  "music");
        m.put("sndcdn.com",    "music"); m.put("pandora.com",     "music");
        m.put("deezer.com",    "music"); m.put("tidal.com",       "music");
        m.put("jiosaavn.com",  "music"); m.put("gaana.com",       "music");
        m.put("wynk.in",       "music");
        // ── Gaming ──
        m.put("roblox.com",    "gaming"); m.put("rbxcdn.com",     "gaming");
        m.put("roblox-static.com","gaming"); m.put("rbx.com",     "gaming");
        m.put("robloxlabs.com","gaming");
        m.put("minecraft.net", "gaming"); m.put("mojang.com",     "gaming");
        m.put("fortnite.com",  "gaming"); m.put("epicgames.com",  "gaming");
        m.put("epicusercontent.com","gaming"); m.put("unrealengine.com","gaming");
        m.put("steampowered.com","gaming"); m.put("steamcommunity.com","gaming");
        m.put("steamstatic.com","gaming"); m.put("steamcontent.com","gaming");
        m.put("valvesoftware.com","gaming");
        m.put("ea.com","gaming"); m.put("easports.com","gaming");
        m.put("origin.com","gaming"); m.put("easyanticheat.net","gaming");
        m.put("riotgames.com","gaming"); m.put("leagueoflegends.com","gaming");
        m.put("valorant.com","gaming");
        m.put("blizzard.com","gaming"); m.put("battle.net","gaming");
        m.put("activision.com","gaming"); m.put("callofduty.com","gaming");
        m.put("xbox.com","gaming"); m.put("xboxlive.com","gaming");
        m.put("playstation.com","gaming"); m.put("playstation.net","gaming");
        m.put("nintendo.com","gaming"); m.put("nintendoswitch.com","gaming");
        m.put("pubg.com","gaming"); m.put("pubgmobile.com","gaming");
        m.put("krafton.com","gaming");
        m.put("freefiremobile.com","gaming"); m.put("garena.com","gaming");
        m.put("rockstargames.com","gaming");
        m.put("hoyoverse.com","gaming"); m.put("mihoyo.com","gaming");
        m.put("nianticlabs.com","gaming"); m.put("pokemongolive.com","gaming");
        m.put("supercell.com","gaming"); m.put("clashofclans.com","gaming");
        m.put("clashroyale.com","gaming"); m.put("king.com","gaming");
        m.put("zynga.com","gaming"); m.put("gameloft.com","gaming");
        // ── Shopping ──
        m.put("amazon.com","shopping"); m.put("amazon.in","shopping");
        m.put("ebay.com","shopping"); m.put("etsy.com","shopping");
        m.put("shopify.com","shopping"); m.put("aliexpress.com","shopping");
        m.put("walmart.com","shopping"); m.put("flipkart.com","shopping");
        m.put("myntra.com","shopping"); m.put("meesho.com","shopping");
        m.put("ajio.com","shopping"); m.put("nykaa.com","shopping");
        // ── Education ──
        m.put("khanacademy.org","education"); m.put("coursera.org","education");
        m.put("udemy.com","education"); m.put("edx.org","education");
        m.put("duolingo.com","education"); m.put("quizlet.com","education");
        m.put("wikipedia.org","education"); m.put("brainly.com","education");
        m.put("scratch.mit.edu","education"); m.put("code.org","education");
        m.put("byjus.com","education"); m.put("vedantu.com","education");
        m.put("unacademy.com","education"); m.put("toppr.com","education");
        // ── Search ──
        m.put("google.com","search"); m.put("bing.com","search");
        m.put("duckduckgo.com","search"); m.put("yahoo.com","search");
        // ── Adult ──
        m.put("pornhub.com","adult"); m.put("xvideos.com","adult");
        m.put("xnxx.com","adult"); m.put("xhamster.com","adult");
        m.put("onlyfans.com","adult"); m.put("chaturbate.com","adult");
        m.put("redtube.com","adult"); m.put("youporn.com","adult");
        m.put("spankbang.com","adult"); m.put("rule34.xxx","adult");
        m.put("livejasmin.com","adult"); m.put("bongacams.com","adult");
        m.put("stripchat.com","adult"); m.put("cam4.com","adult");
        // ── Gambling ──
        m.put("bet365.com","gambling"); m.put("pokerstars.com","gambling");
        m.put("betway.com","gambling"); m.put("draftkings.com","gambling");
        m.put("fanduel.com","gambling"); m.put("bovada.lv","gambling");
        m.put("dream11.com","gambling"); m.put("d11.dev","gambling");
        m.put("mpl.live","gambling"); m.put("rummycircle.com","gambling");
        m.put("1xbet.com","gambling"); m.put("1xbet.co.in","gambling");
        m.put("pokerstars.net","gambling"); m.put("casumo.com","gambling");
        m.put("williamhill.com","gambling"); m.put("betfair.com","gambling");
        // ── Adult Dating ──
        m.put("tinder.com","dating"); m.put("bumble.com","dating");
        m.put("grindr.com","dating"); m.put("hinge.co","dating");
        m.put("badoo.com","dating"); m.put("okcupid.com","dating");
        m.put("match.com","dating"); m.put("ashley-madison.com","dating");
        m.put("gotinder.com","dating"); m.put("plentyoffish.com","dating");
        // ── VPN & Proxy ──
        m.put("nordvpn.com","vpn_proxy"); m.put("nordvpn.net","vpn_proxy");
        m.put("nordvpndns.com","vpn_proxy");
        m.put("expressvpn.com","vpn_proxy"); m.put("expressvpn.net","vpn_proxy");
        m.put("protonvpn.com","vpn_proxy"); m.put("proton.ch","vpn_proxy");
        m.put("surfshark.com","vpn_proxy"); m.put("tunnelbear.com","vpn_proxy");
        m.put("windscribe.com","vpn_proxy"); m.put("psiphon.ca","vpn_proxy");
        m.put("psiphon3.com","vpn_proxy"); m.put("hidemyass.com","vpn_proxy");
        m.put("hide.me","vpn_proxy"); m.put("hotspotshield.com","vpn_proxy");
        m.put("anchorfree.com","vpn_proxy"); m.put("ultrasurf.us","vpn_proxy");
        m.put("ultrareach.com","vpn_proxy"); m.put("ipvanish.com","vpn_proxy");
        m.put("cyberghostvpn.com","vpn_proxy"); m.put("vyprvpn.com","vpn_proxy");
        m.put("privateinternetaccess.com","vpn_proxy");
        // ── Tor / Dark Web ──
        m.put("torproject.org","tor"); m.put("tor2web.org","tor");
        m.put("onion.to","tor"); m.put("darkfail.link","tor");
        // ── Crypto ──
        m.put("binance.com","crypto"); m.put("coinbase.com","crypto");
        m.put("kraken.com","crypto"); m.put("opensea.io","crypto");
        m.put("metamask.io","crypto"); m.put("coinmarketcap.com","crypto");
        m.put("wazirx.com","crypto"); m.put("coindcx.com","crypto");
        // ── Anonymous chat ──
        m.put("omegle.com","chat"); m.put("chatroulette.com","chat");
        m.put("monkey.cool","chat"); m.put("yik-yak.com","chat");
        // ── AI ──
        m.put("openai.com","ai"); m.put("chatgpt.com","ai");
        m.put("anthropic.com","ai"); m.put("claude.ai","ai");
        m.put("midjourney.com","ai"); m.put("perplexity.ai","ai");
        // ── News ──
        m.put("cnn.com","news"); m.put("bbc.com","news");
        m.put("nytimes.com","news"); m.put("reuters.com","news");
        m.put("ndtv.com","news"); m.put("indiatoday.in","news");
        m.put("thehindu.com","news"); m.put("hindustantimes.com","news");
        CATEGORY_MAP = java.util.Collections.unmodifiableMap(m);
    }

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

    /**
     * Synchronous enrich — uses in-memory maps only.
     * Use enrichWithCache() for Redis-backed lookup in the async DNS pipeline.
     */
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

        // In-memory category fallback (Redis check happens in enrichAsync)
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

    /**
     * Async enrich — checks Redis domain-category cache first (populated by CategoryCacheLoader),
     * then falls back to in-memory CATEGORY_MAP.
     * Use this in the reactive DNS resolution pipeline for full coverage.
     */
    public reactor.core.publisher.Mono<DomainInfo> enrichAsync(
            String domain,
            org.springframework.data.redis.core.ReactiveStringRedisTemplate redis) {

        if (domain == null || domain.isEmpty()) {
            return reactor.core.publisher.Mono.just(
                DomainInfo.builder().originalDomain(domain).rootDomain(domain).build());
        }

        String normalized = domain.toLowerCase();
        if (normalized.endsWith(".")) normalized = normalized.substring(0, normalized.length() - 1);
        String root = extractRootDomain(normalized);

        String appName = APP_MAP.get(root);
        if (appName == null) appName = APP_MAP.get(normalized);

        boolean isCdn = CDN_SUFFIXES.contains(root) || normalized.contains(".cdn.");
        boolean isTracking = TRACKING_DOMAINS.contains(root) || TRACKING_DOMAINS.contains(normalized);

        final String finalAppName = appName;
        final String finalRoot = root;

        // Check Redis cache (shield:domcat:{root}) first
        String cacheKey = CategoryCacheLoader.DOMCAT_PREFIX + root;
        return redis.opsForValue().get(cacheKey)
            .switchIfEmpty(
                // Fallback: check normalized full domain in Redis
                redis.opsForValue().get(CategoryCacheLoader.DOMCAT_PREFIX + normalized))
            .map(categoryFromRedis -> DomainInfo.builder()
                .originalDomain(domain)
                .rootDomain(finalRoot)
                .appName(finalAppName)
                .category(categoryFromRedis)
                .cdn(isCdn)
                .tracking(isTracking)
                .build())
            .switchIfEmpty(reactor.core.publisher.Mono.fromSupplier(() -> {
                // Final fallback: in-memory CATEGORY_MAP
                String cat = CATEGORY_MAP.get(finalRoot);
                if (cat == null) cat = CATEGORY_MAP.get(normalized);
                return DomainInfo.builder()
                    .originalDomain(domain)
                    .rootDomain(finalRoot)
                    .appName(finalAppName)
                    .category(cat)
                    .cdn(isCdn)
                    .tracking(isTracking)
                    .build();
            }));
    }
}
