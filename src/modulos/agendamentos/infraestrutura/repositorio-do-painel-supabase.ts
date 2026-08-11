import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GeradorUuid } from "@/src/compartilhado/aplicacao/gerador-de-identificador";
import type { PerfilAutenticado } from "@/src/modulos/acesso/dominio/perfil-autenticado";
import { PERFIS_DE_ACESSO } from "@/src/modulos/acesso/dominio/perfil-de-acesso";
import { AgendamentoOcupacional } from "../dominio/agendamento-ocupacional";
import {
  PERIODOS_PREFERIDOS,
  STATUS_DO_AGENDAMENTO,
  TIPOS_DE_EXAME,
  type PeriodoPreferido,
  type StatusDoAgendamento,
  type TipoDeExame,
} from "../dominio/tipos-do-agendamento";
import type {
  AgendamentoParaPainel,
  ColaboradorParaSelecao,
  DadosDaNovaSolicitacao,
  DadosDoNovoHorario,
  DadosDoPainel,
} from "../apresentacao/tipos-do-painel";

const papeisDeOrganizacao = z.enum(["empresa", "clinica"]);
const tiposDeExame = z.enum([
  TIPOS_DE_EXAME.ADMISSIONAL,
  TIPOS_DE_EXAME.PERIODICO,
  TIPOS_DE_EXAME.RETORNO_AO_TRABALHO,
  TIPOS_DE_EXAME.MUDANCA_DE_RISCO,
  TIPOS_DE_EXAME.DEMISSIONAL,
]);
const statusDoAgendamento = z.enum([
  STATUS_DO_AGENDAMENTO.SOLICITADO,
  STATUS_DO_AGENDAMENTO.AGENDADO,
  STATUS_DO_AGENDAMENTO.REALIZADO,
  STATUS_DO_AGENDAMENTO.CANCELADO,
  STATUS_DO_AGENDAMENTO.NAO_COMPARECEU,
]);
const periodosPreferidos = z.enum([
  PERIODOS_PREFERIDOS.MANHA,
  PERIODOS_PREFERIDOS.TARDE,
  PERIODOS_PREFERIDOS.QUALQUER,
]);

const esquemaDaOrganizacao = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2),
  tipo: papeisDeOrganizacao,
  ativo: z.boolean(),
});

const esquemaDoColaborador = z.object({
  id: z.string().uuid(),
  empresa_id: z.string().uuid(),
  nome_completo: z.string().min(2),
  cpf_final: z.string().regex(/^\d{2}$/),
  matricula: z.string().min(1),
  cargo: z.string().min(2),
  ativo: z.boolean(),
});

const esquemaDoRecurso = z.object({
  id: z.string().uuid(),
  clinica_id: z.string().uuid(),
  nome: z.string().min(2),
  duracao_padrao_minutos: z.number().int().positive(),
  ativo: z.boolean(),
});

const esquemaDoAgendamento = z.object({
  id: z.string().uuid(),
  empresa_id: z.string().uuid(),
  clinica_id: z.string().uuid(),
  colaborador_id: z.string().uuid(),
  recurso_clinica_id: z.string().uuid().nullable(),
  tipo_exame: tiposDeExame,
  status: statusDoAgendamento,
  data_referencia: z.string(),
  data_limite: z.string(),
  periodo_preferido: periodosPreferidos,
  dias_afastamento: z.number().int().nullable(),
  observacoes: z.string().nullable(),
  inicio_agendado: z.string().nullable(),
  fim_agendado: z.string().nullable(),
  motivo_cancelamento: z.string().nullable(),
  criado_por: z.string().uuid(),
  criado_em: z.string(),
  atualizado_em: z.string(),
  realizado_em: z.string().nullable(),
});

const esquemaDoEvento = z.object({
  id: z.string().uuid(),
  agendamento_id: z.string().uuid(),
  status_anterior: statusDoAgendamento.nullable(),
  status_atual: statusDoAgendamento,
  descricao: z.string().min(2),
  realizado_por: z.string().uuid().nullable(),
  ocorrido_em: z.string(),
});

const esquemaDoPerfilResponsavel = z.object({
  id: z.string().uuid(),
  nome_completo: z.string().min(2),
});

type LinhaDaOrganizacao = z.infer<typeof esquemaDaOrganizacao>;
type LinhaDoColaborador = z.infer<typeof esquemaDoColaborador>;
type LinhaDoRecurso = z.infer<typeof esquemaDoRecurso>;
type LinhaDoAgendamento = z.infer<typeof esquemaDoAgendamento>;
type LinhaDoEvento = z.infer<typeof esquemaDoEvento>;

const geradorDeIdentificador = new GeradorUuid();
const CORES_DOS_AVATARES = ["verde", "azul", "lilas", "laranja", "rosa"];

export class ErroDePersistencia extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDePersistencia";
  }
}

export class RepositorioDoPainelSupabase {
  constructor(
    private readonly cliente: SupabaseClient,
    private readonly perfil: PerfilAutenticado,
  ) {}

  async carregarDados(): Promise<DadosDoPainel> {
    const [
      resultadoDosAgendamentos,
      resultadoDosColaboradores,
      resultadoDasOrganizacoes,
      resultadoDosRecursos,
      resultadoDosEventos,
      resultadoDosResponsaveis,
    ] =
      await Promise.all([
        this.cliente
          .from("agendamentos_ocupacionais")
          .select("*")
          .order("data_limite", { ascending: true }),
        this.cliente.rpc("listar_colaboradores_autorizados"),
        this.cliente
          .from("organizacoes")
          .select("id, nome, tipo, ativo")
          .order("nome", { ascending: true }),
        this.cliente
          .from("recursos_clinica")
          .select("id, clinica_id, nome, duracao_padrao_minutos, ativo")
          .order("nome", { ascending: true }),
        this.cliente
          .from("eventos_agendamento")
          .select(
            "id, agendamento_id, status_anterior, status_atual, descricao, realizado_por, ocorrido_em",
          )
          .order("ocorrido_em", { ascending: true }),
        this.cliente
          .from("perfis")
          .select("id, nome_completo"),
      ]);

    garantirConsultaValida(resultadoDosAgendamentos.error);
    garantirConsultaValida(resultadoDosColaboradores.error);
    garantirConsultaValida(resultadoDasOrganizacoes.error);
    garantirConsultaValida(resultadoDosRecursos.error);
    garantirConsultaValida(resultadoDosEventos.error);
    garantirConsultaValida(resultadoDosResponsaveis.error);

    const linhasDosAgendamentos = esquemaDoAgendamento
      .array()
      .parse(resultadoDosAgendamentos.data ?? []);
    const linhasDosColaboradores = esquemaDoColaborador
      .array()
      .parse(resultadoDosColaboradores.data ?? []);
    const linhasDasOrganizacoes = esquemaDaOrganizacao
      .array()
      .parse(resultadoDasOrganizacoes.data ?? []);
    const linhasDosRecursos = esquemaDoRecurso
      .array()
      .parse(resultadoDosRecursos.data ?? []);
    const linhasDosEventos = esquemaDoEvento
      .array()
      .parse(resultadoDosEventos.data ?? []);
    const linhasDosResponsaveis = esquemaDoPerfilResponsavel
      .array()
      .parse(resultadoDosResponsaveis.data ?? []);

    const colaboradores = linhasDosColaboradores.map(mapearColaborador);
    const colaboradoresPorId = new Map(
      colaboradores.map((colaborador) => [colaborador.id, colaborador]),
    );
    const organizacoesPorId = new Map(
      linhasDasOrganizacoes.map((organizacao) => [organizacao.id, organizacao]),
    );
    const recursosPorId = new Map(
      linhasDosRecursos.map((recurso) => [recurso.id, recurso]),
    );
    const responsaveisPorId = new Map(
      linhasDosResponsaveis.map((responsavel) => [
        responsavel.id,
        responsavel.nome_completo,
      ]),
    );

    return {
      agendamentos: linhasDosAgendamentos.map((agendamento) =>
        mapearAgendamento(
          agendamento,
          colaboradoresPorId,
          organizacoesPorId,
          recursosPorId,
        ),
      ),
      colaboradores: linhasDosColaboradores
        .filter((colaborador) => colaborador.ativo)
        .map(mapearColaborador),
      recursosDaClinica: linhasDosRecursos
        .filter(
          (recurso) =>
            recurso.clinica_id === this.perfil.organizacaoId && recurso.ativo,
        )
        .map((recurso) => ({
          id: recurso.id,
          nome: recurso.nome,
          duracaoEmMinutos: recurso.duracao_padrao_minutos,
        })),
      clinicasRelacionadas: linhasDasOrganizacoes
        .filter(
          (organizacao) => organizacao.tipo === "clinica" && organizacao.ativo,
        )
        .map((organizacao) => ({ id: organizacao.id, nome: organizacao.nome })),
      eventosDoAgendamento: linhasDosEventos.map((evento) =>
        mapearEvento(evento, responsaveisPorId),
      ),
    };
  }

  async criarSolicitacao(
    dados: DadosDaNovaSolicitacao,
    clinicaId: string,
  ): Promise<void> {
    if (this.perfil.papel !== PERFIS_DE_ACESSO.RH) {
      throw new ErroDePersistencia(
        "Somente usuários de RH podem criar solicitações.",
      );
    }

    if (!clinicaId) {
      throw new ErroDePersistencia(
        "Nenhuma clínica relacionada está disponível para receber a solicitação.",
      );
    }

    const agora = new Date().toISOString();
    const resultado = AgendamentoOcupacional.solicitar(
      {
        id: geradorDeIdentificador.gerar(),
        empresaId: this.perfil.organizacaoId,
        clinicaId,
        colaboradorId: dados.colaboradorId,
        tipoDeExame: dados.tipoDeExame,
        dataDeReferencia: dados.dataDeReferencia,
        periodoPreferido: dados.periodoPreferido,
        diasDeAfastamento: dados.diasDeAfastamento,
        observacoes: dados.observacoes,
        criadoPor: this.perfil.usuarioId,
        criadoEm: agora,
      },
      geradorDeIdentificador.gerar(),
    );
    const agendamento = resultado.agendamento.obterDados();

    const { error } = await this.cliente
      .from("agendamentos_ocupacionais")
      .insert({
        id: agendamento.id,
        empresa_id: agendamento.empresaId,
        clinica_id: agendamento.clinicaId,
        colaborador_id: agendamento.colaboradorId,
        recurso_clinica_id: agendamento.recursoDaClinicaId,
        tipo_exame: agendamento.tipoDeExame,
        status: agendamento.status,
        data_referencia: agendamento.dataDeReferencia,
        data_limite: agendamento.dataLimite,
        periodo_preferido: agendamento.periodoPreferido,
        dias_afastamento: agendamento.diasDeAfastamento,
        observacoes: agendamento.observacoes,
        criado_por: agendamento.criadoPor,
        criado_em: agendamento.criadoEm,
        atualizado_em: agendamento.atualizadoEm,
      });

    garantirMutacaoValida(error);
  }

  async confirmarHorario(
    agendamentoId: string,
    dados: DadosDoNovoHorario,
  ): Promise<void> {
    const { error } = await this.cliente.rpc("confirmar_horario_agendamento", {
      agendamento_id: agendamentoId,
      recurso_id: dados.recursoDaClinicaId,
      inicio: dados.inicio,
      fim: dados.fim,
    });

    garantirMutacaoValida(error);
  }

  async concluir(agendamentoId: string): Promise<void> {
    const { error } = await this.cliente.rpc("concluir_agendamento", {
      agendamento_id: agendamentoId,
    });
    garantirMutacaoValida(error);
  }

  async registrarNaoComparecimento(agendamentoId: string): Promise<void> {
    const { error } = await this.cliente.rpc(
      "registrar_nao_comparecimento",
      { agendamento_id: agendamentoId },
    );
    garantirMutacaoValida(error);
  }

  async cancelar(agendamentoId: string, motivo: string): Promise<void> {
    const { error } = await this.cliente.rpc("cancelar_agendamento", {
      agendamento_id: agendamentoId,
      motivo,
    });
    garantirMutacaoValida(error);
  }
}

function mapearColaborador(linha: LinhaDoColaborador): ColaboradorParaSelecao {
  return {
    id: linha.id,
    nome: linha.nome_completo,
    cpfMascarado: `***.***.***-${linha.cpf_final}`,
    matricula: linha.matricula,
    cargo: linha.cargo,
    iniciais: obterIniciais(linha.nome_completo),
    cor: obterCorDoAvatar(linha.id),
  };
}

function mapearEvento(
  linha: LinhaDoEvento,
  responsaveisPorId: ReadonlyMap<string, string>,
): DadosDoPainel["eventosDoAgendamento"][number] {
  return {
    id: linha.id,
    agendamentoId: linha.agendamento_id,
    statusAnterior: linha.status_anterior,
    statusAtual: linha.status_atual,
    descricao: linha.descricao,
    realizadoPorNome: linha.realizado_por
      ? responsaveisPorId.get(linha.realizado_por) ?? "Usuário autorizado"
      : "Sistema",
    ocorridoEm: linha.ocorrido_em,
  };
}

function mapearAgendamento(
  linha: LinhaDoAgendamento,
  colaboradoresPorId: ReadonlyMap<string, ColaboradorParaSelecao>,
  organizacoesPorId: ReadonlyMap<string, LinhaDaOrganizacao>,
  recursosPorId: ReadonlyMap<string, LinhaDoRecurso>,
): AgendamentoParaPainel {
  const colaborador = colaboradoresPorId.get(linha.colaborador_id);
  const empresa = organizacoesPorId.get(linha.empresa_id);
  const clinica = organizacoesPorId.get(linha.clinica_id);

  if (!colaborador || !empresa || !clinica) {
    throw new ErroDePersistencia(
      "Os dados retornados pelo banco estão incompletos para montar o painel.",
    );
  }

  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    clinicaId: linha.clinica_id,
    colaboradorId: linha.colaborador_id,
    colaborador,
    empresaNome: empresa.nome,
    clinicaNome: clinica.nome,
    recursoDaClinicaNome: linha.recurso_clinica_id
      ? recursosPorId.get(linha.recurso_clinica_id)?.nome ?? null
      : null,
    tipoDeExame: linha.tipo_exame as TipoDeExame,
    status: linha.status as StatusDoAgendamento,
    dataDeReferencia: linha.data_referencia,
    dataLimite: linha.data_limite,
    periodoPreferido: linha.periodo_preferido as PeriodoPreferido,
    diasDeAfastamento: linha.dias_afastamento,
    observacoes: linha.observacoes,
    recursoDaClinicaId: linha.recurso_clinica_id,
    inicioAgendado: linha.inicio_agendado,
    fimAgendado: linha.fim_agendado,
    motivoDoCancelamento: linha.motivo_cancelamento,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    realizadoEm: linha.realizado_em,
  };
}

function obterIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return `${partes[0]?.[0] ?? ""}${partes.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function obterCorDoAvatar(identificador: string): string {
  const soma = [...identificador].reduce(
    (total, caractere) => total + caractere.charCodeAt(0),
    0,
  );
  return CORES_DOS_AVATARES[soma % CORES_DOS_AVATARES.length];
}

function garantirConsultaValida(erro: { message: string } | null): void {
  if (!erro) return;
  throw new ErroDePersistencia(
    "Não foi possível carregar os dados autorizados para este usuário.",
  );
}

function garantirMutacaoValida(
  erro: { code?: string; message: string } | null,
): void {
  if (!erro) return;

  const mensagensPorCodigo: Record<string, string> = {
    "23505": "Já existe uma solicitação aberta com esses mesmos dados.",
    "23P01": "A agenda Medicina do Trabalho já possui atendimento nesse horário.",
    "42501": "Seu perfil não possui permissão para realizar esta ação.",
    P0002: "O agendamento não foi encontrado ou não permite esta ação.",
  };

  throw new ErroDePersistencia(
    mensagensPorCodigo[erro.code ?? ""] ??
      erro.message ??
      "Não foi possível salvar a alteração.",
  );
}
