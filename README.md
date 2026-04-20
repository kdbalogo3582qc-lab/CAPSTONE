# CAPSTONE Setup Guide (Client + Backend + Python)

This document explains how to set up the full CAPSTONE system from scratch.

## 1. Prerequisites

Install the following before starting:

- Node.js 18+ and npm
- Python 3.10+ (with pip)
- XAMPP (MySQL and phpMyAdmin)
- ffmpeg (required for audio/video processing)
- A Gemini API key

Optional:

- OpenAI API key (used by `backend/gpt.js`)

### macOS helpers

```bash
brew install ffmpeg
brew install python
```

## 2. Open Project Root

From terminal, go to the CAPSTONE root folder:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/CAPSTONE
```

## 3. Set Up Database

1. Start XAMPP and make sure MySQL is running.
2. Open phpMyAdmin.
3. Create a database named `py_project` (or use the one from import).
4. Import `backend/py_project.sql` into that database.

This creates the required tables such as `tbl_account`, `saved_videos`, and `action_plan_tasks`.

## 4. Create Backend Environment File

Create `backend/.env` and set these values:

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

## 5. Install Backend Dependencies

```bash
cd backend
npm install
```

## 6. Set Up Python Environment

From project root:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/CAPSTONE
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

Important:

- `backend/index.js` uses `python3` for main analysis.
- `backend/train_routes.js` uses `python` for model training.
- Ensure both `python3` and `python` commands are available in your terminal.

## 7. Install Client Dependencies

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/CAPSTONE/client
npm install
```

## 8. Confirm Frontend API URL

Verify API base URL in `client/src/components/config/LocalConfigApi.jsx`:

```js
export const ApiConfig = {
	apiURL: 'http://localhost:8800'
}
```

## 9. Run the System

Use two terminals.

Terminal 1 (backend):

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/CAPSTONE
source venv/bin/activate
cd backend
npm run dev
```

Terminal 2 (client):

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/CAPSTONE/client
npm start
```

## 10. Access the App

- Client: http://localhost:3000
- Backend: http://localhost:8800

## 11. Quick Verification Checklist

- Backend terminal shows database connected.
- Uploading video works without Python errors.
- Transcription/analysis returns JSON result.
- Login/signup flows can read and write to MySQL.

## Troubleshooting

### Error: ffmpeg not found

Install ffmpeg and restart terminal.

### Error: No API key found

Add `GEMINI_API_KEY` in `backend/.env` and restart backend.

### Error: DB connection failed

Check `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `backend/.env`, and verify MySQL is running in XAMPP.

### Error: python command not found during training

Install Python so `python` is available, or update the spawn command in `backend/train_routes.js` to use `python3`.
