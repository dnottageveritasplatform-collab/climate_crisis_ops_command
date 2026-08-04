import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const feedPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/signals/demo-feed.json"
);

export function loadDemoFeed() {
  const raw = fs.readFileSync(feedPath, "utf8");
  return JSON.parse(raw);
}

export async function fetchDemoSignals() {
  const feed = loadDemoFeed();
  const weather = {
    ...feed.weather,
    category: "weather",
    id: "weather-demo",
  };
  const institutional = feed.institutional.map((item) => ({
    ...item,
    category: "institutional",
  }));

  return {
    mode: "demo",
    scenario: feed.scenario,
    serviceArea: feed.serviceArea,
    weather,
    institutional,
    signals: [weather, ...institutional],
  };
}
