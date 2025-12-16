@echo off
echo ================================================
echo  Wild Animal Monitoring System - Starting...
echo ================================================
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
    echo.
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate
echo.

REM Install/Update dependencies
echo Checking dependencies...
pip install -r requirements.txt --quiet
echo.

REM Check if model exists
if not exist "backend\models\best.pt" (
    echo WARNING: Model file not found at backend\models\best.pt
    echo The system will use a fallback model.
    echo Please place your trained model in backend\models\best.pt
    echo.
    pause
)

REM Create required directories
if not exist "backend\models\" mkdir backend\models
if not exist "backend\utils\" mkdir backend\utils
if not exist "backend\logs\" mkdir backend\logs
if not exist "uploads\" mkdir uploads
if not exist "static\" mkdir static
if not exist "templates\" mkdir templates

echo ================================================
echo  Starting Flask server...
echo  Access the app at: http://localhost:5000
echo ================================================
echo.
echo Press Ctrl+C to stop the server
echo.

REM Run the application
python app.py

pause