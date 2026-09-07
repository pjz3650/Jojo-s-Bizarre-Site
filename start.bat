@echo off
setlocal
cd /d "%~dp0"

if not exist venv\Scripts\python.exe (
    echo Criando ambiente virtual...
    python -m venv venv
    if errorlevel 1 exit /b 1
)

call venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo.
echo JoJo Team Builder disponivel em http://127.0.0.1:5000
python app.py
