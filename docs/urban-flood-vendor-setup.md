# Commercial Urban Flood Vendor Setup (Phase 3b Day 2)

Register for [JBA Flood Foresight](https://jbagr.com/digital-tools/flood-foresight/) (primary pilot vendor) or [Fathom Global](https://www.fathom.global/) (alternate) to pull fine-resolution urban pluvial guidance for downtown Nassau. CCOC Day 2 verifies credentials and caches the last successful fetch timestamp; **vendor export → polygon conversion ships Day 3**.

---

## 1. Vendor shortlist

| Vendor | Product | Pilot fit |
|--------|---------|-----------|
| **[JBA Flood Foresight](https://jbagr.com/digital-tools/flood-foresight/)** *(pilot primary)* | Flood forecasting API | Event-driven urban flood polygons · anticipatory action / EOC briefing |
| [Fathom Global](https://www.fathom.global/) *(alternate)* | Global Flood Map + API | Street pluvial depth bands, Caribbean bbox licensing |

Design-partner scope: API key + license for New Providence urban core clip only. Demo clip (`urban-flood-nassau-demo.json`) proves merge path without contract.

---

## 2. Register

### JBA (pilot primary)

1. Request Flood Foresight evaluation credentials via [JBA Global Resilience](https://jbagr.com/) — product page: [Flood Foresight](https://jbagr.com/digital-tools/flood-foresight/)
   - Scroll to **“Contact our team today to get started with Flood Foresight”** and submit the form (Name · Email · Location · Comments), or use the general [contact page](https://jbagr.com/contact/)
   - Mention: Future Caribbean pilot · New Providence urban bbox · evaluation / API access for CCOC integration
2. When JBA responds, copy API key — use `.env` only — and set `URBAN_FLOOD_API_URL` to the REST base URL they provide at onboarding
3. No public default API base URL — design-partner scope only

### Fathom (alternate)

1. Request pilot / evaluation API access via [Fathom Global](https://www.fathom.global/) — requires a **commercial email address**
2. Copy API key from the vendor portal — never commit
3. Default probe URL: `https://api.fathom.global/v1` (set `URBAN_FLOOD_VENDOR=fathom`)

---

## 3. Environment

**JBA pilot (recommended while awaiting credentials):**

```env
URBAN_FLOOD_ENABLED=true
URBAN_FLOOD_VENDOR=jba
URBAN_FLOOD_DEMO=true              # demo clip until JBA export or Day 3 conversion
URBAN_FLOOD_LIVE=false             # flip true after JBA sends API URL + key
# URBAN_FLOOD_API_KEY=             # from JBA onboarding — never commit
# URBAN_FLOOD_API_URL=             # REST base URL supplied by JBA (required for jba live probe)
URBAN_FLOOD_CACHE_PATH=data/geo/urban-flood-cache.json
URBAN_FLOOD_FETCH_TIMEOUT_MS=20000
URBAN_FLOOD_STALE_HOURS=24
URBAN_FLOOD_ESCALATION_MIN_LEVEL=2   # Phase 3b Day 7 — L2+ pipeline refresh; L1 cache-only
```

See **`docs/urban-flood-sovereign-cron.md`** for cache-only below L2 policy and sovereign cron/timer examples.

**After JBA onboarding:**

```env
URBAN_FLOOD_LIVE=true
URBAN_FLOOD_API_KEY=your-jba-key-here
URBAN_FLOOD_API_URL=https://…      # endpoint from JBA — not a public default
```

**Fathom alternate** (when commercial email + contract available):

```env
URBAN_FLOOD_VENDOR=fathom
URBAN_FLOOD_LIVE=true
URBAN_FLOOD_API_KEY=your-fathom-key-here
URBAN_FLOOD_API_URL=https://api.fathom.global/v1
```

| Variable | Purpose |
|----------|---------|
| `URBAN_FLOOD_LIVE` | Attempt vendor probe on pipeline sync + `POST /api/geo/hazards/urban-flood/fetch` |
| `URBAN_FLOOD_API_MOCK` | `true` = simulate successful metadata fetch without network (local dev) |
| `URBAN_FLOOD_DEMO` | `true` (default) = GeoJSON layer fallback until Day 3 conversion |
| `URBAN_FLOOD_VENDOR` | `jba` · `fathom` · `demo` (default `demo` in code when unset) |

---

## 4. Verify

```bash
npm run geo:urban-flood-vendor
npm run geo:urban-flood-fetch
curl.exe http://127.0.0.1:8787/api/geo/hazards/urban-flood/status
curl.exe -X POST http://127.0.0.1:8787/api/geo/hazards/urban-flood/fetch
npm run pipeline:run
```

**JBA — awaiting credentials:** `URBAN_FLOOD_VENDOR=jba` + `URBAN_FLOOD_DEMO=true` → demo clip loads · status shows `vendor: jba`  
**Without key (live probe):** graceful `missing_api_key` + demo fallback  
**With key + URL:** vendor catalogue probe → cache `lastSuccessfulFetchAt` in `data/geo/urban-flood-cache.json`  
**Day 3:** same cache extended with clipped GeoJSON polygons from vendor grid — run `npm run geo:urban-flood-convert`

```bash
npm run geo:urban-flood-convert
```

---

## Scope guard

- Day 2 metadata probe ≠ field-confirmed flood depth
- Agency GIS still wins on corridor overlap when both layers present
- Commercial urban is `commercial_model` confidence — not NEMA authority
- HITL mandatory before outbound COMMS
- Vendor licensing + API cost are design-partner decisions

---

## References

- [Phase 3b roadmap](./phase3b-roadmap.md)
- [GloFAS CDS setup](./glofas-cds-setup.md) — parallel pattern for network layer
- **JBA (pilot):** [JBA Global Resilience](https://jbagr.com/) · [Flood Foresight](https://jbagr.com/digital-tools/flood-foresight/) · [Contact](https://jbagr.com/contact/)
- **Fathom (alternate):** [Fathom Global](https://www.fathom.global/)
