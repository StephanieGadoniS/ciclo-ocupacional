"use client";

import {
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PerfilAutenticado } from "@/src/modulos/acesso/dominio/perfil-autenticado";
import type { PerfilDeAcesso } from "@/src/modulos/acesso/dominio/perfil-de-acesso";
import {
  ROTULOS_DOS_TIPOS_DE_EXAME,
  STATUS_DO_AGENDAMENTO,
} from "@/src/modulos/agendamentos/dominio/tipos-do-agendamento";
import { PoliticaDePrazoOcupacional } from "@/src/modulos/agendamentos/dominio/politica-de-prazo-ocupacional";
import type {
  AgendamentoParaPainel,
  ColaboradorParaSelecao,
} from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import { EtiquetaStatus } from "./etiqueta-status";

export type FiltroDeStatus =
  | "todos"
  | "pendentes"
  | "agendados"
  | "concluidos"
  | "cancelados";

interface PropriedadesDoPainelDeAgendamentos {
  agendamentos: AgendamentoParaPainel[];
  busca: string;
  filtro: FiltroDeStatus;
  hoje: string;
  titulo?: string;
  descricao?: string;
  aoBuscar(valor: string): void;
  aoFiltrar(valor: FiltroDeStatus): void;
  aoSelecionar(id: string): void;
}

export function PainelDeAgendamentos({
  agendamentos,
  busca,
  filtro,
  hoje,
  titulo = "Agendamentos ocupacionais",
  descricao = "Prioridade organizada pela data limite.",
  aoBuscar,
  aoFiltrar,
  aoSelecionar,
}: PropriedadesDoPainelDeAgendamentos) {
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

  return (
    <section className="painel painel--agendamentos">
      <header className="cabecalho-do-painel">
        <div>
          <h2>{titulo}</h2>
          <p>{descricao}</p>
        </div>
        <div className="controles-da-lista">
          <label className="campo-de-busca">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Buscar agendamento</span>
            <input
              type="search"
              placeholder="Buscar colaborador"
              value={busca}
              onChange={(evento) => aoBuscar(evento.target.value)}
            />
          </label>
          <select
            className="filtro-status"
            aria-label="Filtrar por status"
            value={filtro}
            onChange={(evento) =>
              aoFiltrar(evento.target.value as FiltroDeStatus)
            }
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
              <th>
                <span className="sr-only">Ações</span>
              </th>
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
                      onClick={() => aoSelecionar(agendamento.id)}
                    >
                      <span
                        className={`avatar avatar--${agendamento.colaborador.cor}`}
                      >
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
                    <small className="matricula">
                      {agendamento.colaborador.matricula}
                    </small>
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
                  <td>
                    <EtiquetaStatus status={agendamento.status} />
                  </td>
                  <td>
                    <button
                      className="botao-ver"
                      type="button"
                      onClick={() => aoSelecionar(agendamento.id)}
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
  );
}

export function PaginaColaboradores({
  colaboradores,
  aoSolicitarExame,
}: {
  colaboradores: ColaboradorParaSelecao[];
  aoSolicitarExame(colaboradorId: string): void;
}) {
  const [busca, definirBusca] = useState("");
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const colaboradoresFiltrados = colaboradores.filter((colaborador) =>
    [colaborador.nome, colaborador.cargo, colaborador.matricula].some((valor) =>
      valor.toLocaleLowerCase("pt-BR").includes(termo),
    ),
  );

  return (
    <div className="pagina-interna">
      <CabecalhoDaPagina
        sobrelinha="Empresa solicitante"
        titulo="Colaboradores"
        descricao="Cadastros disponíveis para abertura de solicitações ocupacionais."
      />

      <section className="painel">
        <header className="cabecalho-do-painel">
          <div>
            <h2>Equipe cadastrada</h2>
            <p>{colaboradoresFiltrados.length} colaboradores encontrados</p>
          </div>
          <label className="campo-de-busca">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Buscar colaborador</span>
            <input
              type="search"
              placeholder="Nome, cargo ou matrícula"
              value={busca}
              onChange={(evento) => definirBusca(evento.target.value)}
            />
          </label>
        </header>

        <div className="grade-colaboradores">
          {colaboradoresFiltrados.map((colaborador) => (
            <article className="cartao-colaborador" key={colaborador.id}>
              <span className={`avatar avatar--${colaborador.cor}`}>
                {colaborador.iniciais}
              </span>
              <div className="cartao-colaborador__dados">
                <strong>{colaborador.nome}</strong>
                <span>{colaborador.cargo}</span>
                <small>
                  {colaborador.matricula} · {colaborador.cpfMascarado}
                </small>
              </div>
              <button
                className="botao botao--secundario"
                type="button"
                onClick={() => aoSolicitarExame(colaborador.id)}
              >
                <Plus size={16} /> Solicitar exame
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PaginaAgendaClinica({
  agendamentos,
  aoSelecionar,
  aoAgendar,
}: {
  agendamentos: AgendamentoParaPainel[];
  aoSelecionar(id: string): void;
  aoAgendar(id: string): void;
}) {
  const hoje = obterDataAtual();
  const pendentes = agendamentos.filter(
    (item) =>
      item.status === STATUS_DO_AGENDAMENTO.SOLICITADO ||
      item.status === STATUS_DO_AGENDAMENTO.NAO_COMPARECEU,
  );
  const confirmados = agendamentos
    .filter(
      (item) =>
        item.status === STATUS_DO_AGENDAMENTO.AGENDADO && item.inicioAgendado,
    )
    .sort((a, b) =>
      (a.inicioAgendado ?? "").localeCompare(b.inicioAgendado ?? ""),
    );

  return (
    <div className="pagina-interna">
      <CabecalhoDaPagina
        sobrelinha="Clínica responsável"
        titulo="Agenda clínica"
        descricao="Confirme solicitações recebidas e acompanhe os atendimentos do dia."
      />

      <div className="grade-agenda-clinica">
        <section className="painel">
          <header className="cabecalho-do-painel">
            <div>
              <h2>Solicitações aguardando horário</h2>
              <p>Priorize os exames com prazo mais próximo.</p>
            </div>
            <CalendarClock size={20} />
          </header>
          <div className="lista-operacional">
            {pendentes.map((agendamento) => (
              <article className="item-operacional" key={agendamento.id}>
                <span className={`avatar avatar--${agendamento.colaborador.cor}`}>
                  {agendamento.colaborador.iniciais}
                </span>
                <div>
                  <strong>{agendamento.colaborador.nome}</strong>
                  <span>
                    {ROTULOS_DOS_TIPOS_DE_EXAME[agendamento.tipoDeExame]}
                  </span>
                  <small>Prazo: {formatarData(agendamento.dataLimite)}</small>
                </div>
                <button
                  className="botao botao--primario"
                  disabled={
                    agendamento.status === STATUS_DO_AGENDAMENTO.SOLICITADO &&
                    agendamento.dataLimite < hoje
                  }
                  type="button"
                  title={
                    agendamento.status === STATUS_DO_AGENDAMENTO.SOLICITADO &&
                    agendamento.dataLimite < hoje
                      ? "O prazo ocupacional encerrou"
                      : undefined
                  }
                  onClick={() => aoAgendar(agendamento.id)}
                >
                  {agendamento.status === STATUS_DO_AGENDAMENTO.SOLICITADO &&
                  agendamento.dataLimite < hoje
                    ? "Prazo encerrado"
                    : agendamento.status ===
                        STATUS_DO_AGENDAMENTO.NAO_COMPARECEU
                      ? "Reagendar"
                      : "Definir horário"}
                </button>
              </article>
            ))}
            {pendentes.length === 0 && (
              <EstadoVazio
                icone={<CalendarClock size={25} />}
                titulo="Nenhuma solicitação pendente"
                descricao="Novas solicitações aparecerão aqui."
              />
            )}
          </div>
        </section>

        <section className="painel">
          <header className="cabecalho-do-painel">
            <div>
              <h2>Atendimentos agendados</h2>
              <p>Abra um item para registrar o comparecimento.</p>
            </div>
            <CalendarDays size={20} />
          </header>
          <div className="lista-operacional">
            {confirmados.map((agendamento) => (
              <button
                className="item-operacional item-operacional--botao"
                type="button"
                key={agendamento.id}
                onClick={() => aoSelecionar(agendamento.id)}
              >
                <span className="data-do-atendimento">
                  <strong>{obterDia(agendamento.inicioAgendado!)}</strong>
                  <small>{obterMes(agendamento.inicioAgendado!)}</small>
                </span>
                <span>
                  <strong>{agendamento.colaborador.nome}</strong>
                  <small>
                    {ROTULOS_DOS_TIPOS_DE_EXAME[agendamento.tipoDeExame]}
                  </small>
                </span>
                <span className="acao-atendimento">
                  <strong>{obterHora(agendamento.inicioAgendado!)}</strong>
                  <small>Registrar atendimento</small>
                  <ChevronRight size={17} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function PaginaConfiguracoes({
  perfil,
  perfilAutenticado,
}: {
  perfil: PerfilDeAcesso;
  perfilAutenticado: PerfilAutenticado;
}) {
  const ehRh = perfil === "rh";

  return (
    <div className="pagina-interna pagina-interna--estreita">
      <CabecalhoDaPagina
        sobrelinha="Conta"
        titulo="Configurações"
        descricao="Preferências operacionais da sua conta autenticada."
      />

      <section className="painel formulario-configuracoes">
        <section className="bloco-configuracao">
          <span className="icone-configuracao">
            <UserRound size={20} />
          </span>
          <div>
            <h2>Perfil e organização</h2>
            <p>Dados verificados a partir da sessão autenticada no Supabase.</p>
            <dl className="lista-de-dados">
              <div>
                <dt>Nome</dt>
                <dd>{perfilAutenticado.nomeCompleto}</dd>
              </div>
              <div>
                <dt>Organização</dt>
                <dd>{perfilAutenticado.organizacaoNome}</dd>
              </div>
              <div>
                <dt>Permissão</dt>
                <dd>{ehRh ? "Recursos Humanos" : "Atendimento da clínica"}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{perfilAutenticado.email}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="bloco-configuracao">
          <span className="icone-configuracao">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2>Privacidade do recorte</h2>
            <p>
              O sistema guarda somente dados de agenda. Resultado médico,
              prontuário e diagnóstico permanecem fora deste MVP.
            </p>
          </div>
        </section>

        <footer className="rodape-configuracoes">
          <span>
            <Mail size={16} /> Dados da conta são administrados pelo Supabase Auth.
          </span>
        </footer>
      </section>
    </div>
  );
}

export function CabecalhoDaPagina({
  sobrelinha,
  titulo,
  descricao,
}: {
  sobrelinha: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <header className="cabecalho-da-pagina">
      <span className="sinalizador-de-contexto">{sobrelinha}</span>
      <h1>{titulo}</h1>
      <p>{descricao}</p>
    </header>
  );
}

function EstadoVazio({
  icone,
  titulo,
  descricao,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="estado-vazio">
      {icone}
      <strong>{titulo}</strong>
      <p>{descricao}</p>
    </div>
  );
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

function obterDataAtual(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}
