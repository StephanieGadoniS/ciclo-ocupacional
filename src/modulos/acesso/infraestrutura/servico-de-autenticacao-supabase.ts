import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import {
  PERFIS_DE_ACESSO,
  type PerfilDeAcesso,
} from "../dominio/perfil-de-acesso";
import type { PerfilAutenticado } from "../dominio/perfil-autenticado";

const esquemaDoPerfil = z.object({
  id: z.string().uuid(),
  organizacao_id: z.string().uuid(),
  nome_completo: z.string().min(2),
  papel: z.enum([PERFIS_DE_ACESSO.RH, PERFIS_DE_ACESSO.CLINICA]),
});

const esquemaDaOrganizacao = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2),
});

export class ErroDeAutenticacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeAutenticacao";
  }
}

export class ServicoDeAutenticacaoSupabase {
  constructor(private readonly cliente: SupabaseClient) {}

  async entrarComEmailESenha(
    email: string,
    senha: string,
  ): Promise<PerfilAutenticado> {
    const { data, error } = await this.cliente.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });

    if (error || !data.user) {
      throw new ErroDeAutenticacao(
        "E-mail ou senha inválidos. Confira os dados e tente novamente.",
      );
    }

    try {
      return await this.carregarPerfil(data.user);
    } catch (erro) {
      await this.cliente.auth.signOut();
      throw erro;
    }
  }

  async obterPerfilDaSessaoAtual(): Promise<PerfilAutenticado | null> {
    const { data, error } = await this.cliente.auth.getUser();

    if (error || !data.user) return null;
    return this.carregarPerfil(data.user);
  }

  async sair(): Promise<void> {
    const { error } = await this.cliente.auth.signOut();
    if (error) {
      throw new ErroDeAutenticacao(
        "Não foi possível encerrar a sessão. Tente novamente.",
      );
    }
  }

  private async carregarPerfil(usuario: User): Promise<PerfilAutenticado> {
    const { data: perfilBruto, error: erroDoPerfil } = await this.cliente
      .from("perfis")
      .select("id, organizacao_id, nome_completo, papel")
      .eq("id", usuario.id)
      .single();

    if (erroDoPerfil || !perfilBruto) {
      throw new ErroDeAutenticacao(
        "Seu login existe, mas ainda não possui um perfil de RH ou clínica. Verifique a preparação dos dados de demonstração.",
      );
    }

    const resultadoDoPerfil = esquemaDoPerfil.safeParse(perfilBruto);
    if (!resultadoDoPerfil.success) {
      throw new ErroDeAutenticacao(
        "O perfil autenticado possui dados inválidos. Revise o cadastro no Supabase.",
      );
    }

    const perfil = resultadoDoPerfil.data;
    const { data: organizacaoBruta, error: erroDaOrganizacao } =
      await this.cliente
        .from("organizacoes")
        .select("id, nome")
        .eq("id", perfil.organizacao_id)
        .single();

    if (erroDaOrganizacao || !organizacaoBruta) {
      throw new ErroDeAutenticacao(
        "Não foi possível identificar a organização vinculada ao usuário.",
      );
    }

    const organizacao = esquemaDaOrganizacao.parse(organizacaoBruta);

    return {
      usuarioId: perfil.id,
      email: usuario.email ?? "",
      nomeCompleto: perfil.nome_completo,
      papel: perfil.papel as PerfilDeAcesso,
      organizacaoId: organizacao.id,
      organizacaoNome: organizacao.nome,
    };
  }
}
