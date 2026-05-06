
DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'qa-admin@royalvita.test';
  v_password text := 'QaAdmin@2026';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"QA Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', v_user_id::text, now(), now(), now()
    );
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (v_user_id, v_email, 'QA Admin')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
