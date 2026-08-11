import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const chaveDeServico = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !chaveDeServico) {
  throw new Error(
    "Preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local.",
  );
}

const supabase = createClient(url, chaveDeServico, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const usuarios = [
  {
    email: "rh@ciclo.test",
    senha: "CicloRH#2026!",
    nomeCompleto: "Mariana Costa",
    papel: "rh",
  },
  {
    email: "clinica@ciclo.test",
    senha: "CicloClinica#2026!",
    nomeCompleto: "Lucas Martins",
    papel: "clinica",
  },
];

for (const usuario of usuarios) {
  const existente = await localizarUsuarioPorEmail(usuario.email);

  if (existente) {
    const { error } = await supabase.auth.admin.updateUserById(existente.id, {
      password: usuario.senha,
      email_confirm: true,
      user_metadata: {
        nome_completo: usuario.nomeCompleto,
        papel_demonstrativo: usuario.papel,
      },
    });

    if (error) throw error;
    console.log(`Usuário atualizado: ${usuario.email}`);
    continue;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: usuario.email,
    password: usuario.senha,
    email_confirm: true,
    user_metadata: {
      nome_completo: usuario.nomeCompleto,
      papel_demonstrativo: usuario.papel,
    },
  });

  if (error) throw error;
  console.log(`Usuário criado: ${usuario.email}`);
}

console.log("Usuários de demonstração prontos. Agora execute supabase/dados-de-demonstracao.sql.");

async function localizarUsuarioPorEmail(email) {
  let pagina = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pagina,
      perPage: 100,
    });

    if (error) throw error;

    const usuario = data.users.find(
      (item) => item.email?.toLowerCase() === email.toLowerCase(),
    );
    if (usuario) return usuario;
    if (data.users.length < 100) return null;

    pagina += 1;
  }
}
