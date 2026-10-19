(async function protectOrdersPage() {
  const allowedRoles = new Set(['admin', 'sales', 'factory', 'viewer']);
  const goToLogin = (reason = '') => {
    const next = `${window.location.pathname.split('/').pop()}${window.location.search}`;
    const target = new URL('admin.html', window.location.href);
    target.searchParams.set('next', next);
    if (reason) target.searchParams.set('reason', reason);
    window.location.replace(target.href);
  };

  if (!window.appBackend) return goToLogin('client');

  const { data: { user }, error: userError } = await window.appBackend.auth.getUser();
  if (userError || !user) return goToLogin('session');

  const { data: { session } } = await window.appBackend.auth.getSession();
  if (!session) return goToLogin('session');

  const { data: profile, error } = await window.appBackend
    .from('profiles')
    .select('id, display_name, role, active')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile?.active || !allowedRoles.has(profile.role)) {
    await window.appBackend.auth.signOut();
    return goToLogin('permission');
  }

  window.currentAuth = { session, profile };
  window.dispatchEvent(new CustomEvent('auth-ready', { detail: window.currentAuth }));
})();
