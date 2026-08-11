-- Verificação transacional das permissões e regras críticas.
-- Pré-requisitos: usuários/dados de demonstração e todas as migrations aplicadas.
-- O script termina com ROLLBACK e não preserva os registros temporários.

begin;

do $$
declare
  usuario_rh_id uuid;
  usuario_clinica_id uuid;
  empresa_id uuid := '10000000-0000-4000-8000-000000000001';
  clinica_id uuid := '10000000-0000-4000-8000-000000000002';
  outra_clinica_id uuid := gen_random_uuid();
  agendamento_teste_id uuid := gen_random_uuid();
  agendamento_isolado_id uuid := gen_random_uuid();
  agendamento_falta_id uuid := gen_random_uuid();
  data_da_falta date := date_trunc('week', current_date)::date - 7;
begin
  select id into usuario_rh_id
  from auth.users
  where lower(email) = 'rh@ciclo.test';

  select id into usuario_clinica_id
  from auth.users
  where lower(email) = 'clinica@ciclo.test';

  if usuario_rh_id is null or usuario_clinica_id is null then
    raise exception 'Crie os usuários de demonstração antes desta verificação.';
  end if;

  insert into public.organizacoes (id, nome, tipo)
  values (outra_clinica_id, 'Clínica isolada do teste', 'clinica');

  insert into public.agendamentos_ocupacionais (
    id,
    empresa_id,
    clinica_id,
    colaborador_id,
    tipo_exame,
    status,
    data_referencia,
    data_limite,
    periodo_preferido,
    criado_por
  ) values (
    agendamento_teste_id,
    empresa_id,
    clinica_id,
    '20000000-0000-4000-8000-000000000001',
    'periodico',
    'solicitado',
    current_date + 30,
    current_date + 30,
    'manha',
    usuario_rh_id
  ), (
    agendamento_isolado_id,
    empresa_id,
    outra_clinica_id,
    '20000000-0000-4000-8000-000000000002',
    'admissional',
    'solicitado',
    current_date + 31,
    current_date + 31,
    'qualquer',
    usuario_rh_id
  );

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
    inicio_agendado,
    fim_agendado,
    criado_por
  ) values (
    agendamento_falta_id,
    empresa_id,
    clinica_id,
    '20000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000001',
    'periodico',
    'nao_compareceu',
    data_da_falta,
    data_da_falta,
    'qualquer',
    (data_da_falta::text || ' 10:00:00-03')::timestamptz,
    (data_da_falta::text || ' 10:30:00-03')::timestamptz,
    usuario_rh_id
  );

  perform set_config('ciclo.teste.usuario_rh', usuario_rh_id::text, true);
  perform set_config('ciclo.teste.usuario_clinica', usuario_clinica_id::text, true);
  perform set_config('ciclo.teste.agendamento', agendamento_teste_id::text, true);
  perform set_config('ciclo.teste.agendamento_isolado', agendamento_isolado_id::text, true);
  perform set_config('ciclo.teste.agendamento_falta', agendamento_falta_id::text, true);
end;
$$;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('ciclo.teste.usuario_rh'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  quantidade integer;
begin
  select count(*) into quantidade
  from public.listar_colaboradores_autorizados();

  if quantidade = 0 then
    raise exception 'FALHA: o RH não recebeu seus colaboradores pela RPC mascarada.';
  end if;

  begin
    perform cpf from public.colaboradores limit 1;
    raise exception 'FALHA: o RH conseguiu selecionar o CPF completo diretamente.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.confirmar_horario_agendamento(
      current_setting('ciclo.teste.agendamento')::uuid,
      '30000000-0000-4000-8000-000000000001',
      ((current_date + 1)::text || ' 10:00:00-03')::timestamptz,
      ((current_date + 1)::text || ' 10:30:00-03')::timestamptz
    );
    raise exception 'FALHA: o RH conseguiu confirmar um horário.';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('ciclo.teste.usuario_clinica'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  quantidade integer;
  inicio_teste timestamptz :=
    ((
      case extract(isodow from current_date + 1)::integer
        when 6 then current_date + 3
        when 7 then current_date + 2
        else current_date + 1
      end
    )::text || ' 10:00:00-03')::timestamptz;
  inicio_no_sabado timestamptz :=
    ((date_trunc('week', current_date)::date + 12)::text || ' 10:00:00-03')::timestamptz;
begin
  if not exists (
    select 1
    from public.recursos_clinica
    where id = '30000000-0000-4000-8000-000000000001'
      and nome = 'Medicina do Trabalho'
      and duracao_padrao_minutos = 30
      and ativo
  ) or exists (
    select 1
    from public.recursos_clinica
    where id = '30000000-0000-4000-8000-000000000002'
      and ativo
  ) then
    raise exception 'FALHA: a clínica não possui somente a agenda ativa Medicina do Trabalho.';
  end if;

  select count(*) into quantidade
  from public.agendamentos_ocupacionais
  where id = current_setting('ciclo.teste.agendamento_isolado')::uuid;

  if quantidade <> 0 then
    raise exception 'FALHA: a clínica visualizou um agendamento de outra clínica.';
  end if;

  if exists (
    select 1
    from public.listar_colaboradores_autorizados()
    where cpf_final !~ '^\d{2}$'
  ) then
    raise exception 'FALHA: a RPC retornou CPF fora do formato mascarado.';
  end if;

  begin
    perform public.confirmar_horario_agendamento(
      current_setting('ciclo.teste.agendamento')::uuid,
      '30000000-0000-4000-8000-000000000001',
      inicio_teste,
      inicio_teste + interval '31 minutes'
    );
    raise exception 'FALHA: o banco aceitou duração diferente da agenda.';
  exception
    when sqlstate '22007' then null;
  end;

  begin
    perform public.confirmar_horario_agendamento(
      current_setting('ciclo.teste.agendamento')::uuid,
      '30000000-0000-4000-8000-000000000001',
      inicio_no_sabado,
      inicio_no_sabado + interval '30 minutes'
    );
    raise exception 'FALHA: o banco aceitou agendamento no sábado.';
  exception
    when sqlstate '22007' then null;
  end;

  begin
    perform public.confirmar_horario_agendamento(
      current_setting('ciclo.teste.agendamento')::uuid,
      '30000000-0000-4000-8000-000000000001',
      inicio_teste + interval '10 minutes',
      inicio_teste + interval '40 minutes'
    );
    raise exception 'FALHA: o banco aceitou início fora da grade de 30 minutos.';
  exception
    when sqlstate '22007' then null;
  end;

  begin
    perform public.confirmar_horario_agendamento(
      current_setting('ciclo.teste.agendamento')::uuid,
      '30000000-0000-4000-8000-000000000001',
      (((inicio_teste at time zone 'America/Sao_Paulo')::date)::text || ' 07:30:00-03')::timestamptz,
      (((inicio_teste at time zone 'America/Sao_Paulo')::date)::text || ' 08:00:00-03')::timestamptz
    );
    raise exception 'FALHA: o banco aceitou atendimento antes das 08:00.';
  exception
    when sqlstate '22007' then null;
  end;

  begin
    perform public.confirmar_horario_agendamento(
      current_setting('ciclo.teste.agendamento')::uuid,
      '30000000-0000-4000-8000-000000000001',
      (((inicio_teste at time zone 'America/Sao_Paulo')::date)::text || ' 18:00:00-03')::timestamptz,
      (((inicio_teste at time zone 'America/Sao_Paulo')::date)::text || ' 18:30:00-03')::timestamptz
    );
    raise exception 'FALHA: o banco aceitou atendimento depois das 18:00.';
  exception
    when sqlstate '22007' then null;
  end;

  perform public.confirmar_horario_agendamento(
    current_setting('ciclo.teste.agendamento_falta')::uuid,
    '30000000-0000-4000-8000-000000000001',
    inicio_teste + interval '1 hour',
    inicio_teste + interval '1 hour 30 minutes'
  );

  if not exists (
    select 1
    from public.agendamentos_ocupacionais
    where id = current_setting('ciclo.teste.agendamento_falta')::uuid
      and status = 'agendado'
      and inicio_agendado = inicio_teste + interval '1 hour'
  ) then
    raise exception 'FALHA: o banco bloqueou o reagendamento após não comparecimento.';
  end if;

  perform public.confirmar_horario_agendamento(
    current_setting('ciclo.teste.agendamento')::uuid,
    '30000000-0000-4000-8000-000000000001',
    inicio_teste,
    inicio_teste + interval '30 minutes'
  );

  if not exists (
    select 1
    from public.eventos_agendamento
    where agendamento_id = current_setting('ciclo.teste.agendamento')::uuid
      and descricao = 'Horário confirmado pela clínica.'
  ) then
    raise exception 'FALHA: a confirmação não gerou evento de auditoria.';
  end if;
end;
$$;

reset role;

select 'Verificações de segurança e fluxo aprovadas.' as resultado;

rollback;
