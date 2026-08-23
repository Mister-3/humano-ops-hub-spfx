import { endToEndSupabase, isSupabaseConfigured } from '../services/supabase';

const normalizeEmail = (value: string): string =>
  value.trim().toLocaleLowerCase();

const authenticationError = (detail?: string): Error => new Error(
  `No fue posible establecer la identidad segura del módulo End-to-End${
    detail ? `: ${detail}` : '.'
  }`
);

export const establishEndToEndAuthSession = async (
  email: string,
  password: string
): Promise<string> => {
  if (!isSupabaseConfigured()) {
    throw authenticationError('Supabase no está configurado.');
  }

  const expectedEmail = normalizeEmail(email);
  const current = await endToEndSupabase.auth.getUser();
  if (current.error) {
    await endToEndSupabase.auth.signOut();
  } else if (current.data.user) {
    if (normalizeEmail(current.data.user.email || '') === expectedEmail) {
      return current.data.user.id;
    }
    await endToEndSupabase.auth.signOut();
  }

  const signIn = await endToEndSupabase.auth.signInWithPassword({
    email: expectedEmail,
    password
  });
  if (signIn.data.user && signIn.data.session) {
    return signIn.data.user.id;
  }

  const signUp = await endToEndSupabase.auth.signUp({
    email: expectedEmail,
    password,
    options: { data: { source: 'humano-ops-hub' } }
  });
  if (signUp.error) {
    throw authenticationError(signUp.error.message);
  }
  if (signUp.data.user?.identities?.length === 0) {
    throw authenticationError(
      'la identidad ya existe en Supabase Auth, pero la contraseña no coincide.'
    );
  }
  if (!signUp.data.user || !signUp.data.session) {
    throw authenticationError(
      'la cuenta requiere confirmación de correo. En QA, desactive “Confirm email” en Supabase Auth.'
    );
  }
  return signUp.data.user.id;
};

export const restoreEndToEndAuthSession = async (
  expectedEmail: string
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const { data, error } = await endToEndSupabase.auth.getUser();
  return !error && Boolean(
    data.user &&
    normalizeEmail(data.user.email || '') === normalizeEmail(expectedEmail)
  );
};

export const updateEndToEndAuthPassword = async (
  password: string
): Promise<void> => {
  const { error } = await endToEndSupabase.auth.updateUser({ password });
  if (error) throw authenticationError(error.message);
};

export const clearEndToEndAuthSession = async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  await endToEndSupabase.auth.signOut({ scope: 'local' });
};
