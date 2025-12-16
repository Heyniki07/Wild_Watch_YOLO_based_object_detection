from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import sqlite3
import os
import math
import json
from datetime import datetime
import uuid

# Import detection utilities
from backend.utils.detector import detect_objects, load_model
from backend.utils.alert_system import is_wild_animal_detected, trigger_alert

DB_PATH = os.path.join(os.path.dirname(__file__), 'backend', 'app.db')
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'avi', 'mov', 'mkv'}

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
CORS(app, supports_credentials=True)

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load YOLO model at startup
print("Loading YOLO model...")
yolo_model = load_model()
print("YOLO model loaded successfully!")


def allowed_file(filename):
	return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_db():
	conn = sqlite3.connect(DB_PATH)
	conn.row_factory = sqlite3.Row
	return conn


def init_db():
	conn = get_db()
	cur = conn.cursor()
	
	# Users table
	cur.execute(
		"""
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at TEXT NOT NULL
		);
		"""
	)
	
	# Profiles table with preferences
	cur.execute(
		"""
		CREATE TABLE IF NOT EXISTS profiles (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER UNIQUE NOT NULL,
			occupation TEXT,
			address TEXT,
			area_type TEXT CHECK(area_type IN ('rural','semi-urban','urban')),
			phone TEXT,
			lat REAL,
			lon REAL,
			radius_km REAL DEFAULT 5,
			preferences TEXT,
			FOREIGN KEY(user_id) REFERENCES users(id)
		);
		"""
	)
	
	# Detections table with confidence and file path
	cur.execute(
		"""
		CREATE TABLE IF NOT EXISTS detections (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			species TEXT NOT NULL,
			lat REAL NOT NULL,
			lon REAL NOT NULL,
			confidence REAL,
			file_path TEXT,
			detected_at TEXT NOT NULL,
			user_id INTEGER,
			FOREIGN KEY(user_id) REFERENCES users(id)
		);
		"""
	)
	
	# Alerts table
	cur.execute(
		"""
		CREATE TABLE IF NOT EXISTS alerts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			detection_id INTEGER NOT NULL,
			distance_km REAL NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY(user_id) REFERENCES users(id),
			FOREIGN KEY(detection_id) REFERENCES detections(id)
		);
		"""
	)
	
	conn.commit()
	conn.close()


# Initialize database
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
init_db()


@app.route('/')
def index():
	return send_from_directory('templates', 'index.html')


@app.route('/api/signup', methods=['POST'])
def signup():
	data = request.get_json(force=True)
	name = data.get('name', '').strip()
	email = data.get('email', '').strip().lower()
	password = data.get('password', '')
	
	if not name or not email or not password:
		return jsonify({'error': 'Missing name, email, or password'}), 400
	
	if len(password) < 8:
		return jsonify({'error': 'Password must be at least 8 characters'}), 400
	
	password_hash = generate_password_hash(password)
	conn = get_db()
	
	try:
		cur = conn.cursor()
		cur.execute(
			'INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
			(name, email, password_hash, datetime.utcnow().isoformat())
		)
		conn.commit()
		user_id = cur.lastrowid
		
		# Create empty profile with default preferences
		default_prefs = json.dumps({'email': True, 'sms': True, 'push': True})
		cur.execute(
			'INSERT INTO profiles (user_id, preferences) VALUES (?, ?)',
			(user_id, default_prefs)
		)
		conn.commit()
		
		session['user_id'] = user_id
		return jsonify({
			'message': 'Signup successful',
			'user': {'id': user_id, 'name': name, 'email': email}
		})
	except sqlite3.IntegrityError:
		return jsonify({'error': 'Email already registered'}), 409
	finally:
		conn.close()


@app.route('/api/login', methods=['POST'])
def login():
	data = request.get_json(force=True)
	email = data.get('email', '').strip().lower()
	password = data.get('password', '')
	
	if not email or not password:
		return jsonify({'error': 'Missing email or password'}), 400
	
	conn = get_db()
	cur = conn.cursor()
	cur.execute('SELECT * FROM users WHERE email = ?', (email,))
	row = cur.fetchone()
	conn.close()
	
	if not row or not check_password_hash(row['password_hash'], password):
		return jsonify({'error': 'Invalid credentials'}), 401
	
	session['user_id'] = row['id']
	return jsonify({
		'message': 'Login successful',
		'user': {'id': row['id'], 'name': row['name'], 'email': row['email']}
	})


@app.route('/api/logout', methods=['POST'])
def logout():
	session.pop('user_id', None)
	return jsonify({'message': 'Logged out'})


@app.route('/api/me', methods=['GET'])
def me():
	user_id = session.get('user_id')
	if not user_id:
		return jsonify({'user': None})
	
	conn = get_db()
	cur = conn.cursor()
	cur.execute('SELECT id, name, email, created_at FROM users WHERE id = ?', (user_id,))
	user_row = cur.fetchone()
	
	if not user_row:
		conn.close()
		return jsonify({'user': None})
	
	user = dict(user_row)
	
	cur.execute('SELECT occupation, address, area_type, phone, lat, lon, radius_km, preferences FROM profiles WHERE user_id = ?', (user_id,))
	profile_row = cur.fetchone()
	
	profile = None
	if profile_row:
		profile = dict(profile_row)
		# Parse preferences JSON
		if profile.get('preferences'):
			try:
				profile['preferences'] = json.loads(profile['preferences'])
			except:
				profile['preferences'] = {'email': True, 'sms': True, 'push': True}
	
	conn.close()
	return jsonify({'user': user, 'profile': profile})


@app.route('/api/profile', methods=['POST'])
def save_profile():
	user_id = session.get('user_id')
	if not user_id:
		return jsonify({'error': 'Unauthorized'}), 401
	
	data = request.get_json(force=True)
	occupation = data.get('occupation', '').strip()
	address = data.get('address', '').strip()
	area_type = data.get('area_type')
	phone = data.get('phone', '').strip()
	lat = data.get('lat')
	lon = data.get('lon')
	radius_km = data.get('radius_km', 5)
	preferences = data.get('preferences', {'email': True, 'sms': True, 'push': True})
	
	# Validate area_type
	if area_type and area_type not in ('rural', 'semi-urban', 'urban'):
		return jsonify({'error': 'Invalid area_type'}), 400
	
	# Convert preferences to JSON
	preferences_json = json.dumps(preferences)
	
	conn = get_db()
	cur = conn.cursor()
	cur.execute(
		'''UPDATE profiles 
		   SET occupation = ?, address = ?, area_type = ?, phone = ?, 
		       lat = ?, lon = ?, radius_km = ?, preferences = ?
		   WHERE user_id = ?''',
		(occupation, address, area_type, phone, lat, lon, radius_km, preferences_json, user_id)
	)
	conn.commit()
	conn.close()
	
	return jsonify({'message': 'Profile saved successfully'})


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
	user_id = session.get('user_id')
	if not user_id:
		return jsonify({'error': 'Unauthorized'}), 401
	
	conn = get_db()
	cur = conn.cursor()
	cur.execute('''
		SELECT a.id, a.distance_km, a.created_at,
		       d.id as detection_id, d.species, d.lat, d.lon, d.detected_at, d.confidence
		FROM alerts a
		JOIN detections d ON d.id = a.detection_id
		WHERE a.user_id = ?
		ORDER BY a.created_at DESC
		LIMIT 100
	''', (user_id,))
	
	rows = cur.fetchall()
	alerts = []
	for r in rows:
		alerts.append({
			'id': r['id'],
			'distance_km': r['distance_km'],
			'created_at': r['created_at'],
			'species': r['species'],
			'lat': r['lat'],
			'lon': r['lon'],
			'detected_at': r['detected_at'],
			'confidence': r['confidence']
		})
	
	conn.close()
	return jsonify({'alerts': alerts})


# Haversine distance in km
EARTH_R = 6371.0

def haversine_km(lat1, lon1, lat2, lon2):
	if None in (lat1, lon1, lat2, lon2):
		return None
	phi1 = math.radians(lat1)
	phi2 = math.radians(lat2)
	dphi = math.radians(lat2 - lat1)
	dlambda = math.radians(lon2 - lon1)
	a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
	c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
	return EARTH_R * c


def create_alerts_for_detection(detection_id, det_lat, det_lon):
	"""Create alerts for all users within their alert radius"""
	conn = get_db()
	cur = conn.cursor()
	
	cur.execute('''
		SELECT user_id, lat, lon, radius_km 
		FROM profiles 
		WHERE lat IS NOT NULL AND lon IS NOT NULL AND radius_km IS NOT NULL
	''')
	
	profiles = cur.fetchall()
	created = 0
	
	for p in profiles:
		dist = haversine_km(p['lat'], p['lon'], det_lat, det_lon)
		if dist is not None and dist <= (p['radius_km'] or 0):
			cur.execute(
				'INSERT INTO alerts (user_id, detection_id, distance_km, created_at) VALUES (?, ?, ?, ?)',
				(p['user_id'], detection_id, round(dist, 2), datetime.utcnow().isoformat())
			)
			created += 1
	
	conn.commit()
	conn.close()
	return created


@app.route('/api/mock_detection', methods=['POST'])
def mock_detection():
	"""Create a mock detection for testing"""
	user_id = session.get('user_id')
	if not user_id:
		return jsonify({'error': 'Unauthorized'}), 401
	
	data = request.get_json(force=True)
	species = data.get('species', '').lower()
	lat = data.get('lat')
	lon = data.get('lon')
	confidence = data.get('confidence', 95)
	
	if not species or lat is None or lon is None:
		return jsonify({'error': 'Missing species, latitude, or longitude'}), 400
	
	detected_at = datetime.utcnow().isoformat()
	
	conn = get_db()
	cur = conn.cursor()
	cur.execute(
		'INSERT INTO detections (species, lat, lon, confidence, detected_at, user_id) VALUES (?, ?, ?, ?, ?, ?)',
		(species, lat, lon, confidence, detected_at, user_id)
	)
	detection_id = cur.lastrowid
	conn.commit()
	conn.close()
	
	# Create alerts for nearby users
	alerts_created = create_alerts_for_detection(detection_id, lat, lon)
	
	return jsonify({
		'message': 'Mock detection created',
		'detection_id': detection_id,
		'alerts_created': alerts_created
	})


@app.route('/api/detect', methods=['POST'])
def detect_wildlife():
	"""Upload image/video and run YOLOv8 detection"""
	user_id = session.get('user_id')
	if not user_id:
		return jsonify({'error': 'Unauthorized'}), 401
	
	# Check if file is in request
	if 'file' not in request.files:
		return jsonify({'error': 'No file provided'}), 400
	
	file = request.files['file']
	
	if file.filename == '':
		return jsonify({'error': 'No file selected'}), 400
	
	if not allowed_file(file.filename):
		return jsonify({'error': 'Invalid file type. Allowed: images (jpg, png, gif) and videos (mp4, avi, mov, mkv)'}), 400
	
	# Get user's location from form data
	try:
		user_lat = float(request.form.get('lat', 0))
		user_lon = float(request.form.get('lon', 0))
	except (TypeError, ValueError):
		# If no location provided, try to get from profile
		conn = get_db()
		cur = conn.cursor()
		cur.execute('SELECT lat, lon FROM profiles WHERE user_id = ?', (user_id,))
		profile = cur.fetchone()
		conn.close()
		
		if profile and profile['lat'] and profile['lon']:
			user_lat = profile['lat']
			user_lon = profile['lon']
		else:
			return jsonify({'error': 'Location required. Please set your location in profile or provide coordinates.'}), 400
	
	try:
		# Save file with unique name
		filename = secure_filename(file.filename)
		unique_filename = f"{uuid.uuid4()}_{filename}"
		filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
		file.save(filepath)
		
		# Run YOLO detection
		detections = detect_objects(filepath, yolo_model)
		
		# Check if wild animals detected
		wild_animals_found = []
		alerts_created = 0
		
		for det in detections:
			is_wild, detection_info = is_wild_animal_detected([det])
			
			if is_wild:
				# Save detection to database
				detected_at = datetime.utcnow().isoformat()
				conn = get_db()
				cur = conn.cursor()
				
				cur.execute(
					'''INSERT INTO detections 
					   (species, lat, lon, confidence, file_path, detected_at, user_id) 
					   VALUES (?, ?, ?, ?, ?, ?, ?)''',
					(det['label'], user_lat, user_lon, det['confidence'] * 100, 
					 unique_filename, detected_at, user_id)
				)
				detection_id = cur.lastrowid
				conn.commit()
				conn.close()
				
				# Create alerts for nearby users
				alerts = create_alerts_for_detection(detection_id, user_lat, user_lon)
				alerts_created += alerts
				
				wild_animals_found.append({
					'species': det['label'],
					'confidence': round(det['confidence'] * 100, 2),
					'detection_id': detection_id
				})
				
				# Trigger alert system
				trigger_alert(detection_info)
		
		return jsonify({
			'success': True,
			'detections': detections,
			'wild_animals': wild_animals_found,
			'alerts_created': alerts_created,
			'file_path': unique_filename
		})
	
	except Exception as e:
		print(f"Detection error: {str(e)}")
		return jsonify({'error': f'Detection failed: {str(e)}'}), 500


@app.route('/uploads/<filename>')
def uploaded_file(filename):
	"""Serve uploaded files"""
	return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# WCCB Centers (Wildlife Crime Control Bureau)
WCCB_CENTERS = [
	{
		'name': 'WCCB Headquarters New Delhi',
		'lat': 28.6139,
		'lon': 77.2090,
		'email': 'wccb-hq@nic.in',
		'phone': '+91-11-26567788'
	},
	{
		'name': 'WCCB Western Regional Office Mumbai',
		'lat': 19.0760,
		'lon': 72.8777,
		'email': 'wccb-west@nic.in',
		'phone': '+91-22-26595103'
	},
	{
		'name': 'WCCB Southern Regional Office Chennai',
		'lat': 13.0827,
		'lon': 80.2707,
		'email': 'wccb-south@nic.in',
		'phone': '+91-44-28520321'
	},
	{
		'name': 'WCCB Eastern Regional Office Kolkata',
		'lat': 22.5726,
		'lon': 88.3639,
		'email': 'wccb-east@nic.in',
		'phone': '+91-33-24797700'
	},
	{
		'name': 'WCCB Northern Regional Office Delhi',
		'lat': 28.7041,
		'lon': 77.1025,
		'email': 'wccb-north@nic.in',
		'phone': '+91-11-26567788'
	},
]


@app.route('/api/wccb')
def wccb_nearest():
	"""Find nearest WCCB office"""
	try:
		lat = float(request.args.get('lat'))
		lon = float(request.args.get('lon'))
	except (TypeError, ValueError):
		return jsonify({'error': 'Invalid latitude or longitude'}), 400
	
	best = None
	best_d = float('inf')
	
	for center in WCCB_CENTERS:
		dist = haversine_km(lat, lon, center['lat'], center['lon'])
		if dist and dist < best_d:
			best = {**center, 'distance_km': round(dist, 1)}
			best_d = dist
	
	if not best:
		return jsonify({'error': 'No WCCB office found'}), 404
	
	return jsonify({'nearest': best})


@app.route('/api/stats', methods=['GET'])
def get_stats():
	"""Get detection statistics"""
	user_id = session.get('user_id')
	if not user_id:
		return jsonify({'error': 'Unauthorized'}), 401
	
	conn = get_db()
	cur = conn.cursor()
	
	# Get counts by species
	cur.execute('''
		SELECT d.species, COUNT(*) as count
		FROM alerts a
		JOIN detections d ON d.id = a.detection_id
		WHERE a.user_id = ?
		GROUP BY d.species
	''', (user_id,))
	
	stats = {}
	for row in cur.fetchall():
		stats[row['species']] = row['count']
	
	conn.close()
	return jsonify({'stats': stats})


# Static routes
@app.route('/static/<path:path>')
def static_proxy(path):
	return send_from_directory('static', path)


if __name__ == '__main__':
	port = int(os.environ.get('PORT', 5000))
	app.run(host='0.0.0.0', port=port, debug=True)