
INSERT INTO storage.buckets (id, name, public) VALUES ('marketing-images', 'marketing-images', true);

CREATE POLICY "Anyone can upload marketing images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'marketing-images');
CREATE POLICY "Anyone can read marketing images" ON storage.objects FOR SELECT USING (bucket_id = 'marketing-images');
