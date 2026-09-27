# CAPSTONE Setup Guide (Windows + macOS)

This guide sets up the full CAPSTONE system: frontend (React), backend (Node/Express), database (MySQL via XAMPP), and Python processing.

## 1. Prerequisites

Install these first:

- Node.js 18+ with npm
- Python 3.10+ with pip
- XAMPP (MySQL and phpMyAdmin)
- ffmpeg (required for audio/video processing)
- Gemini API key

Optional:

- OpenAI API key (used by backend/gpt.js)

Platform install hints:

1. macOS (Homebrew)

```bash
brew install python ffmpeg
```

2. Windows

- Install Python from python.org (check Add Python to PATH)
- Install ffmpeg and add it to PATH

## 2. Clone or Open the Project

Use the CAPSTONE project root as working directory.

1. macOS terminal

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/CAPSTONE
```

2. Windows PowerShell

```powershell
cd C:\xampp\htdocs\CAPSTONE
```

## 3. Set Up Database

1. Start XAMPP and ensure MySQL is running.
2. Open phpMyAdmin.
3. Create a database named py_project (or import and let SQL create it).
4. Import [backend/py_project.sql](backend/py_project.sql).

Expected tables include tbl_account, tbl_account_details, saved_videos, and action_plan_tasks.

## 4. Configure Environment Variables

Create [backend/.env](backend/.env) and add:

```env
PORT=8800
CLIENT_URL=http://localhost:3000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=py_project

JWT_SECRET=replace_with_long_random_secret
JWT_REFRESH_SECRET=replace_with_another_long_random_secret

GEMINI_API_KEY=your_gemini_api_key

# Optional
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
```

## 5. Install Node Dependencies

1. Backend

```bash
cd backend
npm install
```

2. Client

```bash
cd ../client
npm install
```

## 6. Create and Activate Python Virtual Environment

Run from the project root.

1. macOS terminal

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

2. Windows PowerShell

```powershell
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

3. Windows Command Prompt

```cmd
py -m venv venv
venv\Scripts\activate.bat
pip install -r backend/requirements.txt
```

## 7. Confirm Backend and Client Ports

- Backend default port is 8800 (from .env).
- Client uses http://localhost:3000.

Check frontend API URL in [client/src/components/config/LocalConfigApi.jsx](client/src/components/config/LocalConfigApi.jsx):

```js
export const ApiConfig = {
    apiURL: 'http://localhost:8800'
}
```

## 8. Run the App (Two Terminals)

Keep MySQL running in XAMPP.

1. Terminal A: backend

macOS:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/CAPSTONE
source venv/bin/activate
cd backend
npm run dev
```

Windows PowerShell:

```powershell
cd C:\xampp\htdocs\CAPSTONE
.\venv\Scripts\Activate.ps1
cd backend
npm run dev
```

2. Terminal B: client

macOS:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/CAPSTONE/client
npm start
```

Windows PowerShell:

```powershell
cd C:\xampp\htdocs\CAPSTONE\client
npm start
```

## 9. Open the System

- Frontend: http://localhost:3000
- Backend: http://localhost:8800

## 10. Quick Verification Checklist

- Backend logs show database connection success.
- Signup/login works and data persists in MySQL.
- Video upload works.
- Analysis endpoint returns JSON response.

## Troubleshooting

### ffmpeg not found

Install ffmpeg and ensure it is in PATH, then restart terminal.

### No API key found

Set GEMINI_API_KEY in backend/.env and restart backend.

### Database connection failed

Verify DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in backend/.env and ensure MySQL is running.

### python or python3 command not found

- On macOS, use python3.
- On Windows, use py.
- Ensure Python is added to PATH.

### PowerShell script execution blocked

Run PowerShell as Administrator once and allow local scripts:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
