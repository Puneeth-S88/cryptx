-- ==============================================================================
-- CRYPTEX 2026 - MIGRATION 04: Seed Data (8 Authorized Rounds + Official Details)
-- ==============================================================================

DO $$
DECLARE
  v_admin_id UUID := gen_random_uuid();
  v_event_id UUID := '20261111-0000-0000-0000-000000002026'::UUID;
  v_r1_id UUID := gen_random_uuid();
  v_r2_id UUID := gen_random_uuid();
  v_r3_id UUID := gen_random_uuid();
  v_r4_id UUID := gen_random_uuid();
  v_r5_id UUID := gen_random_uuid();
  v_r6_id UUID := gen_random_uuid();
  v_r7_id UUID := gen_random_uuid();
  v_r8_id UUID := gen_random_uuid();
  v_p1_id UUID := gen_random_uuid();
  v_p2_id UUID := gen_random_uuid();
  v_p3_id UUID := gen_random_uuid();
  v_p4_id UUID := gen_random_uuid();
  v_p5_id UUID := gen_random_uuid();
  v_p6_id UUID := gen_random_uuid();
  v_p7_id UUID := gen_random_uuid();
  v_p8_id UUID := gen_random_uuid();
  -- Default organizer control password hash for 'CryptX@2026!' using bcrypt
  v_pwd_hash TEXT := '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMeq';
BEGIN

  -- 1. Insert Event (CRYPTEX 2026)
  INSERT INTO public.events (
    id, slug, title, tagline, description,
    date_start, date_end, venue,
    max_teams, max_members_per_team, min_members_per_team, fee_inr,
    status, is_leaderboard_frozen,
    student_coordinators, faculty_coordinators
  ) VALUES (
    v_event_id,
    'cryptex-2026',
    'CRYPTEX 2026',
    'The Ultimate Cryptography Championship',
    'Crack. Decode. Conquer. Live, organizer-controlled cryptography competition.',
    '2026-11-11 14:00:00+05:30',
    '2026-11-11 16:00:00+05:30',
    'DFL04',
    15, 4, 1, 200,
    'registration_open', false,
    ARRAY['Prajwal B U', 'Puneeth S'],
    ARRAY['Dr. Vijay Kumar AV', 'Ms. Soumya']
  ) ON CONFLICT (slug) DO NOTHING;

  -- 2. Insert Organizer Control Password Secret (private.organizer_control_secrets)
  INSERT INTO private.organizer_control_secrets (
    event_id, password_hash, salt
  ) VALUES (
    v_event_id,
    v_pwd_hash,
    'cryptex_salt_2026'
  ) ON CONFLICT (event_id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

  -- 3. ROUND 1: The Secret Code (MCQ x 5)
  INSERT INTO public.event_rounds (
    id, event_id, round_number, title, topic, description,
    puzzle_type, state, duration_seconds, max_points, order_index
  ) VALUES (
    v_r1_id, v_event_id, 1, 'The Secret Code', 'Cryptographic Fundamentals & Classical Ciphers',
    '5 rapid questions testing foundational cryptographic concepts and early ciphers.',
    'mcq', 'locked', 600, 100, 1
  );

  INSERT INTO public.puzzles (id, round_id, title, instructions, content, max_hints, hint_penalty_points)
  VALUES (
    v_p1_id, v_r1_id, 'The Secret Code',
    'Select the single correct answer for each multiple-choice question and type the exact code for Question 5.',
    jsonb_build_object(
      'questions', jsonb_build_array(
        jsonb_build_object(
          'id', 1,
          'question', 'What is the primary definition of decryption in classical cryptography?',
          'options', jsonb_build_array(
            'A) Converting plaintext into unreadable ciphertext',
            'B) Unlocking an encrypted message using a key',
            'C) Destroying cryptographic keys after one transmission',
            'D) Generating pseudo-random hashes'
          )
        ),
        jsonb_build_object(
          'id', 2,
          'question', 'Using the standard A1Z26 mapping where A=1, B=2 ... Z=26, which word corresponds to numbers 3 - 15 - 4 - 5?',
          'options', jsonb_build_array(
            'A) CODE',
            'B) COLD',
            'C) DOME',
            'D) CORE'
          )
        ),
        jsonb_build_object(
          'id', 3,
          'question', 'In a simple substitution cipher where plaintext letter E maps to ciphertext H, what is the shift amount?',
          'options', jsonb_build_array(
            'A) 1',
            'B) 2',
            'C) 3',
            'D) 5'
          )
        ),
        jsonb_build_object(
          'id', 4,
          'question', 'Which classical cipher family shifts the entire alphabet by a fixed integer k?',
          'options', jsonb_build_array(
            'A) Playfair Cipher',
            'B) Caesar Cipher',
            'C) Enigma Machine',
            'D) RSA'
          )
        ),
        jsonb_build_object(
          'id', 5,
          'question', 'Type the 3-letter cryptographic word used to lock and unlock ciphertexts:',
          'type', 'text_input',
          'placeholder', '3 letters...'
        )
      )
    ),
    0, 0
  );

  INSERT INTO private.puzzle_secrets (puzzle_id, round_id, solution_data)
  VALUES (
    v_p1_id, v_r1_id,
    jsonb_build_object(
      'answers', jsonb_build_object(
        '1', 'B',
        '2', 'A',
        '3', 'C',
        '4', 'B',
        '5', 'KEY'
      ),
      'points_per_item', 20
    )
  );

  -- 4. ROUND 2: Cipher Breakers (3 Messages with method selector + answer)
  INSERT INTO public.event_rounds (
    id, event_id, round_number, title, topic, description,
    puzzle_type, state, duration_seconds, max_points, order_index
  ) VALUES (
    v_r2_id, v_event_id, 2, 'Cipher Breakers', 'Multi-Cipher Decryption',
    'Identify the cipher method and decode three intercepted transmissions.',
    'method_cipher', 'locked', 600, 150, 2
  );

  INSERT INTO public.puzzles (id, round_id, title, instructions, content, max_hints, hint_penalty_points)
  VALUES (
    v_p2_id, v_r2_id, 'Cipher Breakers',
    'For each message, select the correct decryption algorithm and provide the decoded plaintext.',
    jsonb_build_object(
      'available_methods', jsonb_build_array('Caesar Shift 3', 'Atbash Cipher', 'Binary (ASCII)', 'Vigenere', 'Rail Fence'),
      'messages', jsonb_build_array(
        jsonb_build_object('id', 1, 'ciphertext', 'FDW'),
        jsonb_build_object('id', 2, 'ciphertext', 'GSV'),
        jsonb_build_object('id', 3, 'ciphertext', '01001000 01001001')
      )
    ),
    0, 0
  );

  INSERT INTO private.puzzle_secrets (puzzle_id, round_id, solution_data)
  VALUES (
    v_p2_id, v_r2_id,
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('id', 1, 'method', 'Caesar Shift 3', 'plaintext', 'CAT', 'points', 50),
        jsonb_build_object('id', 2, 'method', 'Atbash Cipher', 'plaintext', 'THE', 'points', 50),
        jsonb_build_object('id', 3, 'method', 'Binary (ASCII)', 'plaintext', 'HI', 'points', 50)
      )
    )
  );

  -- 5. ROUND 3: Code Grid (Polybius Click Grid)
  INSERT INTO public.event_rounds (
    id, event_id, round_number, title, topic, description,
    puzzle_type, state, duration_seconds, max_points, order_index
  ) VALUES (
    v_r3_id, v_event_id, 3, 'Code Grid', 'Polybius Square Coordinate Decryption',
    'Decipher coordinates using an interactive 5x5 Polybius click grid.',
    'polybius_grid', 'locked', 600, 150, 3
  );

  INSERT INTO public.puzzles (id, round_id, title, instructions, content, max_hints, hint_penalty_points)
  VALUES (
    v_p3_id, v_r3_id, 'Code Grid',
    'Click grid letters corresponding to row-column pairs. Polybius 5x5: Rows 1-5, Columns 1-5.',
    jsonb_build_object(
      'ciphertext_pairs', '32-15-15-44 / 11-44 / 22-11-44-15',
      'grid_layout', jsonb_build_array(
        jsonb_build_array('A', 'B', 'C', 'D', 'E'),
        jsonb_build_array('F', 'G', 'H', 'I/J', 'K'),
        jsonb_build_array('L', 'M', 'N', 'O', 'P'),
        jsonb_build_array('Q', 'R', 'S', 'T', 'U'),
        jsonb_build_array('V', 'W', 'X', 'Y', 'Z')
      )
    ),
    0, 0
  );

  INSERT INTO private.puzzle_secrets (puzzle_id, round_id, solution_data)
  VALUES (
    v_p3_id, v_r3_id,
    jsonb_build_object(
      'plaintext', 'MEET AT GATE',
      'normalized_plaintext', 'MEETATGATE',
      'points', 150
    )
  );

  -- 6. ROUND 4: Cipher Scramble (Drag & Drop Letters)
  INSERT INTO public.event_rounds (
    id, event_id, round_number, title, topic, description,
    puzzle_type, state, duration_seconds, max_points, order_index
  ) VALUES (
    v_r4_id, v_event_id, 4, 'Cipher Scramble', 'Cryptographic Anagrams & Terminology',
    'Unscramble five cryptographic terms using interactive letter tiles.',
    'drag_scramble', 'locked', 600, 150, 4
  );

  INSERT INTO public.puzzles (id, round_id, title, instructions, content, max_hints, hint_penalty_points)
  VALUES (
    v_p4_id, v_r4_id, 'Cipher Scramble',
    'Drag or reorder scrambled letters to form the correct cryptographic keyword matching each clue.',
    jsonb_build_object(
      'words', jsonb_build_array(
        jsonb_build_object('id', 1, 'scrambled', 'REENIGEV', 'clue', 'Polyalphabetic cipher invented in the 16th century'),
        jsonb_build_object('id', 2, 'scrambled', 'TEBAHPLA', 'clue', 'Ordered set of letters forming the basis of a cipher system'),
        jsonb_build_object('id', 3, 'scrambled', 'ELZZUP', 'clue', 'Cryptanalytic challenge or enigma to be cracked'),
        jsonb_build_object('id', 4, 'scrambled', 'LEVEL', 'clue', 'A palindrome word often used in security tiers'),
        jsonb_build_object('id', 5, 'scrambled', 'TXET', 'clue', 'Written words before or after encryption (plain or cipher)')
      )
    ),
    0, 0
  );

  INSERT INTO private.puzzle_secrets (puzzle_id, round_id, solution_data)
  VALUES (
    v_p4_id, v_r4_id,
    jsonb_build_object(
      'solutions', jsonb_build_object(
        '1', 'VIGENERE',
        '2', 'ALPHABET',
        '3', 'PUZZLE',
        '4', 'LEVEL',
        '5', 'TEXT'
      ),
      'points_per_word', 30
    )
  );

  -- 7. ROUND 5: Memory Cipher
  INSERT INTO public.event_rounds (
    id, event_id, round_number, title, topic, description,
    puzzle_type, state, duration_seconds, max_points, order_index
  ) VALUES (
    v_r5_id, v_event_id, 5, 'Memory Cipher', 'Timed Key Memorization & Rapid Decoding',
    'Memorize the substitution key for 15 seconds, then decode 5 intercepted cipher words from memory.',
    'memory_cipher', 'locked', 600, 200, 5
  );

  INSERT INTO public.puzzles (id, round_id, title, instructions, content, max_hints, hint_penalty_points)
  VALUES (
    v_p5_id, v_r5_id, 'Memory Cipher',
    'Click Start Key Reveal to view the substitution alphabet for 15 seconds. The key will disappear and cannot be viewed again. Decode all 5 words.',
    jsonb_build_object(
      'reveal_duration_seconds', 15,
      'cipher_words', jsonb_build_array('UQZT', 'XFRTK', 'QEETLL', 'KTLTZ', 'RGGK')
    ),
    0, 0
  );

  INSERT INTO private.puzzle_secrets (puzzle_id, round_id, solution_data)
  VALUES (
    v_p5_id, v_r5_id,
    jsonb_build_object(
      'substitution_key', jsonb_build_object(
        'A','Q','B','W','C','E','D','R','E','T','F','Y','G','U','H','I','I','O','J','P',
        'K','A','L','S','M','D','N','F','O','G','P','H','Q','J','R','K','S','L','T','Z',
        'U','X','V','C','W','V','X','B','Y','N','Z','M'
      ),
      'solutions', jsonb_build_object(
        'UQZT', 'GATE',
        'XFRTK', 'UNDER',
        'QEETLL', 'ACCESS',
        'KTLTZ', 'RESET',
        'RGGK', 'DOOR'
      ),
      'points_per_word', 40
    )
  );

  -- 8. ROUND 6: Cipher Auction (Rail Fence with tiered hints)
  INSERT INTO public.event_rounds (
    id, event_id, round_number, title, topic, description,
    puzzle_type, state, duration_seconds, max_points, order_index
  ) VALUES (
    v_r6_id, v_event_id, 6, 'Cipher Auction', 'Rail Fence Cipher with Point Bidding',
    'Transposition cipher with 2 optional hints. Each requested hint reduces your maximum points.',
    'cipher_auction', 'locked', 600, 200, 6
  );

  INSERT INTO public.puzzles (id, round_id, title, instructions, content, max_hints, hint_penalty_points)
  VALUES (
    v_p6_id, v_r6_id, 'Cipher Auction',
    'Decode the Rail Fence transposition. 0 hints = 200 pts, 1 hint = 150 pts, 2 hints = 100 pts.',
    jsonb_build_object(
      'ciphertext', 'MEADWETTAN',
      'max_hints', 2,
      'hint_penalties', jsonb_build_array(50, 50)
    ),
    2, 50
  );

  INSERT INTO private.puzzle_secrets (puzzle_id, round_id, solution_data, hints)
  VALUES (
    v_p6_id, v_r6_id,
    jsonb_build_object(
      'plaintext', 'MEET AT DAWN',
      'normalized_plaintext', 'MEETATDAWN',
      'base_points', 200
    ),
    jsonb_build_array(
      jsonb_build_object('index', 1, 'text', 'Hint 1: This is a Rail Fence (zigzag) cipher with 2 rails.'),
      jsonb_build_object('index', 2, 'text', 'Hint 2: Top rail holds M E D E T; Bottom rail holds E A W T A N.')
    )
  );

  -- 9. ROUND 7: Colour Cipher (Baconian Cipher with Coloured Tiles)
  INSERT INTO public.event_rounds (
    id, event_id, round_number, title, topic, description,
    puzzle_type, state, duration_seconds, max_points, order_index
  ) VALUES (
    v_r7_id, v_event_id, 7, 'Colour Cipher', 'Baconian Cipher via Visual Steganography',
    'Decode a visual binary steganogram where Blue represents A and Orange represents B in 5-bit Bacon codes.',
    'colour_cipher', 'locked', 600, 200, 7
  );

  INSERT INTO public.puzzles (id, round_id, title, instructions, content, max_hints, hint_penalty_points)
  VALUES (
    v_p7_id, v_r7_id, 'Colour Cipher',
    'Decode the coloured tile sequences. Blue represents A (0), Orange represents B (1). Convert 5-character groups into letters.',
    jsonb_build_object(
      'colour_mapping', jsonb_build_object('Blue', 'A', 'Orange', 'B'),
      'tile_groups', jsonb_build_array(
        jsonb_build_array('Blue', 'Blue', 'Blue', 'Orange', 'Blue'),       -- AAABA = C
        jsonb_build_array('Blue', 'Orange', 'Orange', 'Orange', 'Blue'),   -- ABBBA = O
        jsonb_build_array('Blue', 'Blue', 'Blue', 'Orange', 'Orange'),     -- AAABB = D
        jsonb_build_array('Blue', 'Blue', 'Orange', 'Blue', 'Blue')        -- AABAA = E
      )
    ),
    0, 0
  );

  INSERT INTO private.puzzle_secrets (puzzle_id, round_id, solution_data)
  VALUES (
    v_p7_id, v_r7_id,
    jsonb_build_object(
      'plaintext', 'CODE',
      'normalized_plaintext', 'CODE',
      'points', 200
    )
  );

  -- 10. ROUND 8: Master Cryptanalyst (Vigenere + Explanatory Proof)
  INSERT INTO public.event_rounds (
    id, event_id, round_number, title, topic, description,
    puzzle_type, state, duration_seconds, max_points, order_index
  ) VALUES (
    v_r8_id, v_event_id, 8, 'Master Cryptanalyst', 'Polyalphabetic Cryptanalysis & Technical Methodology',
    'Final championship challenge: Decrypt Vigenere ciphertext and explain the cryptanalytic derivation.',
    'vigenere_analysis', 'locked', 900, 300, 8
  );

  INSERT INTO public.puzzles (id, round_id, title, instructions, content, max_hints, hint_penalty_points)
  VALUES (
    v_p8_id, v_r8_id, 'Master Cryptanalyst',
    'Use the integrated Vigenere table tool. Submit both the decoded plaintext (150 pts) and your detailed cryptanalytic explanation (150 pts).',
    jsonb_build_object(
      'ciphertext', 'LXFOPVEFRNHR',
      'key_hint', 'LEMON',
      'has_decoder_tool', true
    ),
    0, 0
  );

  INSERT INTO private.puzzle_secrets (puzzle_id, round_id, solution_data, jury_criteria)
  VALUES (
    v_p8_id, v_r8_id,
    jsonb_build_object(
      'plaintext', 'ATTACKATDAWN',
      'plaintext_points', 150,
      'explanation_points', 150,
      'required_explanation_keywords', jsonb_build_array('vigenere', 'lemon', 'repeat', 'shift', 'modular', 'polyalphabetic')
    ),
    jsonb_build_object(
      'min_keyword_matches_for_auto', 3,
      'allow_manual_jury_override', true
    )
  );

  -- 11. Seed Default Authorized Teams
  INSERT INTO public.teams (id, event_id, name, join_code, captain_name, captain_email, password_hash, status, is_eliminated, eliminated_after_round)
  VALUES
    ('20261111-0000-0000-0000-000000000001', v_event_id, 'CipherAces', 'ACES-9942', 'Alice Captain', 'captain@cipheraces.com', '$2a$10$U3j2L4rYQ7O9N5K8H0X8Ge.H0m6g2wZtT7oQ5rW5L5oK8H0X8Ge.H', 'approved', false, null),
    ('20261111-0000-0000-0000-000000000002', v_event_id, 'Atbashers United', 'ATB-5512', 'Bob Atbash', 'captain@atbashers.org', '$2a$10$U3j2L4rYQ7O9N5K8H0X8Ge.H0m6g2wZtT7oQ5rW5L5oK8H0X8Ge.H', 'approved', false, null),
    ('20261111-0000-0000-0000-000000000003', v_event_id, 'Enigma Breakers', 'ENIG-1188', 'Alan Rotor', 'captain@enigma.io', '$2a$10$U3j2L4rYQ7O9N5K8H0X8Ge.H0m6g2wZtT7oQ5rW5L5oK8H0X8Ge.H', 'approved', false, null),
    ('20261111-0000-0000-0000-000000000004', v_event_id, 'Quantum Hashes', 'QUANT-7721', 'Dave Qubit', 'captain@quantum.net', '$2a$10$U3j2L4rYQ7O9N5K8H0X8Ge.H0m6g2wZtT7oQ5rW5L5oK8H0X8Ge.H', 'approved', false, null),
    ('20261111-0000-0000-0000-000000000005', v_event_id, 'Polybius Prime', 'POLY-4409', 'Eve Coordinate', 'captain@polybius.dev', '$2a$10$U3j2L4rYQ7O9N5K8H0X8Ge.H0m6g2wZtT7oQ5rW5L5oK8H0X8Ge.H', 'approved', true, 2)
  ON CONFLICT (event_id, name) DO NOTHING;

  -- 12. Seed Default Scores for Leaderboard Realism
  INSERT INTO public.scores (event_id, team_id, round_id, round_number, points, final_points, final_submitted_at)
  VALUES
    (v_event_id, '20261111-0000-0000-0000-000000000001', v_r1_id, 1, 100, 100, '2026-11-11 14:10:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000001', v_r2_id, 2, 150, 150, '2026-11-11 14:20:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000001', v_r3_id, 3, 100, 100, '2026-11-11 14:30:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000002', v_r1_id, 1, 80, 80, '2026-11-11 14:12:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000002', v_r2_id, 2, 150, 150, '2026-11-11 14:22:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000002', v_r3_id, 3, 80, 80, '2026-11-11 14:32:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000003', v_r1_id, 1, 80, 80, '2026-11-11 14:15:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000003', v_r2_id, 2, 140, 140, '2026-11-11 14:25:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000003', v_r3_id, 3, 60, 60, '2026-11-11 14:35:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000004', v_r1_id, 1, 60, 60, '2026-11-11 14:18:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000004', v_r2_id, 2, 110, 110, '2026-11-11 14:28:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000004', v_r3_id, 3, 40, 40, '2026-11-11 14:40:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000005', v_r1_id, 1, 40, 40, '2026-11-11 14:20:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000005', v_r2_id, 2, 80, 80, '2026-11-11 14:30:00+05:30'),
    (v_event_id, '20261111-0000-0000-0000-000000000005', v_r3_id, 3, 20, 20, '2026-11-11 14:45:00+05:30')
  ON CONFLICT (event_id, team_id, round_id) DO NOTHING;

END $$;
