# ThoracicAI — Production SaaS Deployment Guide

This guide details the step-by-step production deployment procedure for the **ThoracicAI — Secure CT Research & Classification Platform**.

---

## Architecture Overview

```
                                      ┌─────────────────────────────────┐
                                      │        Client Browser           │
                                      │  React 19 + TypeScript + Vite   │
                                      └────────────────┬────────────────┘
                                                       │ HTTPS (JWT)
                                                       ▼
                            ┌─────────────────────────────────────────────────────┐
                            │                    Vercel Edge                      │
                            │              (SPA Hosting & Routing)                │
                            └──────────────────────────┬──────────────────────────┘
                                                       │ /api/* Rewrites
                                                       ▼
┌─────────────────────────────────┐ HTTPS (JWT) ┌─────────────────────────────────┐
│          Supabase               │◄───────────►│          Render Cloud           │
│ • Supabase Auth (JWT)           │             │ • Render Docker Web Service     │
│ • PostgreSQL 16 + RLS Policies  │             │ • FastAPI + Uvicorn Async       │
│ • Private Encrypted Storage     │             │ • PyTorch DenseNet121 Inference │
└─────────────────────────────────┘             │ • ReportLab PDF Engine          │
                                                └─────────────────────────────────┘
```

---

## 1. Database & Authentication Setup (Supabase)

1. Log in to [Supabase Console](https://app.supabase.com) and create a new project:
   - Project Name: `thoracicai-platform`
   - Region: Select nearest geographic region (e.g. `us-east-1` or `eu-west-1`).
2. Navigate to **SQL Editor** in the Supabase dashboard.
3. Open `migrations/001_initial_schema.sql` from this repository and run the script. This creates:
   - `profiles` table linked to `auth.users` via trigger
   - `workspaces` & `workspace_members` tables
   - `cases` & `case_slices` tables
   - `reports` table
   - `audit_events` immutable logging table
   - Strict Row Level Security (RLS) policies for user isolation
4. Navigate to **Storage**:
   - Create a private bucket named `reports`.
   - Set **Public Bucket** to `False` (Short-lived signed URLs only).
5. Retrieve your project API credentials under **Project Settings > API**:
   - `Project URL` (`SUPABASE_URL`)
   - `anon public` key (`SUPABASE_ANON_KEY`)
   - `service_role secret` key (`SUPABASE_SERVICE_ROLE_KEY`)
   - `JWT Secret` (`SUPABASE_JWT_SECRET`)
   - Database Connection URI under **Database > Connection string > URI** (`DATABASE_URL`).

---

## 2. Backend Deployment (Render Docker Web Service)

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your Git repository.
3. Configure the service settings:
   - **Environment**: `Docker`
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Docker Context**: `./backend`
   - **Instance Type**: `Standard` (at least 2 GB RAM recommended for PyTorch models).
4. Set Environment Variables:
   ```env
   PORT=8000
   ENVIRONMENT=production
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres
   SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
   SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
   SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
   SUPABASE_JWT_SECRET=[YOUR-JWT-SECRET]
   CORS_ORIGINS=["https://thoracicai.vercel.app","http://localhost:5173"]
   ```
5. Deploy service. Once deployed, verify health at:
   `https://[YOUR-RENDER-APP].onrender.com/api/health`

---

## 3. Frontend Deployment (Vercel)

1. Import repository into [Vercel](https://vercel.com).
2. Set Root Directory to `frontend`.
3. Framework Preset: `Vite`.
4. Configure Build & Output Settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Configure Environment Variables in Vercel:
   ```env
   VITE_SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
   VITE_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
   ```
6. Update the API destination in `frontend/vercel.json` with your actual Render backend URL.
7. Deploy. Your platform is now live!

---

## 4. Local Development with Docker Compose

To run the complete full-stack platform locally with isolated PostgreSQL:

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API & Swagger Docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

---

## 5. Security & Governance Verification

- **Zero PHI Storage**: Raw CT image files are never stored to disk or cloud; inference is performed strictly in-memory.
- **Row Level Security**: Users can only query and mutate cases and reports associated with their account.
- **Audit Trails**: Every login, case creation, status change, and report generation is cryptographically logged in `audit_events`.
