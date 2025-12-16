/* ===================================
   Wild Animal Monitoring System - JavaScript
   Enhanced with Error Handling & UX Features
   =================================== */

// Utility Functions
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const API = async (path, opts = {}) => {
	try {
		return await fetch(path, {
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			...opts
		});
	} catch (error) {
		console.error('API Error:', error);
		throw new Error('Network connection failed. Please check your internet connection.');
	}
};

// State Management
const AppState = {
	isAuthed: false,
	currentUser: null,
	alerts: [],
	filters: {
		species: '',
		timeRange: 'all'
	},
	stats: {
		leopard: 0,
		tiger: 0,
		lion: 0,
		cheetah: 0
	}
};

/* ===================================
   TAB SWITCHING
   =================================== */

const tabLogin = $('#tab-login');
const tabSignup = $('#tab-signup');
const loginForm = $('#login-form');
const signupForm = $('#signup-form');
const terms = $('#terms');
const signupBtn = $('#signup-btn');

function switchToTab(targetTab) {
	if (targetTab === 'login') {
		tabLogin?.classList.add('active');
		tabSignup?.classList.remove('active');
		tabLogin?.setAttribute('aria-selected', 'true');
		tabSignup?.setAttribute('aria-selected', 'false');
		loginForm?.classList.remove('hidden');
		signupForm?.classList.add('hidden');
	} else {
		tabSignup?.classList.add('active');
		tabLogin?.classList.remove('active');
		tabSignup?.setAttribute('aria-selected', 'true');
		tabLogin?.setAttribute('aria-selected', 'false');
		signupForm?.classList.remove('hidden');
		loginForm?.classList.add('hidden');
		syncTermsState();
	}
}

tabLogin?.addEventListener('click', () => switchToTab('login'));
tabSignup?.addEventListener('click', () => switchToTab('signup'));

/* ===================================
   TERMS & CONDITIONS
   =================================== */

function syncTermsState() {
	if (terms && signupBtn) {
		signupBtn.disabled = !terms.checked;
	}
}

if (terms) {
	terms.addEventListener('change', syncTermsState);
	syncTermsState();
}

/* ===================================
   GEOLOCATION
   =================================== */

function getCurrentPositionAsync(options) {
	return new Promise((resolve, reject) => {
		if (!('geolocation' in navigator)) {
			reject(new Error('Geolocation is not supported by your browser'));
			return;
		}
		navigator.geolocation.getCurrentPosition(resolve, reject, options);
	});
}

const getLocBtn = $('#get-location-btn');
if (getLocBtn) {
	getLocBtn.addEventListener('click', async (e) => {
		const btn = e.currentTarget;
		const originalHTML = btn.innerHTML;
		
		try {
			btn.disabled = true;
			btn.innerHTML = '<span class="spinner"></span><span>Getting Location...</span>';
			btn.classList.add('loading');

			const pos = await getCurrentPositionAsync({
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 60000
			});

			const { latitude, longitude, accuracy } = pos.coords;
			const latEl = $('#lat');
			const lonEl = $('#lon');

			if (latEl && lonEl) {
				latEl.value = Number(latitude).toFixed(6);
				lonEl.value = Number(longitude).toFixed(6);
				
				// Add visual feedback
				latEl.classList.add('success-flash');
				lonEl.classList.add('success-flash');
				setTimeout(() => {
					latEl.classList.remove('success-flash');
					lonEl.classList.remove('success-flash');
				}, 1000);
			}

			const accuracyMsg = accuracy ? ` (±${Math.round(accuracy)}m accuracy)` : '';
			showToast(`Location captured successfully${accuracyMsg}`, 'success');
			
		} catch (err) {
			console.error('Geolocation error:', err);
			
			let msg = 'Unable to get your location';
			let details = '';
			
			if (err.code === 1) { // PERMISSION_DENIED
				msg = 'Location Permission Denied';
				details = 'Please enable location access in your browser settings and try again.';
			} else if (err.code === 2) { // POSITION_UNAVAILABLE
				msg = 'Location Unavailable';
				details = 'Unable to determine your position. Check your GPS/network settings.';
			} else if (err.code === 3) { // TIMEOUT
				msg = 'Location Request Timed Out';
				details = 'The request took too long. Please try again.';
			} else {
				details = err.message || 'An unknown error occurred.';
			}
			
			showToast(msg, 'error', 4000);
			showModal('Location Error', `${msg}<br><small>${details}</small>`);
			
		} finally {
			btn.disabled = false;
			btn.innerHTML = originalHTML;
			btn.classList.remove('loading');
		}
	});
}

/* ===================================
   AUTHENTICATION
   =================================== */

// Signup
$('#signup-btn')?.addEventListener('click', async (e) => {
	e.preventDefault();
	const btn = e.currentTarget;
	const msgEl = $('#signup-msg');
	const originalHTML = btn.innerHTML;
	
	// Clear previous messages
	msgEl.textContent = '';
	msgEl.className = 'msg';

	// Get form values
	const name = $('#signup-name')?.value.trim();
	const email = $('#signup-email')?.value.trim();
	const password = $('#signup-password')?.value;

	// Validation
	if (terms && !terms.checked) {
		msgEl.textContent = 'Please agree to the Terms of Service to continue.';
		msgEl.classList.add('error');
		return;
	}

	if (!name || !email || !password) {
		msgEl.textContent = 'Please fill in all required fields.';
		msgEl.classList.add('error');
		return;
	}

	if (name.length < 2) {
		msgEl.textContent = 'Name must be at least 2 characters long.';
		msgEl.classList.add('error');
		return;
	}

	if (!isValidEmail(email)) {
		msgEl.textContent = 'Please enter a valid email address.';
		msgEl.classList.add('error');
		return;
	}

	if (password.length < 8) {
		msgEl.textContent = 'Password must be at least 8 characters long.';
		msgEl.classList.add('error');
		return;
	}

	try {
		btn.disabled = true;
		btn.innerHTML = '<span class="spinner"></span><span>Creating Account...</span>';

		const res = await API('/api/signup', {
			method: 'POST',
			body: JSON.stringify({ name, email, password })
		});

		const data = await res.json().catch(() => ({}));

		if (!res.ok) {
			msgEl.textContent = data.error || 'Signup failed. Please try again.';
			msgEl.classList.add('error');
			return;
		}

		msgEl.textContent = '✓ Account created successfully!';
		msgEl.classList.add('success');
		showToast('Welcome! Your account has been created.', 'success');
		notifyNative('Signup Successful', 'Your account has been created and you are logged in.');
		
		// Clear form
		$('#signup-name').value = '';
		$('#signup-email').value = '';
		$('#signup-password').value = '';
		if (terms) terms.checked = false;

		await loadMe();

	} catch (err) {
		console.error('Signup error:', err);
		msgEl.textContent = err.message || 'Network error. Please check your connection.';
		msgEl.classList.add('error');
		showToast('Signup failed due to network error', 'error');
	} finally {
		btn.disabled = false;
		btn.innerHTML = originalHTML;
	}
});

// Login
$('#login-btn')?.addEventListener('click', async (e) => {
	e.preventDefault();
	const btn = e.currentTarget;
	const msgEl = $('#login-msg');
	const originalHTML = btn.innerHTML;
	
	// Clear previous messages
	msgEl.textContent = '';
	msgEl.className = 'msg';

	const email = $('#login-email')?.value.trim();
	const password = $('#login-password')?.value;

	// Validation
	if (!email || !password) {
		msgEl.textContent = 'Please enter both email and password.';
		msgEl.classList.add('error');
		return;
	}

	if (!isValidEmail(email)) {
		msgEl.textContent = 'Please enter a valid email address.';
		msgEl.classList.add('error');
		return;
	}

	try {
		btn.disabled = true;
		btn.innerHTML = '<span class="spinner"></span><span>Logging In...</span>';

		const res = await API('/api/login', {
			method: 'POST',
			body: JSON.stringify({ email, password })
		});

		const data = await res.json().catch(() => ({}));

		if (!res.ok) {
			msgEl.textContent = data.error || 'Login failed. Check your credentials.';
			msgEl.classList.add('error');
			return;
		}

		msgEl.textContent = '✓ Login successful!';
		msgEl.classList.add('success');
		showToast('Welcome back!', 'success');
		notifyNative('Login Successful', 'You are now logged in to the monitoring system.');
		
		// Clear form
		$('#login-email').value = '';
		$('#login-password').value = '';

		await loadMe();

	} catch (err) {
		console.error('Login error:', err);
		msgEl.textContent = err.message || 'Network error. Please check your connection.';
		msgEl.classList.add('error');
		showToast('Login failed due to network error', 'error');
	} finally {
		btn.disabled = false;
		btn.innerHTML = originalHTML;
	}
});

// Logout
$('#logout-btn')?.addEventListener('click', async () => {
	if (!confirm('Are you sure you want to logout?')) return;
	
	try {
		await API('/api/logout', { method: 'POST' });
		showToast('Logged out successfully', 'info');
		setTimeout(() => location.reload(), 500);
	} catch (err) {
		console.error('Logout error:', err);
		showToast('Logout failed', 'error');
		// Force reload anyway
		setTimeout(() => location.reload(), 1000);
	}
});

/* ===================================
   PROFILE MANAGEMENT
   =================================== */

$('#save-profile')?.addEventListener('click', async (e) => {
	const btn = e.currentTarget;
	const msgEl = $('#profile-msg');
	const originalHTML = btn.innerHTML;
	
	msgEl.textContent = '';
	msgEl.className = 'msg';

	// Get form values
	const occupation = $('#occupation')?.value.trim();
	const address = $('#address')?.value.trim();
	const areaType = $('#area_type')?.value || null;
	const phone = $('#phone')?.value.trim();
	const lat = parseFloat($('#lat')?.value);
	const lon = parseFloat($('#lon')?.value);
	const radiusKm = parseFloat($('#radius_km')?.value) || 5;

	// Validation
	if (!occupation || !address || !areaType) {
		msgEl.textContent = 'Please fill in all required fields (marked with *).';
		msgEl.classList.add('error');
		return;
	}

	if (isNaN(lat) || isNaN(lon)) {
		msgEl.textContent = 'Please provide valid latitude and longitude.';
		msgEl.classList.add('error');
		return;
	}

	if (lat < -90 || lat > 90) {
		msgEl.textContent = 'Latitude must be between -90 and 90.';
		msgEl.classList.add('error');
		return;
	}

	if (lon < -180 || lon > 180) {
		msgEl.textContent = 'Longitude must be between -180 and 180.';
		msgEl.classList.add('error');
		return;
	}

	if (radiusKm < 0.1 || radiusKm > 50) {
		msgEl.textContent = 'Alert radius must be between 0.1 and 50 km.';
		msgEl.classList.add('error');
		return;
	}

	// Get notification preferences
	const preferences = {
		email: $('#pref-email')?.checked || false,
		sms: $('#pref-sms')?.checked || false,
		push: $('#pref-push')?.checked || false
	};

	const payload = {
		occupation,
		address,
		area_type: areaType,
		phone: phone || null,
		lat,
		lon,
		radius_km: radiusKm,
		preferences
	};

	try {
		btn.disabled = true;
		btn.innerHTML = '<span class="spinner"></span><span>Saving...</span>';

		const res = await API('/api/profile', {
			method: 'POST',
			body: JSON.stringify(payload)
		});

		const data = await res.json().catch(() => ({}));

		if (!res.ok) {
			msgEl.textContent = data.error || 'Failed to save profile.';
			msgEl.classList.add('error');
			return;
		}

		msgEl.textContent = '✓ Profile saved successfully!';
		msgEl.classList.add('success');
		showToast('Profile updated successfully', 'success');
		
		await refreshAlerts();
		
	} catch (err) {
		console.error('Profile save error:', err);
		msgEl.textContent = err.message || 'Network error. Please try again.';
		msgEl.classList.add('error');
		showToast('Failed to save profile', 'error');
	} finally {
		btn.disabled = false;
		btn.innerHTML = originalHTML;
	}
});

/* ===================================
   FILE UPLOAD & DETECTION
   =================================== */

// Add upload section to mock section
function addUploadSection() {
	const mockSection = $('#mock-section');
	if (!mockSection) return;
	
	const uploadHTML = `
		<div class="upload-section" style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid var(--gray-200);">
			<h3>🔍 Real Detection Mode</h3>
			<p class="section-description">Upload an image or video to detect wild animals using YOLOv8</p>
			
			<div class="image-upload-area" id="upload-area">
				<input type="file" id="file-input" accept="image/*,video/*" style="display: none;" />
				<div class="upload-content">
					<div style="font-size: 3rem; margin-bottom: 1rem;">📁</div>
					<h4>Drop files here or click to browse</h4>
					<p>Supports: JPG, PNG, GIF, MP4, AVI, MOV, MKV (Max 50MB)</p>
				</div>
			</div>
			
			<div id="upload-preview" class="hidden" style="margin-top: 1rem; text-align: center;">
				<img id="preview-image" style="max-width: 100%; max-height: 300px; border-radius: 0.5rem;" />
				<video id="preview-video" controls style="max-width: 100%; max-height: 300px; border-radius: 0.5rem; display: none;"></video>
				<p id="file-name" style="margin-top: 0.5rem; color: var(--gray-600);"></p>
			</div>
			
			<div class="actions" style="margin-top: 1.5rem;">
				<button id="detect-btn" class="btn-primary" disabled>
					<span>🔍 Detect Wildlife</span>
				</button>
				<button id="clear-upload-btn" class="btn-secondary" style="display: none;">
					<span>Clear</span>
				</button>
			</div>
			
			<div id="detection-results" class="hidden" style="margin-top: 2rem;">
				<h4>Detection Results:</h4>
				<div id="results-content"></div>
			</div>
			
			<small id="upload-msg" class="msg" role="alert"></small>
		</div>
	`;
	
	const demoContent = mockSection.querySelector('.demo-content');
	if (demoContent) {
		demoContent.insertAdjacentHTML('afterend', uploadHTML);
		initializeUpload();
	}
}

function initializeUpload() {
	const uploadArea = $('#upload-area');
	const fileInput = $('#file-input');
	const detectBtn = $('#detect-btn');
	const clearBtn = $('#clear-upload-btn');
	const preview = $('#upload-preview');
	const previewImg = $('#preview-image');
	const previewVideo = $('#preview-video');
	const fileName = $('#file-name');
	const resultsDiv = $('#detection-results');
	const resultsContent = $('#results-content');
	const uploadMsg = $('#upload-msg');
	
	let selectedFile = null;
	
	// Click to upload
	uploadArea?.addEventListener('click', () => fileInput?.click());
	
	// Drag and drop
	uploadArea?.addEventListener('dragover', (e) => {
		e.preventDefault();
		uploadArea.classList.add('dragging');
	});
	
	uploadArea?.addEventListener('dragleave', () => {
		uploadArea.classList.remove('dragging');
	});
	
	uploadArea?.addEventListener('drop', (e) => {
		e.preventDefault();
		uploadArea.classList.remove('dragging');
		const files = e.dataTransfer.files;
		if (files.length > 0) {
			handleFileSelect(files[0]);
		}
	});
	
	// File input change
	fileInput?.addEventListener('change', (e) => {
		if (e.target.files.length > 0) {
			handleFileSelect(e.target.files[0]);
		}
	});
	
	// Handle file selection
	function handleFileSelect(file) {
		selectedFile = file;
		
		// Check file size (50MB limit)
		if (file.size > 50 * 1024 * 1024) {
			showToast('File too large. Maximum size is 50MB.', 'error');
			return;
		}
		
		// Check file type
		const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska'];
		if (!validTypes.includes(file.type)) {
			showToast('Invalid file type. Please upload an image or video.', 'error');
			return;
		}
		
		// Show preview
		const reader = new FileReader();
		reader.onload = (e) => {
			if (file.type.startsWith('image/')) {
				previewImg.src = e.target.result;
				previewImg.style.display = 'block';
				previewVideo.style.display = 'none';
			} else {
				previewVideo.src = e.target.result;
				previewVideo.style.display = 'block';
				previewImg.style.display = 'none';
			}
			preview.classList.remove('hidden');
			fileName.textContent = file.name;
		};
		reader.readAsDataURL(file);
		
		// Enable detect button
		detectBtn.disabled = false;
		clearBtn.style.display = 'inline-flex';
		resultsDiv.classList.add('hidden');
		uploadMsg.textContent = '';
		uploadMsg.className = 'msg';
	}
	
	// Clear upload
	clearBtn?.addEventListener('click', () => {
		selectedFile = null;
		fileInput.value = '';
		preview.classList.add('hidden');
		previewImg.src = '';
		previewVideo.src = '';
		detectBtn.disabled = true;
		clearBtn.style.display = 'none';
		resultsDiv.classList.add('hidden');
		uploadMsg.textContent = '';
		uploadMsg.className = 'msg';
	});
	
	// Detect button
	detectBtn?.addEventListener('click', async () => {
		if (!selectedFile) {
			showToast('Please select a file first', 'warning');
			return;
		}
		
		const originalHTML = detectBtn.innerHTML;
		detectBtn.disabled = true;
		detectBtn.innerHTML = '<span class="spinner"></span><span>Analyzing...</span>';
		
		uploadMsg.textContent = '';
		uploadMsg.className = 'msg';
		
		try {
			// Get user location
			const lat = $('#lat')?.value;
			const lon = $('#lon')?.value;
			
			if (!lat || !lon) {
				showModal('Location Required', 'Please set your location in your profile before running detection.');
				return;
			}
			
			// Create form data
			const formData = new FormData();
			formData.append('file', selectedFile);
			formData.append('lat', lat);
			formData.append('lon', lon);
			
			// Upload and detect
			const response = await fetch('/api/detect', {
				method: 'POST',
				credentials: 'include',
				body: formData
			});
			
			const data = await response.json();
			
			if (!response.ok) {
				throw new Error(data.error || 'Detection failed');
			}
			
			// Display results
			displayDetectionResults(data);
			
			// Refresh alerts
			await refreshAlerts();
			await updateStats();
			
			if (data.wild_animals && data.wild_animals.length > 0) {
				showToast(`Alert! ${data.wild_animals.length} wild animal(s) detected!`, 'warning', 5000);
				notifyNative('Wildlife Detected!', `${data.wild_animals.length} wild animal(s) found in your upload`);
			} else {
				showToast('No wild animals detected in this file', 'success');
			}
			
		} catch (err) {
			console.error('Detection error:', err);
			uploadMsg.textContent = err.message || 'Detection failed. Please try again.';
			uploadMsg.classList.add('error');
			showToast('Detection failed', 'error');
		} finally {
			detectBtn.disabled = false;
			detectBtn.innerHTML = originalHTML;
		}
	});
}

function displayDetectionResults(data) {
	const resultsDiv = $('#detection-results');
	const resultsContent = $('#results-content');
	
	if (!resultsDiv || !resultsContent) return;
	
	let html = '';
	
	// Wild animals section
	if (data.wild_animals && data.wild_animals.length > 0) {
		html += '<div class="alert-item severity-high" style="margin-bottom: 1rem;">';
		html += '<div class="alert-icon">⚠️</div>';
		html += '<div class="alert-content">';
		html += '<div class="alert-title">Wild Animals Detected!</div>';
		html += '<div class="alert-details">';
		
		data.wild_animals.forEach(animal => {
			html += `<div style="margin: 0.5rem 0;">`;
			html += `<strong>${getSpeciesEmoji(animal.species)} ${animal.species.toUpperCase()}</strong> - `;
			html += `<span class="badge badge-danger">${animal.confidence}% confidence</span>`;
			html += `</div>`;
		});
		
		html += '</div>';
		html += `<p style="margin-top: 0.5rem; color: var(--danger); font-weight: 600;">`;
		html += `${data.alerts_created} alert(s) created for nearby users`;
		html += `</p>`;
		html += '</div>';
		html += '</div>';
	}
	
	// All detections
	if (data.detections && data.detections.length > 0) {
		html += '<div style="margin-top: 1rem;">';
		html += `<h4>All Detections (${data.detections.length} objects found):</h4>`;
		html += '<div class="stats-grid" style="margin-top: 1rem;">';
		
		data.detections.forEach(det => {
			const isWild = ['leopard', 'tiger', 'lion', 'cheetah'].includes(det.label.toLowerCase());
			html += '<div class="stat-card" style="' + (isWild ? 'border-color: var(--danger);' : '') + '">';
			html += `<div class="stat-icon">${getSpeciesEmoji(det.label)}</div>`;
			html += `<div class="stat-value">${(det.confidence * 100).toFixed(1)}%</div>`;
			html += `<div class="stat-label">${det.label}</div>`;
			html += '</div>';
		});
		
		html += '</div>';
		html += '</div>';
	}
	
	if (!html) {
		html = '<p style="text-align: center; color: var(--gray-600);">No objects detected in this file.</p>';
	}
	
	resultsContent.innerHTML = html;
	resultsDiv.classList.remove('hidden');
}

/* ===================================
   MOCK DETECTION (DEMO)
   =================================== */

$('#mock-btn')?.addEventListener('click', async (e) => {
	const btn = e.currentTarget;
	const msgEl = $('#mock-msg');
	const originalHTML = btn.innerHTML;
	
	msgEl.textContent = '';
	msgEl.className = 'msg';

	const species = $('#mock-species')?.value;
	const lat = parseFloat($('#mock-lat')?.value);
	const lon = parseFloat($('#mock-lon')?.value);
	const confidence = parseInt($('#mock-confidence')?.value) || 95;

	// Validation
	if (isNaN(lat) || isNaN(lon)) {
		msgEl.textContent = 'Please provide valid coordinates.';
		msgEl.classList.add('error');
		return;
	}

	try {
		btn.disabled = true;
		btn.innerHTML = '<span class="spinner"></span><span>Creating...</span>';

		const res = await API('/api/mock_detection', {
			method: 'POST',
			body: JSON.stringify({ species, lat, lon, confidence })
		});

		const data = await res.json().catch(() => ({}));

		if (!res.ok) {
			msgEl.textContent = data.error || 'Failed to create detection.';
			msgEl.classList.add('error');
			return;
		}

		const alertsCount = data.alerts_created || 0;
		msgEl.textContent = `✓ Created ${alertsCount} alert${alertsCount !== 1 ? 's' : ''}`;
		msgEl.classList.add('success');
		showToast(`Mock ${species} detection created`, 'success');
		
		await refreshAlerts();
		await updateStats();
		
	} catch (err) {
		console.error('Mock detection error:', err);
		msgEl.textContent = err.message || 'Network error.';
		msgEl.classList.add('error');
		showToast('Failed to create detection', 'error');
	} finally {
		btn.disabled = false;
		btn.innerHTML = originalHTML;
	}
});

/* ===================================
   USER SESSION MANAGEMENT
   =================================== */

async function loadMe() {
	try {
		const res = await API('/api/me');
		const data = await res.json().catch(() => ({ user: null }));

		if (!data.user) {
			// User not authenticated
			$('#profile-section')?.classList.add('hidden');
			$('#alerts-section')?.classList.add('hidden');
			$('#stats-section')?.classList.add('hidden');
			$('#mock-section')?.classList.add('hidden');
			$('#emergency-section')?.classList.add('hidden');

			if (AppState.isAuthed) {
				showToast('Session expired. Please login again.', 'info');
			}
			AppState.isAuthed = false;
			AppState.currentUser = null;
			return;
		}

		// User authenticated
		AppState.currentUser = data.user;
		
		$('#profile-section')?.classList.remove('hidden');
		$('#alerts-section')?.classList.remove('hidden');
		$('#stats-section')?.classList.remove('hidden');
		$('#mock-section')?.classList.remove('hidden');
		$('#emergency-section')?.classList.remove('hidden');

		if (!AppState.isAuthed) {
			showToast(`Welcome, ${data.user.name}!`, 'success');
		}
		AppState.isAuthed = true;

		// Load profile data
		const p = data.profile || {};
		$('#occupation').value = p.occupation || '';
		$('#address').value = p.address || '';
		$('#area_type').value = p.area_type || '';
		$('#phone').value = p.phone || '';
		$('#lat').value = p.lat ?? '';
		$('#lon').value = p.lon ?? '';
		$('#radius_km').value = p.radius_km ?? 5;

		// Load preferences
		if (p.preferences) {
			$('#pref-email').checked = p.preferences.email !== false;
			$('#pref-sms').checked = p.preferences.sms !== false;
			$('#pref-push').checked = p.preferences.push !== false;
		}

		await refreshAlerts();
		await updateStats();
		startAutoRefresh();

	} catch (err) {
		console.error('Load user error:', err);
		showToast('Failed to load user data', 'error');
	}
}

/* ===================================
   ALERTS MANAGEMENT
   =================================== */

async function refreshAlerts() {
	try {
		const res = await API('/api/alerts');
		if (!res.ok) {
			throw new Error('Failed to fetch alerts');
		}

		const data = await res.json().catch(() => ({ alerts: [] }));
		AppState.alerts = data.alerts || [];

		renderAlerts();
		
	} catch (err) {
		console.error('Refresh alerts error:', err);
		showToast('Failed to refresh alerts', 'error');
	}
}

function renderAlerts() {
	const list = $('#alerts-list');
	if (!list) return;

	// Update alert count
	const countEl = $('#alert-count');
	if (countEl) {
		countEl.textContent = String(AppState.alerts.length);
	}

	// Filter alerts
	const filtered = filterAlerts(AppState.alerts);

	// Clear list
	list.innerHTML = '';

	// Show empty state if no alerts
	if (filtered.length === 0) {
		list.innerHTML = `
			<div class="empty-state">
				<div class="empty-icon">🔍</div>
				<h3>No Alerts Found</h3>
				<p>${AppState.filters.species || AppState.filters.timeRange !== 'all' 
					? 'No alerts match your current filters.' 
					: 'You\'re all clear! We\'ll notify you when wildlife is detected in your area.'}</p>
			</div>
		`;
		return;
	}

	// Render alerts
	filtered.forEach((alert, index) => {
		const alertEl = createAlertElement(alert, index);
		list.appendChild(alertEl);
	});
}

function createAlertElement(alert, index) {
	const div = document.createElement('div');
	div.className = 'alert-item';
	div.style.animationDelay = `${index * 0.05}s`;

	// Determine severity based on distance
	let severity = 'low';
	if (alert.distance_km < 2) severity = 'critical';
	else if (alert.distance_km < 5) severity = 'high';
	else if (alert.distance_km < 10) severity = 'medium';
	
	div.classList.add(`severity-${severity}`);

	const detectedTime = new Date(alert.detected_at);
	const timeAgo = getTimeAgo(detectedTime);
	
	const speciesEmoji = getSpeciesEmoji(alert.species);
	const confidenceLevel = alert.confidence ? `${alert.confidence}%` : 'N/A';

	div.innerHTML = `
		<div class="alert-icon">${speciesEmoji}</div>
		<div class="alert-content">
			<div class="alert-title">
				<span class="alert-species">${alert.species}</span>
				<span class="badge badge-${severity}">${severity.toUpperCase()}</span>
			</div>
			<div class="alert-details">
				<div><strong>📍 Distance:</strong> ${alert.distance_km.toFixed(2)} km from your location</div>
				<div><strong>📊 Confidence:</strong> ${confidenceLevel}</div>
				<div><strong>🕐 Detected:</strong> ${detectedTime.toLocaleString()}</div>
				<div><strong>📌 Coordinates:</strong> (${alert.lat.toFixed(6)}, ${alert.lon.toFixed(6)})</div>
			</div>
			<div class="alert-meta">
				<span title="Detection ID">#${alert.id || 'N/A'}</span>
				<span>•</span>
				<span>${timeAgo}</span>
			</div>
			<div class="alert-actions">
				<button class="btn-primary btn-forward" data-alert-id="${alert.id}">
					<span>📧 Forward to WCCB</span>
				</button>
				<button class="btn-secondary btn-view-map" data-lat="${alert.lat}" data-lon="${alert.lon}">
					<span>🗺️ View on Map</span>
				</button>
			</div>
		</div>
	`;

	// Attach event listeners
	const forwardBtn = div.querySelector('.btn-forward');
	const mapBtn = div.querySelector('.btn-view-map');

	forwardBtn?.addEventListener('click', () => forwardToWCCB(alert));
	mapBtn?.addEventListener('click', () => viewOnMap(alert.lat, alert.lon));

	return div;
}

function filterAlerts(alerts) {
	let filtered = [...alerts];

	// Filter by species
	if (AppState.filters.species) {
		filtered = filtered.filter(a => 
			a.species.toLowerCase() === AppState.filters.species.toLowerCase()
		);
	}

	// Filter by time range
	if (AppState.filters.timeRange !== 'all') {
		const now = Date.now();
		const ranges = {
			'1h': 60 * 60 * 1000,
			'24h': 24 * 60 * 60 * 1000,
			'7d': 7 * 24 * 60 * 60 * 1000
		};
		const timeLimit = ranges[AppState.filters.timeRange];
		if (timeLimit) {
			filtered = filtered.filter(a => {
				const alertTime = new Date(a.detected_at).getTime();
				return (now - alertTime) <= timeLimit;
			});
		}
	}

	// Sort by distance (closest first)
	filtered.sort((a, b) => a.distance_km - b.distance_km);

	return filtered;
}

/* ===================================
   FORWARD TO WCCB
   =================================== */

async function forwardToWCCB(alert) {
	const lat = parseFloat($('#lat')?.value);
	const lon = parseFloat($('#lon')?.value);

	if (isNaN(lat) || isNaN(lon)) {
		showModal('Location Required', 'Please set your latitude and longitude in your profile before forwarding alerts.');
		return;
	}

	try {
		showToast('Looking up nearest WCCB office...', 'info');

		const res = await API(`/api/wccb?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
		const data = await res.json().catch(() => ({}));

		if (!res.ok) {
			throw new Error(data.error || 'Failed to lookup WCCB');
		}

		const center = data.nearest;
		if (!center || !center.email) {
			throw new Error('No WCCB contact found for your location');
		}

		// Compose email
		const subject = encodeURIComponent(
			`[URGENT] Wildlife Alert: ${alert.species} detected within ${alert.distance_km}km`
		);

		const body = encodeURIComponent(
`Dear ${center.name},

This is an automated alert from the Wild Animal Monitoring System (YOLOv8).

=== ALERT DETAILS ===
Species: ${alert.species}
Detection Confidence: ${alert.confidence || 'N/A'}%
Detection Time (UTC): ${alert.detected_at}
Detection Location: ${alert.lat.toFixed(6)}°N, ${alert.lon.toFixed(6)}°E

=== REPORTER DETAILS ===
User Location: ${lat.toFixed(6)}°N, ${lon.toFixed(6)}°E
Distance from Detection: ${alert.distance_km.toFixed(2)} km
Area Type: ${$('#area_type')?.value || 'Not specified'}
Contact: ${$('#phone')?.value || 'Not provided'}

=== RECOMMENDED ACTION ===
Please investigate this sighting and take appropriate action to ensure public safety and wildlife protection.

View on Google Maps: https://maps.google.com/?q=${alert.lat},${alert.lon}

---
This alert was generated by the Wild Animal Monitoring System.
For technical support, please contact: support@wildlifemonitor.example.com
`);

		// Open email client
		window.location.href = `mailto:${encodeURIComponent(center.email)}?subject=${subject}&body=${body}`;
		
		showToast(`Email prepared for ${center.name}`, 'success');
		notifyNative('Alert Forwarded', `Preparing email to ${center.name}`);

	} catch (err) {
		console.error('Forward to WCCB error:', err);
		showModal('Forward Failed', err.message || 'Unable to forward alert to WCCB. Please try again.');
	}
}

/* ===================================
   VIEW ON MAP
   =================================== */

function viewOnMap(lat, lon) {
	const url = `https://www.google.com/maps?q=${lat},${lon}&z=15`;
	window.open(url, '_blank', 'noopener,noreferrer');
	showToast('Opening location in Google Maps', 'info');
}

/* ===================================
   STATISTICS
   =================================== */

async function updateStats() {
	// Reset stats
	AppState.stats = {
		leopard: 0,
		tiger: 0,
		lion: 0,
		cheetah: 0
	};

	// Count from current alerts
	AppState.alerts.forEach(alert => {
		const species = alert.species.toLowerCase();
		if (AppState.stats.hasOwnProperty(species)) {
			AppState.stats[species]++;
		}
	});

	// Update UI
	$('#stat-leopard').textContent = AppState.stats.leopard;
	$('#stat-tiger').textContent = AppState.stats.tiger;
	$('#stat-lion').textContent = AppState.stats.lion;
	$('#stat-cheetah').textContent = AppState.stats.cheetah;
}

/* ===================================
   FILTER CONTROLS
   =================================== */

const filterSpecies = $('#filter-species');
const filterTime = $('#filter-time');

if (filterSpecies) {
	filterSpecies.addEventListener('change', (e) => {
		AppState.filters.species = e.target.value;
		renderAlerts();
		showToast('Filters applied', 'info', 1500);
	});
}

if (filterTime) {
	filterTime.addEventListener('change', (e) => {
		AppState.filters.timeRange = e.target.value;
		renderAlerts();
		showToast('Filters applied', 'info', 1500);
	});
}

/* ===================================
   REFRESH BUTTON
   =================================== */

const refreshBtn = $('#refresh-alerts');
if (refreshBtn) {
	refreshBtn.addEventListener('click', async () => {
		const originalHTML = refreshBtn.innerHTML;
		refreshBtn.innerHTML = '<span>🔄</span>';
		refreshBtn.disabled = true;
		
		await refreshAlerts();
		await updateStats();
		
		showToast('Alerts refreshed', 'success', 1500);
		
		setTimeout(() => {
			refreshBtn.innerHTML = originalHTML;
			refreshBtn.disabled = false;
		}, 1000);
	});
}

/* ===================================
   AUTO-REFRESH
   =================================== */

let autoRefreshInterval = null;

function startAutoRefresh() {
	// Clear existing interval
	if (autoRefreshInterval) {
		clearInterval(autoRefreshInterval);
	}

	// Refresh every 30 seconds
	autoRefreshInterval = setInterval(async () => {
		if (AppState.isAuthed) {
			await refreshAlerts();
			await updateStats();
		}
	}, 30000);
}

function stopAutoRefresh() {
	if (autoRefreshInterval) {
		clearInterval(autoRefreshInterval);
		autoRefreshInterval = null;
	}
}

// Stop auto-refresh when page is hidden
document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		stopAutoRefresh();
	} else if (AppState.isAuthed) {
		startAutoRefresh();
	}
});

/* ===================================
   TOAST NOTIFICATIONS
   =================================== */

function showToast(message, variant = 'info', duration = 3000) {
	// Remove existing toast
	const existingToast = $('.toast-container .toast');
	if (existingToast) {
		existingToast.remove();
	}

	// Create toast container if it doesn't exist
	let container = $('.toast-container');
	if (!container) {
		container = document.createElement('div');
		container.className = 'toast-container';
		document.body.appendChild(container);
	}

	// Create toast element
	const toast = document.createElement('div');
	toast.className = `toast toast-${variant}`;

	// Icon based on variant
	const icons = {
		success: '✓',
		error: '✗',
		warning: '⚠',
		info: 'ℹ'
	};

	toast.innerHTML = `
		<div class="toast-icon">${icons[variant] || 'ℹ'}</div>
		<div class="toast-content">
			<div class="toast-message">${message}</div>
		</div>
		<button class="toast-close" aria-label="Close">×</button>
	`;

	// Add to container
	container.appendChild(toast);

	// Close button handler
	const closeBtn = toast.querySelector('.toast-close');
	closeBtn?.addEventListener('click', () => {
		toast.style.animation = 'slideOutRight 0.3s ease-out';
		setTimeout(() => toast.remove(), 300);
	});

	// Auto-remove after duration
	setTimeout(() => {
		if (toast.parentElement) {
			toast.style.animation = 'slideOutRight 0.3s ease-out';
			setTimeout(() => toast.remove(), 300);
		}
	}, duration);
}

/* ===================================
   MODAL DIALOG
   =================================== */

function showModal(title, content, buttons = [{ text: 'OK', primary: true }]) {
	// Remove existing modal
	const existingModal = $('.modal-overlay');
	if (existingModal) {
		existingModal.remove();
	}

	// Create modal overlay
	const overlay = document.createElement('div');
	overlay.className = 'modal-overlay';

	// Create modal
	const modal = document.createElement('div');
	modal.className = 'modal';

	modal.innerHTML = `
		<div class="modal-header">
			<h3 class="modal-title">${title}</h3>
			<button class="toast-close" aria-label="Close">×</button>
		</div>
		<div class="modal-body">
			${content}
		</div>
		<div class="modal-footer">
			${buttons.map((btn, idx) => 
				`<button class="btn-${btn.primary ? 'primary' : 'secondary'}" data-action="${idx}">${btn.text}</button>`
			).join('')}
		</div>
	`;

	overlay.appendChild(modal);
	document.body.appendChild(overlay);

	// Close handlers
	const closeBtn = modal.querySelector('.toast-close');
	const actionBtns = modal.querySelectorAll('[data-action]');

	const closeModal = () => {
		overlay.style.animation = 'fadeOut 0.2s ease-out';
		setTimeout(() => overlay.remove(), 200);
	};

	closeBtn?.addEventListener('click', closeModal);
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) closeModal();
	});

	actionBtns.forEach((btn, idx) => {
		btn.addEventListener('click', () => {
			if (buttons[idx].callback) {
				buttons[idx].callback();
			}
			closeModal();
		});
	});

	// Escape key handler
	const escHandler = (e) => {
		if (e.key === 'Escape') {
			closeModal();
			document.removeEventListener('keydown', escHandler);
		}
	};
	document.addEventListener('keydown', escHandler);
}

/* ===================================
   WEB NOTIFICATIONS
   =================================== */

async function ensureNotificationPermission() {
	if (!('Notification' in window)) {
		console.warn('Notifications not supported');
		return false;
	}

	if (Notification.permission === 'granted') {
		return true;
	}

	if (Notification.permission !== 'denied') {
		try {
			const permission = await Notification.requestPermission();
			return permission === 'granted';
		} catch (err) {
			console.error('Notification permission error:', err);
			return false;
		}
	}

	return false;
}

async function notifyNative(title, body, options = {}) {
	if (!('Notification' in window)) return;

	const hasPermission = await ensureNotificationPermission();
	if (!hasPermission) return;

	try {
		const notification = new Notification(title, {
			body,
			icon: '/static/icon.png',
			badge: '/static/badge.png',
			tag: 'wildlife-monitor',
			requireInteraction: options.requireInteraction || false,
			...options
		});

		notification.onclick = () => {
			window.focus();
			notification.close();
		};

		return notification;
	} catch (err) {
		console.error('Native notification error:', err);
	}
}

/* ===================================
   UTILITY FUNCTIONS
   =================================== */

function isValidEmail(email) {
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return re.test(email);
}

function getTimeAgo(date) {
	const seconds = Math.floor((new Date() - date) / 1000);
	
	const intervals = {
		year: 31536000,
		month: 2592000,
		week: 604800,
		day: 86400,
		hour: 3600,
		minute: 60,
		second: 1
	};

	for (const [unit, secondsInUnit] of Object.entries(intervals)) {
		const interval = Math.floor(seconds / secondsInUnit);
		if (interval >= 1) {
			return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
		}
	}

	return 'Just now';
}

function getSpeciesEmoji(species) {
	const emojis = {
		'leopard': '🐆',
		'tiger': '🐅',
		'lion': '🦁',
		'cheetah': '🐆'
	};
	return emojis[species.toLowerCase()] || '🐾';
}

function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

function throttle(func, limit) {
	let inThrottle;
	return function(...args) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

/* ===================================
   KEYBOARD SHORTCUTS
   =================================== */

document.addEventListener('keydown', (e) => {
	// Ctrl/Cmd + K: Focus search/filter
	if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
		e.preventDefault();
		$('#filter-species')?.focus();
	}

	// Ctrl/Cmd + R: Refresh alerts
	if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
		e.preventDefault();
		refreshBtn?.click();
	}

	// Escape: Clear filters
	if (e.key === 'Escape' && !$('.modal-overlay')) {
		if (AppState.filters.species || AppState.filters.timeRange !== 'all') {
			AppState.filters.species = '';
			AppState.filters.timeRange = 'all';
			if (filterSpecies) filterSpecies.value = '';
			if (filterTime) filterTime.value = 'all';
			renderAlerts();
			showToast('Filters cleared', 'info', 1500);
		}
	}
});

/* ===================================
   FORM VALIDATION HELPERS
   =================================== */

function addInputValidation(inputId, validationFn, errorMsg) {
	const input = $(inputId);
	if (!input) return;

	input.addEventListener('blur', () => {
		const value = input.value.trim();
		if (value && !validationFn(value)) {
			input.classList.add('error');
			showTooltip(input, errorMsg);
		} else {
			input.classList.remove('error');
			hideTooltip(input);
		}
	});

	input.addEventListener('input', () => {
		input.classList.remove('error');
		hideTooltip(input);
	});
}

function showTooltip(element, message) {
	element.setAttribute('data-tooltip', message);
	element.classList.add('has-tooltip');
}

function hideTooltip(element) {
	element.removeAttribute('data-tooltip');
	element.classList.remove('has-tooltip');
}

/* ===================================
   NETWORK STATUS MONITORING
   =================================== */

window.addEventListener('online', () => {
	showToast('Connection restored', 'success');
	if (AppState.isAuthed) {
		refreshAlerts();
		updateStats();
	}
});

window.addEventListener('offline', () => {
	showToast('You are offline. Some features may not work.', 'warning', 5000);
});

/* ===================================
   ERROR BOUNDARY
   =================================== */

window.addEventListener('error', (event) => {
	console.error('Global error:', event.error);
	showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
	console.error('Unhandled promise rejection:', event.reason);
	showToast('An unexpected error occurred', 'error');
	event.preventDefault();
});

/* ===================================
   PAGE VISIBILITY & LIFECYCLE
   =================================== */

let wasHidden = false;

document.addEventListener('visibilitychange', async () => {
	if (!document.hidden && wasHidden && AppState.isAuthed) {
		// Page became visible again - refresh data
		await refreshAlerts();
		await updateStats();
	}
	wasHidden = document.hidden;
});

// Before page unload
window.addEventListener('beforeunload', (e) => {
	// Stop auto-refresh
	stopAutoRefresh();
	
	// If there are unsaved changes in forms, warn user
	const hasUnsavedChanges = checkUnsavedChanges();
	if (hasUnsavedChanges) {
		e.preventDefault();
		e.returnValue = '';
	}
});

function checkUnsavedChanges() {
	// Check if profile form has unsaved changes
	// This is a simple check - implement more sophisticated logic as needed
	return false;
}

/* ===================================
   ACCESSIBILITY ENHANCEMENTS
   =================================== */

// Skip to main content link
const skipLink = document.createElement('a');
skipLink.href = '#alerts-section';
skipLink.className = 'sr-only';
skipLink.textContent = 'Skip to main content';
skipLink.addEventListener('click', (e) => {
	e.preventDefault();
	$('#alerts-section')?.focus();
	$('#alerts-section')?.scrollIntoView({ behavior: 'smooth' });
});
document.body.insertBefore(skipLink, document.body.firstChild);

// Announce alerts to screen readers
function announceToScreenReader(message) {
	const announcement = document.createElement('div');
	announcement.className = 'sr-only';
	announcement.setAttribute('role', 'status');
	announcement.setAttribute('aria-live', 'polite');
	announcement.textContent = message;
	document.body.appendChild(announcement);
	
	setTimeout(() => announcement.remove(), 1000);
}

/* ===================================
   PERFORMANCE MONITORING
   =================================== */

// Log page load time
window.addEventListener('load', () => {
	if (window.performance && window.performance.timing) {
		const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
		console.log(`Page loaded in ${loadTime}ms`);
	}
});

/* ===================================
   FEATURE DETECTION
   =================================== */

function checkBrowserSupport() {
	const features = {
		geolocation: 'geolocation' in navigator,
		notifications: 'Notification' in window,
		serviceWorker: 'serviceWorker' in navigator,
		localStorage: typeof Storage !== 'undefined'
	};

	console.log('Browser features:', features);

	if (!features.geolocation) {
		console.warn('Geolocation not supported');
	}

	if (!features.notifications) {
		console.warn('Notifications not supported');
	}

	return features;
}

/* ===================================
   COPY TO CLIPBOARD
   =================================== */

async function copyToClipboard(text) {
	try {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			await navigator.clipboard.writeText(text);
			showToast('Copied to clipboard', 'success', 1500);
		} else {
			// Fallback for older browsers
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			showToast('Copied to clipboard', 'success', 1500);
		}
	} catch (err) {
		console.error('Copy failed:', err);
		showToast('Failed to copy', 'error');
	}
}

/* ===================================
   EXPORT ALERTS DATA
   =================================== */

function exportAlertsToCSV() {
	if (AppState.alerts.length === 0) {
		showToast('No alerts to export', 'warning');
		return;
	}

	const headers = ['ID', 'Species', 'Date', 'Time', 'Latitude', 'Longitude', 'Distance (km)', 'Confidence'];
	const rows = AppState.alerts.map(alert => {
		const date = new Date(alert.detected_at);
		return [
			alert.id || 'N/A',
			alert.species,
			date.toLocaleDateString(),
			date.toLocaleTimeString(),
			alert.lat.toFixed(6),
			alert.lon.toFixed(6),
			alert.distance_km.toFixed(2),
			alert.confidence || 'N/A'
		];
	});

	const csvContent = [
		headers.join(','),
		...rows.map(row => row.join(','))
	].join('\n');

	const blob = new Blob([csvContent], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `wildlife-alerts-${new Date().toISOString().split('T')[0]}.csv`;
	link.click();
	URL.revokeObjectURL(url);

	showToast('Alerts exported to CSV', 'success');
}

/* ===================================
   ADD CSS FOR SUCCESS FLASH ANIMATION
   =================================== */

// Add dynamic styles for input success flash
const style = document.createElement('style');
style.textContent = `
	.success-flash {
		animation: successFlash 0.5s ease-out;
	}

	@keyframes successFlash {
		0% { background-color: #d1fae5; }
		100% { background-color: transparent; }
	}

	@keyframes fadeOut {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@keyframes slideOutRight {
		from {
			transform: translateX(0);
			opacity: 1;
		}
		to {
			transform: translateX(100%);
			opacity: 0;
		}
	}

	.has-tooltip {
		position: relative;
	}

	input.error,
	select.error,
	textarea.error {
		border-color: var(--danger) !important;
		animation: shake 0.3s ease-in-out;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-5px); }
		75% { transform: translateX(5px); }
	}

	.btn-primary:disabled,
	.btn-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		pointer-events: none;
	}
`;
document.head.appendChild(style);

/* ===================================
   INITIALIZATION
   =================================== */

// Initialize app
async function initApp() {
	console.log('🐾 Wild Animal Monitoring System initialized');
	
	// Check browser support
	checkBrowserSupport();
	
	// Request notification permission on first visit
	if (localStorage.getItem('notificationPrompted') !== 'true') {
		setTimeout(async () => {
			const granted = await ensureNotificationPermission();
			if (granted) {
				showToast('Notifications enabled! You\'ll receive real-time alerts.', 'success', 4000);
			}
			localStorage.setItem('notificationPrompted', 'true');
		}, 3000);
	}
	
	// Load user session
	await loadMe();
	
	// Add upload section to demo/mock section
	setTimeout(() => {
		addUploadSection();
	}, 500);
	
	// Check network status
	if (!navigator.onLine) {
		showToast('You appear to be offline', 'warning');
	}
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initApp);
} else {
	initApp();
}

/* ===================================
   CONSOLE EASTER EGG
   =================================== */

console.log(`
%c🐾 Wild Animal Monitoring System
%cPowered by YOLOv8 Deep Learning
%c
Found a bug? Have suggestions? 
Email: support@wildlifemonitor.example.com

%cKeyboard Shortcuts:
• Ctrl/Cmd + K: Focus filters
• Ctrl/Cmd + R: Refresh alerts  
• Escape: Clear filters
`,
'color: #2d5016; font-size: 20px; font-weight: bold;',
'color: #f59e0b; font-size: 14px;',
'color: #6b7280; font-size: 12px;',
'color: #374151; font-size: 12px; font-family: monospace;'
);

/* ===================================
   EXPORT FOR TESTING
   =================================== */

// Expose utilities for debugging (remove in production)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
	window.WildlifeMonitor = {
		state: AppState,
		refreshAlerts,
		updateStats,
		showToast,
		showModal,
		exportAlertsToCSV,
		copyToClipboard
	};
	console.log('Debug utilities available at window.WildlifeMonitor');
}