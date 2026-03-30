
DROP POLICY "Authenticated users can manage campaigns" ON public.campanhas_agendadas;

CREATE POLICY "Allow all access to campaigns"
  ON public.campanhas_agendadas
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
