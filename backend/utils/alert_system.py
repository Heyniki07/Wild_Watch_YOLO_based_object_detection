# backend/utils/alert_system.py
import os
from datetime import datetime
import json

# Wild animals to monitor (customize based on your trained model)
WILD_ANIMALS = {'leopard', 'tiger', 'lion', 'cheetah'}

# Confidence threshold for alerts
CONFIDENCE_THRESHOLD = 0.5  # 50%

# Alert severity levels based on confidence
SEVERITY_LEVELS = {
	'critical': 0.85,  # 85%+
	'high': 0.70,      # 70%+
	'medium': 0.55,    # 55%+
	'low': 0.40        # 40%+
}


def is_wild_animal_detected(detections, threshold=CONFIDENCE_THRESHOLD):
	"""
	Check if any wild animal is detected above confidence threshold
	
	Args:
		detections: List of detection dictionaries
		threshold: Minimum confidence threshold
	
	Returns:
		(is_detected, detection_info) tuple
	"""
	for det in detections:
		label = det.get('label', '').lower()
		confidence = det.get('confidence', 0)
		
		if label in WILD_ANIMALS and confidence >= threshold:
			return True, det
	
	return False, None


def get_severity_level(confidence):
	"""Determine alert severity based on confidence"""
	if confidence >= SEVERITY_LEVELS['critical']:
		return 'critical'
	elif confidence >= SEVERITY_LEVELS['high']:
		return 'high'
	elif confidence >= SEVERITY_LEVELS['medium']:
		return 'medium'
	else:
		return 'low'


def trigger_alert(detection_info):
	"""
	Trigger alert for detected wild animal
	
	Args:
		detection_info: Dictionary containing detection details
	"""
	try:
		label = detection_info.get('label', 'Unknown')
		confidence = detection_info.get('confidence', 0)
		severity = get_severity_level(confidence)
		
		alert_message = f"[{severity.upper()}] {label.upper()} detected with {confidence*100:.2f}% confidence"
		
		# Log to console
		print("=" * 60)
		print(f"🚨 WILDLIFE ALERT: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
		print(alert_message)
		print(f"Bounding Box: {detection_info.get('bbox', 'N/A')}")
		print("=" * 60)
		
		# Log to file
		log_alert_to_file(detection_info, severity)
		
		# Here you can add more alert mechanisms:
		# - Send email notifications
		# - Send SMS via Twilio/AWS SNS
		# - Push notifications
		# - Webhook calls
		# - Database logging (already done in app.py)
		
		return True
	
	except Exception as e:
		print(f"Error triggering alert: {e}")
		return False


def log_alert_to_file(detection_info, severity):
	"""Log alert to a file for record keeping"""
	try:
		log_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
		os.makedirs(log_dir, exist_ok=True)
		
		log_file = os.path.join(log_dir, 'alerts.log')
		
		log_entry = {
			'timestamp': datetime.now().isoformat(),
			'severity': severity,
			'species': detection_info.get('label'),
			'confidence': detection_info.get('confidence'),
			'bbox': detection_info.get('bbox')
		}
		
		with open(log_file, 'a') as f:
			f.write(json.dumps(log_entry) + '\n')
		
		print(f"Alert logged to {log_file}")
	
	except Exception as e:
		print(f"Error logging alert: {e}")


def send_email_alert(recipient_email, detection_info, user_location=None):
	"""
	Send email alert (placeholder - implement with SMTP or service like SendGrid)
	
	Args:
		recipient_email: Email address to send alert to
		detection_info: Detection information
		user_location: Optional user location (lat, lon)
	"""
	try:
		# TODO: Implement email sending
		# Example using smtplib or SendGrid API
		
		subject = f"🚨 Wildlife Alert: {detection_info.get('label', 'Unknown').upper()} Detected"
		
		body = f"""
		Wildlife Alert Notification
		
		A wild animal has been detected by the monitoring system.
		
		Species: {detection_info.get('label', 'Unknown')}
		Confidence: {detection_info.get('confidence', 0) * 100:.2f}%
		Severity: {get_severity_level(detection_info.get('confidence', 0))}
		Detection Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
		
		"""
		
		if user_location:
			body += f"\nLocation: {user_location[0]}, {user_location[1]}\n"
		
		body += """
		Please take appropriate safety measures.
		
		This is an automated alert from the Wild Animal Monitoring System.
		"""
		
		print(f"Email alert prepared for {recipient_email}")
		print(f"Subject: {subject}")
		# Actual email sending would go here
		
		return True
	
	except Exception as e:
		print(f"Error sending email alert: {e}")
		return False


def send_sms_alert(phone_number, detection_info):
	"""
	Send SMS alert (placeholder - implement with Twilio or similar)
	
	Args:
		phone_number: Phone number to send SMS to
		detection_info: Detection information
	"""
	try:
		# TODO: Implement SMS sending with Twilio or AWS SNS
		
		message = f"Wildlife Alert: {detection_info.get('label', 'Unknown').upper()} detected with {detection_info.get('confidence', 0)*100:.0f}% confidence. Stay safe!"
		
		print(f"SMS alert prepared for {phone_number}")
		print(f"Message: {message}")
		# Actual SMS sending would go here
		
		return True
	
	except Exception as e:
		print(f"Error sending SMS alert: {e}")
		return False


def filter_detections_by_species(detections, species_list):
	"""Filter detections to only include specified species"""
	return [d for d in detections if d.get('label', '').lower() in [s.lower() for s in species_list]]


def get_highest_confidence_detection(detections):
	"""Get the detection with highest confidence"""
	if not detections:
		return None
	return max(detections, key=lambda x: x.get('confidence', 0))


def aggregate_detections_by_species(detections):
	"""
	Aggregate detections by species, keeping highest confidence per species
	
	Returns:
		Dictionary with species as keys and detection info as values
	"""
	aggregated = {}
	
	for det in detections:
		species = det.get('label', 'unknown').lower()
		confidence = det.get('confidence', 0)
		
		if species not in aggregated or confidence > aggregated[species]['confidence']:
			aggregated[species] = det
	
	return aggregated


# Alert message templates
ALERT_TEMPLATES = {
	'critical': {
		'title': '🚨 CRITICAL WILDLIFE ALERT',
		'message': 'IMMEDIATE ACTION REQUIRED: {species} detected with very high confidence ({confidence}%). Please evacuate the area and contact authorities immediately.'
	},
	'high': {
		'title': '⚠️ HIGH PRIORITY WILDLIFE ALERT',
		'message': 'WARNING: {species} detected with high confidence ({confidence}%). Exercise extreme caution and maintain safe distance.'
	},
	'medium': {
		'title': '⚡ WILDLIFE ALERT',
		'message': 'CAUTION: {species} detected ({confidence}% confidence). Be alert and aware of your surroundings.'
	},
	'low': {
		'title': 'ℹ️ Wildlife Activity',
		'message': 'Possible {species} sighting detected ({confidence}% confidence). Stay vigilant.'
	}
}


def get_alert_message(detection_info):
	"""Get formatted alert message based on severity"""
	try:
		confidence = detection_info.get('confidence', 0)
		severity = get_severity_level(confidence)
		template = ALERT_TEMPLATES.get(severity, ALERT_TEMPLATES['low'])
		
		message = {
			'title': template['title'],
			'body': template['message'].format(
				species=detection_info.get('label', 'Unknown').upper(),
				confidence=f"{confidence*100:.1f}"
			),
			'severity': severity
		}
		
		return message
	
	except Exception as e:
		print(f"Error generating alert message: {e}")
		return {
			'title': 'Wildlife Alert',
			'body': 'A wild animal has been detected. Please stay alert.',
			'severity': 'low'
		}


# Safety recommendations based on species
SAFETY_RECOMMENDATIONS = {
	'leopard': [
		"Do not run - back away slowly while facing the animal",
		"Make yourself appear larger by raising arms",
		"Make loud noises to scare it away",
		"Never turn your back or crouch down",
		"Seek shelter in a building or vehicle if available"
	],
	'tiger': [
		"Remain calm and do not run",
		"Face the tiger and back away slowly",
		"Make yourself appear large",
		"Shout loudly and make noise",
		"Never approach a tiger, even if it appears injured"
	],
	'lion': [
		"Stand your ground and make eye contact",
		"Make yourself appear larger",
		"Shout and wave your arms",
		"Back away slowly without turning",
		"Climb a tree if possible and safe"
	],
	'cheetah': [
		"Stand still and face the cheetah",
		"Make yourself appear large",
		"Shout and make loud noises",
		"Do not run - they chase prey that runs",
		"Back away slowly"
	],
	'elephant': [
		"Keep at least 50 meters distance",
		"Do not make sudden movements",
		"Move away quietly and slowly",
		"Never approach a mother with calves",
		"Seek shelter behind solid structures"
	]
}


def get_safety_recommendations(species):
	"""Get safety recommendations for specific species"""
	species_lower = species.lower()
	return SAFETY_RECOMMENDATIONS.get(species_lower, [
		"Maintain safe distance from the animal",
		"Do not approach or provoke",
		"Contact wildlife authorities",
		"Alert others in the area",
		"Stay calm and move away slowly"
	])


# For testing
if __name__ == "__main__":
	print("Testing alert system...")
	
	# Test detection
	test_detection = {
		'label': 'leopard',
		'confidence': 0.92,
		'bbox': [100, 200, 300, 400]
	}
	
	# Check if wild animal
	is_wild, det = is_wild_animal_detected([test_detection])
	print(f"\nWild animal detected: {is_wild}")
	
	if is_wild:
		# Trigger alert
		trigger_alert(det)
		
		# Get alert message
		message = get_alert_message(det)
		print(f"\nAlert Message:")
		print(f"Title: {message['title']}")
		print(f"Body: {message['body']}")
		print(f"Severity: {message['severity']}")
		
		# Get safety recommendations
		recommendations = get_safety_recommendations(det['label'])
		print(f"\nSafety Recommendations:")
		for i, rec in enumerate(recommendations, 1):
			print(f"{i}. {rec}")
	
	print("\nAlert system test complete!")