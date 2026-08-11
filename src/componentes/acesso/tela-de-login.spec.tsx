// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TelaDeLogin } from "./tela-de-login";

afterEach(cleanup);

describe("Tela de login", () => {
  it("mantém a apresentação institucional sem textos de funcionalidade", () => {
    render(<TelaDeLogin aoEntrar={vi.fn(async () => null)} />);

    const apresentacao = screen.getByRole("region", {
      name: "Apresentação do Ciclo",
    });

    expect(apresentacao).toHaveTextContent(
      "Autorização por Supabase Auth e Row Level Security",
    );
    expect(apresentacao).not.toHaveTextContent("Empresa e clínica no mesmo fluxo");
    expect(apresentacao).not.toHaveTextContent("Cada organização visualiza");
  });

  it("preenche a credencial de RH para facilitar a avaliação", () => {
    render(<TelaDeLogin aoEntrar={vi.fn(async () => null)} />);

    fireEvent.click(screen.getByRole("button", { name: /RH/i }));

    expect(screen.getByLabelText("E-mail")).toHaveValue("rh@ciclo.test");
    expect(screen.getByLabelText("Senha")).toHaveValue("CicloRH#2026!");
  });

  it("envia e-mail e senha para o serviço de autenticação", async () => {
    const entrar = vi.fn(async () => null);
    render(<TelaDeLogin aoEntrar={entrar} />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "clinica@ciclo.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "CicloClinica#2026!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Entrar no Ciclo/i }));

    await waitFor(() =>
      expect(entrar).toHaveBeenCalledWith(
        "clinica@ciclo.test",
        "CicloClinica#2026!",
      ),
    );
  });
});
