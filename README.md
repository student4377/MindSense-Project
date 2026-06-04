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
