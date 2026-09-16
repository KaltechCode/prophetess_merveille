-- Run once in a new/dedicated Supabase project using SQL Editor.
-- Does not migrate any existing Sites/D1 guest responses.
BEGIN;

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 120),
  email text NOT NULL DEFAULT '' CHECK (length(email) <= 254),
  code uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rsvps (
  id uuid PRIMARY KEY,
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 120),
  email text NOT NULL DEFAULT '' CHECK (length(email) <= 254),
  phone text NOT NULL DEFAULT '' CHECK (length(phone) <= 40),
  response text NOT NULL CHECK (response IN ('accepted', 'declined')),
  party_size integer NOT NULL CHECK (
    (response = 'accepted' AND party_size BETWEEN 1 AND 20)
    OR (response = 'declined' AND party_size = 0)
  ),
  guest_names text NOT NULL DEFAULT '' CHECK (length(guest_names) <= 1000),
  dietary_requirements text NOT NULL DEFAULT '' CHECK (length(dietary_requirements) <= 1000),
  message text NOT NULL DEFAULT '' CHECK (length(message) <= 2000),
  invitation_code uuid UNIQUE REFERENCES public.invitations (code),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  checked_in boolean NOT NULL DEFAULT false,
  dedupe_key text NOT NULL UNIQUE CHECK (length(dedupe_key) = 64),
  request_hash text NOT NULL CHECK (length(request_hash) = 64)
);

CREATE INDEX idx_rsvps_submitted_at ON public.rsvps (submitted_at DESC, id DESC);
CREATE INDEX idx_invitations_created_at ON public.invitations (created_at DESC, id DESC);

CREATE FUNCTION public.touch_rsvp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_rsvp_updated_at
BEFORE UPDATE ON public.rsvps
FOR EACH ROW
EXECUTE FUNCTION public.touch_rsvp_updated_at();

CREATE TABLE public.request_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL
);

-- RLS has NO browser policies: only the backend service_role can touch data.
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.invitations, public.rsvps, public.request_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations, public.rsvps, public.request_limits TO service_role;

CREATE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_hits integer;
BEGIN
  IF length(p_key) <> 64 OR p_limit < 1 OR p_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit arguments';
  END IF;

  INSERT INTO public.request_limits (key, window_start, hits)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE
      WHEN public.request_limits.window_start < now() - make_interval(secs => p_seconds) THEN 1
      ELSE public.request_limits.hits + 1
    END,
    window_start = CASE
      WHEN public.request_limits.window_start < now() - make_interval(secs => p_seconds) THEN now()
      ELSE public.request_limits.window_start
    END
  RETURNING hits INTO v_hits;

  DELETE FROM public.request_limits
  WHERE window_start < now() - interval '1 day';

  RETURN v_hits <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.touch_rsvp_updated_at() FROM PUBLIC, anon, authenticated;

COMMIT;
