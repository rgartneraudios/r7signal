CREATE OR REPLACE FUNCTION descontar_credito(
  p_user_id uuid,
  p_coste float8,
  p_tokens int4
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.balances
  SET 
    credito = credito - p_coste,
    tokens_usados = tokens_usados + p_tokens,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;