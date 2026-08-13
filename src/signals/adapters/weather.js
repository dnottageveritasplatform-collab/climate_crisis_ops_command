/**
 * Live NHC RSS adapter with https fallback, retries, and stale-while-revalidate cache.
 */

import https from "https";

const DEFAULT_TIMEOUT_MS = 45000;
const MAX_ATTEMPTS = 3;
const DEFAULT_STALE_MS = 6 * 60 * 60 * 1000;

/** @type {null | { payload: object, cachedAt: string }} */
let lastGoodFetch = null;

function cleanRssText(value) {
  return value
    ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRss(text) {
  const channelBlock = text.match(/<channel>([\s\S]*?)<\/channel>/i)?.[1] || "";
  const channelTitle = channelBlock.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  const channelPubDate = channelBlock.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1]?.trim();
  const itemBlock = text.match(/<item>([\s\S]*?)<\/item>/i)?.[1];
  const fullText = cleanRssText(text.replace(/<[^>]+>/g, " "));

  if (!itemBlock) {
    return {
      headline: cleanRssText(channelTitle) || "Atlantic Tropical Weather Outlook",
      summary: fullText,
      issuedAt: channelPubDate ? new Date(channelPubDate).toISOString() : new Date().toISOString(),
    };
  }

  const itemTitle = itemBlock.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const description = itemBlock.match(/<description>([\s\S]*?)<\/description>/i)?.[1];
  const pubDate = itemBlock.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1]?.trim();

  return {
    headline: cleanRssText(itemTitle) || cleanRssText(channelTitle) || "Live weather feed",
    summary: cleanRssText(description) || fullText,
    issuedAt: pubDate
      ? new Date(pubDate).toISOString()
      : channelPubDate
        ? new Date(channelPubDate).toISOString()
        : new Date().toISOString(),
  };
}

function httpsGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "ClimateCrisisOpsCommand/1.0 (+https://github.com/dnottageveritasplatform-collab/climate_crisis_ops_command)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("https request timeout"));
    });
    req.on("error", reject);
  });
}

async function fetchNhcUrl(url, timeoutMs) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "ClimateCrisisOpsCommand/1.0 (+https://github.com/dnottageveritasplatform-collab/climate_crisis_ops_command)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      });
      if (!res.ok) throw new Error(`fetch HTTP ${res.status}`);
      const text = await res.text();
      if (!text?.trim()) throw new Error("fetch empty body");
      return text;
    } finally {
      clearTimeout(timer);
    }
  } catch (fetchErr) {
    const text = await httpsGet(url, timeoutMs);
    if (!text?.trim()) throw fetchErr;
    return text;
  }
}

function buildPayload(url, parsed, text, attempt) {
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
    fetchAttempts: attempt,
    fetchedAt: new Date().toISOString(),
  };
}

export function getStaleLiveWeather() {
  if (!lastGoodFetch) return null;
  const staleMs = Number(process.env.NHC_STALE_MS) || DEFAULT_STALE_MS;
  const age = Date.now() - new Date(lastGoodFetch.cachedAt).getTime();
  if (age > staleMs) return null;
  return {
    ...lastGoodFetch.payload,
    stale: true,
    staleAgeMs: age,
  };
}

export async function fetchLiveWeather() {
  const url = process.env.NHC_FEED_URL?.trim();
  if (!url) return null;

  const timeoutMs = Number(process.env.NHC_FETCH_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const text = await fetchNhcUrl(url, timeoutMs);
      const parsed = parseRss(text);
      const payload = buildPayload(url, parsed, text, attempt);
      lastGoodFetch = { payload, cachedAt: new Date().toISOString() };
      return payload;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }
  }

  const stale = getStaleLiveWeather();
  if (stale) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[nhc] live fetch failed — serving stale cache:", lastError?.message || lastError);
    }
    return stale;
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[nhc] live feed fetch failed after retries:", lastError?.message || lastError);
  }
  return null;
}

/** Warm NHC cache on server boot so the UI is not blocked on first request. */
export async function prefetchLiveWeather() {
  const url = process.env.NHC_FEED_URL?.trim();
  if (!url || process.env.NHC_LIVE === "false") {
    return { ok: false, skipped: true, reason: "NHC not enabled" };
  }
  const result = await fetchLiveWeather();
  return {
    ok: Boolean(result),
    stale: Boolean(result?.stale),
    event: result?.event || null,
    issuedAt: result?.issuedAt || null,
  };
}
