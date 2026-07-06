# MindSense

MindSense is a Vite, React, and TypeScript mental wellness application backed by Supabase Auth, Postgres, Storage, Row Level Security policies, and SQL RPC functions.

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, shadcn/Radix UI
- Backend: Supabase Auth, PostgREST, Storage, SQL functions
- Database: Supabase Postgres migrations in `supabase/migrations`
- Tests: Vitest with jsdom

## Environment

Create `.env` from `.env.example` and fill in the values from Supabase Project Settings > API:

```env
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-or-anon-key"
VITE_ML_API_URL="http://127.0.0.1:8000"
```

Use the publishable or anon key only. Do not put a Supabase service role key in frontend environment variables.

`VITE_ML_API_URL` is optional during normal frontend development. If it is omitted, the depression test uses a questionnaire-only PHQ baseline while the learned Python model service is not running.

## Run Locally

```powershell
npm install
npm run dev
```

The Vite dev server uses port `8080` by default:

```text
http://localhost:8080
```

## Validate

```powershell
npm run lint
npm run test
npm run build
npm audit
```

## Final Demo / Production Setup

Frontend:

```powershell
npm install
npm run dev
```

Supabase:

```powershell
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
npx supabase migration list --linked
```

ML API:

```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python predict_api.py --host 127.0.0.1 --port 8000
```

Media tools:

```powershell
winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
$env:MINDSENSE_OPENFACE_BIN="C:\Tools\OpenFace\FeatureExtraction.exe"
```

Required `.env`:

```env
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-or-anon-key"
VITE_ML_API_URL="http://127.0.0.1:8000"
```

Optional ML API safety settings:

```powershell
$env:MINDSENSE_MAX_MEDIA_BYTES="104857600"
$env:MINDSENSE_MEDIA_DOWNLOAD_TIMEOUT_SECONDS="30"
$env:MINDSENSE_MEDIA_COMMAND_TIMEOUT_SECONDS="180"
```

Local media file paths are blocked by default in `/predict-from-media`. Enable them only for trusted local testing:

```powershell
$env:MINDSENSE_ALLOW_LOCAL_MEDIA_PATHS="true"
```

Optional Urdu/English speech transcript support:

```powershell
$env:MINDSENSE_ENABLE_AUDIO_TRANSCRIPT="true"
$env:MINDSENSE_WHISPER_MODEL="base"
$env:MINDSENSE_WHISPER_TASK="translate"
```

The audio pipeline always extracts acoustic features. When `faster-whisper` is installed, the same audio is also transcribed/translated into English and appended to the model text context. This helps Urdu and English speech contribute semantic information without retraining the model.

## Supabase Setup

If a resumed or newly linked Supabase project is reachable but app tables return `PGRST205`, the database schema has not been applied to that project. Link the CLI and push migrations:

```powershell
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
npx supabase migration list --linked
```

The local Supabase project ref is stored in `supabase/config.toml`. Keep it aligned with `VITE_SUPABASE_PROJECT_ID`.

## Learned Multimodal Model

Training code lives in `ml/`. Keep DAIC-WOZ data outside this repo and train from a participant-level manifest:

```text
participant_id,split,phq_score,transcript_path,audio_features_path,video_features_path
```

The model predicts continuous PHQ-8 score with learned gated fusion over text, audio, and video encoders. The old fixed 50/25/25-style fusion is not used in the assessment flow.

```powershell
cd ml
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python predict_api.py
```

The selected local artifact is:

```text
ml/artifacts/mindsense_roberta_gated_tuned_v2/best_model.pt
```

It was selected after comparing gated fusion, cross-modal fusion, tuned gated fusion, and text-only baseline runs. Current test metrics:

```text
MAE: 5.396
RMSE: 6.654
F1 macro: 0.124
Correlation: 0.064
```

The trained API requires OpenSMILE audio features and OpenFace video features. Browser `.webm` recordings must be converted into those feature files before true learned-model inference. Until that feature extraction service is connected, the website falls back to the questionnaire PHQ baseline when `/predict` reports `FEATURE_EXTRACTION_REQUIRED`.

Manual browser smoke check before submission:

```text
1. Sign in.
2. Complete the depression test.
3. Confirm voice/video uploads succeed.
4. Confirm the ML API returns a prediction or the app shows the questionnaire baseline fallback.
5. Confirm result rows are saved in depression_tests, model_predictions, and results.
6. Open History and Admin Dashboard.
7. Print/export the report.
```
