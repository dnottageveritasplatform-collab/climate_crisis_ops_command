#!/usr/bin/env python3
"""Optional Phase 3+ sidecar — extract GloFAS discharge grid from NetCDF/GRIB for Nassau clip.

Requires: pip install xarray cfgrib netCDF4
Usage: python scripts/glofas-grid-from-nc.py path/to/glofas.nc data/geo/glofas-grid-export.json

Day 3 MVP uses data/geo/glofas-grid-nassau-demo.json directly; this script is the live GRIB path stub.
"""

import json
import sys

NASSAU_BBOX = (-77.36, -77.24, 25.03, 25.10)


def main():
    if len(sys.argv) < 3:
        print("Usage: glofas-grid-from-nc.py <input.nc|grib2> <output-grid.json>", file=sys.stderr)
        sys.exit(1)

    input_path, output_path = sys.argv[1], sys.argv[2]
    try:
        import xarray as xr  # noqa: F401
    except ImportError:
        print(
            "xarray not installed — use demo grid JSON or: pip install xarray cfgrib netCDF4",
            file=sys.stderr,
        )
        sys.exit(2)

    payload = {
        "scopeGuard": "GloFAS grid extracted from NetCDF/GRIB — model_estimated",
        "source": "glofas_grid_nc",
        "serviceName": "cems-glofas-forecast",
        "clipBbox": {
            "minLon": NASSAU_BBOX[0],
            "maxLon": NASSAU_BBOX[1],
            "minLat": NASSAU_BBOX[2],
            "maxLat": NASSAU_BBOX[3],
        },
        "gridResolutionDeg": 0.05,
        "dischargeThresholdM3s": 70,
        "cells": [],
        "notes": f"Extract from {input_path} — implement discharge variable slice in sovereign worker",
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote stub grid → {output_path} (implement xarray slice for production)")


if __name__ == "__main__":
    main()
