# backend/utils/detector.py
import os
from ultralytics import YOLO
import cv2
import numpy as np

# Model path
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'models', 'best.pt')

def load_model():
	"""Load YOLOv8 model at startup"""
	try:
		if not os.path.exists(MODEL_PATH):
			print(f"Warning: Model not found at {MODEL_PATH}")
			print("Using default YOLOv8n model as fallback")
			model = YOLO('yolov8n.pt')  # Fallback to pretrained model
		else:
			model = YOLO(MODEL_PATH)
			print(f"Model loaded successfully from {MODEL_PATH}")
		return model
	except Exception as e:
		print(f"Error loading model: {e}")
		print("Falling back to YOLOv8n pretrained model")
		return YOLO('yolov8n.pt')


def detect_objects(file_path, model=None):
	"""
	Run YOLO detection on image or video
	
	Args:
		file_path: Path to image or video file
		model: Loaded YOLO model
	
	Returns:
		List of detections with label, confidence, and bounding box
	"""
	if model is None:
		model = load_model()
	
	detections = []
	
	try:
		# Check if file is video
		video_extensions = ['.mp4', '.avi', '.mov', '.mkv']
		is_video = any(file_path.lower().endswith(ext) for ext in video_extensions)
		
		if is_video:
			# Process video
			detections = process_video(file_path, model)
		else:
			# Process image
			detections = process_image(file_path, model)
		
		return detections
	
	except Exception as e:
		print(f"Detection error: {e}")
		return []


def process_image(image_path, model):
	"""Process a single image"""
	detections = []
	
	try:
		# Run inference
		results = model(image_path, conf=0.25, iou=0.45)
		
		# Extract detections
		for result in results:
			boxes = result.boxes
			
			if boxes is not None:
				for box in boxes:
					# Get class name
					class_id = int(box.cls[0])
					label = model.names[class_id]
					
					# Get confidence
					confidence = float(box.conf[0])
					
					# Get bounding box coordinates
					bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
					
					detections.append({
						'label': label.lower(),
						'confidence': confidence,
						'bbox': bbox,
						'class_id': class_id
					})
		
		print(f"Detected {len(detections)} objects in image")
		return detections
	
	except Exception as e:
		print(f"Image processing error: {e}")
		return []


def process_video(video_path, model, max_frames=30):
	"""
	Process video and aggregate detections
	
	Args:
		video_path: Path to video file
		model: YOLO model
		max_frames: Maximum number of frames to process (for performance)
	
	Returns:
		Aggregated detections with highest confidence per class
	"""
	detections_dict = {}
	
	try:
		cap = cv2.VideoCapture(video_path)
		
		if not cap.isOpened():
			print(f"Error: Could not open video {video_path}")
			return []
		
		total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
		fps = cap.get(cv2.CAP_PROP_FPS)
		
		# Sample frames evenly throughout video
		if total_frames > max_frames:
			frame_indices = np.linspace(0, total_frames - 1, max_frames, dtype=int)
		else:
			frame_indices = range(total_frames)
		
		frame_count = 0
		
		for frame_idx in frame_indices:
			# Set frame position
			cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
			ret, frame = cap.read()
			
			if not ret:
				break
			
			# Run inference on frame
			results = model(frame, conf=0.25, iou=0.45, verbose=False)
			
			# Extract detections
			for result in results:
				boxes = result.boxes
				
				if boxes is not None:
					for box in boxes:
						class_id = int(box.cls[0])
						label = model.names[class_id].lower()
						confidence = float(box.conf[0])
						bbox = box.xyxy[0].tolist()
						
						# Keep highest confidence detection per class
						if label not in detections_dict or confidence > detections_dict[label]['confidence']:
							detections_dict[label] = {
								'label': label,
								'confidence': confidence,
								'bbox': bbox,
								'class_id': class_id,
								'frame': frame_count
							}
			
			frame_count += 1
		
		cap.release()
		
		# Convert dict to list
		detections = list(detections_dict.values())
		print(f"Detected {len(detections)} unique objects in video")
		return detections
	
	except Exception as e:
		print(f"Video processing error: {e}")
		return []


def draw_detections(image_path, detections, output_path=None):
	"""
	Draw bounding boxes on image
	
	Args:
		image_path: Path to input image
		detections: List of detections
		output_path: Path to save annotated image (optional)
	
	Returns:
		Annotated image as numpy array
	"""
	try:
		# Read image
		img = cv2.imread(image_path)
		
		if img is None:
			print(f"Error: Could not read image {image_path}")
			return None
		
		# Draw each detection
		for det in detections:
			bbox = det['bbox']
			label = det['label']
			confidence = det['confidence']
			
			# Convert bbox to integers
			x1, y1, x2, y2 = map(int, bbox)
			
			# Choose color based on label
			color = (0, 255, 0)  # Default green
			if label in ['leopard', 'tiger', 'lion', 'cheetah']:
				color = (0, 0, 255)  # Red for wild animals
			
			# Draw rectangle
			cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
			
			# Draw label
			label_text = f"{label}: {confidence:.2f}"
			font = cv2.FONT_HERSHEY_SIMPLEX
			font_scale = 0.6
			thickness = 2
			
			# Get text size for background
			(text_width, text_height), _ = cv2.getTextSize(label_text, font, font_scale, thickness)
			
			# Draw background rectangle
			cv2.rectangle(img, (x1, y1 - text_height - 10), (x1 + text_width, y1), color, -1)
			
			# Draw text
			cv2.putText(img, label_text, (x1, y1 - 5), font, font_scale, (255, 255, 255), thickness)
		
		# Save if output path provided
		if output_path:
			cv2.imwrite(output_path, img)
			print(f"Annotated image saved to {output_path}")
		
		return img
	
	except Exception as e:
		print(f"Error drawing detections: {e}")
		return None


def get_model_info(model):
	"""Get information about the loaded model"""
	try:
		info = {
			'model_type': model.model.__class__.__name__,
			'classes': list(model.names.values()),
			'num_classes': len(model.names),
		}
		return info
	except Exception as e:
		print(f"Error getting model info: {e}")
		return {}


# For testing
if __name__ == "__main__":
	print("Testing YOLO detector...")
	
	# Load model
	model = load_model()
	
	# Get model info
	info = get_model_info(model)
	print(f"\nModel Info:")
	print(f"Type: {info.get('model_type')}")
	print(f"Number of classes: {info.get('num_classes')}")
	print(f"Classes: {info.get('classes')}")
	
	print("\nDetector ready!")