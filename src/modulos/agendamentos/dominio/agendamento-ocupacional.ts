import { ErroDeDominio } from "./erro-de-dominio";
import { PoliticaDePrazoOcupacional } from "./politica-de-prazo-ocupacional";
import {
  STATUS_DO_AGENDAMENTO,
  type DadosDoAgendamentoOcupacional,
  type EventoDoAgendamento,
  type PeriodoPreferido,
  type ResultadoDaAlteracao,
  type TipoDeExame,
} from "./tipos-do-agendamento";

interface ContextoDaAlteracao {
  eventoId: string;
  realizadoPor: string;
  ocorridoEm: string;
}

interface NovaSolicitacao {
  id: string;
  empresaId: string;
  clinicaId: string;
  colaboradorId: string;
  tipoDeExame: TipoDeExame;
  dataDeReferencia: string;
  periodoPreferido: PeriodoPreferido;
  diasDeAfastamento?: number | null;
  observacoes?: string | null;
  criadoPor: string;
  criadoEm: string;
}

interface DadosDoHorario {
  recursoDaClinicaId: string;
  inicio: string;
  fim: string;
}

export class AgendamentoOcupacional {
  private constructor(
    private readonly estado: DadosDoAgendamentoOcupacional,
  ) {}

  static solicitar(
    entrada: NovaSolicitacao,
    eventoId: string,
  ): ResultadoDaAlteracao {
    garantirTexto(entrada.empresaId, "A empresa é obrigatória.");
    garantirTexto(entrada.clinicaId, "A clínica é obrigatória.");
    garantirTexto(entrada.colaboradorId, "O colaborador é obrigatório.");
    garantirTexto(entrada.criadoPor, "O usuário solicitante é obrigatório.");

    PoliticaDePrazoOcupacional.validarDataDeReferencia(
      entrada.tipoDeExame,
      entrada.dataDeReferencia,
      entrada.criadoEm,
    );
    PoliticaDePrazoOcupacional.validarDadosEspecificos(
      entrada.tipoDeExame,
      entrada.diasDeAfastamento,
    );

    const dados: DadosDoAgendamentoOcupacional = {
      id: entrada.id,
      empresaId: entrada.empresaId,
      clinicaId: entrada.clinicaId,
      colaboradorId: entrada.colaboradorId,
      tipoDeExame: entrada.tipoDeExame,
      status: STATUS_DO_AGENDAMENTO.SOLICITADO,
      dataDeReferencia: entrada.dataDeReferencia,
      dataLimite: PoliticaDePrazoOcupacional.calcularDataLimite(
        entrada.tipoDeExame,
        entrada.dataDeReferencia,
      ),
      periodoPreferido: entrada.periodoPreferido,
      diasDeAfastamento: entrada.diasDeAfastamento ?? null,
      observacoes: normalizarTextoOpcional(entrada.observacoes),
      recursoDaClinicaId: null,
      inicioAgendado: null,
      fimAgendado: null,
      motivoDoCancelamento: null,
      criadoPor: entrada.criadoPor,
      criadoEm: entrada.criadoEm,
      atualizadoEm: entrada.criadoEm,
      realizadoEm: null,
    };

    return {
      agendamento: new AgendamentoOcupacional(dados),
      evento: criarEvento({
        id: eventoId,
        agendamentoId: entrada.id,
        statusAnterior: null,
        statusAtual: STATUS_DO_AGENDAMENTO.SOLICITADO,
        descricao: "Solicitação de exame criada pelo RH.",
        realizadoPor: entrada.criadoPor,
        ocorridoEm: entrada.criadoEm,
      }),
    };
  }

  static restaurar(dados: DadosDoAgendamentoOcupacional): AgendamentoOcupacional {
    return new AgendamentoOcupacional({ ...dados });
  }

  obterDados(): Readonly<DadosDoAgendamentoOcupacional> {
    return { ...this.estado };
  }

  agendar(
    horario: DadosDoHorario,
    contexto: ContextoDaAlteracao,
  ): ResultadoDaAlteracao {
    if (
      this.estado.status !== STATUS_DO_AGENDAMENTO.SOLICITADO &&
      this.estado.status !== STATUS_DO_AGENDAMENTO.AGENDADO &&
      this.estado.status !== STATUS_DO_AGENDAMENTO.NAO_COMPARECEU
    ) {
      throw new ErroDeDominio(
        "Somente solicitações abertas ou já agendadas podem receber um horário.",
        "STATUS_NAO_PERMITE_AGENDAMENTO",
      );
    }

    garantirTexto(
      horario.recursoDaClinicaId,
      "Selecione a agenda responsável pelo atendimento.",
    );
    const eraReagendamento =
      this.estado.status === STATUS_DO_AGENDAMENTO.AGENDADO ||
      this.estado.status === STATUS_DO_AGENDAMENTO.NAO_COMPARECEU;
    garantirIntervaloValido(horario.inicio, horario.fim);
    garantirHorarioDeInicioNaGrade(horario.inicio);
    garantirHorarioDentroDoExpediente(horario.inicio, horario.fim);
    garantirHorarioDentroDoPrazo(
      horario.inicio,
      horario.fim,
      this.estado.dataLimite,
      contexto.ocorridoEm,
      eraReagendamento,
    );

    const novosDados: DadosDoAgendamentoOcupacional = {
      ...this.estado,
      status: STATUS_DO_AGENDAMENTO.AGENDADO,
      recursoDaClinicaId: horario.recursoDaClinicaId,
      inicioAgendado: horario.inicio,
      fimAgendado: horario.fim,
      atualizadoEm: contexto.ocorridoEm,
      motivoDoCancelamento: null,
    };

    return this.criarResultado(
      novosDados,
      contexto,
      eraReagendamento
        ? "Atendimento reagendado pela clínica."
        : "Horário confirmado pela clínica.",
    );
  }

  concluir(contexto: ContextoDaAlteracao): ResultadoDaAlteracao {
    this.garantirStatusAgendado(
      "Somente um exame agendado pode ser marcado como realizado.",
      "STATUS_NAO_PERMITE_CONCLUSAO",
    );
    this.garantirHorarioJaIniciado(contexto.ocorridoEm);

    return this.criarResultado(
      {
        ...this.estado,
        status: STATUS_DO_AGENDAMENTO.REALIZADO,
        realizadoEm: contexto.ocorridoEm,
        atualizadoEm: contexto.ocorridoEm,
      },
      contexto,
      "Exame registrado como realizado.",
    );
  }

  registrarNaoComparecimento(
    contexto: ContextoDaAlteracao,
  ): ResultadoDaAlteracao {
    this.garantirStatusAgendado(
      "Somente um exame agendado pode ser marcado como não comparecimento.",
      "STATUS_NAO_PERMITE_FALTA",
    );
    this.garantirHorarioJaIniciado(contexto.ocorridoEm);

    return this.criarResultado(
      {
        ...this.estado,
        status: STATUS_DO_AGENDAMENTO.NAO_COMPARECEU,
        atualizadoEm: contexto.ocorridoEm,
      },
      contexto,
      "Não comparecimento registrado pela clínica.",
    );
  }

  cancelar(
    motivo: string,
    contexto: ContextoDaAlteracao,
  ): ResultadoDaAlteracao {
    if (
      this.estado.status !== STATUS_DO_AGENDAMENTO.SOLICITADO &&
      this.estado.status !== STATUS_DO_AGENDAMENTO.AGENDADO &&
      this.estado.status !== STATUS_DO_AGENDAMENTO.NAO_COMPARECEU
    ) {
      throw new ErroDeDominio(
        "Este agendamento não pode mais ser cancelado.",
        "STATUS_NAO_PERMITE_CANCELAMENTO",
      );
    }

    if (motivo.trim().length < 5 || motivo.trim().length > 180) {
      throw new ErroDeDominio(
        "O motivo do cancelamento deve ter entre 5 e 180 caracteres.",
        "MOTIVO_DE_CANCELAMENTO_INVALIDO",
      );
    }

    return this.criarResultado(
      {
        ...this.estado,
        status: STATUS_DO_AGENDAMENTO.CANCELADO,
        motivoDoCancelamento: motivo.trim(),
        atualizadoEm: contexto.ocorridoEm,
      },
      contexto,
      "Agendamento cancelado.",
    );
  }

  private criarResultado(
    novosDados: DadosDoAgendamentoOcupacional,
    contexto: ContextoDaAlteracao,
    descricao: string,
  ): ResultadoDaAlteracao {
    return {
      agendamento: new AgendamentoOcupacional(novosDados),
      evento: criarEvento({
        id: contexto.eventoId,
        agendamentoId: this.estado.id,
        statusAnterior: this.estado.status,
        statusAtual: novosDados.status,
        descricao,
        realizadoPor: contexto.realizadoPor,
        ocorridoEm: contexto.ocorridoEm,
      }),
    };
  }

  private garantirStatusAgendado(mensagem: string, codigo: string): void {
    if (this.estado.status !== STATUS_DO_AGENDAMENTO.AGENDADO) {
      throw new ErroDeDominio(mensagem, codigo);
    }
  }

  private garantirHorarioJaIniciado(ocorridoEm: string): void {
    const inicio = Date.parse(this.estado.inicioAgendado ?? "");
    const agora = Date.parse(ocorridoEm);

    if (Number.isNaN(inicio) || Number.isNaN(agora) || inicio > agora) {
      throw new ErroDeDominio(
        "O comparecimento só pode ser registrado após o início do atendimento.",
        "ATENDIMENTO_AINDA_NAO_INICIADO",
      );
    }
  }
}

function criarEvento(evento: EventoDoAgendamento): EventoDoAgendamento {
  return evento;
}

function garantirTexto(valor: string, mensagem: string): void {
  if (!valor.trim()) {
    throw new ErroDeDominio(mensagem, "CAMPO_OBRIGATORIO");
  }
}

function normalizarTextoOpcional(valor?: string | null): string | null {
  const texto = valor?.trim();
  return texto ? texto : null;
}

function garantirIntervaloValido(inicio: string, fim: string): void {
  const inicioEmMilissegundos = Date.parse(inicio);
  const fimEmMilissegundos = Date.parse(fim);

  if (
    Number.isNaN(inicioEmMilissegundos) ||
    Number.isNaN(fimEmMilissegundos) ||
    fimEmMilissegundos <= inicioEmMilissegundos
  ) {
    throw new ErroDeDominio(
      "O horário final deve ser posterior ao horário inicial.",
      "INTERVALO_DE_HORARIO_INVALIDO",
    );
  }
}

function garantirHorarioDeInicioNaGrade(inicio: string): void {
  const data = new Date(inicio);

  if (Number.isNaN(data.getTime())) return;

  const partes = new Intl.DateTimeFormat("en-US", {
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(data);
  const minuto = Number(partes.find((parte) => parte.type === "minute")?.value);
  const segundo = Number(partes.find((parte) => parte.type === "second")?.value);

  if (minuto % 30 !== 0 || segundo !== 0) {
    throw new ErroDeDominio(
      "O horário de início deve usar intervalos de 30 minutos.",
      "HORARIO_FORA_DA_GRADE",
    );
  }
}

function garantirHorarioDentroDoExpediente(inicio: string, fim: string): void {
  const inicioComoData = new Date(inicio);
  const fimComoData = new Date(fim);

  if (
    Number.isNaN(inicioComoData.getTime()) ||
    Number.isNaN(fimComoData.getTime())
  ) {
    return;
  }

  const inicioLocal = obterPartesLocaisDoHorario(inicioComoData);
  const fimLocal = obterPartesLocaisDoHorario(fimComoData);
  const minutosDoInicio = inicioLocal.hora * 60 + inicioLocal.minuto;
  const minutosDoFim = fimLocal.hora * 60 + fimLocal.minuto;

  if (
    inicioLocal.data !== fimLocal.data ||
    minutosDoInicio < 8 * 60 ||
    minutosDoFim > 18 * 60
  ) {
    throw new ErroDeDominio(
      "A clínica realiza atendimentos entre 08:00 e 18:00.",
      "ATENDIMENTO_FORA_DO_EXPEDIENTE",
    );
  }
}

function obterPartesLocaisDoHorario(data: Date): {
  data: string;
  hora: number;
  minuto: number;
} {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(data);
  const obterParte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";

  return {
    data: `${obterParte("year")}-${obterParte("month")}-${obterParte("day")}`,
    hora: Number(obterParte("hour")),
    minuto: Number(obterParte("minute")),
  };
}

function garantirHorarioDentroDoPrazo(
  inicio: string,
  fim: string,
  dataLimite: string,
  ocorridoEm: string,
  permiteReagendamentoDepoisDoPrazo: boolean,
): void {
  const inicioEmMilissegundos = Date.parse(inicio);
  const fimEmMilissegundos = Date.parse(fim);
  const agoraEmMilissegundos = Date.parse(ocorridoEm);

  if (
    Number.isNaN(inicioEmMilissegundos) ||
    Number.isNaN(fimEmMilissegundos) ||
    Number.isNaN(agoraEmMilissegundos)
  ) {
    throw new ErroDeDominio(
      "Não foi possível validar a data e o horário informados.",
      "HORARIO_INVALIDO",
    );
  }

  if (inicioEmMilissegundos < agoraEmMilissegundos) {
    throw new ErroDeDominio(
      "Não é possível agendar um atendimento no passado.",
      "HORARIO_NO_PASSADO",
    );
  }

  const dataDoInicio = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(inicio));
  const dataDoFim = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(fim));

  if (
    !permiteReagendamentoDepoisDoPrazo &&
    (dataDoInicio > dataLimite || dataDoFim > dataLimite)
  ) {
    throw new ErroDeDominio(
      "O atendimento não pode ser agendado depois do prazo ocupacional.",
      "HORARIO_APOS_PRAZO",
    );
  }

  if (ehFimDeSemana(dataDoInicio) || ehFimDeSemana(dataDoFim)) {
    throw new ErroDeDominio(
      "A clínica atende somente de segunda a sexta-feira.",
      "AGENDAMENTO_EM_FIM_DE_SEMANA",
    );
  }
}

function ehFimDeSemana(data: string): boolean {
  const diaDaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
  return diaDaSemana === 0 || diaDaSemana === 6;
}
