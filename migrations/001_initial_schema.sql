-- ============================================================
-- THORACICAI — SUPABASE POSTGRESQL PRODUCTION MIGRATION
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE
-- Mirrors Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL DEFAULT 'Researcher',
    role TEXT NOT NULL DEFAULT 'RESEARCHER' CHECK (role IN ('ADMIN', 'RESEARCHER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);

-- 4. WORKSPACE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- 5. CASES TABLE
CREATE TABLE IF NOT EXISTS public.cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_reference TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    dataset TEXT NOT NULL CHECK (dataset IN ('cancer', 'covid')),
    status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Draft', 'Queued', 'Processing', 'Completed', 'Failed', 'Report pending', 'Report completed')),
    model_architecture TEXT NOT NULL DEFAULT 'DenseNet121',
    model_version TEXT NOT NULL DEFAULT '1.0.0',
    number_of_slices INTEGER NOT NULL DEFAULT 0,
    predicted_class TEXT,
    mean_scores JSONB,
    inference_duration_ms INTEGER,
    error_message TEXT,
    is_single_slice BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_cases_owner ON public.cases(owner_id);
CREATE INDEX IF NOT EXISTS idx_cases_ref ON public.cases(case_reference);
CREATE INDEX IF NOT EXISTS idx_cases_dataset ON public.cases(dataset);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases(created_at DESC);

-- 6. CASE SLICES TABLE
CREATE TABLE IF NOT EXISTS public.case_slices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    slice_index INTEGER NOT NULL,
    filename TEXT NOT NULL,
    predicted_class TEXT NOT NULL,
    class_scores JSONB NOT NULL,
    UNIQUE(case_id, slice_index)
);

CREATE INDEX IF NOT EXISTS idx_case_slices_case_id ON public.case_slices(case_id);

-- 7. REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_format TEXT NOT NULL CHECK (report_format IN ('PDF', 'CSV', 'JSON')),
    storage_path TEXT NOT NULL,
    generation_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (generation_status IN ('PENDING', 'COMPLETED', 'FAILED')),
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_reports_owner ON public.reports(owner_id);
CREATE INDEX IF NOT EXISTS idx_reports_case ON public.reports(case_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- 8. AUDIT EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    request_id TEXT,
    ip_address TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_events(timestamp DESC);

-- 9. AUTOMATIC PROFILE PROVISIONING TRIGGER FROM AUTH.USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
        'RESEARCHER'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_slices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own or public directory, update only their own
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Cases: strict user isolation
CREATE POLICY "Users can view own cases"
    ON public.cases FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own cases"
    ON public.cases FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own cases"
    ON public.cases FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own cases"
    ON public.cases FOR DELETE
    USING (auth.uid() = owner_id);

-- Case Slices: accessible if user owns parent case
CREATE POLICY "Users can view own case slices"
    ON public.case_slices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.cases
            WHERE public.cases.id = public.case_slices.case_id
            AND public.cases.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own case slices"
    ON public.case_slices FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.cases
            WHERE public.cases.id = public.case_slices.case_id
            AND public.cases.owner_id = auth.uid()
        )
    );

-- Reports: strict user isolation
CREATE POLICY "Users can view own reports"
    ON public.reports FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own reports"
    ON public.reports FOR DELETE
    USING (auth.uid() = owner_id);

-- Audit Events: Users can insert audit events or view their own
CREATE POLICY "Users can view own audit events"
    ON public.audit_events FOR SELECT
    USING (auth.uid() = actor_id);

CREATE POLICY "Users can insert audit events"
    ON public.audit_events FOR INSERT
    WITH CHECK (auth.uid() = actor_id);
