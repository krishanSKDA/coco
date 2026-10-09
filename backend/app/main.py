"""CocoFarm C04 inference API.

    GET  /api/v1/health                          model + database status
    POST /api/v1/analyze                         multipart image → lesion segmentation (best.pt)
    POST /api/v1/plots/{plot_id}/observations    store an assessment (idempotent by id)
    GET  /api/v1/plots/{plot_id}/observations    a plot's synchronised history
    GET  /api/v1/observations                    all synchronised observations

Forecast, attribution and the intervention window are still computed in the
app until the temporal model is trained; the server stores the full result.
"""
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from . import inference, storage

MAX_IMAGE_BYTES = 30 * 1024 * 1024

app = FastAPI(title="CocoFarm C04 API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "model": inference.MODEL_VERSION, "classes": inference.model.names}


@app.post("/api/v1/analyze")
async def analyze(image: UploadFile = File(...)):
    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(415, "Upload an image file")
    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image larger than 30 MB")
    try:
        return await run_in_threadpool(inference.analyze, data)
    except OSError:
        raise HTTPException(400, "Could not decode image")


@app.post("/api/v1/plots/{plot_id}/observations", status_code=201)
def create_observation(plot_id: str, observation: dict):
    if observation.get("plotId") != plot_id or not observation.get("id") or not observation.get("timestamp"):
        raise HTTPException(422, "Observation must carry id, timestamp and a plotId matching the URL")
    received_at = storage.upsert_observation(plot_id, observation)
    return {"id": observation["id"], "plotId": plot_id, "receivedAt": received_at}


@app.get("/api/v1/plots/{plot_id}/observations")
def plot_observations(plot_id: str):
    return storage.list_observations(plot_id)


@app.get("/api/v1/observations")
def all_observations():
    return storage.list_observations()
