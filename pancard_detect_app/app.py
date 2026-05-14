from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import logging
import shutil
import cv2
import numpy as np
import os
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
UPLOAD_FOLDER = BASE_DIR / "uploads"
MODEL_PATH = BASE_DIR / "model" / "best.pt"

# Ensure uploads folder always exists
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="PAN Card Detector")

# CORS — allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static Files ─────────────────────────────────────────────────────────────
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_FOLDER)), name="uploads")

# ─── Templates ────────────────────────────────────────────────────────────────
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# ─── Load Model ───────────────────────────────────────────────────────────────
model = YOLO(str(MODEL_PATH))

# ─── Logging ───────────────────────────────────────────────────────────────
logger = logging.getLogger("pancard_detect_app")
logger.setLevel(logging.INFO)
handler = logging.FileHandler(UPLOAD_FOLDER / "debug.log")
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(handler)

# ─── Detection Settings ────────────────────────────────────────────────────────
# Minimum YOLO confidence to even consider a detection
# Raised to 0.30 to cut out very weak false positives (faces, random objects)
CONF_THRESHOLD = 0.30

# Expand the bounding box outward by this many pixels on each side
BOX_PADDING = 22

# ─── PAN Card Visual Validation ───────────────────────────────────────────────
# PAN card ISO dimensions: 85.6mm x 54mm  =>  aspect ratio ~1.586 (landscape)
# Calibrated with ±30% tolerance (covers ratio range 1.11 – 2.06)
#   - Real PAN card box ratio:  1.549  -> ok
#   - Identity card box ratio:  2.334  -> FAIL (outside range)
#   - Face photo:               eliminated at CONF_THRESHOLD first
PAN_ASPECT_RATIO = 1.586
PAN_ASPECT_TOL   = 0.30

# PAN cards contain dense printed text, QR/barcode, and logos.
# Calibration on actual YOLO bounding box crops:
#   - Real PAN card:   edge_density = 0.0502  -> pass
#   - Face photo:      edge_density = 0.0165  -> fail
#   - Identity card:   edge_density = 0.0030  -> fail
# Using 0.035 as threshold gives a safe margin between real card (0.05) and fakes.
EDGE_DENSITY_MIN = 0.035

# NOTE: White-background check was removed after calibration showed the real
# PAN card box only has white_ratio=0.014 (the photo/portrait inside brings it down).
# It was causing false rejections of valid PAN cards.


def _is_valid_pancard_region(img_bgr, box, h_img, w_img) -> tuple:
    """
    Two-stage pure-OpenCV validation (no external OCR needed):
      1. Aspect ratio: PAN card is ~1.586:1 landscape  (eliminates portraits, tall ID cards)
      2. Edge density: PAN card has dense text/QR/logo  (eliminates plain face photos)

    Returns (is_valid: bool, reason: str)
    """
    x1 = max(0, int(box[0]))
    y1 = max(0, int(box[1]))
    x2 = min(w_img, int(box[2]))
    y2 = min(h_img, int(box[3]))

    box_w = x2 - x1
    box_h = y2 - y1
    if box_w <= 0 or box_h <= 0:
        return False, "zero-size box"

    crop = img_bgr[y1:y2, x1:x2]

    # ── Stage 1: Aspect ratio ──────────────────────────────────────────────
    # PAN card is landscape (wider than tall). Portrait = definitely not PAN.
    ratio = box_w / box_h
    if ratio < 1.0:
        return False, f"portrait orientation (ratio={ratio:.2f})"
    ratio_diff = abs(ratio - PAN_ASPECT_RATIO) / PAN_ASPECT_RATIO
    if ratio_diff > PAN_ASPECT_TOL:
        return False, f"wrong aspect ratio {ratio:.2f} (expected {PAN_ASPECT_RATIO}±{int(PAN_ASPECT_TOL*100)}%)"

    # ── Stage 2: Edge density ──────────────────────────────────────────────
    # PAN cards contain dense printed content: text, QR/barcode, name/DOB fields.
    # Plain face photos or backgrounds have far fewer edges.
    gray  = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 180)
    edge_density = float(np.count_nonzero(edges)) / (box_w * box_h)
    if edge_density < EDGE_DENSITY_MIN:
        return False, f"low edge density {edge_density:.4f} (min {EDGE_DENSITY_MIN})"

    return True, f"passed (ratio={ratio:.3f}, edges={edge_density:.4f})"


def _draw_bbox(img, x1, y1, x2, y2, conf, h_img, w_img):
    """Draw a bold bounding box scaled proportionally to the image size."""
    # Scale factors based on image size (assume baseline width of ~1000px)
    scale = max(1.0, min(w_img, h_img) / 1000.0)
    
    thick_main = int(18 * scale)
    thick_inner = int(6 * scale)
    thick_shadow = int(10 * scale)
    
    # ── Outer shadow for depth ───────────────────────────────────────────
    cv2.rectangle(img, (x1 - thick_shadow//2, y1 - thick_shadow//2), 
                  (x2 + thick_shadow//2, y2 + thick_shadow//2), (0, 0, 0), thick_shadow)

    # ── Main bounding box — PURE RED ─────────────────────────────────────
    main_color = (0, 0, 255)        # Pure bright red (BGR)
    cv2.rectangle(img, (x1, y1), (x2, y2), main_color, thick_main)

    # ── Inner highlight ring — bright cyan ───────────────────────────────
    inner_color = (255, 255, 0)     # Pure cyan (BGR)
    off = thick_main // 2 + thick_inner // 2
    cv2.rectangle(img, (x1 + off, y1 + off), (x2 - off, y2 - off), inner_color, thick_inner)

    # ── Corner accent markers ────────────────────────────────────────────
    c_len = int(80 * scale)
    c_thk = int(thick_main * 1.2)
    c_col = (0, 255, 0)  # Pure bright green (BGR)
    corners = [
        ((x1, y1), (x1 + c_len, y1), (x1, y1 + c_len)),
        ((x2, y1), (x2 - c_len, y1), (x2, y1 + c_len)),
        ((x1, y2), (x1 + c_len, y2), (x1, y2 - c_len)),
        ((x2, y2), (x2 - c_len, y2), (x2, y2 - c_len)),
    ]
    for origin, end_h, end_v in corners:
        cv2.line(img, origin, end_h, c_col, c_thk, cv2.LINE_AA)
        cv2.line(img, origin, end_v, c_col, c_thk, cv2.LINE_AA)

    # ── Confidence pill label ────────────────────────────────────────────
    label = f"  PAN CARD  {conf * 100:.1f}%  "
    font = cv2.FONT_HERSHEY_SIMPLEX
    fscale = 1.0 * scale
    fthick = max(2, int(3 * scale))
    (tw, th), _ = cv2.getTextSize(label, font, fscale, fthick)
    pad = int(14 * scale)
    lx1 = x1
    ly1 = max(y1 - th - pad * 2 - int(8 * scale), 0)
    lx2 = x1 + tw + int(16 * scale)
    ly2 = ly1 + th + pad * 2

    # Pill background
    cv2.rectangle(img, (lx1, ly1), (lx2, ly2), (10, 10, 40), -1)
    # Pill border
    cv2.rectangle(img, (lx1, ly1), (lx2, ly2), main_color, max(2, thick_main // 3))
    # Text
    cv2.putText(img, label, (lx1 + int(8*scale), ly2 - pad),
                font, fscale, (255, 255, 255), fthick, cv2.LINE_AA)


def _draw_rejection_stamp(img, h_img, w_img):
    """Draw a large red 'NOT A PAN CARD' rejection stamp across the image."""
    # Semi-transparent red overlay
    overlay = img.copy()
    cv2.rectangle(overlay, (0, 0), (w_img, h_img), (0, 0, 80), -1)
    cv2.addWeighted(overlay, 0.3, img, 0.7, 0, img)

    # Large red X across the image
    x_color = (0, 0, 255)
    x_thick = max(8, min(w_img, h_img) // 50)
    cv2.line(img, (0, 0), (w_img, h_img), x_color, x_thick, cv2.LINE_AA)
    cv2.line(img, (w_img, 0), (0, h_img), x_color, x_thick, cv2.LINE_AA)

    # Main rejection text
    text1 = "NOT A PAN CARD"
    font = cv2.FONT_HERSHEY_SIMPLEX
    # Scale text to fit ~70% of image width
    fscale = w_img / 500.0
    fscale = max(1.5, min(fscale, 5.0))
    fthick = max(4, int(fscale * 3))
    (tw, th), _ = cv2.getTextSize(text1, font, fscale, fthick)

    # Center the text
    tx = (w_img - tw) // 2
    ty = (h_img + th) // 2

    # Black outline for readability
    cv2.putText(img, text1, (tx, ty), font, fscale, (0, 0, 0), fthick + 6, cv2.LINE_AA)
    # Red text
    cv2.putText(img, text1, (tx, ty), font, fscale, (0, 0, 255), fthick, cv2.LINE_AA)

    # Subtitle
    text2 = "Upload a valid PAN Card image"
    fscale2 = fscale * 0.45
    fthick2 = max(2, int(fscale2 * 2))
    (tw2, th2), _ = cv2.getTextSize(text2, font, fscale2, fthick2)
    tx2 = (w_img - tw2) // 2
    ty2 = ty + th + int(30 * fscale / 2)
    cv2.putText(img, text2, (tx2, ty2), font, fscale2, (0, 0, 0), fthick2 + 4, cv2.LINE_AA)
    cv2.putText(img, text2, (tx2, ty2), font, fscale2, (180, 180, 255), fthick2, cv2.LINE_AA)


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    try:
        # Save uploaded file
        safe_name = Path(file.filename).name
        file_location = UPLOAD_FOLDER / safe_name
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Run YOLO inference
        results = model(str(file_location), conf=CONF_THRESHOLD)
        result  = results[0]

        raw_boxes = result.boxes.xyxy.cpu().numpy()
        raw_confs = result.boxes.conf.cpu().numpy()

        img = cv2.imread(str(file_location))
        h_img, w_img = img.shape[:2]

        # ── Filter by confidence ─────────────────────────────────────────
        candidates = [(b, c) for b, c in zip(raw_boxes, raw_confs) if c >= CONF_THRESHOLD]

        # ── Multi-stage visual validation: aspect ratio + edges + white BG ─
        valid = []
        rejected_count = 0
        for box, conf in candidates:
            is_pan, reason = _is_valid_pancard_region(img, box, h_img, w_img)
            if is_pan:
                valid.append((box, conf))
                logger.info(f"Accepted PAN detection: conf={conf:.3f}, {reason}")
            else:
                rejected_count += 1
                logger.info(f"Rejected non-PAN detection: conf={conf:.3f}, reason={reason}")

        detected = len(valid) > 0

        # Build response message
        if detected:
            message = "PAN Card successfully detected!"
        elif rejected_count > 0:
            # YOLO found a card-like object but OCR confirmed it's NOT a PAN card
            message = "This is NOT a PAN Card. Please upload a valid PAN Card image."
            _draw_rejection_stamp(img, h_img, w_img)
        else:
            # No card-like object detected at all
            message = "No card detected in this image. Please upload a clear PAN Card photo."

        for box, conf in valid:
            x1 = max(0,     int(box[0]) - BOX_PADDING)
            y1 = max(0,     int(box[1]) - BOX_PADDING)
            x2 = min(w_img, int(box[2]) + BOX_PADDING)
            y2 = min(h_img, int(box[3]) + BOX_PADDING)
            _draw_bbox(img, x1, y1, x2, y2, conf, h_img, w_img)

        # Save result image
        result_name = f"result_{safe_name}"
        result_path = UPLOAD_FOLDER / result_name
        cv2.imwrite(str(result_path), img)

        top_conf = float(valid[0][1]) if detected else 0.0

        return JSONResponse({
            "detected":   detected,
            "image_url":  f"/uploads/{result_name}",
            "confidence": top_conf,
            "box_count":  len(valid),
            "threshold":  CONF_THRESHOLD,
            "message":    message
        })

    except Exception as e:
        # Log full exception for debugging
        logger.exception("Detection error")
        return JSONResponse({"error": str(e), "detected": False, "confidence": 0.0}, status_code=500)


@app.post("/debug_detect")
async def debug_detect(file: UploadFile = File(...)):
    """Debug endpoint: returns raw boxes and confidences from the model without drawing.
    Useful for inspecting what the model produced for a given image.
    """
    try:
        # Save uploaded file
        safe_name = Path(file.filename).name
        file_location = UPLOAD_FOLDER / safe_name
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        results = model(str(file_location), conf=CONF_THRESHOLD)
        result = results[0]

        raw_boxes = result.boxes.xyxy.cpu().numpy().tolist() if hasattr(result.boxes, 'xyxy') else []
        raw_confs = result.boxes.conf.cpu().numpy().tolist() if hasattr(result.boxes, 'conf') else []

        img = cv2.imread(str(file_location))
        h_img, w_img = img.shape[:2]

        # Pair boxes and confs (may be empty lists)
        paired = []
        for b, c in zip(raw_boxes, raw_confs):
            paired.append({
                "box": [int(b[0]), int(b[1]), int(b[2]), int(b[3])],
                "conf": float(c)
            })

        detected = len(paired) > 0
        top_conf = paired[0]['conf'] if detected else 0.0

        # Log summary
        logger.info(f"debug_detect: file={safe_name} detections={len(paired)} top_conf={top_conf}")

        return JSONResponse({
            "detected": detected,
            "detections": paired,
            "image_size": {"width": w_img, "height": h_img},
            "top_conf": top_conf,
            "threshold": CONF_THRESHOLD,
        })

    except Exception as e:
        logger.exception("Debug detect error")
        return JSONResponse({"error": str(e)}, status_code=500)


if __name__ == "__main__":
    # Allow `python app.py` to start a development server for debugging convenience.
    # Note: avoid reload=True here to keep behavior simple when started this way.
    import uvicorn
    logger.info("Starting app via python app.py")
    uvicorn.run("app:app", host="127.0.0.1", port=8000)