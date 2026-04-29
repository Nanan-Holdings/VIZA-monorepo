function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

function setStatus(text, variant = 'info') {
  const statusNode = document.getElementById('supabaseStatus');
  if (!statusNode) return;
  statusNode.textContent = text;
  statusNode.className = `pill ${variant}`;
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return 'unknown';
  const date = new Date(expiresAt * 1000);
  return date.toLocaleString();
}

function formatAuthErrorMessage(message) {
  const text = (message || '').toString();
  if (text.startsWith('network_unreachable')) {
    return 'Network unreachable. Check Supabase URL, permissions, or network.';
  }
  if (text === 'network_offline') {
    return 'Network offline. Please reconnect and retry.';
  }
  return text || 'unknown';
}

async function refreshSessionStatus() {
  try {
    const response = await sendMessage({ action: 'authGetSession' });
    if (response?.session?.email) {
      const expiry = formatExpiry(response.session.expires_at);
      setStatus(`Signed in as ${response.session.email} (expires ${expiry})`, 'ok');
      return;
    }
    setStatus('Not signed in', 'info');
  } catch (error) {
    console.warn('Failed to read auth session:', error.message);
    setStatus('Unable to read login status', 'warn');
  }
}

async function handleSendOtp() {
  const emailInput = document.getElementById('supabaseEmail');
  const email = emailInput?.value?.trim();

  if (!email) {
    setStatus('Email is required', 'warn');
    return;
  }

  setStatus('Sending code...', 'info');

  try {
    const response = await sendMessage({
      action: 'authSendOtp',
      email
    });

    if (response?.success) {
      setStatus('Code sent. Check your email.', 'ok');
      return;
    }

    setStatus(`Send failed: ${formatAuthErrorMessage(response?.error)}`, 'warn');
  } catch (error) {
    setStatus(`Send failed: ${formatAuthErrorMessage(error.message)}`, 'warn');
  }
}

async function handleVerifyOtp() {
  const emailInput = document.getElementById('supabaseEmail');
  const codeInput = document.getElementById('supabaseOtpCode');
  const email = emailInput?.value?.trim();
  const token = codeInput?.value?.trim();

  if (!email || !token) {
    setStatus('Email and code are required', 'warn');
    return;
  }

  setStatus('Verifying code...', 'info');

  try {
    const response = await sendMessage({
      action: 'authVerifyOtp',
      email,
      token
    });

    if (response?.success) {
      if (codeInput) codeInput.value = '';
      await refreshSessionStatus();
      return;
    }

    setStatus(`Verify failed: ${formatAuthErrorMessage(response?.error)}`, 'warn');
  } catch (error) {
    setStatus(`Verify failed: ${formatAuthErrorMessage(error.message)}`, 'warn');
  }
}

async function handleLogout() {
  setStatus('Signing out...', 'info');
  try {
    const response = await sendMessage({ action: 'authLogout' });
    if (response?.success) {
      await refreshSessionStatus();
      return;
    }
    setStatus(`Sign out failed: ${response?.error || 'unknown'}`, 'warn');
  } catch (error) {
    setStatus(`Sign out failed: ${error.message}`, 'warn');
  }
}

async function handleFetchProfile() {
  setStatus('Fetching profile...', 'info');
  try {
    const response = await sendMessage({ action: 'fetchProfile', force: true });
    if (response?.success && response?.profile) {
      setStatus('Profile loaded from Supabase', 'ok');
      return;
    }

    if (response?.success && !response?.profile) {
      setStatus('No profile found. Using defaults.', 'warn');
      return;
    }

    setStatus(`Fetch failed: ${response?.error || 'unknown'}`, 'warn');
  } catch (error) {
    setStatus(`Fetch failed: ${error.message}`, 'warn');
  }
}

async function handleUpdatePassword() {
  const newPasswordInput = document.getElementById('supabaseNewPassword');
  const newPassword = newPasswordInput?.value || '';

  if (!newPassword.trim()) {
    setStatus('New password is required', 'warn');
    return;
  }

  setStatus('Updating password...', 'info');

  try {
    const response = await sendMessage({
      action: 'authUpdatePassword',
      password: newPassword
    });

    if (response?.success) {
      if (newPasswordInput) newPasswordInput.value = '';
      setStatus('Password updated successfully', 'ok');
      return;
    }

    setStatus(`Update failed: ${response?.error || 'unknown'}`, 'warn');
  } catch (error) {
    setStatus(`Update failed: ${error.message}`, 'warn');
  }
}

function initSupabaseControls() {
  const sendBtn = document.getElementById('supabaseSendOtp');
  const verifyBtn = document.getElementById('supabaseVerifyOtp');
  const logoutBtn = document.getElementById('supabaseLogout');
  const syncBtn = document.getElementById('supabaseSync');
  const updateBtn = document.getElementById('supabaseUpdatePassword');

  if (sendBtn) sendBtn.addEventListener('click', handleSendOtp);
  if (verifyBtn) verifyBtn.addEventListener('click', handleVerifyOtp);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (syncBtn) syncBtn.addEventListener('click', handleFetchProfile);
  if (updateBtn) updateBtn.addEventListener('click', handleUpdatePassword);

  refreshSessionStatus();
}

(() => {
  const versionLine = document.getElementById('versionLine');
  const generatedAt = document.getElementById('generatedAt');

  let version = 'unknown';
  try {
    version = chrome.runtime?.getManifest?.()?.version || version;
  } catch (error) {
    console.warn('Unable to read manifest version:', error);
  }

  if (versionLine) {
    versionLine.textContent = `Version: ${version}`;
  }

  if (generatedAt) {
    const now = new Date();
    generatedAt.textContent = `Loaded at: ${now.toLocaleString()}`;
  }

  initSupabaseControls();
})();
