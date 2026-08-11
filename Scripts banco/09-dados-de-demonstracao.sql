-- Dados fictícios e idempotentes para avaliação do desafio técnico.
-- Execute depois da migration e da criação dos usuários de demonstração.

do $$
declare
  empresa_id constant uuid := '10000000-0000-4000-8000-000000000001';
  clinica_id constant uuid := '10000000-0000-4000-8000-000000000002';
  usuario_rh_id uuid;
  usuario_clinica_id uuid;
begin
  select id into usuario_rh_id
  from auth.users
  where lower(email) = 'rh@ciclo.test';

  select id into usuario_clinica_id
  from auth.users
  where lower(email) = 'clinica@ciclo.test';

  if usuario_rh_id is null or usuario_clinica_id is null then
    raise exception
      'Crie os usuários com npm run demo:usuarios antes de executar este arquivo.';
  end if;

  insert into public.organizacoes (id, nome, tipo, ativo)
  values
    (empresa_id, 'Grupo Horizonte', 'empresa', true),
    (clinica_id, 'Clínica Bem Viver', 'clinica', true)
  on conflict (id) do update
  set nome = excluded.nome,
      ativo = excluded.ativo;

  insert into public.perfis (id, organizacao_id, nome_completo, papel)
  values
    (usuario_rh_id, empresa_id, 'Mariana Costa', 'rh'),
    (usuario_clinica_id, clinica_id, 'Lucas Martins', 'clinica')
  on conflict (id) do update
  set nome_completo = excluded.nome_completo;

  insert into public.colaboradores (
    id,
    empresa_id,
    nome_completo,
    cpf,
    matricula,
    cargo,
    ativo
  )
  values
    (
      '20000000-0000-4000-8000-000000000001',
      empresa_id,
      'Ana Torres',
      '90000000001',
      'GH-1042',
      'Analista financeira',
      true
    ),
    (
      '20000000-0000-4000-8000-000000000002',
      empresa_id,
      'Bruno Lima',
      '90000000002',
      'GH-0987',
      'Técnico de manutenção',
      true
    ),
    (
      '20000000-0000-4000-8000-000000000003',
      empresa_id,
      'Camila Souza',
      '90000000003',
      'GH-0881',
      'Supervisora de operações',
      true
    ),
    (
      '20000000-0000-4000-8000-000000000004',
      empresa_id,
      'Diego Alves',
      '90000000004',
      'GH-0744',
      'Operador de produção',
      true
    ),
    (
      '20000000-0000-4000-8000-000000000005',
      empresa_id,
      'Elisa Nunes',
      '90000000005',
      'GH-1120',
      'Assistente administrativa',
      true
    )
  on conflict (id) do update
  set nome_completo = excluded.nome_completo,
      matricula = excluded.matricula,
      cargo = excluded.cargo,
      ativo = excluded.ativo;

  insert into public.recursos_clinica (
    id,
    clinica_id,
    nome,
    duracao_padrao_minutos,
    ativo
  )
  values
    (
      '30000000-0000-4000-8000-000000000001',
      clinica_id,
      'Medicina do Trabalho',
      30,
      true
    )
  on conflict (id) do update
  set nome = excluded.nome,
      duracao_padrao_minutos = excluded.duracao_padrao_minutos,
      ativo = excluded.ativo;

  insert into public.agendamentos_ocupacionais (
    id,
    empresa_id,
    clinica_id,
    colaborador_id,
    recurso_clinica_id,
    tipo_exame,
    status,
    data_referencia,
    data_limite,
    periodo_preferido,
    dias_afastamento,
    observacoes,
    inicio_agendado,
    fim_agendado,
    motivo_cancelamento,
    criado_por,
    criado_em,
    atualizado_em,
    realizado_em
  )
  values
    (
      '40000000-0000-4000-8000-000000000001',
      empresa_id,
      clinica_id,
      '20000000-0000-4000-8000-000000000001',
      null,
      'admissional',
      'solicitado',
      '2026-08-08',
      '2026-08-08',
      'manha',
      null,
      'Admissão prevista para o turno da manhã.',
      null,
      null,
      null,
      usuario_rh_id,
      '2026-08-04 10:20:00-03',
      '2026-08-04 10:20:00-03',
      null
    ),
    (
      '40000000-0000-4000-8000-000000000002',
      empresa_id,
      clinica_id,
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000001',
      'periodico',
      'agendado',
      '2026-08-12',
      '2026-08-12',
      'qualquer',
      null,
      null,
      '2026-08-07 09:00:00-03',
      '2026-08-07 09:30:00-03',
      null,
      usuario_rh_id,
      '2026-08-01 07:10:00-03',
      '2026-08-02 11:30:00-03',
      null
    ),
    (
      '40000000-0000-4000-8000-000000000003',
      empresa_id,
      clinica_id,
      '20000000-0000-4000-8000-000000000003',
      '30000000-0000-4000-8000-000000000001',
      'retorno_ao_trabalho',
      'agendado',
      '2026-08-06',
      '2026-08-06',
      'manha',
      41,
      'Retorno gradual será avaliado durante o exame.',
      '2026-08-06 08:00:00-03',
      '2026-08-06 08:30:00-03',
      null,
      usuario_rh_id,
      '2026-08-03 08:00:00-03',
      '2026-08-03 12:10:00-03',
      null
    ),
    (
      '40000000-0000-4000-8000-000000000004',
      empresa_id,
      clinica_id,
      '20000000-0000-4000-8000-000000000004',
      '30000000-0000-4000-8000-000000000001',
      'periodico',
      'realizado',
      '2026-08-04',
      '2026-08-04',
      'tarde',
      null,
      null,
      '2026-08-04 14:00:00-03',
      '2026-08-04 14:30:00-03',
      null,
      usuario_rh_id,
      '2026-07-28 09:00:00-03',
      '2026-08-04 14:35:00-03',
      '2026-08-04 14:35:00-03'
    ),
    (
      '40000000-0000-4000-8000-000000000005',
      empresa_id,
      clinica_id,
      '20000000-0000-4000-8000-000000000005',
      '30000000-0000-4000-8000-000000000001',
      'mudanca_de_risco',
      'nao_compareceu',
      '2026-08-03',
      '2026-08-03',
      'tarde',
      null,
      'Mudança para área com novo perfil de risco.',
      '2026-08-03 15:00:00-03',
      '2026-08-03 15:30:00-03',
      null,
      usuario_rh_id,
      '2026-07-29 06:00:00-03',
      '2026-08-03 17:00:00-03',
      null
    )
  on conflict (id) do nothing;
end
$$;
