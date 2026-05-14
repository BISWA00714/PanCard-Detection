"""
Calibration script: runs YOLO on all test images and checks the three
visual-validation metrics on the ACTUAL detected bounding box crop.
This tells us exactly what thresholds to use in app.py.
"""
import cv2, numpy as np
from ultralytics import YOLO
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "pancard_detect_app"))

BASE = r"pancard_detect_app"
MODEL = YOLO(f"{BASE}/model/best.pt")

TEST_IMAGES = [
    (f"{BASE}/uploads/Biswa_PAN_CARD.jpg",           "✅ Real PAN Card"),
    (f"{BASE}/uploads/BISWA_IMAGE.png",               "❌ Face Photo"),
    (f"{BASE}/uploads/NARESH_IT_IDENTITY_CARD.jpg",   "❌ Identity Card"),
]

PAN_ASPECT_RATIO = 1.586
PAN_ASPECT_TOL   = 0.30

print("="*70)
print(f"{'Image':<30}{'conf':>7}{'ratio':>8}{'edge':>8}{'white':>8}  verdict")
print("="*70)

for path, label in TEST_IMAGES:
    img = cv2.imread(path)
    if img is None:
        print(f"{label:<30} FILE NOT FOUND")
        continue
    h, w = img.shape[:2]

    results = MODEL(path, conf=0.15)
    r = results[0]

    if len(r.boxes) == 0:
        print(f"{label:<30}  --no YOLO box--")
        continue

    for box, conf in zip(r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy()):
        x1, y1, x2, y2 = [int(v) for v in box]
        bw = x2 - x1
        bh = y2 - y1
        if bw <= 0 or bh <= 0:
            continue

        crop = img[y1:y2, x1:x2]
        ratio = bw / bh

        gray  = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 80, 180)
        edge_dens = float(np.count_nonzero(edges)) / (bw * bh)

        hsv  = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        wm   = cv2.inRange(hsv, (0, 0, 200), (180, 50, 255))
        white_r = float(np.count_nonzero(wm)) / (bw * bh)

        ratio_ok = (ratio >= 1.0) and (abs(ratio - PAN_ASPECT_RATIO) / PAN_ASPECT_RATIO <= PAN_ASPECT_TOL)

        print(f"{label:<30} {conf:>6.3f} {ratio:>7.3f} {edge_dens:>7.4f} {white_r:>7.3f}  "
              f"  ar={'ok' if ratio_ok else 'FAIL'}")

print("="*70)
print("\nTarget thresholds to choose:")
print("  CONF_THRESHOLD    = 0.30  (face=0.219 drops out)")
print("  PAN_ASPECT_TOL    = 0.30  (ratio range 1.11 – 2.06)")
print("  EDGE_DENSITY_MIN  = see above edge column for PAN card")
print("  WHITE_BG_MIN_RATIO= see above white column for PAN card")
