import { ErroDeDominio } from "./erro-de-dominio";
import {
  STATUS_DO_AGENDAMENTO,
  TIPOS_DE_EXAME,
  type SituacaoDoPrazo,
  type StatusDoAgendamento,
  type TipoDeExame,
} from "./tipos-do-agendamento";

const FORMATO_DE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const MILISSEGUNDOS_EM_UM_DIA = 86_400_000;

interface DadosParaClassificarPrazo {
  status: StatusDoAgendamento;
  dataLimite: string;
  inicioAgendado?: string | null;
}

export class PoliticaDePrazoOcupacional {
  static validarDataDeReferencia(
    tipoDeExame: TipoDeExame,
    dataDeReferencia: string,
    instanteDaSolicitacao: string,
  ): void {
    this.validarData(dataDeReferencia);
    const dataDaSolicitacao = obterDataEmSaoPaulo(instanteDaSolicitacao);

    if (
      tipoDeExame === TIPOS_DE_EXAME.DEMISSIONAL &&
      this.calcularDataLimite(tipoDeExame, dataDeReferencia) < dataDaSolicitacao
    ) {
      throw new ErroDeDominio(
        "O prazo de 10 dias do exame demissional já encerrou.",
        "PRAZO_DEMISSIONAL_ENCERRADO",
      );
    }

    if (
      tipoDeExame !== TIPOS_DE_EXAME.DEMISSIONAL &&
      dataDeReferencia < dataDaSolicitacao
    ) {
      throw new ErroDeDominio(
        "A data de referência não pode estar no passado.",
        "DATA_DE_REFERENCIA_NO_PASSADO",
      );
    }
  }

  static calcularDataLimite(
    tipoDeExame: TipoDeExame,
    dataDeReferencia: string,
  ): string {
    this.validarData(dataDeReferencia);

    if (tipoDeExame === TIPOS_DE_EXAME.DEMISSIONAL) {
      return somarDias(dataDeReferencia, 10);
    }

    return dataDeReferencia;
  }

  static validarDadosEspecificos(
    tipoDeExame: TipoDeExame,
    diasDeAfastamento?: number | null,
  ): void {
    if (tipoDeExame !== TIPOS_DE_EXAME.RETORNO_AO_TRABALHO) {
      return;
    }

    if (diasDeAfastamento === null || diasDeAfastamento === undefined) {
      throw new ErroDeDominio(
        "Informe quantos dias o colaborador permaneceu afastado.",
        "DIAS_DE_AFASTAMENTO_OBRIGATORIOS",
      );
    }

    if (!Number.isInteger(diasDeAfastamento) || diasDeAfastamento < 30) {
      throw new ErroDeDominio(
        "O exame de retorno se aplica a afastamentos de 30 dias ou mais.",
        "AFASTAMENTO_INFERIOR_A_TRINTA_DIAS",
      );
    }
  }

  static classificar(
    dados: DadosParaClassificarPrazo,
    hoje: string,
  ): SituacaoDoPrazo {
    this.validarData(dados.dataLimite);
    this.validarData(hoje);

    if (dados.status === STATUS_DO_AGENDAMENTO.REALIZADO) {
      return "concluido";
    }

    if (dados.status === STATUS_DO_AGENDAMENTO.CANCELADO) {
      return "encerrado";
    }

    const dataAgendada = dados.inicioAgendado?.slice(0, 10);
    if (dataAgendada && dataAgendada > dados.dataLimite) {
      return "atrasado";
    }

    const diasRestantes = diferencaEmDias(hoje, dados.dataLimite);

    if (diasRestantes < 0) {
      return "atrasado";
    }

    if (diasRestantes <= 2) {
      return "atencao";
    }

    return "em_dia";
  }

  static descricaoDaDataDeReferencia(tipoDeExame: TipoDeExame): string {
    const descricoes: Record<TipoDeExame, string> = {
      admissional: "Data prevista para início das atividades",
      periodico: "Data limite definida pelo PCMSO",
      retorno_ao_trabalho: "Data prevista para retorno",
      mudanca_de_risco: "Data prevista para mudança de risco",
      demissional: "Data de término do contrato",
    };

    return descricoes[tipoDeExame];
  }

  static orientacaoDaDataDeReferencia(tipoDeExame: TipoDeExame): string {
    const orientacoes: Record<TipoDeExame, string> = {
      admissional: "O exame deve ser realizado até o início das atividades.",
      periodico: "Use a data limite prevista no programa ocupacional da empresa.",
      retorno_ao_trabalho: "Informe o primeiro dia previsto para o retorno.",
      mudanca_de_risco: "Informe quando começa a exposição ao novo risco.",
      demissional:
        "Informe o término do contrato. O prazo operacional será de 10 dias corridos.",
    };

    return orientacoes[tipoDeExame];
  }

  private static validarData(data: string): void {
    if (!FORMATO_DE_DATA.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) {
      throw new ErroDeDominio(
        "Informe uma data válida no formato AAAA-MM-DD.",
        "DATA_INVALIDA",
      );
    }
  }
}

function somarDias(data: string, quantidade: number): string {
  const dataEmUtc = new Date(`${data}T12:00:00Z`);
  dataEmUtc.setUTCDate(dataEmUtc.getUTCDate() + quantidade);
  return dataEmUtc.toISOString().slice(0, 10);
}

function diferencaEmDias(inicio: string, fim: string): number {
  const inicioEmUtc = Date.parse(`${inicio}T12:00:00Z`);
  const fimEmUtc = Date.parse(`${fim}T12:00:00Z`);
  return Math.round((fimEmUtc - inicioEmUtc) / MILISSEGUNDOS_EM_UM_DIA);
}

function obterDataEmSaoPaulo(instante: string): string {
  const data = new Date(instante);

  if (Number.isNaN(data.getTime())) {
    throw new ErroDeDominio(
      "Não foi possível validar a data atual da solicitação.",
      "INSTANTE_INVALIDO",
    );
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}
