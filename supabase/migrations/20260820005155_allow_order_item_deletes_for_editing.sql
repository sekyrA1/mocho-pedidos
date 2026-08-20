-- Editing an existing order can remove line items before the new item set is saved.
-- Keep this limited to the same staff roles that can update orders and order_items.
drop policy if exists order_items_delete_sales on public.order_items;
create policy order_items_delete_sales on public.order_items for delete to authenticated
  using (private.current_user_has_role(array['admin', 'sales']));

grant delete on table public.order_items to authenticated;
