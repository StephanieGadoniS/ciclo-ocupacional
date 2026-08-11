import type { PerfilDeAcesso } from "./perfil-de-acesso";

export interface PerfilAutenticado {
  usuarioId: string;
  email: string;
  nomeCompleto: string;
  papel: PerfilDeAcesso;
  organizacaoId: string;
  organizacaoNome: string;
}

export function obterPrimeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] || "Usuário";
}

export function obterIniciais(nomeCompleto: string): string {
  const partes = nomeCompleto
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (partes.length === 0) return "US";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  return `${partes[0][0]}${partes.at(-1)?.[0] ?? ""}`.toUpperCase();
}
