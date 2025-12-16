WILD WATCH

WILD WATCH a YOLOv8-based wild animal monitoring project (Leopard, Tiger, Lion, Cheetah). Includes:
- Intro section with left-side Login/Signup
- SQLite-backed authentication and profiles (occupation, address, area type)
- Alert settings with user location and radius
- Alerts list when detections occur within radius
- Forward-to-WCCB via pre-filled email (mailto)
- Mock detection endpoint to simulate detections

## Prerequisites
- Python 3.10+
- Windows PowerShell (this guide uses it)

## Setup
```powershell
cd C:\Users\Nikita\Downloads\Minor_Project_Frontend
python -m venv .venv
. .venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
$env:FLASK_APP = "backend/app.py"
python backend/app.py
```
The app runs at http://localhost:5000/

## Usage
1. Open the site. Use the left card to Sign up (creates user in SQLite) or Login.
2. Fill your profile (occupation, address) and set your latitude, longitude, and alert radius.
3. Use the demo section to create a mock detection near your coordinates to see alerts.
4. Click "Forward to WCCB" on an alert to open your email client with prefilled details for the nearest center.

## Connecting YOLOv8
- Replace the `/api/mock_detection` calls with your YOLO pipeline posting to the same endpoint:
```http
POST /api/mock_detection
Content-Type: application/json
{
  "species": "Leopard", "lat": 19.1, "lon": 72.9
}
```
On each detection, the server will create alerts for users within their configured radius.

## Notes
- SQLite file is created at `backend/app.db`.
- For production, set `SECRET_KEY` env var. Consider moving to a proper DB and adding HTTPS.

