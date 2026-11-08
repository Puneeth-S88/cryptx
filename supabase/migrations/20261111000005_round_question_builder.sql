-- ==============================================================================
-- CRYPTEX 2026 - MIGRATION 05: Dynamic Round & Question Builder Support
-- ==============================================================================

-- 1. Create round_type ENUM if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'round_type') THEN
    CREATE TYPE round_type AS ENUM (
      'standard',
      'polybius',
      'scramble',
      'memory',
      'auction',
      'colour',
      'vigenere',
      'jury'
    );
  END IF;
END $$;

-- 2. Create question_type ENUM if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
    CREATE TYPE question_type AS ENUM (
      'mcq',
      'text'
    );
  END IF;
END $$;

-- 3. Add round_type and qualification_note to event_rounds if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'event_rounds' AND column_name = 'round_type'
  ) THEN
    ALTER TABLE public.event_rounds ADD COLUMN round_type round_type NOT NULL DEFAULT 'standard';
    
    -- Map existing puzzle_type values to new round_type
    UPDATE public.event_rounds SET round_type = 'polybius' WHERE puzzle_type = 'polybius_grid';
    UPDATE public.event_rounds SET round_type = 'scramble' WHERE puzzle_type = 'drag_scramble';
    UPDATE public.event_rounds SET round_type = 'memory' WHERE puzzle_type = 'memory_cipher';
    UPDATE public.event_rounds SET round_type = 'auction' WHERE puzzle_type = 'cipher_auction';
    UPDATE public.event_rounds SET round_type = 'colour' WHERE puzzle_type = 'colour_cipher';
    UPDATE public.event_rounds SET round_type = 'vigenere' WHERE puzzle_type = 'vigenere_analysis';
    UPDATE public.event_rounds SET round_type = 'jury' WHERE puzzle_type = 'manual_jury';
    UPDATE public.event_rounds SET round_type = 'standard' WHERE puzzle_type IN ('mcq', 'method_cipher');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'event_rounds' AND column_name = 'qualification_note'
  ) THEN
    ALTER TABLE public.event_rounds ADD COLUMN qualification_note TEXT DEFAULT 'Top teams with highest cumulative score qualify.';
  END IF;
END $$;

-- 4. Create Questions Table for Standard Quiz Rounds (Public content)
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  question_type question_type NOT NULL DEFAULT 'mcq',
  question_text TEXT NOT NULL,
  monospace_code TEXT,
  image_url TEXT,
  options JSONB DEFAULT '[]'::jsonb, -- e.g. ["Option A", "Option B", ...] for MCQ
  points INT NOT NULL DEFAULT 10,
  text_settings JSONB DEFAULT '{"ignore_case": true, "ignore_punct_space": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create Private Question Secrets Table (Private Schema - Zero Client Leaks)
CREATE TABLE IF NOT EXISTS private.question_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  correct_option_index INT, -- 0-based index for MCQ
  accepted_answers TEXT[] NOT NULL DEFAULT '{}', -- List of acceptable strings for TEXT
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_question_secret UNIQUE (question_id)
);

-- Permissions: Restrict private.question_secrets
REVOKE ALL ON private.question_secrets FROM PUBLIC;
REVOKE ALL ON private.question_secrets FROM anon;
REVOKE ALL ON private.question_secrets FROM authenticated;
GRANT ALL ON private.question_secrets TO postgres;
GRANT ALL ON private.question_secrets TO service_role;

-- 6. Trigger to automatically re-compute standard round total marks from sum of question marks
CREATE OR REPLACE FUNCTION public.sync_round_total_points()
RETURNS TRIGGER AS $$
DECLARE
  v_round_id UUID;
  v_total INT;
  v_round_type round_type;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_round_id := OLD.round_id;
  ELSE
    v_round_id := NEW.round_id;
  END IF;

  SELECT round_type INTO v_round_type FROM public.event_rounds WHERE id = v_round_id;

  -- Only automatically sync for standard rounds
  IF v_round_type = 'standard' THEN
    SELECT COALESCE(SUM(points), 0)::INT INTO v_total 
    FROM public.questions 
    WHERE round_id = v_round_id;

    UPDATE public.event_rounds 
    SET max_points = v_total, updated_at = now()
    WHERE id = v_round_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_sync_round_total_points ON public.questions;
CREATE TRIGGER trigger_sync_round_total_points
  AFTER INSERT OR UPDATE OR DELETE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.sync_round_total_points();

-- 7. Row Level Security for questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view questions if round is active/past and team qualified"
  ON public.questions FOR SELECT
  USING (
    public.is_admin_or_organizer() OR (
      EXISTS (
        SELECT 1 FROM public.event_rounds r
        JOIN public.teams t ON t.event_id = r.event_id
        JOIN public.team_members tm ON tm.team_id = t.id
        WHERE r.id = questions.round_id
          AND tm.user_id = auth.uid()
          AND r.state IN ('open', 'paused', 'closed', 'scored')
          AND (
            r.round_number = 1 OR EXISTS (
              SELECT 1 FROM public.round_qualifications rq
              WHERE rq.event_id = r.event_id 
                AND rq.round_number = r.round_number 
                AND rq.team_id = t.id 
                AND rq.qualified = true
            )
          )
      )
    )
  );

CREATE POLICY "Organizers can manage questions"
  ON public.questions FOR ALL
  USING (public.is_admin_or_organizer());

-- 8. Seed questions for Round 1 if standard
DO $$
DECLARE
  v_r1_id UUID;
  v_q1_id UUID := gen_random_uuid();
  v_q2_id UUID := gen_random_uuid();
  v_q3_id UUID := gen_random_uuid();
  v_q4_id UUID := gen_random_uuid();
  v_q5_id UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_r1_id FROM public.event_rounds WHERE round_number = 1 LIMIT 1;
  IF v_r1_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.questions WHERE round_id = v_r1_id) THEN
    -- Q1 MCQ
    INSERT INTO public.questions (id, round_id, order_index, question_type, question_text, options, points)
    VALUES (v_q1_id, v_r1_id, 1, 'mcq', 'What is the primary definition of decryption in classical cryptography?',
      '["Converting plaintext into unreadable ciphertext", "Unlocking an encrypted message using a key", "Destroying cryptographic keys after one transmission", "Generating pseudo-random hashes"]'::jsonb, 20);
    INSERT INTO private.question_secrets (question_id, round_id, correct_option_index)
    VALUES (v_q1_id, v_r1_id, 1);

    -- Q2 MCQ
    INSERT INTO public.questions (id, round_id, order_index, question_type, question_text, monospace_code, options, points)
    VALUES (v_q2_id, v_r1_id, 2, 'mcq', 'Using the standard A1Z26 mapping where A=1, B=2 ... Z=26, which word corresponds to these numbers?',
      '3 - 15 - 4 - 5', '["CODE", "COLD", "DOME", "CORE"]'::jsonb, 20);
    INSERT INTO private.question_secrets (question_id, round_id, correct_option_index)
    VALUES (v_q2_id, v_r1_id, 0);

    -- Q3 MCQ
    INSERT INTO public.questions (id, round_id, order_index, question_type, question_text, monospace_code, options, points)
    VALUES (v_q3_id, v_r1_id, 3, 'mcq', 'In a simple substitution cipher where plaintext letter E maps to ciphertext H, what is the shift amount?',
      'Plain: E -> Cipher: H', '["1", "2", "3", "5"]'::jsonb, 20);
    INSERT INTO private.question_secrets (question_id, round_id, correct_option_index)
    VALUES (v_q3_id, v_r1_id, 2);

    -- Q4 MCQ
    INSERT INTO public.questions (id, round_id, order_index, question_type, question_text, options, points)
    VALUES (v_q4_id, v_r1_id, 4, 'mcq', 'Which classical cipher family shifts the entire alphabet by a fixed integer k?',
      '["Playfair Cipher", "Caesar Cipher", "Enigma Machine", "RSA"]'::jsonb, 20);
    INSERT INTO private.question_secrets (question_id, round_id, correct_option_index)
    VALUES (v_q4_id, v_r1_id, 1);

    -- Q5 TEXT
    INSERT INTO public.questions (id, round_id, order_index, question_type, question_text, points, text_settings)
    VALUES (v_q5_id, v_r1_id, 5, 'text', 'Type the 3-letter cryptographic word used to lock and unlock ciphertexts:',
      20, '{"ignore_case": true, "ignore_punct_space": true}'::jsonb);
    INSERT INTO private.question_secrets (question_id, round_id, accepted_answers)
    VALUES (v_q5_id, v_r1_id, ARRAY['KEY', 'A KEY', 'THE KEY']);
  END IF;
END $$;
