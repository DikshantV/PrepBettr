// Static export stubs - functionality disabled
export async function signUp(params?: any) {
  console.warn('Auth disabled in static mode');
  return { success: false, error: 'Static mode', message: 'Auth disabled in static mode' };
}

export async function signUpWithEmail() {
  return signUp();
}

export async function signInWithEmail() {
  return signUp();
}

export async function signOut() {
  return signUp();
}

export async function getCurrentUser(): Promise<{ id: string; name: string; email: string; uid: string } | null> {
  return null;
}

export async function isAuthenticated() {
  return false;
}

export async function signIn() {
  return { error: 'Static mode' };
}
