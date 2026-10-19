(async function setupAdminAuth() {
  const byId = id => document.getElementById(id);
  const login = byId('loginForm'), recovery = byId('recoveryForm');
  const message = (text, type = '') => { byId('authMessage').textContent = text; byId('authMessage').dataset.type = type; };
  const params = new URLSearchParams(location.search);
  const resetToken = params.get('token');
  if (resetToken) history.replaceState({}, document.title, location.pathname);
  byId('inviteFormTemplate')?.remove();
  let reset = null;
  if (resetToken) { reset = byId('resetFormTemplate').content.firstElementChild.cloneNode(true); recovery.after(reset); }
  byId('resetFormTemplate')?.remove();
  const show = form => [login, recovery, reset].filter(Boolean).forEach(item => { item.hidden = item !== form; });
  const backend = window.appBackend;
  if (!backend) {
    message(window.backendConfigurationError || 'Não foi possível carregar a conexão com o Neon. Recarregue a página.', 'error');
    byId('submitLogin').disabled = true; byId('submitRecovery').disabled = true; return;
  }
  const failure = error => {
    if (error?.status === 429 || /rate.?limit|too many/i.test(error?.message || '')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
    if (/fetch|network|connection/i.test(error?.message || '')) return 'Não foi possível conectar ao Neon. Confira sua conexão e tente novamente.';
    if (/verif|confirm/i.test(error?.message || '')) return 'Confirme seu e-mail antes de entrar.';
    return 'Não foi possível entrar. Confira o e-mail e a senha.';
  };
  async function openPanel(session) {
    if (!session) return;
    const { data: profile, error } = await backend.from('profiles').select('id, display_name, role, active').eq('id', session.user.id).maybeSingle();
    if (error) { message('Não foi possível consultar as permissões do perfil.', 'error'); return; }
    if (!profile?.active || !['admin', 'sales', 'factory', 'viewer'].includes(profile.role)) {
      await backend.auth.signOut();
      message('Sua conta não tem um perfil ativo autorizado. Solicite a liberação ao administrador.', 'error'); return;
    }
    location.assign('pedidos.html');
  }
  async function busy(button, action) {
    button.disabled = true;
    try { await action(); } catch (error) { message(failure(error), 'error'); } finally { button.disabled = false; }
  }
  login.addEventListener('submit', event => {
    event.preventDefault();
    busy(byId('submitLogin'), async () => {
      message('Validando acesso…');
      const { data, error } = await backend.auth.signInWithPassword({ email: byId('email').value.trim(), password: byId('password').value });
      if (error) throw error;
      await openPanel(data.session);
    });
  });
  byId('showRecovery').addEventListener('click', () => { byId('recoveryEmail').value = byId('email').value.trim(); show(recovery); message(''); });
  byId('backToLogin').addEventListener('click', () => { show(login); message(''); });
  recovery.addEventListener('submit', event => {
    event.preventDefault();
    busy(byId('submitRecovery'), async () => {
      const { error } = await backend.auth.resetPasswordForEmail(byId('recoveryEmail').value.trim(), { redirectTo: new URL('admin.html', location.href).href });
      if (error) throw error;
      message('Se o e-mail estiver cadastrado, você receberá um link. Confira também o spam.', 'success');
    });
  });
  reset?.addEventListener('submit', event => {
    event.preventDefault();
    busy(byId('submitReset'), async () => {
      const password = byId('resetPassword').value;
      if (password.length < 8 || password !== byId('resetPasswordConfirmation').value) { message('Use pelo menos 8 caracteres e repita a mesma senha.', 'error'); return; }
      const { error } = await window.appPasswordAuth.resetPassword({ token: resetToken, newPassword: password });
      if (error) { message('O link expirou ou não é válido. Solicite outro link de recuperação.', 'error'); return; }
      show(login); message('Senha atualizada. Entre com sua nova senha.', 'success');
    });
  });
  if (resetToken) { show(reset); message('Defina sua nova senha.'); return; }
  if (params.get('error')) { show(recovery); message('O link expirou ou não é válido. Solicite outro.', 'error'); return; }
  if (params.get('reason') === 'permission') message('Sua conta não tem um perfil ativo autorizado.', 'error');
  if (params.get('reason') === 'session') message('Sua sessão expirou. Entre novamente.', 'error');
  try { const { data, error } = await backend.auth.getSession(); if (error) throw error; await openPanel(data.session); }
  catch (error) { message(failure(error), 'error'); }
})();
