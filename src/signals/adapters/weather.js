/**
 * Optional live weather adapter. Falls back silently when NHC_FEED_URL is unset or fetch fails.
 */
function parseRss(text) {
  const channelTitle = text.match(/<channel>[\s\S]*?<title>([^<]+)<\/title>/i)?.[1]?.trim();
  const itemBlock = text.match(/<item>([\s\S]*?)<\/item>/i)?.[1];
  if (!itemBlock) {
    return {
      headline: channelTitle || "Live weather feed",
      summary: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
      issuedAt: new Date().toISOString(),
    };
  }

  const itemTitle = itemBlock.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const description = itemBlock.match(/<description>([\s\S]*?)<\/description>/i)?.[1];
  const pubDate = itemBlock.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1]?.trim();
  const clean = (value) =>
    value
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return {
    headline: clean(itemTitle) || channelTitle || "Live weather feed",
    summary: clean(description) || clean(channelTitle) || "NHC feed update",
    issuedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
  };
}

export async function fetchLiveWeather() {
  const url = process.env.NHC_FEED_URL;
  if (!url) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const text = await res.text();
    const parsed = parseRss(text);

    return {
      id: "weather-live",
      category: "weather",
      level: null,
      label: "Live feed",
      event: parsed.headline,
      source: "nhc_feed",
      feedUrl: url,
      summary: parsed.summary,
      issuedAt: parsed.issuedAt,
      rawLength: text.length,
    };
  } catch {
    return null;
  }
}
