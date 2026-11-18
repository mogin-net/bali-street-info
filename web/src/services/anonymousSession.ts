import { supabase } from "@/lib/supabase";

/** Ensures auth.uid() belongs to a user that still exists in this project. */
export async function ensureAnonymousSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  if (data.session) {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userData.user) return;

    // A database reset can remove auth.users while the browser keeps its old JWT.
    // Replace only an invalid session; preserve it on transient auth/network errors.
    const isStaleSession =
      userError?.code === "user_not_found" ||
      userError?.status === 401 ||
      userError?.status === 404;

    if (userError && !isStaleSession) {
      throw userError;
    }

    const { error: signOutError } = await supabase.auth.signOut({
      scope: "local",
    });
    if (signOutError) throw signOutError;
  }

  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) throw signInError;
}
