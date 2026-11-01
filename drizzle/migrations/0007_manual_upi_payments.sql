ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS upi_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS screenshot_url text;
COMMENT ON COLUMN public.app_settings.upi_id IS 'Institute UPI ID used for manual UPI payments, editable by admin';
COMMENT ON COLUMN public.payments.screenshot_url IS 'Payment confirmation screenshot uploaded by the student (manual UPI flow)';
UPDATE public.app_settings SET upi_id = 'shu780067@okicici' WHERE id = true AND upi_id IS NULL;
CREATE POLICY "payment screenshots owner write" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'media') AND (storage.foldername(name))[1] = 'payment-screenshots' AND (storage.foldername(name))[2] = (auth.uid())::text);