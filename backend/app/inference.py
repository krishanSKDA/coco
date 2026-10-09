"""Lesion segmentation with the trained YOLOv8n-seg weights (model/best.pt).

Matches the notebook and the in-browser ONNX path: the photo is stretched to
640×640 (Roboflow "Resize: Stretch"), lesion masks are predicted at that size,
and severity input = lesion area ÷ leaf area, where leaf area is green–yellow
tissue (OpenCV HSV) plus the lesions themselves.
"""
import base64
import io
import os
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

SIZE = 640
CONF = 0.25
MODEL_PATH = Path(os.getenv("MODEL_PATH", Path(__file__).resolve().parents[2] / "model" / "best.pt"))
MODEL_VERSION = os.getenv("MODEL_VERSION", "yolov8n-seg-lesion-v3")

model = YOLO(str(MODEL_PATH), task="segment")
LESION = next(i for i, n in model.names.items() if n == "lesion")
HEALTHY = next((i for i, n in model.names.items() if n == "healthy"), None)


def _leaf_mask(bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    return cv2.inRange(hsv, (20, 60, 40), (90, 255, 255)) > 0


def analyze(image_bytes: bytes) -> dict:
    rgb = np.asarray(Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((SIZE, SIZE), Image.BILINEAR))
    bgr = np.ascontiguousarray(rgb[..., ::-1])

    t = time.perf_counter()
    r = model.predict(bgr, imgsz=SIZE, conf=CONF, retina_masks=True, verbose=False)[0]
    inference_ms = (time.perf_counter() - t) * 1000

    lesion = np.zeros((SIZE, SIZE), bool)
    lesion_count, lesion_conf, healthy_conf = 0, 0.0, 0.0
    if r.boxes is not None and len(r.boxes):
        classes = r.boxes.cls.cpu().numpy().astype(int)
        confs = r.boxes.conf.cpu().numpy()
        masks = r.masks.data.cpu().numpy() if r.masks is not None else []
        for i, (c, p) in enumerate(zip(classes, confs)):
            if c == LESION:
                lesion_count += 1
                lesion_conf = max(lesion_conf, float(p))
                m = masks[i]
                if m.shape != (SIZE, SIZE):
                    m = cv2.resize(m, (SIZE, SIZE), interpolation=cv2.INTER_NEAREST)
                lesion |= m > 0.5
            elif c == HEALTHY:
                healthy_conf = max(healthy_conf, float(p))

    leaf = _leaf_mask(bgr) | lesion
    buf = io.BytesIO()
    Image.fromarray(lesion.astype(np.uint8) * 255).save(buf, format="PNG", optimize=True)

    return {
        "model": MODEL_VERSION,
        "engine": "server",
        "input_size": SIZE,
        "lesion_fraction": float(lesion.sum() / max(leaf.sum(), 1)),
        "lesion_count": lesion_count,
        "lesion_conf": lesion_conf,
        "healthy_conf": healthy_conf,
        "lesion_mask_png": base64.b64encode(buf.getvalue()).decode(),
        "inference_ms": round(inference_ms, 1),
    }
