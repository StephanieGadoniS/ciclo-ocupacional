import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let clienteCompartilhado: SupabaseClient | null = null;

export function obterClienteSupabase(): SupabaseClient {
  if (clienteCompartilhado) return clienteCompartilhado;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !chavePublica) {
    throw new Error(
      "A conexão com o Supabase não foi configurada. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  clienteCompartilhado = createClient(url, chavePublica, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return clienteCompartilhado;
}
