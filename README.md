# CocoFarm AI – Component 04 Frontend Prototype

Explainable multimodal coconut disease progression forecasting and intervention timing
(CDAP_IT_09_2026 · IT23421226).

React 19 + Vite 8 + TypeScript prototype of the grower mobile app and extension-officer
web dashboard described in the project proposal.

## Run

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

### Backend (inference API + sync)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate                     # macOS/Linux: source .venv/bin/activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload  # docs at http://localhost:8000/docs
```

It loads `model/best.pt` (override with `MODEL_PATH`) and stores synchronised
observations in `backend/data/cocofarm.db`. The Vite dev server proxies `/api` to
port 8000; set `VITE_API_URL` for a deployed server. The app still works without the
backend: lesion segmentation falls back to the on-device ONNX model and observations
stay queued until the server is reachable.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health` | Model and server status |
| `POST /api/v1/analyze` | Multipart image → lesion mask, lesion ÷ leaf area (best.pt) |
| `POST /api/v1/plots/{id}/observations` | Store an assessment (idempotent by id) |
| `GET /api/v1/plots/{id}/observations` | A plot's synchronised history |

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
| New assessment | FR-02 capture/upload, FR-03 on-device quality gate, offline queue (FR-16) |
| Assessment result | FR-04/05 class + ordinal severity, FR-08 3/7/14-day forecast, FR-09 risk, FR-10 calibrated intervals, FR-11 intervention window, FR-12 Grad-CAM overlay, FR-13 plain-language attributions, FR-14 KB guidance, FR-19 API response |
| Alerts | FR-17 escalation alerts |
| Knowledge base | Expert-reviewed guidance, severity rubric (Table 3) |
| Model & evaluation | Tables 5–7, corpus construction, model registry |
| Settings | Sinhala / English (NFR-11), action & confidence thresholds, live weather toggle |

## Prototype inference (what is real vs simulated)

- **Real:** image quality gate (Laplacian sharpness, exposure, foliage ratio); weather
  retrieval from **NASA POWER** (observed) and **Open-Meteo** (forecast) with Table 4 window
  features; Table 7 intervention logic with conservative fallback.
- **Trained lesion model:** YOLOv8n-seg (`model/colab_lesion_segmentation.ipynb`) gives
  lesion ÷ leaf area → severity and class, on the server (`best.pt`) or on-device
  (`frontend/public/models/*.onnx`). Its v3 labels outline leaflets rather than spots, so treat
  its severities as a pipeline test.
- **Stand-ins for the trained model:** colour-segmentation severity/class estimator
  (fallback only, `frontend/src/lib/imageAnalysis.ts`); weather-modulated logistic
  progression model – the same family the proposal uses to generate corpus trajectories
  (`frontend/src/lib/forecast.ts`); occlusion-based Shapley-style attribution
  (`frontend/src/lib/explain.ts`).

All three sit behind `frontend/src/services/assessmentService.ts`, which mirrors the
`POST /api/v1/plots/{id}/observations` contract, so they can be swapped for the real
inference API without touching the UI.

## Structure

```
backend/       FastAPI inference API + sync (loads model/best.pt)
model/         training notebook and trained weights
frontend/      React + Vite app
  public/models/  on-device ONNX model
  src/
    components/  ui/ layout/ charts/ domain/
    data/        knowledge base entries
    hooks/       useOnlineStatus
    i18n/        en / si dictionaries
    lib/         forecast, intervention, explain, weather, imageAnalysis, lesionModel, pipeline
    pages/       one file per route
    services/    apiClient, assessmentService, weatherService
    store/       Zustand app store
    types/       domain model (Appendix A data dictionary)
```

The app starts empty: register a plot, then assess it. Data on a device can be removed from
**Settings → Clear local data**; observations already synchronised stay on the server.
