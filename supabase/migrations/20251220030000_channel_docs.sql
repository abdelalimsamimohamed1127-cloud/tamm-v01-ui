-- Channel documentation core tables
CREATE TABLE public.channel_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, channel_key)
);

CREATE TABLE public.channel_doc_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES public.channel_docs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  lang_code TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(doc_id, version, lang_code)
);

CREATE TABLE public.channel_doc_permissions (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  role TEXT NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT false,
  can_write BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (workspace_id, channel_key, role)
);

CREATE TABLE public.channel_doc_languages (
  channel_doc_id UUID NOT NULL REFERENCES public.channel_docs(id) ON DELETE CASCADE,
  lang_code TEXT NOT NULL,
  PRIMARY KEY (channel_doc_id, lang_code)
);

CREATE TABLE public.channel_doc_language_permissions (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  lang_code TEXT NOT NULL,
  role TEXT NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT false,
  can_write BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (workspace_id, channel_key, lang_code, role)
);

CREATE TABLE public.channel_doc_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  lang_code TEXT,
  action TEXT NOT NULL CHECK (action IN ('read', 'draft', 'publish')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS enablement
ALTER TABLE public.channel_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_doc_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_doc_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_doc_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_doc_language_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_doc_audit_logs ENABLE ROW LEVEL SECURITY;

-- Permission helpers
CREATE OR REPLACE FUNCTION public.has_channel_permission(p_workspace_id uuid, p_channel_key text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.owner_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.channel_doc_permissions p
    WHERE p.workspace_id = p_workspace_id
      AND p.channel_key = p_channel_key
      AND p.role = v_role
      AND (
        (p_action = 'read' AND p.can_read)
        OR (p_action = 'write' AND p.can_write)
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_channel_language_permission(p_workspace_id uuid, p_channel_key text, p_lang_code text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.owner_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.channel_doc_language_permissions lp
    WHERE lp.workspace_id = p_workspace_id
      AND lp.channel_key = p_channel_key
      AND lp.lang_code = p_lang_code
      AND lp.role = v_role
      AND (
        (p_action = 'read' AND lp.can_read)
        OR (p_action = 'write' AND lp.can_write)
      )
  )
  AND public.has_channel_permission(p_workspace_id, p_channel_key, p_action);
END;
$$;

-- Audit logging helper
CREATE OR REPLACE FUNCTION public.log_channel_doc_action(p_user_id uuid, p_workspace_id uuid, p_channel_key text, p_lang_code text, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.channel_doc_audit_logs (user_id, workspace_id, channel_key, lang_code, action)
  VALUES (p_user_id, p_workspace_id, p_channel_key, p_lang_code, p_action);
END;
$$;

-- Reader helpers (log reads)
CREATE OR REPLACE FUNCTION public.get_published_channel_doc(p_workspace_id uuid, p_channel_key text, p_lang_code text)
RETURNS TABLE (
  doc_id uuid,
  channel_key text,
  version integer,
  lang_code text,
  title text,
  content_md text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT v.doc_id, d.channel_key, v.version, v.lang_code, v.title, v.content_md, v.status, v.created_at
  FROM public.channel_doc_versions v
  JOIN public.channel_docs d ON d.id = v.doc_id
  WHERE d.workspace_id = p_workspace_id
    AND d.channel_key = p_channel_key
    AND v.lang_code = p_lang_code
    AND v.status = 'published'
    AND public.has_channel_language_permission(d.workspace_id, d.channel_key, v.lang_code, 'read')
  ORDER BY v.version DESC
  LIMIT 1;

  IF FOUND THEN
    PERFORM public.log_channel_doc_action(auth.uid(), p_workspace_id, p_channel_key, p_lang_code, 'read');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_channel_doc_version(p_workspace_id uuid, p_channel_key text, p_lang_code text)
RETURNS TABLE (
  doc_id uuid,
  channel_key text,
  version integer,
  lang_code text,
  title text,
  content_md text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT v.doc_id, d.channel_key, v.version, v.lang_code, v.title, v.content_md, v.status, v.created_at
  FROM public.channel_doc_versions v
  JOIN public.channel_docs d ON d.id = v.doc_id
  WHERE d.workspace_id = p_workspace_id
    AND d.channel_key = p_channel_key
    AND v.lang_code = p_lang_code
    AND (
      (v.status = 'published' AND public.has_channel_language_permission(d.workspace_id, d.channel_key, v.lang_code, 'read'))
      OR (v.status = 'draft' AND public.has_channel_language_permission(d.workspace_id, d.channel_key, v.lang_code, 'write'))
    )
  ORDER BY v.version DESC
  LIMIT 1;

  IF FOUND THEN
    PERFORM public.log_channel_doc_action(auth.uid(), p_workspace_id, p_channel_key, p_lang_code, 'read');
  END IF;
END;
$$;

-- Trigger to log drafts and publishes
CREATE OR REPLACE FUNCTION public.log_channel_doc_version_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc public.channel_docs;
BEGIN
  SELECT * INTO v_doc FROM public.channel_docs d WHERE d.id = NEW.doc_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'draft' THEN
    PERFORM public.log_channel_doc_action(COALESCE(auth.uid(), NEW.created_by), v_doc.workspace_id, v_doc.channel_key, NEW.lang_code, 'draft');
  ELSIF NEW.status = 'published' THEN
    PERFORM public.log_channel_doc_action(COALESCE(auth.uid(), NEW.created_by), v_doc.workspace_id, v_doc.channel_key, NEW.lang_code, 'publish');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER channel_doc_versions_audit
AFTER INSERT ON public.channel_doc_versions
FOR EACH ROW EXECUTE FUNCTION public.log_channel_doc_version_changes();

-- Policies
CREATE POLICY "Read channel docs when permitted" ON public.channel_docs
  FOR SELECT USING (public.has_channel_permission(workspace_id, channel_key, 'read'));

CREATE POLICY "Write channel docs when permitted" ON public.channel_docs
  FOR ALL USING (public.has_channel_permission(workspace_id, channel_key, 'write'));

CREATE POLICY "Read channel doc versions with permissions" ON public.channel_doc_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_docs d
      WHERE d.id = channel_doc_versions.doc_id
        AND (
          (channel_doc_versions.status = 'published' AND public.has_channel_language_permission(d.workspace_id, d.channel_key, channel_doc_versions.lang_code, 'read'))
          OR (channel_doc_versions.status = 'draft' AND public.has_channel_language_permission(d.workspace_id, d.channel_key, channel_doc_versions.lang_code, 'write'))
        )
    )
  );

CREATE POLICY "Manage channel doc versions with write permission" ON public.channel_doc_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.channel_docs d
      WHERE d.id = channel_doc_versions.doc_id
        AND public.has_channel_language_permission(d.workspace_id, d.channel_key, channel_doc_versions.lang_code, 'write')
    )
  );

CREATE POLICY "Owner reads channel doc permissions" ON public.channel_doc_permissions
  FOR SELECT USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owner manages channel doc permissions" ON public.channel_doc_permissions
  FOR ALL USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Read channel doc languages when permitted" ON public.channel_doc_languages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_docs d
      WHERE d.id = channel_doc_id
        AND public.has_channel_permission(d.workspace_id, d.channel_key, 'read')
    )
  );

CREATE POLICY "Manage channel doc languages with write" ON public.channel_doc_languages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.channel_docs d
      WHERE d.id = channel_doc_id
        AND public.has_channel_permission(d.workspace_id, d.channel_key, 'write')
    )
  );

CREATE POLICY "Owner reads channel doc language permissions" ON public.channel_doc_language_permissions
  FOR SELECT USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owner manages channel doc language permissions" ON public.channel_doc_language_permissions
  FOR ALL USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Audit logs visible to permitted members" ON public.channel_doc_audit_logs
  FOR SELECT USING (
    public.has_channel_permission(workspace_id, channel_key, 'read')
  );

-- No direct inserts into audit logs (trigger-only)
