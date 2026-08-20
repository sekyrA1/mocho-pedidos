-- Remove the legacy structure/finish attribute from order records.
update public.orders
set order_snapshot = replace(
  regexp_replace(
    order_snapshot::text,
    'estrutura\s*:?\s*metal\s+cromado\s+prata',
    '',
    'gi'
  ),
  'metal cromado prata', ''
)::jsonb
where order_snapshot::text ilike any (array[
  '%estrutura: metal cromado prata%',
  '%estrutura metal cromado prata%',
  '%metal cromado prata%'
]);

update public.orders
set order_snapshot = order_snapshot - 'corEstrutura'
where order_snapshot ? 'corEstrutura';

update public.orders
set order_snapshot = jsonb_set(
  order_snapshot,
  '{items}',
  (
    select coalesce(jsonb_agg(item - 'corEstrutura'), '[]'::jsonb)
    from jsonb_array_elements(order_snapshot->'items') as item
  ),
  true
)
where jsonb_typeof(order_snapshot->'items') = 'array';

update public.order_items
set manufacturing_notes = nullif(
  btrim(regexp_replace(
    manufacturing_notes,
    'estrutura\s*:?\s*metal\s+cromado\s+prata',
    '',
    'gi'
  )),
  ''
)
where manufacturing_notes ilike any (array[
  '%estrutura: metal cromado prata%',
  '%estrutura metal cromado prata%'
]);

alter table public.order_items
  drop column if exists frame_finish;
