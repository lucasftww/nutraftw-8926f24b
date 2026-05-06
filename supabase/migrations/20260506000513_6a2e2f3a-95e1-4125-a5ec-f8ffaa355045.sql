
-- 1) Lock down Realtime: only admins may subscribe/receive messages.
--    The app only uses realtime for admin order notifications.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can receive realtime messages" ON realtime.messages;
CREATE POLICY "Admins can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can send realtime messages" ON realtime.messages;
CREATE POLICY "Admins can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Revoke anonymous EXECUTE on SECURITY DEFINER function has_role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
