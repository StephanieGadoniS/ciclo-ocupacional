"use client";

import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { obterClienteSupabase } from "@/src/infraestrutura/supabase/cliente-do-navegador";
import type { PerfilAutenticado } from "@/src/modulos/acesso/dominio/perfil-autenticado";
import {
  ErroDeAutenticacao,
  ServicoDeAutenticacaoSupabase,
} from "@/src/modulos/acesso/infraestrutura/servico-de-autenticacao-supabase";
import type { DadosDoPainel } from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import {
  ErroDePersistencia,
  RepositorioDoPainelSupabase,
} from "@/src/modulos/agendamentos/infraestrutura/repositorio-do-painel-supabase";
import { ErroDeDominio } from "@/src/modulos/agendamentos/dominio/erro-de-dominio";
import { TelaDeLogin } from "../acesso/tela-de-login";
import { LogotipoCiclo } from "./logotipo-ciclo";
import { PainelDoCiclo } from "./painel-do-ciclo";

type EstadoDoPortal =
  | { tipo: "carregando" }
  | { tipo: "anonimo" }
  | {
      tipo: "autenticado";
      perfil: PerfilAutenticado;
      dados: DadosDoPainel;
    }
  | {
      tipo: "erro";
      mensagem: string;
      perfil: PerfilAutenticado | null;
    };

export function PortalDoCiclo() {
  const [estado, definirEstado] = useState<EstadoDoPortal>({ tipo: "carregando" });
  const estadoAtual = useRef<EstadoDoPortal>(estado);

  useEffect(() => {
    estadoAtual.current = estado;
  }, [estado]);

  const carregarSessao = useCallback(async () => {
    try {
      const cliente = obterClienteSupabase();
      const autenticacao = new ServicoDeAutenticacaoSupabase(cliente);
      const perfil = await autenticacao.obterPerfilDaSessaoAtual();

      if (!perfil) {
        definirEstado({ tipo: "anonimo" });
        return;
      }

      const repositorio = new RepositorioDoPainelSupabase(cliente, perfil);
      const dados = await repositorio.carregarDados();
      definirEstado({ tipo: "autenticado", perfil, dados });
    } catch (erro) {
      definirEstado({
        tipo: "erro",
        mensagem: obterMensagemDoErro(erro),
        perfil: null,
      });
    }
  }, []);

  async function tentarNovamente(): Promise<void> {
    definirEstado({ tipo: "carregando" });
    await carregarSessao();
  }

  useEffect(() => {
    const identificador = window.setTimeout(() => {
      void carregarSessao();
    }, 0);

    return () => window.clearTimeout(identificador);
  }, [carregarSessao]);

  const usuarioAutenticadoId =
    estado.tipo === "autenticado" ? estado.perfil.usuarioId : null;
  const organizacaoAutenticadaId =
    estado.tipo === "autenticado" ? estado.perfil.organizacaoId : null;
  const papelAutenticado =
    estado.tipo === "autenticado" ? estado.perfil.papel : null;

  useEffect(() => {
    if (!usuarioAutenticadoId || !organizacaoAutenticadaId || !papelAutenticado) {
      return;
    }

    const cliente = obterClienteSupabase();
    let temporizador: number | null = null;
    let ativo = true;

    const atualizarAposMudanca = () => {
      if (temporizador !== null) window.clearTimeout(temporizador);
      temporizador = window.setTimeout(async () => {
        try {
          const estadoDaSessao = estadoAtual.current;
          const perfilAtual =
            estadoDaSessao.tipo === "autenticado" &&
            estadoDaSessao.perfil.usuarioId === usuarioAutenticadoId
              ? estadoDaSessao.perfil
              : null;
          if (!perfilAtual || !ativo) return;

          const dados = await new RepositorioDoPainelSupabase(
            cliente,
            perfilAtual,
          ).carregarDados();

          if (!ativo) return;
          definirEstado((estadoAtual) =>
            estadoAtual.tipo === "autenticado" &&
            estadoAtual.perfil.usuarioId === usuarioAutenticadoId
              ? { ...estadoAtual, dados }
              : estadoAtual,
          );
        } catch {
          // A atualização manual permanece disponível caso o canal seja interrompido.
        }
      }, 180);
    };

    const colunaDaOrganizacao =
      papelAutenticado === "rh" ? "empresa_id" : "clinica_id";
    const canal = cliente
      .channel(`ciclo-agendamentos-${usuarioAutenticadoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agendamentos_ocupacionais",
          filter: `${colunaDaOrganizacao}=eq.${organizacaoAutenticadaId}`,
        },
        atualizarAposMudanca,
      )
      .subscribe();

    return () => {
      ativo = false;
      if (temporizador !== null) window.clearTimeout(temporizador);
      void cliente.removeChannel(canal);
    };
  }, [
    organizacaoAutenticadaId,
    papelAutenticado,
    usuarioAutenticadoId,
  ]);

  async function entrar(email: string, senha: string): Promise<string | null> {
    try {
      const cliente = obterClienteSupabase();
      const autenticacao = new ServicoDeAutenticacaoSupabase(cliente);
      const perfil = await autenticacao.entrarComEmailESenha(email, senha);
      const repositorio = new RepositorioDoPainelSupabase(cliente, perfil);
      const dados = await repositorio.carregarDados();
      definirEstado({ tipo: "autenticado", perfil, dados });
      return null;
    } catch (erro) {
      return obterMensagemDoErro(erro);
    }
  }

  async function sair(): Promise<void> {
    const estadoAnterior = estado;
    definirEstado({ tipo: "carregando" });

    try {
      const autenticacao = new ServicoDeAutenticacaoSupabase(
        obterClienteSupabase(),
      );
      await autenticacao.sair();
      definirEstado({ tipo: "anonimo" });
    } catch {
      definirEstado(estadoAnterior);
    }
  }

  async function executarEAtualizar(
    operacao: (repositorio: RepositorioDoPainelSupabase) => Promise<void>,
  ): Promise<string | null> {
    if (estado.tipo !== "autenticado") {
      return "Sua sessão não está mais disponível. Entre novamente.";
    }

    try {
      const repositorio = new RepositorioDoPainelSupabase(
        obterClienteSupabase(),
        estado.perfil,
      );
      await operacao(repositorio);
      const dados = await repositorio.carregarDados();
      definirEstado({ ...estado, dados });
      return null;
    } catch (erro) {
      return obterMensagemDoErro(erro);
    }
  }

  async function atualizarDados(): Promise<string | null> {
    if (estado.tipo !== "autenticado") {
      return "Sua sessão não está mais disponível. Entre novamente.";
    }

    try {
      const repositorio = new RepositorioDoPainelSupabase(
        obterClienteSupabase(),
        estado.perfil,
      );
      const dados = await repositorio.carregarDados();
      definirEstado({ ...estado, dados });
      return null;
    } catch (erro) {
      return obterMensagemDoErro(erro);
    }
  }

  if (estado.tipo === "carregando") return <TelaDeCarregamento />;
  if (estado.tipo === "anonimo") return <TelaDeLogin aoEntrar={entrar} />;
  if (estado.tipo === "erro") {
    return (
      <TelaDeErro
        mensagem={estado.mensagem}
        aoTentarNovamente={tentarNovamente}
        aoSair={estado.perfil ? sair : undefined}
      />
    );
  }

  const clinicaPadraoId = estado.dados.clinicasRelacionadas[0]?.id ?? "";

  return (
    <PainelDoCiclo
      dados={estado.dados}
      perfilAutenticado={estado.perfil}
      aoSair={sair}
      aoAtualizar={atualizarDados}
      aoCriarSolicitacao={(dados) =>
        executarEAtualizar((repositorio) =>
          repositorio.criarSolicitacao(dados, clinicaPadraoId),
        )
      }
      aoSalvarHorario={(agendamentoId, dados) =>
        executarEAtualizar((repositorio) =>
          repositorio.confirmarHorario(agendamentoId, dados),
        )
      }
      aoConcluir={(agendamentoId) =>
        executarEAtualizar((repositorio) =>
          repositorio.concluir(agendamentoId),
        )
      }
      aoRegistrarFalta={(agendamentoId) =>
        executarEAtualizar((repositorio) =>
          repositorio.registrarNaoComparecimento(agendamentoId),
        )
      }
      aoCancelar={(agendamentoId, motivo) =>
        executarEAtualizar((repositorio) =>
          repositorio.cancelar(agendamentoId, motivo),
        )
      }
    />
  );
}

function TelaDeCarregamento() {
  return (
    <main className="tela-de-estado">
      <LogotipoCiclo />
      <LoaderCircle className="icone-girando" size={28} />
      <p>Preparando seu ambiente seguro...</p>
    </main>
  );
}

function TelaDeErro({
  mensagem,
  aoTentarNovamente,
  aoSair,
}: {
  mensagem: string;
  aoTentarNovamente(): Promise<void>;
  aoSair?: () => Promise<void>;
}) {
  return (
    <main className="tela-de-estado">
      <div className="cartao-de-estado">
        <span className="cartao-de-estado__icone">
          <AlertTriangle size={24} />
        </span>
        <h1>Não foi possível abrir o Ciclo</h1>
        <p>{mensagem}</p>
        <div className="grupo-de-acoes">
          {aoSair && (
            <button className="botao botao--secundario" type="button" onClick={aoSair}>
              Sair da conta
            </button>
          )}
          <button
            className="botao botao--primario"
            type="button"
            onClick={() => void aoTentarNovamente()}
          >
            <RefreshCw size={17} /> Tentar novamente
          </button>
        </div>
      </div>
    </main>
  );
}

function obterMensagemDoErro(erro: unknown): string {
  if (
    erro instanceof ErroDeAutenticacao ||
    erro instanceof ErroDePersistencia ||
    erro instanceof ErroDeDominio ||
    erro instanceof Error
  ) {
    return erro.message;
  }

  return "Ocorreu uma falha inesperada. Tente novamente.";
}
