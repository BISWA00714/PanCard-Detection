import cv2, numpy as np

PAN_ASPECT_RATIO = 1.586
PAN_ASPECT_TOL = 0.25
EDGE_DENSITY_MIN = 0.04
WHITE_BG_MIN_RATIO = 0.25

def check(path, label):
    img = cv2.imread(path)
    if img is None:
        print(f"[SKIP] {label} - file not found")
        return
    h, w = img.shape[:2]
    bw, bh = w, h
    ratio = bw / bh
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 180)
    edge_density = float(np.count_nonzero(edges)) / (bw * bh)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    white_mask = cv2.inRange(hsv, (0, 0, 200), (180, 50, 255))
    white_ratio = float(np.count_nonzero(white_mask)) / (bw * bh)
    ratio_diff = abs(ratio - PAN_ASPECT_RATIO) / PAN_ASPECT_RATIO

    s1 = ratio >= 1.0 and ratio_diff <= PAN_ASPECT_TOL
    s2 = edge_density >= EDGE_DENSITY_MIN
    s3 = white_ratio >= WHITE_BG_MIN_RATIO

    print(f"\n==== {label} ====")
    print(f"  Aspect ratio  : {ratio:.3f}  diff={ratio_diff:.3f}  -> {'PASS' if s1 else 'FAIL'}")
    print(f"  Edge density  : {edge_density:.4f}            -> {'PASS' if s2 else 'FAIL'}")
    print(f"  White BG ratio: {white_ratio:.3f}             -> {'PASS' if s3 else 'FAIL'}")
    print(f"  OVERALL       : {'ACCEPTED as PAN card' if (s1 and s2 and s3) else 'REJECTED (not PAN card)'}")

check("pancard_detect_app/uploads/Biswa_PAN_CARD.jpg", "Real PAN Card")
check("pancard_detect_app/uploads/BISWA_IMAGE.png",    "Face Photo")
check("pancard_detect_app/uploads/NARESH_IT_IDENTITY_CARD.jpg", "Identity Card")
