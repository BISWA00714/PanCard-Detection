# 🪪 PAN Card / ID Card Detection using YOLOv8m

A deep learning-based document detection system that automatically identifies and draws bounding boxes around identity cards (PAN cards, Aadhaar, passports, and more) in real-world photos.

Built with **YOLOv8m** and trained on a custom labeled dataset, the model is robust to:
- 🔄 Rotated and skewed cards
- 🌫️ Blurred or low-quality images
- 🟫 Partial occlusion
- 💡 Varying lighting conditions

## 🛠️ Tech Stack
- **Model**: YOLOv8m (Ultralytics)
- **Language**: Python
- **Training**: Google Colab (T4 GPU)
- **Annotation**: LabelImg / Roboflow
- **Libraries**: OpenCV, PyTorch, Ultralytics

## 🚀 Quick Start
```bash
pip install -r requirements.txt
python detect.py --image your_photo.jpg
```

## 📁 Dataset Structure
```
dataset/
├── train/images & labels
├── val/images & labels
└── test/images & labels
```

## 📊 Output
Input image → YOLOv8m inference → Output image with yellow bounding box around detected ID card.