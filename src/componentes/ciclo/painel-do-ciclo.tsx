"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  obterIniciais,
  obterPrimeiroNome,
  type PerfilAutenticado,
} from "@/src/modulos/acesso/dominio/perfil-autenticado";
import {
  PAGINAS_DO_PAINEL,
  PERFIS_DE_ACESSO,
  obterPaginaPermitida,
  podeAcessarPagina,
  type PaginaDoPainel,
} from "@/src/modulos/acesso/dominio/perfil-de-acesso";
import { PoliticaDePrazoOcupacional } from "@/src/modulos/agendamentos/dominio/politica-de-prazo-ocupacional";
import {
  ROTULOS_DOS_TIPOS_DE_EXAME,
  STATUS_DO_AGENDAMENTO,
} from "@/src/modulos/agendamentos/dominio/tipos-do-agendamento";
import type { DadosDoPainel } from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import { DetalhesDoAgendamento } from "./detalhes-do-agendamento";
import { EtiquetaStatus } from "./etiqueta-status";
import { LogotipoCiclo } from "./logotipo-ciclo";
import {
  ModalAgendarExame,
  type DadosDoNovoHorario,
} from "./modal-agendar-exame";
import { ModalAgendamentosDoIndicador } from "./modal-agendamentos-do-indicador";
import { ModalCancelarAgendamento } from "./modal-cancelar-agendamento";
import {
  ModalNovaSolicitacao,
  type DadosDaNovaSolicitacao,
} from "./modal-nova-solicitacao";
import {
  CabecalhoDaPagina,
  PaginaAgendaClinica,
  PaginaColaboradores,
  PaginaConfiguracoes,
  PainelDeAgendamentos,
} from "./paginas-do-painel";

type FiltroDeStatus =
  | "todos"
  | "pendentes"
  | "agendados"
  | "concluidos"
  | "cancelados";
type TipoDeIndicador =
  | "aguardando"
  | "confirmados"
  | "atencao"
  | "realizados";

const INFORMACOES_DOS_INDICADORES: Record<
  TipoDeIndicador,
  { titulo: string; descricao: string }
> = {
  aguardando: {
    titulo: "Aguardando agenda",
    descricao: "Solicitações que ainda precisam de data e horário.",
  },
  confirmados: {
    titulo: "Confirmados",
    descricao: "Atendimentos com data e horário confirmados.",
  },
  atencao: {
    titulo: "Pedem atenção",
    descricao: "Prazos críticos e atendimentos que aguardam desfecho.",
  },
  realizados: {
    titulo: "Realizados",
    descricao: "Atendimentos concluídos pela clínica.",
  },
};

const TITULOS_DAS_PAGINAS: Record<PaginaDoPainel, string> = {
  [PAGINAS_DO_PAINEL.VISAO_GERAL]: "Visão geral",
  [PAGINAS_DO_PAINEL.AGENDAMENTOS]: "Agendamentos",
  [PAGINAS_DO_PAINEL.COLABORADORES]: "Colaboradores",
  [PAGINAS_DO_PAINEL.AGENDA_CLINICA]: "Agenda clínica",
  [PAGINAS_DO_PAINEL.CONFIGURACOES]: "Configurações",
};

interface PropriedadesDoPainel {
  perfilAutenticado: PerfilAutenticado;
  dados: DadosDoPainel;
  aoSair(): Promise<void> | void;
  aoAtualizar(): Promise<string | null>;
  aoCriarSolicitacao(dados: DadosDaNovaSolicitacao): Promise<string | null>;
  aoSalvarHorario(
    agendamentoId: string,
    dados: DadosDoNovoHorario,
  ): Promise<string | null>;
  aoConcluir(agendamentoId: string): Promise<string | null>;
  aoRegistrarFalta(agendamentoId: string): Promise<string | null>;
  aoCancelar(agendamentoId: string, motivo: string): Promise<string | null>;
}

export function PainelDoCiclo({
  perfilAutenticado,
  dados,
  aoSair,
  aoAtualizar,
  aoCriarSolicitacao,
  aoSalvarHorario,
  aoConcluir,
  aoRegistrarFalta,
  aoCancelar,
}: PropriedadesDoPainel) {
  const perfil = perfilAutenticado.papel;
  const agendamentos = dados.agendamentos;
  const [paginaAtiva, definirPaginaAtiva] = useState<PaginaDoPainel>(
    PAGINAS_DO_PAINEL.VISAO_GERAL,
  );
  const [menuAberto, definirMenuAberto] = useState(false);
  const [busca, definirBusca] = useState("");
  const [filtro, definirFiltro] = useState<FiltroDeStatus>("todos");
  const [novaSolicitacaoAberta, definirNovaSolicitacaoAberta] = useState(false);
  const [colaboradorInicialId, definirColaboradorInicialId] = useState<
    string | null
  >(null);
  const [agendamentoSelecionadoId, definirAgendamentoSelecionadoId] = useState<
    string | null
  >(null);
  const [instanteDeConsultaDoAgendamento, definirInstanteDeConsultaDoAgendamento] =
    useState(0);
  const [agendamentoParaHorarioId, definirAgendamentoParaHorarioId] = useState<
    string | null
  >(null);
  const [agendamentoParaCancelarId, definirAgendamentoParaCancelarId] =
    useState<string | null>(null);
  const [indicadorAberto, definirIndicadorAberto] =
    useState<TipoDeIndicador | null>(null);
  const [acaoEmAndamento, definirAcaoEmAndamento] = useState(false);
  const [atualizandoDados, definirAtualizandoDados] = useState(false);
  const [notificacao, definirNotificacao] = useState<{
    mensagem: string;
    tipo: "sucesso" | "erro";
  } | null>(null);

  const hoje = obterDataAtual();
  const agendamentoSelecionado = agendamentos.find(
    (item) => item.id === agendamentoSelecionadoId,
  ) ?? null;
  const agendamentoParaHorario = agendamentos.find(
    (item) => item.id === agendamentoParaHorarioId,
  ) ?? null;
  const agendamentoParaCancelar = agendamentos.find(
    (item) => item.id === agendamentoParaCancelarId,
  ) ?? null;

  const agendamentosPorIndicador = useMemo(() => {
    const agora = new Date().toISOString();
    const aguardando = agendamentos
      .filter((item) => item.status === STATUS_DO_AGENDAMENTO.SOLICITADO)
      .sort((a, b) => a.dataLimite.localeCompare(b.dataLimite));
    const confirmados = agendamentos
      .filter((item) => item.status === STATUS_DO_AGENDAMENTO.AGENDADO)
      .sort((a, b) =>
        (a.inicioAgendado ?? a.dataLimite).localeCompare(
          b.inicioAgendado ?? b.dataLimite,
        ),
      );
    const atencao = agendamentos
      .filter((item) => {
        const situacao = PoliticaDePrazoOcupacional.classificar(item, hoje);
        const aguardaDesfecho =
          item.status === STATUS_DO_AGENDAMENTO.AGENDADO &&
          Boolean(item.inicioAgendado) &&
          item.inicioAgendado! < agora;
        return situacao === "atencao" || situacao === "atrasado" || aguardaDesfecho;
      })
      .sort((a, b) => a.dataLimite.localeCompare(b.dataLimite));
    const realizados = agendamentos
      .filter((item) => item.status === STATUS_DO_AGENDAMENTO.REALIZADO)
      .sort((a, b) =>
        (b.realizadoEm ?? b.atualizadoEm).localeCompare(
          a.realizadoEm ?? a.atualizadoEm,
        ),
      );

    return { aguardando, confirmados, atencao, realizados };
  }, [agendamentos, hoje]);

  const indicadorSelecionado = indicadorAberto
    ? {
        ...INFORMACOES_DOS_INDICADORES[indicadorAberto],
        agendamentos: agendamentosPorIndicador[indicadorAberto],
      }
    : null;

  const agendamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    return agendamentos
      .filter((item) => {
        if (!termo) return true;
        return [
          item.colaborador.nome,
          item.colaborador.cargo,
          ROTULOS_DOS_TIPOS_DE_EXAME[item.tipoDeExame],
        ].some((valor) => valor.toLocaleLowerCase("pt-BR").includes(termo));
      })
      .filter((item) => {
        if (filtro === "pendentes") {
          return (
            item.status === STATUS_DO_AGENDAMENTO.SOLICITADO ||
            item.status === STATUS_DO_AGENDAMENTO.NAO_COMPARECEU
          );
        }
        if (filtro === "agendados") {
          return item.status === STATUS_DO_AGENDAMENTO.AGENDADO;
        }
        if (filtro === "concluidos") {
          return item.status === STATUS_DO_AGENDAMENTO.REALIZADO;
        }
        if (filtro === "cancelados") {
          return item.status === STATUS_DO_AGENDAMENTO.CANCELADO;
        }
        return true;
      })
      .sort((primeiro, segundo) =>
        primeiro.dataLimite.localeCompare(segundo.dataLimite),
      );
  }, [agendamentos, busca, filtro]);

  const proximosAtendimentos = agendamentos
    .filter(
      (item) =>
        item.status === STATUS_DO_AGENDAMENTO.AGENDADO &&
        item.inicioAgendado &&
        new Date(item.inicioAgendado).getTime() >= Date.now(),
    )
    .sort((a, b) =>
      (a.inicioAgendado ?? "").localeCompare(b.inicioAgendado ?? ""),
    )
    .slice(0, 3);

  const eventosDoAgendamentoSelecionado = agendamentoSelecionado
    ? dados.eventosDoAgendamento.filter(
        (evento) => evento.agendamentoId === agendamentoSelecionado.id,
      )
    : [];

  async function criarSolicitacao(
    dadosDaSolicitacao: DadosDaNovaSolicitacao,
  ): Promise<string | null> {
    const erro = await aoCriarSolicitacao(dadosDaSolicitacao);
    if (erro) return erro;

    definirColaboradorInicialId(null);
    mostrarNotificacao("Solicitação criada e enviada para a clínica.");
    return null;
  }

  async function salvarHorario(
    dadosDoHorario: DadosDoNovoHorario,
  ): Promise<string | null> {
    if (!agendamentoParaHorario) return "Solicitação não encontrada.";

    const eraReagendamento =
      Boolean(agendamentoParaHorario.inicioAgendado) ||
      agendamentoParaHorario.status === STATUS_DO_AGENDAMENTO.NAO_COMPARECEU;
    const erro = await aoSalvarHorario(
      agendamentoParaHorario.id,
      dadosDoHorario,
    );
    if (erro) return erro;

    definirAgendamentoSelecionadoId(null);
    mostrarNotificacao(
      eraReagendamento
        ? "Atendimento reagendado com sucesso."
        : "Horário confirmado com sucesso.",
    );
    return null;
  }

  async function concluirSelecionado() {
    if (!agendamentoSelecionado) return;
    await executarAcao(
      () => aoConcluir(agendamentoSelecionado.id),
      "Exame marcado como realizado.",
    );
  }

  async function registrarFaltaNoSelecionado() {
    if (!agendamentoSelecionado) return;
    await executarAcao(
      () => aoRegistrarFalta(agendamentoSelecionado.id),
      "Não comparecimento registrado.",
    );
  }

  function abrirCancelamentoDoSelecionado() {
    if (!agendamentoSelecionado) return;
    definirAgendamentoParaCancelarId(agendamentoSelecionado.id);
    definirAgendamentoSelecionadoId(null);
  }

  async function confirmarCancelamento(motivo: string): Promise<string | null> {
    if (!agendamentoParaCancelar) return "Solicitação não encontrada.";

    const erro = await aoCancelar(agendamentoParaCancelar.id, motivo);

    if (erro) {
      mostrarNotificacao(erro, "erro");
      return erro;
    }

    mostrarNotificacao(
      perfil === PERFIS_DE_ACESSO.RH
        ? "Solicitação cancelada com sucesso."
        : "Atendimento cancelado com sucesso.",
    );
    definirAgendamentoParaCancelarId(null);
    return null;
  }

  async function executarAcao(
    acao: () => Promise<string | null>,
    mensagemDeSucesso: string,
  ) {
    definirAcaoEmAndamento(true);
    const erro = await acao();
    definirAcaoEmAndamento(false);

    if (erro) {
      mostrarNotificacao(erro, "erro");
      return;
    }

    definirAgendamentoSelecionadoId(null);
    mostrarNotificacao(mensagemDeSucesso);
  }

  function mostrarNotificacao(
    mensagem: string,
    tipo: "sucesso" | "erro" = "sucesso",
  ) {
    definirNotificacao({ mensagem, tipo });
    window.setTimeout(() => definirNotificacao(null), 3500);
  }

  async function atualizarPainel() {
    definirAtualizandoDados(true);
    const erro = await aoAtualizar();
    definirAtualizandoDados(false);

    mostrarNotificacao(
      erro ?? "Dados atualizados.",
      erro ? "erro" : "sucesso",
    );
  }

  function navegarPara(pagina: PaginaDoPainel) {
    definirPaginaAtiva(obterPaginaPermitida(perfil, pagina));
    definirMenuAberto(false);
  }

  function abrirNovaSolicitacao(colaboradorId: string | null = null) {
    definirColaboradorInicialId(colaboradorId);
    definirNovaSolicitacaoAberta(true);
  }

  function selecionarAgendamento(agendamentoId: string) {
    definirInstanteDeConsultaDoAgendamento(Date.now());
    definirAgendamentoSelecionadoId(agendamentoId);
  }

  return (
    <div className="aplicacao-ciclo">
      <aside className={`barra-lateral ${menuAberto ? "barra-lateral--aberta" : ""}`}>
        <div className="barra-lateral__topo">
          <LogotipoCiclo />
          <button
            className="botao-icone botao-icone--mobile"
            type="button"
            aria-label="Fechar menu"
            onClick={() => definirMenuAberto(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav aria-label="Navegação principal">
          <p>Gestão</p>
          <button
            className={`item-menu ${
              paginaAtiva === PAGINAS_DO_PAINEL.VISAO_GERAL
                ? "item-menu--ativo"
                : ""
            }`}
            type="button"
            aria-current={
              paginaAtiva === PAGINAS_DO_PAINEL.VISAO_GERAL
                ? "page"
                : undefined
            }
            onClick={() => navegarPara(PAGINAS_DO_PAINEL.VISAO_GERAL)}
          >
            <LayoutDashboard size={19} /> Visão geral
          </button>
          <button
            className={`item-menu ${
              paginaAtiva === PAGINAS_DO_PAINEL.AGENDAMENTOS
                ? "item-menu--ativo"
                : ""
            }`}
            type="button"
            aria-current={
              paginaAtiva === PAGINAS_DO_PAINEL.AGENDAMENTOS
                ? "page"
                : undefined
            }
            onClick={() => {
              definirFiltro("todos");
              navegarPara(PAGINAS_DO_PAINEL.AGENDAMENTOS);
            }}
          >
            <ClipboardList size={19} /> Agendamentos
            <span>{agendamentos.length}</span>
          </button>
          {podeAcessarPagina(perfil, PAGINAS_DO_PAINEL.COLABORADORES) && (
            <button
              className={`item-menu ${
                paginaAtiva === PAGINAS_DO_PAINEL.COLABORADORES
                  ? "item-menu--ativo"
                  : ""
              }`}
              type="button"
              aria-current={
                paginaAtiva === PAGINAS_DO_PAINEL.COLABORADORES
                  ? "page"
                  : undefined
              }
              onClick={() => navegarPara(PAGINAS_DO_PAINEL.COLABORADORES)}
            >
              <UsersRound size={19} /> Colaboradores
            </button>
          )}
          {podeAcessarPagina(perfil, PAGINAS_DO_PAINEL.AGENDA_CLINICA) && (
            <button
              className={`item-menu ${
                paginaAtiva === PAGINAS_DO_PAINEL.AGENDA_CLINICA
                  ? "item-menu--ativo"
                  : ""
              }`}
              type="button"
              aria-current={
                paginaAtiva === PAGINAS_DO_PAINEL.AGENDA_CLINICA
                  ? "page"
                  : undefined
              }
              onClick={() => navegarPara(PAGINAS_DO_PAINEL.AGENDA_CLINICA)}
            >
              <CalendarDays size={19} /> Agenda clínica
            </button>
          )}
          <p>Conta</p>
          <button
            className={`item-menu ${
              paginaAtiva === PAGINAS_DO_PAINEL.CONFIGURACOES
                ? "item-menu--ativo"
                : ""
            }`}
            type="button"
            aria-current={
              paginaAtiva === PAGINAS_DO_PAINEL.CONFIGURACOES
                ? "page"
                : undefined
            }
            onClick={() => navegarPara(PAGINAS_DO_PAINEL.CONFIGURACOES)}
          >
            <Settings size={19} /> Configurações
          </button>
        </nav>

        <div className="cartao-seguranca">
          <ShieldCheck size={22} />
          <strong>Privacidade por padrão</strong>
          <p>O Ciclo trata somente os dados necessários para organizar o atendimento.</p>
        </div>

        <div className="usuario-lateral">
          <span className="avatar avatar--verde">
            {obterIniciais(perfilAutenticado.nomeCompleto)}
          </span>
          <div>
            <strong>{perfilAutenticado.nomeCompleto}</strong>
            <small>
              {perfil === PERFIS_DE_ACESSO.RH ? "RH" : "Clínica"} ·{" "}
              {perfilAutenticado.organizacaoNome}
            </small>
          </div>
          <button
            className="botao-sair-lateral"
            type="button"
            aria-label="Sair da conta"
            title="Sair da conta"
            onClick={() => void aoSair()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {menuAberto && (
        <button
          className="fundo-menu-mobile"
          type="button"
          aria-label="Fechar menu"
          onClick={() => definirMenuAberto(false)}
        />
      )}

      <main className="conteudo-principal">
        <header className="cabecalho-principal">
          <div className="cabecalho-principal__inicio">
            <button
              className="botao-icone botao-menu-mobile"
              type="button"
              aria-label="Abrir menu"
              onClick={() => definirMenuAberto(true)}
            >
              <Menu size={21} />
            </button>
            <div>
              <p>{formatarDataDoCabecalho()}</p>
              <strong>{TITULOS_DAS_PAGINAS[paginaAtiva]}</strong>
            </div>
          </div>
          <div className="acoes-cabecalho">
            <div className="identificador-de-perfil" aria-label="Perfil autenticado">
              <ShieldCheck size={16} />
              <span>
                <small>Acesso</small>
                <strong>
                  {perfil === PERFIS_DE_ACESSO.RH ? "Recursos Humanos" : "Clínica"}
                </strong>
              </span>
            </div>
            <button
              className="botao-icone botao-atualizar"
              type="button"
              aria-label="Atualizar dados"
              title="Atualizar dados"
              disabled={atualizandoDados}
              onClick={() => void atualizarPainel()}
            >
              <RefreshCw
                className={atualizandoDados ? "icone-girando" : undefined}
                size={19}
              />
            </button>
            {perfil === "rh" && (
              <button
                className="botao botao--primario"
                type="button"
                onClick={() => abrirNovaSolicitacao()}
              >
                <Plus size={18} /> Nova solicitação
              </button>
            )}
          </div>
        </header>

        {paginaAtiva === PAGINAS_DO_PAINEL.VISAO_GERAL && (
          <div className="pagina-painel">
          <section className="boas-vindas">
            <div>
              <span className="sinalizador-de-contexto">
                {perfil === "rh" ? "Empresa solicitante" : "Clínica responsável"}
              </span>
              <h1>Olá, {obterPrimeiroNome(perfilAutenticado.nomeCompleto)}.</h1>
              <p>
                {perfil === "rh"
                  ? "Acompanhe os exames ocupacionais sem perder prazos importantes."
                  : "Organize as solicitações recebidas e mantenha as empresas informadas."}
              </p>
            </div>
            <div className="resumo-do-dia">
              <Clock3 size={20} />
              <div>
                <strong>{proximosAtendimentos.length} atendimentos próximos</strong>
                <span>Sincronização automática entre RH e clínica</span>
              </div>
            </div>
          </section>

          <section className="grade-indicadores" aria-label="Resumo dos agendamentos">
            <CartaoIndicador
              titulo="Aguardando agenda"
              valor={agendamentosPorIndicador.aguardando.length}
              detalhe="Solicitações enviadas"
              icone={<ClipboardList size={20} />}
              tom="azul"
              aoAbrir={() => definirIndicadorAberto("aguardando")}
            />
            <CartaoIndicador
              titulo="Confirmados"
              valor={agendamentosPorIndicador.confirmados.length}
              detalhe="Horários confirmados"
              icone={<CalendarDays size={20} />}
              tom="verde"
              aoAbrir={() => definirIndicadorAberto("confirmados")}
            />
            <CartaoIndicador
              titulo="Pedem atenção"
              valor={agendamentosPorIndicador.atencao.length}
              detalhe="Prazos ou desfechos pendentes"
              icone={<Clock3 size={20} />}
              tom="laranja"
              aoAbrir={() => definirIndicadorAberto("atencao")}
            />
            <CartaoIndicador
              titulo="Realizados"
              valor={agendamentosPorIndicador.realizados.length}
              detalhe="Atendimentos concluídos"
              icone={<CheckCircle2 size={20} />}
              tom="lilas"
              aoAbrir={() => definirIndicadorAberto("realizados")}
            />
          </section>

          <div className="grade-conteudo">
            <section className="painel painel--agendamentos">
              <header className="cabecalho-do-painel">
                <div>
                  <h2>Agendamentos ocupacionais</h2>
                  <p>Prioridade organizada pela data limite.</p>
                </div>
                <div className="controles-da-lista">
                  <label className="campo-de-busca">
                    <Search size={17} aria-hidden="true" />
                    <span className="sr-only">Buscar agendamento</span>
                    <input
                      type="search"
                      placeholder="Buscar colaborador"
                      value={busca}
                      onChange={(evento) => definirBusca(evento.target.value)}
                    />
                  </label>
                  <select
                    className="filtro-status"
                    aria-label="Filtrar por status"
                    value={filtro}
                    onChange={(evento) => definirFiltro(evento.target.value as FiltroDeStatus)}
                  >
                    <option value="todos">Todos</option>
                    <option value="pendentes">Pendentes</option>
                    <option value="agendados">Agendados</option>
                    <option value="concluidos">Concluídos</option>
                    <option value="cancelados">Cancelados</option>
                  </select>
                </div>
              </header>

              <div className="tabela-responsiva">
                <table>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Exame</th>
                      <th>Prazo / horário</th>
                      <th>Status</th>
                      <th><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendamentosFiltrados.map((agendamento) => {
                      const situacao = PoliticaDePrazoOcupacional.classificar(
                        agendamento,
                        hoje,
                      );
                      return (
                        <tr key={agendamento.id}>
                          <td>
                            <button
                              className="identidade-colaborador"
                              type="button"
                              onClick={() => selecionarAgendamento(agendamento.id)}
                            >
                              <span className={`avatar avatar--${agendamento.colaborador.cor}`}>
                                {agendamento.colaborador.iniciais}
                              </span>
                              <span>
                                <strong>{agendamento.colaborador.nome}</strong>
                                <small>{agendamento.colaborador.cargo}</small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <strong className="tipo-de-exame">
                              {ROTULOS_DOS_TIPOS_DE_EXAME[agendamento.tipoDeExame]}
                            </strong>
                            <small className="matricula">{agendamento.colaborador.matricula}</small>
                          </td>
                          <td>
                            <span className={`prazo prazo--${situacao}`}>
                              {agendamento.inicioAgendado
                                ? formatarDataHoraCurta(agendamento.inicioAgendado)
                                : `Até ${formatarData(agendamento.dataLimite)}`}
                            </span>
                            <small>
                              {situacao === "atrasado"
                                ? "Fora do prazo"
                                : agendamento.recursoDaClinicaNome ?? "Horário pendente"}
                            </small>
                          </td>
                          <td><EtiquetaStatus status={agendamento.status} /></td>
                          <td>
                            <button
                              className="botao-ver"
                              type="button"
                              onClick={() => selecionarAgendamento(agendamento.id)}
                            >
                              Ver detalhes
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {agendamentosFiltrados.length === 0 && (
                  <div className="estado-vazio">
                    <Search size={24} />
                    <strong>Nenhum agendamento encontrado</strong>
                    <p>Tente ajustar a busca ou o filtro selecionado.</p>
                  </div>
                )}
              </div>
            </section>

            <aside className="painel painel--proximos">
              <header className="cabecalho-do-painel">
                <div>
                  <h2>Próximos</h2>
                  <p>Agenda confirmada</p>
                </div>
                <CalendarDays size={20} />
              </header>
              <div className="lista-proximos">
                {proximosAtendimentos.map((agendamento) => (
                  <button
                    key={agendamento.id}
                    className="proximo-atendimento"
                    type="button"
                    onClick={() => selecionarAgendamento(agendamento.id)}
                  >
                    <span className="data-do-atendimento">
                      <strong>{obterDia(agendamento.inicioAgendado!)}</strong>
                      <small>{obterMes(agendamento.inicioAgendado!)}</small>
                    </span>
                    <span>
                      <strong>{agendamento.colaborador.nome}</strong>
                      <small>{ROTULOS_DOS_TIPOS_DE_EXAME[agendamento.tipoDeExame]}</small>
                      <em>{obterHora(agendamento.inicioAgendado!)}</em>
                    </span>
                  </button>
                ))}
              </div>
              <button
                className="botao botao--secundario botao--largura-total"
                type="button"
                onClick={() =>
                  navegarPara(
                    perfil === PERFIS_DE_ACESSO.CLINICA
                      ? PAGINAS_DO_PAINEL.AGENDA_CLINICA
                      : PAGINAS_DO_PAINEL.AGENDAMENTOS,
                  )
                }
              >
                Ver agenda completa
              </button>
            </aside>
          </div>
          </div>
        )}

        {paginaAtiva === PAGINAS_DO_PAINEL.AGENDAMENTOS && (
          <div className="pagina-painel">
            <div className="pagina-interna">
              <CabecalhoDaPagina
                sobrelinha={
                  perfil === PERFIS_DE_ACESSO.RH
                    ? "Empresa solicitante"
                    : "Clínica responsável"
                }
                titulo="Agendamentos"
                descricao={
                  perfil === PERFIS_DE_ACESSO.RH
                    ? "Acompanhe solicitações, horários e conclusão dos exames da empresa."
                    : "Atenda solicitações, confirme horários e registre os comparecimentos."
                }
              />
              <PainelDeAgendamentos
                agendamentos={agendamentos}
                busca={busca}
                filtro={filtro}
                hoje={hoje}
                aoBuscar={definirBusca}
                aoFiltrar={definirFiltro}
                aoSelecionar={selecionarAgendamento}
              />
            </div>
          </div>
        )}

        {paginaAtiva === PAGINAS_DO_PAINEL.COLABORADORES &&
          perfil === PERFIS_DE_ACESSO.RH && (
            <div className="pagina-painel">
              <PaginaColaboradores
                colaboradores={dados.colaboradores}
                aoSolicitarExame={(colaboradorId) =>
                  abrirNovaSolicitacao(colaboradorId)
                }
              />
            </div>
          )}

        {paginaAtiva === PAGINAS_DO_PAINEL.AGENDA_CLINICA &&
          perfil === PERFIS_DE_ACESSO.CLINICA && (
            <div className="pagina-painel">
              <PaginaAgendaClinica
                agendamentos={agendamentos}
                aoSelecionar={selecionarAgendamento}
                aoAgendar={definirAgendamentoParaHorarioId}
              />
            </div>
          )}

        {paginaAtiva === PAGINAS_DO_PAINEL.CONFIGURACOES && (
          <div className="pagina-painel">
            <PaginaConfiguracoes
              perfil={perfil}
              perfilAutenticado={perfilAutenticado}
            />
          </div>
        )}
      </main>

      <ModalNovaSolicitacao
        key={
          novaSolicitacaoAberta
            ? `nova-${colaboradorInicialId ?? "sem-colaborador"}`
            : "nova-fechada"
        }
        aberto={novaSolicitacaoAberta}
        colaboradores={dados.colaboradores}
        colaboradorInicialId={colaboradorInicialId}
        aoFechar={() => {
          definirNovaSolicitacaoAberta(false);
          definirColaboradorInicialId(null);
        }}
        aoSalvar={criarSolicitacao}
      />
      <ModalAgendamentosDoIndicador
        aberto={indicadorSelecionado !== null}
        titulo={indicadorSelecionado?.titulo ?? ""}
        descricao={indicadorSelecionado?.descricao ?? ""}
        agendamentos={indicadorSelecionado?.agendamentos ?? []}
        hoje={hoje}
        aoFechar={() => definirIndicadorAberto(null)}
        aoSelecionar={(agendamentoId) => {
          definirIndicadorAberto(null);
          selecionarAgendamento(agendamentoId);
        }}
      />
      <DetalhesDoAgendamento
        agendamento={agendamentoSelecionado}
        eventos={eventosDoAgendamentoSelecionado}
        perfil={perfil}
        instanteDeConsulta={instanteDeConsultaDoAgendamento}
        processando={acaoEmAndamento}
        aoFechar={() => definirAgendamentoSelecionadoId(null)}
        aoAgendar={() => {
          definirAgendamentoParaHorarioId(agendamentoSelecionadoId);
          definirAgendamentoSelecionadoId(null);
        }}
        aoConcluir={concluirSelecionado}
        aoRegistrarFalta={registrarFaltaNoSelecionado}
        aoCancelar={abrirCancelamentoDoSelecionado}
      />
      <ModalAgendarExame
        key={agendamentoParaHorarioId ?? "horario-fechado"}
        agendamento={agendamentoParaHorario}
        agendamentos={agendamentos}
        recursos={dados.recursosDaClinica}
        aoFechar={() => definirAgendamentoParaHorarioId(null)}
        aoSalvar={salvarHorario}
      />
      <ModalCancelarAgendamento
        key={agendamentoParaCancelarId ?? "cancelamento-fechado"}
        agendamento={agendamentoParaCancelar}
        perfil={perfil}
        aoFechar={() => definirAgendamentoParaCancelarId(null)}
        aoConfirmar={confirmarCancelamento}
      />

      {notificacao && (
        <div
          className={`notificacao notificacao--${notificacao.tipo}`}
          role={notificacao.tipo === "erro" ? "alert" : "status"}
        >
          {notificacao.tipo === "sucesso" && <CheckCircle2 size={19} />}
          {notificacao.tipo === "erro" && <AlertTriangle size={19} />}
          {notificacao.mensagem}
        </div>
      )}
    </div>
  );
}

function CartaoIndicador({
  titulo,
  valor,
  detalhe,
  icone,
  tom,
  aoAbrir,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  icone: React.ReactNode;
  tom: string;
  aoAbrir?(): void;
}) {
  const conteudo = (
    <>
      <span className={`cartao-indicador__icone cartao-indicador__icone--${tom}`}>
        {icone}
      </span>
      <div>
        <small>{titulo}</small>
        <strong>{valor.toString().padStart(2, "0")}</strong>
        <p>{detalhe}</p>
      </div>
      {aoAbrir && (
        <span className="cartao-indicador__acao" aria-hidden="true">
          Abrir <ChevronRight size={15} />
        </span>
      )}
    </>
  );

  if (aoAbrir) {
    return (
      <button
        className="cartao-indicador cartao-indicador--interativo"
        type="button"
        aria-haspopup="dialog"
        aria-label={`Abrir ${titulo}: ${valor} ${
          valor === 1 ? "agendamento" : "agendamentos"
        }`}
        onClick={aoAbrir}
      >
        {conteudo}
      </button>
    );
  }

  return (
    <article className="cartao-indicador">
      {conteudo}
    </article>
  );
}

function obterDataAtual(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function formatarDataDoCabecalho(): string {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatarData(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${data}T12:00:00Z`));
}

function formatarDataHoraCurta(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data));
}

function obterDia(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data));
}

function obterMes(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "America/Sao_Paulo",
  })
    .format(new Date(data))
    .replace(".", "")
    .toUpperCase();
}

function obterHora(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data));
}
