import { supabase } from '@/lib/supabaseClient';

const run = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const listRows = (table, orderBy = '-created_at') => {
  const descending = orderBy.startsWith('-');
  const column = descending ? orderBy.slice(1) : orderBy;
  return run(supabase.from(table).select('*').order(column, { ascending: !descending }));
};

export const filterRows = (table, filters = {}, orderBy = null, limit = null) => {
  let query = supabase.from(table).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  if (orderBy) {
    const descending = orderBy.startsWith('-');
    const column = descending ? orderBy.slice(1) : orderBy;
    query = query.order(column, { ascending: !descending });
  }
  if (typeof limit === 'number') {
    query = query.limit(limit);
  }
  return run(query);
};

export const createRow = async (table, values) => {
  const user = await getCurrentUser();
  const insertValues = { ...values };
  if (user && !('user_id' in insertValues) && table !== 'profiles') {
    insertValues.user_id = user.id;
  }
  const rows = await run(supabase.from(table).insert(insertValues).select().limit(1));
  return rows?.[0] ?? null;
};

export const updateRow = async (table, id, values) => {
  const rows = await run(supabase.from(table).update(values).eq('id', id).select().limit(1));
  return rows?.[0] ?? null;
};

export const deleteRow = async (table, id) => {
  await run(supabase.from(table).delete().eq('id', id));
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
};

export const getCurrentUserProfile = async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return {
    ...user,
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? '',
    role: profile?.role ?? user.user_metadata?.role ?? 'user',
  };
};
