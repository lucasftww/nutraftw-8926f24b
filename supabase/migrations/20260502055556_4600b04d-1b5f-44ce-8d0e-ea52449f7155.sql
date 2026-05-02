UPDATE auth.users
SET encrypted_password = crypt('Admin@2026!', gen_salt('bf')),
    updated_at = now()
WHERE email = 'frajolasilva60@gmail.com';