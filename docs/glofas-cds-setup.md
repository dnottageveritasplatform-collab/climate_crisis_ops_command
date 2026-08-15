# GloFAS / Copernicus CDS Setup (Phase 3 Day 2)

Register for Copernicus Climate Data Store (CDS) / EWDS API access to pull GloFAS forecast metadata. CCOC Day 2 verifies credentials and caches the last successful fetch timestamp; **GRIB → Nassau polygon conversion ships Day 3**.

---

## 1. Register

1. Create account: [Copernicus Climate Data Store](https://cds.climate.copernicus.eu/)
2. Open **User profile → API key** and copy your personal access token
3. Never commit the key — use `.env` only

Dataset: [`cems-glofas-forecast`](https://ewds.climate.copernicus.eu/datasets/cems-glofas-forecast) (GloFAS 0.05° global river discharge ensemble)

---

## 2. Environment

```env
GLOFAS_ENABLED=true
GLOFAS_LIVE=true
GLOFAS_CDS_KEY=your-private-token-here
GLOFAS_CDS_URL=https://cds.climate.copernicus.eu/api
GLOFAS_CDS_DATASET=cems-glofas-forecast
GLOFAS_CDS_CACHE_PATH=data/geo/glofas-cds-cache.json
GLOFAS_FETCH_TIMEOUT_MS=20000
```

| Variable | Purpose |
|----------|---------|
| `GLOFAS_LIVE` | Attempt CDS probe on pipeline sync + `POST /api/geo/hazards/glofas/fetch` |
| `GLOFAS_CDS_MOCK` | `true` = simulate successful metadata fetch without network (local dev) |
| `GLOFAS_DEMO` | `true` (default) = GeoJSON layer fallback until Day 3 conversion |

---

## 3. Verify

```bash
npm run geo:glofas-cds
npm run geo:glofas-fetch
curl.exe http://127.0.0.1:8787/api/geo/hazards/glofas/status
curl.exe -X POST http://127.0.0.1:8787/api/geo/hazards/glofas/fetch
npm run pipeline:run
```

**Without key:** graceful `missing_cds_key` + demo fallback  
**With key:** CDS catalogue probe → cache `lastSuccessfulFetchAt` in `data/geo/glofas-cds-cache.json`  
**Day 3:** same cache extended with clipped GeoJSON features from GRIB/NetCDF

---

## Scope guard

- Day 2 metadata probe ≠ field-confirmed flood depth
- Agency GIS still wins on corridor overlap when `GLOFAS_ENABLED=true`
- HITL mandatory before outbound COMMS

---

## References

- [GloFAS forecast (EWDS)](https://ewds.climate.copernicus.eu/datasets/cems-glofas-forecast)
- [CDS API documentation](https://cds.climate.copernicus.eu/api-how-to)
