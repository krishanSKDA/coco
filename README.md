# CocoFarm AI – Component 04 Frontend Prototype

Explainable multimodal coconut disease progression forecasting and intervention timing
(CDAP_IT_09_2026 · IT23421226).

React 19 + Vite 8 + TypeScript prototype of the grower mobile app and extension-officer
web dashboard described in the project proposal.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

## Stack

| Concern | Choice |
|---|---|
| Build | Vite 8, TypeScript (strict) |
| UI | React 19, Tailwind CSS v4, lucide-react icons |
| Routing | React Router (data router, route-level code splitting) |
| State | Zustand + `persist` (localStorage, offline-first) |
| Charts | Recharts |

## Features → proposal requirements

| Screen | Covers |
|---|---|
| Dashboard | Officer dashboard: plot aggregation by urgency, category distribution, alerts, weather pressure |
| Plots / Register plot | FR-01 persistent plot IDs, optional crop context, GPS |
| Plot detail | FR-15 trajectory + export (CSV/JSON), FR-06 treatment log, weather tab |
| New assessment | FR-02 capture/upload, FR-03 on-device quality gate, demo frond generator, offline queue (FR-16) |
| Assessment result | FR-04/05 class + ordinal severity, FR-08 3/7/14-day forecast, FR-09 risk, FR-10 calibrated intervals, FR-11 intervention window, FR-12 Grad-CAM overlay, FR-13 plain-language attributions, FR-14 KB guidance, FR-19 API response |
| Alerts | FR-17 escalation alerts |
| Knowledge base | Expert-reviewed guidance, severity rubric (Table 3) |
| Model & evaluation | Tables 5–7, corpus construction, model registry |
| Settings | Sinhala / English (NFR-11), action & confidence thresholds, live weather toggle |

## Prototype inference (what is real vs simulated)

- **Real:** image quality gate (Laplacian sharpness, exposure, foliage ratio); weather
  retrieval from **NASA POWER** (observed) and **Open-Meteo** (forecast) with Table 4 window
  features; Table 7 intervention logic with conservative fallback.
- **Stand-ins for the trained model:** colour-segmentation severity/class estimator and
  Grad-CAM-style lesion map (`src/lib/imageAnalysis.ts`); weather-modulated logistic
  progression model – the same family the proposal uses to generate corpus trajectories
  (`src/lib/forecast.ts`); occlusion-based Shapley-style attribution (`src/lib/explain.ts`).

All three sit behind `src/services/assessmentService.ts`, which mirrors the
`POST /api/v1/plots/{id}/observations` contract, so they can be swapped for the real
inference API without touching the UI.

## Structure

```
src/
  components/  ui/ layout/ charts/ domain/
  data/        knowledge base entries
  hooks/       useOnlineStatus
  i18n/        en / si dictionaries
  lib/         forecast, intervention, explain, weather, imageAnalysis, pipeline, seed
  pages/       one file per route
  services/    assessmentService, weatherService
  store/       Zustand app store
  types/       domain model (Appendix A data dictionary)
```

Demo data (6 plots across the wet, intermediate and dry zones) is seeded deterministically;
reset it from **Settings → Reset demo data**.
