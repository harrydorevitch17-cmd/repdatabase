-- Keep catalogue and image reads public. Only the verified site owner may write.
DO $migration$
DECLARE owner_id uuid; owner_check text;
BEGIN
 SELECT id INTO STRICT owner_id FROM auth.users WHERE email='harrydorevitch17@gmail.com' AND email_confirmed_at IS NOT NULL;
 owner_check := format('(select auth.uid()) = %L::uuid',owner_id);
 EXECUTE format('ALTER POLICY %I ON public.products USING (%s) WITH CHECK (%s)','auth update',owner_check,owner_check);
 EXECUTE format('ALTER POLICY %I ON public.products USING (%s)','auth delete',owner_check);
 EXECUTE format('ALTER POLICY %I ON public.products WITH CHECK (%s)','auth insert',owner_check);
 EXECUTE format('ALTER POLICY %I ON public.events USING (%s)','admins read events',owner_check);
 EXECUTE format('ALTER POLICY %I ON storage.objects WITH CHECK (bucket_id = %L AND (%s))','auth upload images','item-images',owner_check);
 EXECUTE format('ALTER POLICY %I ON storage.objects USING (bucket_id = %L AND (%s))','auth delete images','item-images',owner_check);
END $migration$;
-- Visitor tracking was removed; close the unused public event-write endpoint too.
DROP POLICY "log events" ON public.events;
REVOKE INSERT ON public.events FROM anon,authenticated;
