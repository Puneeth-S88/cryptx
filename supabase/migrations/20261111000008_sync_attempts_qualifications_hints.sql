-- Migration 08: Ensure optional tracking columns on round_attempts, round_qualifications, and hint_usage
DO $$
BEGIN
  -- 1. round_attempts enhancements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'round_attempts' AND column_name = 'score') THEN
    ALTER TABLE public.round_attempts ADD COLUMN score NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'round_attempts' AND column_name = 'attempt_number') THEN
    ALTER TABLE public.round_attempts ADD COLUMN attempt_number INT DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'round_attempts' AND column_name = 'is_final_attempt') THEN
    ALTER TABLE public.round_attempts ADD COLUMN is_final_attempt BOOLEAN DEFAULT true;
  END IF;

  -- 2. round_qualifications enhancements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'round_qualifications' AND column_name = 'is_qualified') THEN
    ALTER TABLE public.round_qualifications ADD COLUMN is_qualified BOOLEAN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'round_qualifications' AND column_name = 'rank_in_round') THEN
    ALTER TABLE public.round_qualifications ADD COLUMN rank_in_round INT;
  END IF;

  -- 3. hint_usage enhancements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hint_usage' AND column_name = 'penalty_applied') THEN
    ALTER TABLE public.hint_usage ADD COLUMN penalty_applied INT DEFAULT 0;
  END IF;
END $$;
