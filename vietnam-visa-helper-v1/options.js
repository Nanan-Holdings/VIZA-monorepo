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
})();
