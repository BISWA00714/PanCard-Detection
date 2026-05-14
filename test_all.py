import requests

BASE = 'http://127.0.0.1:8000/detect'
tests = [
    ('pancard_detect_app/uploads/Biswa_PAN_CARD.jpg', 'Real PAN Card'),
    ('pancard_detect_app/uploads/BISWA_IMAGE.png', 'Face Photo'),
    ('pancard_detect_app/uploads/NARESH_IT_IDENTITY_CARD.jpg', 'Identity Card'),
]

print()
print(f"{'Image':<22} {'detected':>10} {'conf':>8}  message")
print('-' * 80)
for path, label in tests:
    try:
        with open(path, 'rb') as f:
            d = requests.post(BASE, files={'file': f}).json()
        detected = d.get('detected', '?')
        conf = d.get('confidence', 0) * 100
        msg = d.get('message', '')
        print(f"{label:<22} {str(detected):>10} {conf:>7.1f}%  {msg}")
    except FileNotFoundError:
        print(f"{label:<22}  FILE NOT FOUND")
    except Exception as e:
        print(f"{label:<22}  ERROR: {e}")
