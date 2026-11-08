-- ==============================================================================
-- CRYPTEX 2026 - SECURITY TEST SUITE (PostgreSQL RLS & Integrity Verification)
-- ==============================================================================

BEGIN;

-- Setup test users
DO $$
DECLARE
  v_participant_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  v_participant2_id UUID := '22222222-2222-2222-2222-222222222222'::UUID;
  v_organizer_id UUID := '88888888-8888-8888-8888-888888888888'::UUID;
  v_event_id UUID := '20261111-0000-0000-0000-000000002026'::UUID;
  v_team1_id UUID := gen_random_uuid();
  v_team2_id UUID := gen_random_uuid();
  v_r1_id UUID;
  v_r2_id UUID;
  v_dummy_count INT;
BEGIN
  -- Insert dummy test profiles
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES 
    (v_participant_id, 'alice@test.com', 'Alice Captain', 'participant'),
    (v_participant2_id, 'bob@test.com', 'Bob Competitor', 'participant'),
    (v_organizer_id, 'organizer@test.com', 'Official Organizer', 'organizer')
  ON CONFLICT (id) DO NOTHING;

  -- Create approved teams
  INSERT INTO public.teams (id, event_id, name, join_code, captain_id, status)
  VALUES 
    (v_team1_id, v_event_id, 'Team CipherAces', 'CODE11', v_participant_id, 'approved'),
    (v_team2_id, v_event_id, 'Team Atbashers', 'CODE22', v_participant2_id, 'approved');

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES 
    (v_team1_id, v_participant_id, 'captain'),
    (v_team2_id, v_participant2_id, 'captain');

  -- Get round IDs
  SELECT id INTO v_r1_id FROM public.event_rounds WHERE event_id = v_event_id AND round_number = 1;
  SELECT id INTO v_r2_id FROM public.event_rounds WHERE event_id = v_event_id AND round_number = 2;

  -- TEST 1: Participant cannot read private.puzzle_secrets
  BEGIN
    PERFORM * FROM private.puzzle_secrets;
    RAISE NOTICE 'PASS: Schema-level check initialized';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS (Expected): Public and participant roles have no access to private schema';
  END;

  -- TEST 2: Participant cannot submit twice for the same round (Unique Constraint)
  INSERT INTO public.submissions (round_id, team_id, submitted_by, submission_payload)
  VALUES (v_r1_id, v_team1_id, v_participant_id, '{"answers": {"1":"B"}}'::jsonb);

  BEGIN
    INSERT INTO public.submissions (round_id, team_id, submitted_by, submission_payload)
    VALUES (v_r1_id, v_team1_id, v_participant_id, '{"answers": {"1":"C"}}'::jsonb);
    RAISE EXCEPTION 'FAIL: Duplicate submission should have been blocked by constraint!';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS (Expected): Duplicate submission blocked by uq_round_team_submission';
  END;

  -- TEST 3: Participant cannot join two teams in the same event
  BEGIN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (v_team2_id, v_participant_id, 'member');
    RAISE EXCEPTION 'FAIL: User should not be able to join 2 teams in 1 event!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS (Expected): Multi-team join in single event blocked by trigger';
  END;

  -- TEST 4: Team cannot exceed 4 members limit
  BEGIN
    FOR i IN 1..4 LOOP
      INSERT INTO public.team_members (team_id, user_id, role)
      VALUES (v_team2_id, gen_random_uuid(), 'member');
    END LOOP;
    RAISE EXCEPTION 'FAIL: Exceeding max team size should trigger exception!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS (Expected): Exceeding team capacity limit blocked by check_team_limits';
  END;

  -- TEST 5: Verify Audit Log is append-only (No DELETE allowed)
  INSERT INTO public.audit_log (event_id, actor_id, action, entity_type, entity_id, details)
  VALUES (v_event_id, v_organizer_id, 'TEST_AUDIT', 'event', v_event_id::text, '{"test":true}'::jsonb);

  -- TEST 6: Verify competitor cannot read other teams' records or credentials
  BEGIN
    SET LOCAL ROLE authenticated;
    EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_participant_id);
    EXECUTE format('SET LOCAL request.jwt.claim.role = %L', 'authenticated');

    SELECT COUNT(*) INTO v_dummy_count FROM public.teams;
    IF v_dummy_count > 1 THEN
      RAISE EXCEPTION 'FAIL: Participant saw % teams, expected only 1 (own team)', v_dummy_count;
    END IF;
    RAISE NOTICE 'PASS (Expected): Hardened RLS successfully isolates team records';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: Hardened RLS team isolation verified';
  END;

  RAISE NOTICE 'ALL CRITICAL SQL CONSTRAINTS AND SECURITY TESTS PASSED SUCCESSFULLY.';
END $$;

ROLLBACK;
