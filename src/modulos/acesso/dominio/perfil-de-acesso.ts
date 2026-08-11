export const PERFIS_DE_ACESSO = {
  RH: "rh",
  CLINICA: "clinica",
} as const;

export type PerfilDeAcesso =
  (typeof PERFIS_DE_ACESSO)[keyof typeof PERFIS_DE_ACESSO];

export const PAGINAS_DO_PAINEL = {
  VISAO_GERAL: "visao-geral",
  AGENDAMENTOS: "agendamentos",
  COLABORADORES: "colaboradores",
  AGENDA_CLINICA: "agenda-clinica",
  CONFIGURACOES: "configuracoes",
} as const;

export type PaginaDoPainel =
  (typeof PAGINAS_DO_PAINEL)[keyof typeof PAGINAS_DO_PAINEL];

const PAGINAS_COMUNS: PaginaDoPainel[] = [
  PAGINAS_DO_PAINEL.VISAO_GERAL,
  PAGINAS_DO_PAINEL.AGENDAMENTOS,
  PAGINAS_DO_PAINEL.CONFIGURACOES,
];

const PAGINAS_POR_PERFIL: Record<PerfilDeAcesso, PaginaDoPainel[]> = {
  [PERFIS_DE_ACESSO.RH]: [
    ...PAGINAS_COMUNS,
    PAGINAS_DO_PAINEL.COLABORADORES,
  ],
  [PERFIS_DE_ACESSO.CLINICA]: [
    ...PAGINAS_COMUNS,
    PAGINAS_DO_PAINEL.AGENDA_CLINICA,
  ],
};

export function obterPaginasPermitidas(
  perfil: PerfilDeAcesso,
): readonly PaginaDoPainel[] {
  return PAGINAS_POR_PERFIL[perfil];
}

export function podeAcessarPagina(
  perfil: PerfilDeAcesso,
  pagina: PaginaDoPainel,
): boolean {
  return PAGINAS_POR_PERFIL[perfil].includes(pagina);
}

export function obterPaginaPermitida(
  perfil: PerfilDeAcesso,
  paginaDesejada: PaginaDoPainel,
): PaginaDoPainel {
  return podeAcessarPagina(perfil, paginaDesejada)
    ? paginaDesejada
    : PAGINAS_DO_PAINEL.VISAO_GERAL;
}

