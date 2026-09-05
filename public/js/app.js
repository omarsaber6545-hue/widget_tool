// CustomRP 1.19.3 Web - Frontend Logic
document.addEventListener('DOMContentLoaded', () => {
  let appState = null;
  let timerInterval = null;
  let currentElapsedSeconds = 0;
  let logCount = 0;
  let loadedAssets = [];

  // Form Inputs
  const inpId = document.getElementById('inpId');
  const selType = document.getElementById('selType');
  const selDisplay = document.getElementById('selDisplay');
  const inpName = document.getElementById('inpName');
  const inpDetails = document.getElementById('inpDetails');
  const inpDetailsUrl = document.getElementById('inpDetailsUrl');
  const inpState = document.getElementById('inpState');
  const inpStateUrl = document.getElementById('inpStateUrl');
  const inpPartySize = document.getElementById('inpPartySize');
  const inpPartyMax = document.getElementById('inpPartyMax');
  const assetsLoader = document.getElementById('assetsLoader');

  // Timestamps
  const timestampRadios = document.querySelectorAll('input[name="timestampRadio"]');
  const inpTimeStart = document.getElementById('inpTimeStart');
  const chkTimeEnd = document.getElementById('chkTimeEnd');
  const inpTimeEnd = document.getElementById('inpTimeEnd');

  // Images
  const inpLargeKey = document.getElementById('inpLargeKey');
  const inpLargeText = document.getElementById('inpLargeText');
  const inpLargeUrl = document.getElementById('inpLargeUrl');
  const inpSmallKey = document.getElementById('inpSmallKey');
  const inpSmallText = document.getElementById('inpSmallText');
  const inpSmallUrl = document.getElementById('inpSmallUrl');
  const largeAssetsList = document.getElementById('largeAssetsList');
  const smallAssetsList = document.getElementById('smallAssetsList');
  const largeThumb = document.getElementById('largeThumb');
  const smallThumb = document.getElementById('smallThumb');

  // Buttons
  const inpBtn1Text = document.getElementById('inpBtn1Text');
  const inpBtn1Url = document.getElementById('inpBtn1Url');
  const inpBtn2Text = document.getElementById('inpBtn2Text');
  const inpBtn2Url = document.getElementById('inpBtn2Url');

  // Actions
  const btnConnect = document.getElementById('btnConnect');
  const btnDisconnect = document.getElementById('btnDisconnect');
  const btnUpdatePresence = document.getElementById('btnUpdatePresence');

  // Status Bar
  const statusUser = document.getElementById('statusUser');
  const statusConnection = document.getElementById('statusConnection');
  const cloudPulse = document.getElementById('cloudPulse');
  const cloudStatusText = document.getElementById('cloudStatusText');
  const topSavedElapsed = document.getElementById('topSavedElapsed');

  // Preview Card Elements
  const previewSideCard = document.getElementById('previewSideCard');
  const btnTogglePreview = document.getElementById('btnTogglePreview');
  const cardAvatar = document.getElementById('cardAvatar');
  const cardDisplayName = document.getElementById('cardDisplayName');
  const cardUsername = document.getElementById('cardUsername');
  const cardStatusBubble = document.getElementById('cardStatusBubble');
  const cardActivityHeader = document.getElementById('cardActivityHeader');
  const cardAppName = document.getElementById('cardAppName');
  const cardDetails = document.getElementById('cardDetails');
  const cardState = document.getElementById('cardState');
  const cardParty = document.getElementById('cardParty');
  const cardElapsedTimer = document.getElementById('cardElapsedTimer');
  const cardLargeImg = document.getElementById('cardLargeImg');
  const cardLargeTooltip = document.getElementById('cardLargeTooltip');
  const cardSmallBox = document.getElementById('cardSmallBox');
  const cardSmallImg = document.getElementById('cardSmallImg');
  const cardSmallTooltip = document.getElementById('cardSmallTooltip');
  const cardButtons = document.getElementById('cardButtons');
  const cardBtn1 = document.getElementById('cardBtn1');
  const cardBtn2 = document.getElementById('cardBtn2');
  const infoPartyText = document.getElementById('infoPartyText');
  const infoImageText = document.getElementById('infoImageText');
  const infoRecoveryText = document.getElementById('infoRecoveryText');

  // Modals & Drawers
  const tokenModal = document.getElementById('tokenModal');
  const btnOpenTokenModal = document.getElementById('btnOpenTokenModal');
  const btnCloseTokenModal = document.getElementById('btnCloseTokenModal');
  const inpToken = document.getElementById('inpToken');
  const btnSaveTokenModal = document.getElementById('btnSaveTokenModal');
  const btnToggleTokenVisibility = document.getElementById('btnToggleTokenVisibility');
  const btnCopyCode = document.getElementById('btnCopyCode');

  const timeRecoveryModal = document.getElementById('timeRecoveryModal');
  const btnOpenTimeRecoveryModal = document.getElementById('btnOpenTimeRecoveryModal');
  const btnCloseTimeModal = document.getElementById('btnCloseTimeModal');
  const chkModalAutoRestart = document.getElementById('chkModalAutoRestart');
  const btnSaveTimeSettings = document.getElementById('btnSaveTimeSettings');
  const modalPingUrl = document.getElementById('modalPingUrl');
  const btnCopyPingUrl = document.getElementById('btnCopyPingUrl');

  const logsDrawer = document.getElementById('logsDrawer');
  const btnToggleLogs = document.getElementById('btnToggleLogs');
  const btnCloseDrawerLogs = document.getElementById('btnCloseDrawerLogs');
  const btnClearDrawerLogs = document.getElementById('btnClearDrawerLogs');
  const drawerTerminal = document.getElementById('drawerTerminal');
  const drawerLogCount = document.getElementById('drawerLogCount');

  const filePickerCrp = document.getElementById('filePickerCrp');
  const appToast = document.getElementById('appToast');

  modalPingUrl.value = `${window.location.origin}/health`;

  // Helper: Toast
  function showToast(msg, isError = false) {
    appToast.textContent = msg;
    appToast.className = `win-toast show ${isError ? 'error' : ''}`;
    setTimeout(() => {
      appToast.className = 'win-toast';
    }, 3000);
  }

  // Format Seconds -> HH:MM:SS
  function formatSeconds(secs) {
    if (isNaN(secs) || secs < 0) secs = 0;
    const days = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (days > 0) return `${days}d ${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  // 1. Live Validation & Preview Updating
  function updatePreview() {
    // Validate ID
    const idVal = inpId.value.trim();
    if (/^\d{17,20}$/.test(idVal)) {
      inpId.classList.add('valid-id');
    } else {
      inpId.classList.remove('valid-id');
    }

    // Activity Type Header
    const typeTitles = {
      0: 'PLAYING A GAME',
      1: 'STREAMING',
      2: 'LISTENING TO',
      3: 'WATCHING',
      5: 'COMPETING IN'
    };
    cardActivityHeader.textContent = typeTitles[selType.value] || 'PLAYING A GAME';

    // Name / Details / State
    cardAppName.textContent = inpName.value.trim() || 'CustomRP';
    cardDetails.textContent = inpDetails.value.trim() || '';
    cardState.textContent = inpState.value.trim() || '';

    // Party Size & Max
    const pSize = parseInt(inpPartySize.value, 10) || 0;
    const pMax = parseInt(inpPartyMax.value, 10) || 0;
    if (pSize > 0 && pMax > 0) {
      cardParty.style.display = 'inline';
      cardParty.textContent = `(${pSize} of ${Math.max(pSize, pMax)})`;
      infoPartyText.textContent = `Active (${pSize} of ${Math.max(pSize, pMax)})`;
      infoPartyText.style.color = 'var(--win-green)';
    } else {
      cardParty.style.display = 'none';
      infoPartyText.textContent = 'None';
      infoPartyText.style.color = '#949ba4';
    }

    // Large Image
    const largeKeyVal = inpLargeKey.value.trim();
    if (largeKeyVal) {
      let resolvedSrc = resolveImageSrc(largeKeyVal, inpId.value.trim());
      cardLargeImg.src = resolvedSrc;
      cardLargeImg.style.display = 'block';
      largeThumb.src = resolvedSrc;
      largeThumb.style.display = 'block';
      cardLargeTooltip.textContent = inpLargeText.value.trim() || largeKeyVal;
      infoImageText.textContent = 'Active: ' + (largeKeyVal.length > 15 ? largeKeyVal.slice(0, 15) + '...' : largeKeyVal);
    } else {
      cardLargeImg.src = '/assets/logo.png';
      largeThumb.style.display = 'none';
      cardLargeTooltip.textContent = 'CustomRP';
      infoImageText.textContent = 'Default Logo';
    }

    // Small Image
    const smallKeyVal = inpSmallKey.value.trim();
    if (smallKeyVal) {
      let resolvedSmall = resolveImageSrc(smallKeyVal, inpId.value.trim());
      cardSmallBox.style.display = 'block';
      cardSmallImg.src = resolvedSmall;
      smallThumb.src = resolvedSmall;
      smallThumb.style.display = 'block';
      cardSmallTooltip.textContent = inpSmallText.value.trim() || smallKeyVal;
    } else {
      cardSmallBox.style.display = 'none';
      smallThumb.style.display = 'none';
    }

    // Buttons
    const b1Text = inpBtn1Text.value.trim();
    const b1Url = inpBtn1Url.value.trim();
    const b2Text = inpBtn2Text.value.trim();
    const b2Url = inpBtn2Url.value.trim();

    if (b1Text && b1Url) {
      cardBtn1.style.display = 'flex';
      cardBtn1.querySelector('span').textContent = b1Text;
      cardBtn1.href = b1Url;
    } else {
      cardBtn1.style.display = 'none';
    }

    if (b2Text && b2Url) {
      cardBtn2.style.display = 'flex';
      cardBtn2.querySelector('span').textContent = b2Text;
      cardBtn2.href = b2Url;
    } else {
      cardBtn2.style.display = 'none';
    }

    if ((b1Text && b1Url) || (b2Text && b2Url)) {
      cardButtons.style.display = 'flex';
    } else {
      cardButtons.style.display = 'none';
    }
  }

  // Helper to resolve asset key or direct URL into an image source
  function resolveImageSrc(keyOrUrl, appId) {
    if (!keyOrUrl) return '/assets/logo.png';
    // If user pasted local file path or it contains هورايزن
    if (keyOrUrl.startsWith('file://') || /^[A-Z]:[\\\/]/i.test(keyOrUrl) || keyOrUrl.includes('هورايزن') || keyOrUrl.includes('%D9%87%D9%88%D8%B1%D8%A7%D9%8A%D8%B2%D9%86')) {
      if (appId === '1545546198675624016') {
        return 'https://cdn.discordapp.com/app-assets/1545546198675624016/1545574027740053535.png';
      }
      if (appId === '1536166390443278337') {
        return 'https://cdn.discordapp.com/app-assets/1536166390443278337/1545569728041582713.png';
      }
      return 'https://cdn.discordapp.com/app-assets/1545546198675624016/1545574027740053535.png';
    }
    if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
      return keyOrUrl;
    }
    // If it's 'hz'
    if (keyOrUrl.toLowerCase() === 'hz' && appId) {
      if (appId === '1545546198675624016') {
        return 'https://cdn.discordapp.com/app-assets/1545546198675624016/1545574027740053535.png';
      }
      if (appId === '1536166390443278337') {
        return 'https://cdn.discordapp.com/app-assets/1536166390443278337/1545569728041582713.png';
      }
    }
    const found = loadedAssets.find(a => a.name.toLowerCase() === keyOrUrl.toLowerCase() || a.id === keyOrUrl);
    if (found && appId) {
      return `https://cdn.discordapp.com/app-assets/${appId}/${found.id}.png`;
    }
    if (/^\d{17,21}$/.test(keyOrUrl) && appId) {
      return `https://cdn.discordapp.com/app-assets/${appId}/${keyOrUrl}.png`;
    }
    return `https://cdn.discordapp.com/app-assets/${appId}/${keyOrUrl}.png`;
  }

  // 2. Fetch Assets for Application ID
  async function fetchApplicationAssets(appId) {
    if (!appId || !/^\d{17,20}$/.test(appId)) return;
    assetsLoader.style.display = 'block';
    try {
      const res = await fetch(`/api/discord/assets/${appId}`);
      const data = await res.json();
      assetsLoader.style.display = 'none';
      if (data.success && Array.isArray(data.assets)) {
        loadedAssets = data.assets;
        largeAssetsList.innerHTML = '';
        smallAssetsList.innerHTML = '';
        data.assets.forEach(asset => {
          const opt1 = document.createElement('option');
          opt1.value = asset.name;
          opt1.textContent = `${asset.name} (Discord Asset ID: ${asset.id})`;
          largeAssetsList.appendChild(opt1);

          const opt2 = document.createElement('option');
          opt2.value = asset.name;
          opt2.textContent = `${asset.name} (Discord Asset ID: ${asset.id})`;
          smallAssetsList.appendChild(opt2);
        });

        if (data.assets.length > 0) {
          showToast(`تم العثور على ${data.assets.length} صورة مرفوعة في ديسكورد لهذا التطبيق!`);
        }
        updatePreview();
      }
    } catch (err) {
      assetsLoader.style.display = 'none';
    }
  }

  // Auto-detect and fix local file path pasted into Key fields
  function sanitizeKeyInput(inputEl) {
    let val = inputEl.value.trim();
    if (val.startsWith('file://') || /^[A-Z]:[\\\/]/i.test(val) || val.includes('هورايزن') || val.includes('%D9%87%D9%88%D8%B1%D8%A7%D9%8A%D8%B2%D9%86')) {
      inputEl.value = 'hz';
      showToast('تم تحويل المسار المحلي تلقائياً لمفتاح ديسكورد الرسمي: hz ✓');
      updatePreview();
    }
  }

  inpLargeKey.addEventListener('change', () => sanitizeKeyInput(inpLargeKey));
  inpSmallKey.addEventListener('change', () => sanitizeKeyInput(inpSmallKey));

  // Upload buttons logic
  const btnUploadLarge = document.getElementById('btnUploadLarge');
  const fileUploadLarge = document.getElementById('fileUploadLarge');
  const btnUploadSmall = document.getElementById('btnUploadSmall');
  const fileUploadSmall = document.getElementById('fileUploadSmall');

  if (btnUploadLarge && fileUploadLarge) {
    btnUploadLarge.addEventListener('click', () => fileUploadLarge.click());
    fileUploadLarge.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        showToast('جاري رفع الصورة إلى ديسكورد مباشرة...');
        try {
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': file.type || 'image/png',
              'x-filename': encodeURIComponent(file.name),
              'x-app-id': inpId.value.trim()
            },
            body: file
          });
          const data = await res.json();
          if (data.success) {
            const finalKey = data.key || data.url;
            inpLargeKey.value = finalKey;
            updatePreview();
            if (data.isDiscordAsset) {
              showToast(`تم رفع الصورة رسمياً إلى ديسكورد كمفتاح: ${finalKey} ✓`);
              fetchApplicationAssets(inpId.value.trim());
            } else {
              showToast('تم رفع الصورة بنجاح ووضع الرابط المباشر! ✓');
            }
          } else {
            showToast('فشل رفع الصورة', true);
          }
        } catch (err) {
          showToast('خطأ في الرفع: ' + err.message, true);
        }
      }
    });
  }

  if (btnUploadSmall && fileUploadSmall) {
    btnUploadSmall.addEventListener('click', () => fileUploadSmall.click());
    fileUploadSmall.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        showToast('جاري رفع الصورة إلى ديسكورد مباشرة...');
        try {
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': file.type || 'image/png',
              'x-filename': encodeURIComponent(file.name),
              'x-app-id': inpId.value.trim()
            },
            body: file
          });
          const data = await res.json();
          if (data.success) {
            const finalKey = data.key || data.url;
            inpSmallKey.value = finalKey;
            updatePreview();
            if (data.isDiscordAsset) {
              showToast(`تم رفع الصورة رسمياً إلى ديسكورد كمفتاح: ${finalKey} ✓`);
              fetchApplicationAssets(inpId.value.trim());
            } else {
              showToast('تم رفع الصورة بنجاح ووضع الرابط المباشر! ✓');
            }
          } else {
            showToast('فشل رفع الصورة', true);
          }
        } catch (err) {
          showToast('خطأ في الرفع: ' + err.message, true);
        }
      }
    });
  }

  // Pre-fill valid datetime string
  function getDefaultDateTimeString() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  if (!inpTimeStart.value) {
    inpTimeStart.value = getDefaultDateTimeString();
  }

  inpTimeStart.addEventListener('change', () => {
    if (inpTimeStart.value && inpTimeStart.value.length === 10) {
      inpTimeStart.value = `${inpTimeStart.value}T12:00`;
    }
    updatePreview();
  });

  // Bind live listeners
  const allFormInputs = [
    inpId, selType, selDisplay, inpName, inpDetails, inpDetailsUrl,
    inpState, inpStateUrl, inpPartySize, inpPartyMax,
    inpLargeKey, inpLargeText, inpLargeUrl,
    inpSmallKey, inpSmallText, inpSmallUrl,
    inpBtn1Text, inpBtn1Url, inpBtn2Text, inpBtn2Url
  ];

  allFormInputs.forEach(input => {
    input.addEventListener('input', updatePreview);
    input.addEventListener('change', updatePreview);
  });

  inpId.addEventListener('blur', () => {
    fetchApplicationAssets(inpId.value.trim());
  });

  // Party size automatic validation (partyMax >= partySize)
  const validateParty = () => {
    const s = parseInt(inpPartySize.value, 10);
    const m = parseInt(inpPartyMax.value, 10);
    if (!isNaN(s) && !isNaN(m)) {
      if (m === 0) {
        inpPartySize.value = 0;
      } else if (s > m) {
        inpPartyMax.value = s;
      }
    }
    updatePreview();
  };
  inpPartySize.addEventListener('input', validateParty);
  inpPartySize.addEventListener('change', validateParty);
  inpPartyMax.addEventListener('input', validateParty);
  inpPartyMax.addEventListener('change', validateParty);

  // Checkbox end time toggle
  chkTimeEnd.addEventListener('change', () => {
    inpTimeEnd.disabled = !chkTimeEnd.checked;
  });

  // 3. Build Config Object from Form
  function buildConfigFromForm() {
    let timestampType = 0;
    timestampRadios.forEach(r => {
      if (r.checked) timestampType = parseInt(r.value, 10);
    });

    return {
      applicationId: inpId.value.trim(),
      name: inpName.value.trim(),
      type: parseInt(selType.value, 10) || 0,
      display: parseInt(selDisplay.value, 10) || 0,
      details: inpDetails.value.trim(),
      detailsUrl: inpDetailsUrl.value.trim(),
      state: inpState.value.trim(),
      stateUrl: inpStateUrl.value.trim(),
      partySize: parseInt(inpPartySize.value, 10) || 0,
      partyMax: parseInt(inpPartyMax.value, 10) || 0,
      timestampType,
      customTimestampStart: inpTimeStart.value,
      customTimestampEndEnabled: chkTimeEnd.checked,
      customTimestampEnd: inpTimeEnd.value,
      largeKey: inpLargeKey.value.trim(),
      largeText: inpLargeText.value.trim(),
      largeUrl: inpLargeUrl.value.trim(),
      smallKey: inpSmallKey.value.trim(),
      smallText: inpSmallText.value.trim(),
      smallUrl: inpSmallUrl.value.trim(),
      button1Text: inpBtn1Text.value.trim(),
      button1Url: inpBtn1Url.value.trim(),
      button2Text: inpBtn2Text.value.trim(),
      button2Url: inpBtn2Url.value.trim(),
      token: inpToken.value.trim()
    };
    try {
      localStorage.setItem('customrp_saved_config', JSON.stringify(config));
    } catch (e) {}
    return config;
  }

  // 4. Populate Form from State
  function populateFormFromState(cfg) {
    if (!cfg) return;

    // Restore from localStorage if server state is blank (crucial for Vercel serverless)
    try {
      const local = localStorage.getItem('customrp_saved_config');
      if (local) {
        const parsed = JSON.parse(local);
        cfg = { ...parsed, ...cfg };
        if (!cfg.token && parsed.token) cfg.token = parsed.token;
      }
    } catch (e) {}
    if (cfg.applicationId) inpId.value = cfg.applicationId;
    if (cfg.name !== undefined) inpName.value = cfg.name;
    if (cfg.type !== undefined) selType.value = cfg.type;
    if (cfg.display !== undefined) selDisplay.value = cfg.display;
    if (cfg.details !== undefined) inpDetails.value = cfg.details;
    if (cfg.detailsUrl !== undefined) inpDetailsUrl.value = cfg.detailsUrl;
    if (cfg.state !== undefined) inpState.value = cfg.state;
    if (cfg.stateUrl !== undefined) inpStateUrl.value = cfg.stateUrl;
    if (cfg.partySize !== undefined) inpPartySize.value = cfg.partySize;
    if (cfg.partyMax !== undefined) inpPartyMax.value = cfg.partyMax;

    if (cfg.timestampType !== undefined) {
      timestampRadios.forEach(r => {
        r.checked = (parseInt(r.value, 10) === cfg.timestampType);
      });
    }

    if (cfg.customTimestampStart) inpTimeStart.value = cfg.customTimestampStart;
    if (cfg.customTimestampEndEnabled !== undefined) {
      chkTimeEnd.checked = cfg.customTimestampEndEnabled;
      inpTimeEnd.disabled = !chkTimeEnd.checked;
    }
    if (cfg.customTimestampEnd) inpTimeEnd.value = cfg.customTimestampEnd;

    inpLargeKey.value = cfg.largeKey || cfg.largeImage || '';
    inpLargeText.value = cfg.largeText || '';
    inpLargeUrl.value = cfg.largeUrl || '';

    inpSmallKey.value = cfg.smallKey || cfg.smallImage || '';
    inpSmallText.value = cfg.smallText || '';
    inpSmallUrl.value = cfg.smallUrl || '';

    inpBtn1Text.value = cfg.button1Text || '';
    inpBtn1Url.value = cfg.button1Url || '';
    inpBtn2Text.value = cfg.button2Text || '';
    inpBtn2Url.value = cfg.button2Url || '';

    if (cfg.token) inpToken.value = cfg.token;

    updatePreview();
  }

  // 5. Apply Status Updates
  function applyStatus(state, userInfo) {
    appState = state;
    currentElapsedSeconds = state.currentTotalElapsedSeconds || 0;

    if (state.status === 'running') {
      statusConnection.textContent = 'Connected';
      statusConnection.style.color = 'var(--win-green)';
      btnConnect.disabled = true;
      btnDisconnect.disabled = false;
      cardStatusBubble.style.background = 'var(--win-green)';
      cloudPulse.style.background = 'var(--win-green)';
      cloudPulse.style.boxShadow = '0 0 8px var(--win-green)';
      cloudStatusText.textContent = '24/7 Cloud: Running';
    } else if (state.status === 'reconnecting') {
      statusConnection.textContent = 'Reconnecting...';
      statusConnection.style.color = '#f1c40f';
      btnConnect.disabled = true;
      btnDisconnect.disabled = false;
      cardStatusBubble.style.background = '#f1c40f';
      cloudPulse.style.background = '#f1c40f';
      cloudStatusText.textContent = '24/7 Cloud: Reconnecting...';
    } else {
      statusConnection.textContent = 'Disconnected';
      statusConnection.style.color = '#949ba4';
      btnConnect.disabled = false;
      btnDisconnect.disabled = true;
      cardStatusBubble.style.background = '#e74c3c';
      cloudPulse.style.background = '#e74c3c';
      cloudStatusText.textContent = '24/7 Cloud: Stopped';
    }

    if (userInfo) {
      statusUser.textContent = userInfo.username || userInfo.global_name || 'rip_luufy25100';
      cardDisplayName.textContent = userInfo.global_name || userInfo.username || 'rip_luufy25100';
      cardUsername.textContent = `@${userInfo.username || 'user'}`;
      if (userInfo.avatar) cardAvatar.src = userInfo.avatar;
    }

    topSavedElapsed.textContent = formatSeconds(state.accumulatedElapsedSeconds || 0);

    // Sync recovery mode in modal
    if (state.timeHandlingMode) {
      const rad = document.querySelector(`input[name="recoveryMode"][value="${state.timeHandlingMode}"]`);
      if (rad) rad.checked = true;
    }
    if (state.autoRestart !== undefined) {
      chkModalAutoRestart.checked = state.autoRestart;
    }

    startTimerLoop();
  }

  function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      if (appState && appState.status === 'running') {
        currentElapsedSeconds += 1;
        updateTimerDisplay();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const formatted = formatSeconds(currentElapsedSeconds);
    cardElapsedTimer.textContent = `${formatted} elapsed`;
  }

  // 6. Connect / Disconnect / Update Actions
  btnConnect.addEventListener('click', async () => {
    // Save current config first
    const config = buildConfigFromForm();
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const res = await fetch('/api/start', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Connecting to Discord Gateway...');
    } else {
      showToast(data.message, true);
      tokenModal.classList.add('open');
    }
  });

  btnDisconnect.addEventListener('click', async () => {
    const res = await fetch('/api/stop', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Disconnected. Elapsed time saved safely.');
    }
  });

  btnUpdatePresence.addEventListener('click', async () => {
    btnUpdatePresence.disabled = true;
    btnUpdatePresence.textContent = 'Updating...';
    const config = buildConfigFromForm();
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم حفظ وتحديث النشاط على ديسكورد فوراً! ✓');
        // إذا كان التواجد متوقفاً، نطلب بدء الاتصال فوراً
        if (!appState || appState.status !== 'running') {
          await fetch('/api/start', { method: 'POST' });
        }
      } else {
        showToast(data.message || 'فشل تحديث النشاط', true);
      }
    } catch (e) {
      showToast('خطأ في الاتصال بالسيرفر: ' + e.message, true);
    } finally {
      btnUpdatePresence.disabled = false;
      btnUpdatePresence.textContent = 'Update Presence';
    }
  });

  // 7. Modals & Drawer Toggles
  btnOpenTokenModal.addEventListener('click', () => tokenModal.classList.add('open'));
  btnCloseTokenModal.addEventListener('click', () => tokenModal.classList.remove('open'));
  document.getElementById('menuSettingsToken').addEventListener('click', () => tokenModal.classList.add('open'));

  btnSaveTokenModal.addEventListener('click', async () => {
    const token = inpToken.value.trim();
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    tokenModal.classList.remove('open');
    showToast('Token saved successfully!');
  });

  btnToggleTokenVisibility.addEventListener('click', () => {
    if (inpToken.type === 'password') {
      inpToken.type = 'text';
      btnToggleTokenVisibility.textContent = '🔒';
    } else {
      inpToken.type = 'password';
      btnToggleTokenVisibility.textContent = '👁';
    }
  });

  btnCopyCode.addEventListener('click', () => {
    const code = document.querySelector('.code-snippet-box code').textContent;
    navigator.clipboard.writeText(code);
    showToast('Token script copied to clipboard!');
  });

  btnOpenTimeRecoveryModal.addEventListener('click', () => timeRecoveryModal.classList.add('open'));
  btnCloseTimeModal.addEventListener('click', () => timeRecoveryModal.classList.remove('open'));
  document.getElementById('menuSettingsTime').addEventListener('click', () => timeRecoveryModal.classList.add('open'));

  btnSaveTimeSettings.addEventListener('click', async () => {
    const autoRestart = chkModalAutoRestart.checked;
    let mode = 'resume_elapsed';
    document.querySelectorAll('input[name="recoveryMode"]').forEach(r => {
      if (r.checked) mode = r.value;
    });

    await fetch('/api/auto-restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: autoRestart })
    });

    await fetch('/api/time-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });

    timeRecoveryModal.classList.remove('open');
    showToast('24/7 Resilience & Time settings updated!');
  });

  btnCopyPingUrl.addEventListener('click', () => {
    navigator.clipboard.writeText(modalPingUrl.value);
    showToast('Keep-Alive URL copied!');
  });

  document.getElementById('menuResetTimerAction').addEventListener('click', async () => {
    if (confirm('Reset elapsed timer to 00:00:00?')) {
      await fetch('/api/reset-timer', { method: 'POST' });
      currentElapsedSeconds = 0;
      updateTimerDisplay();
      showToast('Timer reset to 00:00:00');
    }
  });

  // Toggle Live Preview Card
  btnTogglePreview.addEventListener('click', () => {
    if (previewSideCard.style.display === 'none') {
      previewSideCard.style.display = 'flex';
      btnTogglePreview.classList.add('active');
    } else {
      previewSideCard.style.display = 'none';
      btnTogglePreview.classList.remove('active');
    }
  });

  // Toggle Logs Drawer
  btnToggleLogs.addEventListener('click', () => {
    logsDrawer.classList.toggle('open');
    btnToggleLogs.classList.toggle('active');
  });
  btnCloseDrawerLogs.addEventListener('click', () => {
    logsDrawer.classList.remove('open');
    btnToggleLogs.classList.remove('active');
  });
  btnClearDrawerLogs.addEventListener('click', () => {
    drawerTerminal.innerHTML = '';
    logCount = 0;
    drawerLogCount.textContent = '0';
  });

  // 8. CRP File Import & Export (File Menu)
  document.getElementById('menuLoadPreset').addEventListener('click', () => filePickerCrp.click());
  filePickerCrp.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const xml = ev.target.result;
          const res = await fetch('/api/presets/import-crp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xml })
          });
          const data = await res.json();
          if (data.success) {
            populateFormFromState(data.config);
            showToast('Preset (.crp) imported and applied successfully!');
          }
        } catch (err) {
          showToast('Failed to import .crp file', true);
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  });

  document.getElementById('menuSavePreset').addEventListener('click', async () => {
    const config = buildConfigFromForm();
    const res = await fetch('/api/presets/export-crp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name || 'preset'}.crp`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Exported preset (.crp) file downloaded!');
  });

  document.getElementById('menuHelpAssets').addEventListener('click', () => {
    alert('To add image assets to your application:\n1. Open Discord Developer Portal (https://discord.com/developers/applications)\n2. Select your Application > Rich Presence > Art Assets\n3. Click "Add Image(s)" and name your asset (e.g. "logo" or "hz")\n4. Enter that name in the Key field in CustomRP!');
  });

  document.getElementById('menuHelpToken').addEventListener('click', () => {
    tokenModal.classList.add('open');
  });

  // 9. SSE Real-time Logs
  function initLogsStream() {
    const evtSource = new EventSource('/api/logs/stream');
    evtSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'state_update') {
          applyStatus(payload.state, appState ? appState.userInfo : null);
        } else {
          logCount++;
          drawerLogCount.textContent = logCount;
          const line = document.createElement('div');
          line.className = `log-line log-${payload.type || 'info'}`;
          line.textContent = `[${payload.timeFormatted || '00:00:00'}] [${(payload.type || 'INFO').toUpperCase()}] ${payload.message}`;
          drawerTerminal.appendChild(line);
          if (drawerTerminal.children.length > 100) {
            drawerTerminal.removeChild(drawerTerminal.firstChild);
          }
          drawerTerminal.scrollTop = drawerTerminal.scrollHeight;
        }
      } catch (err) {}
    };
    evtSource.onerror = () => {
      setTimeout(initLogsStream, 5000);
    };
  }

  // --- REAL DISCORD AUTHENTICATION & USER MANAGEMENT ---
  let currentUser = null;
  let sessionToken = localStorage.getItem('customrp_session_token') || null;

  const btnOpenDiscordLogin = document.getElementById('btnOpenDiscordLogin');
  const discordLoginModal = document.getElementById('discordLoginModal');
  const btnCloseDiscordLoginModal = document.getElementById('btnCloseDiscordLoginModal');
  const btnCancelDiscordLogin = document.getElementById('btnCancelDiscordLogin');
  const btnSubmitDiscordLogin = document.getElementById('btnSubmitDiscordLogin');
  const loginTokenInput = document.getElementById('loginTokenInput');
  const loginStatusFeedback = document.getElementById('loginStatusFeedback');

  const userProfilePill = document.getElementById('userProfilePill');
  const navUserAvatar = document.getElementById('navUserAvatar');
  const navUserDisplayName = document.getElementById('navUserDisplayName');
  const navUserTag = document.getElementById('navUserTag');
  const userProfileDropdown = document.getElementById('userProfileDropdown');
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const dropdownDisplayName = document.getElementById('dropdownDisplayName');
  const dropdownUsername = document.getElementById('dropdownUsername');
  const btnCopyUserId = document.getElementById('btnCopyUserId');
  const btnOpenAccountDetails = document.getElementById('btnOpenAccountDetails');
  const btnLogout = document.getElementById('btnLogout');

  const accountDetailsModal = document.getElementById('accountDetailsModal');
  const btnCloseAccountDetailsModal = document.getElementById('btnCloseAccountDetailsModal');
  const modalProfileAvatar = document.getElementById('modalProfileAvatar');
  const modalProfileDisplayName = document.getElementById('modalProfileDisplayName');
  const modalProfileUsername = document.getElementById('modalProfileUsername');
  const modalProfileUserId = document.getElementById('modalProfileUserId');
  const modalProfileActiveApp = document.getElementById('modalProfileActiveApp');
  const btnModalLogout = document.getElementById('btnModalLogout');

  // Helper for authenticated API calls
  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  }

  // Update UI for Logged-In User
  function setLoggedInUser(user) {
    currentUser = user;
    if (btnOpenDiscordLogin) btnOpenDiscordLogin.style.display = 'none';
    if (userProfilePill) userProfilePill.style.display = 'flex';

    if (navUserAvatar) navUserAvatar.src = user.avatar;
    if (navUserDisplayName) navUserDisplayName.textContent = user.displayName || user.username;
    if (navUserTag) navUserTag.textContent = user.discriminator ? `@${user.username}#${user.discriminator}` : `@${user.username}`;

    if (dropdownAvatar) dropdownAvatar.src = user.avatar;
    if (dropdownDisplayName) dropdownDisplayName.textContent = user.displayName || user.username;
    if (dropdownUsername) dropdownUsername.textContent = `@${user.username}`;

    if (modalProfileAvatar) modalProfileAvatar.src = user.avatar;
    if (modalProfileDisplayName) modalProfileDisplayName.textContent = user.displayName || user.username;
    if (modalProfileUsername) modalProfileUsername.textContent = `@${user.username}`;
    if (modalProfileUserId) modalProfileUserId.textContent = user.id;
    if (modalProfileActiveApp) modalProfileActiveApp.textContent = inpName.value.trim() || 'Horizon Services';

    // Also sync Discord preview card with real user avatar and name!
    cardAvatar.src = user.avatar;
    cardDisplayName.textContent = user.displayName || user.username;
    cardUsername.textContent = `@${user.username}`;
  }

  // Update UI for Logged-Out State
  function setLoggedOutUser() {
    currentUser = null;
    sessionToken = null;
    localStorage.removeItem('customrp_session_token');
    if (btnOpenDiscordLogin) btnOpenDiscordLogin.style.display = 'flex';
    if (userProfilePill) userProfilePill.style.display = 'none';
    if (userProfileDropdown) userProfileDropdown.classList.remove('open');
  }

  // Check Current Session with Backend
  async function checkAuthSession() {
    if (!sessionToken) return false;
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.authenticated && data.user) {
        setLoggedInUser(data.user);
        if (data.config) {
          populateFormFromState(data.config);
        }
        return true;
      } else {
        setLoggedOutUser();
      }
    } catch (e) {}
    return false;
  }

  // Event Listeners for Login & Profile
  if (btnOpenDiscordLogin) {
    btnOpenDiscordLogin.addEventListener('click', () => {
      loginStatusFeedback.style.display = 'none';
      if (inpToken.value.trim()) {
        loginTokenInput.value = inpToken.value.trim();
      }
      discordLoginModal.classList.add('open');
    });
  }

  if (btnCloseDiscordLoginModal) {
    btnCloseDiscordLoginModal.addEventListener('click', () => discordLoginModal.classList.remove('open'));
  }
  if (btnCancelDiscordLogin) {
    btnCancelDiscordLogin.addEventListener('click', () => discordLoginModal.classList.remove('open'));
  }

  // Submit Login
  if (btnSubmitDiscordLogin) {
    btnSubmitDiscordLogin.addEventListener('click', async () => {
      const token = loginTokenInput.value.trim();
      if (!token) {
        loginStatusFeedback.className = 'login-feedback error';
        loginStatusFeedback.textContent = 'يرجى إدخال رمز الحساب (Token)';
        loginStatusFeedback.style.display = 'block';
        return;
      }

      btnSubmitDiscordLogin.disabled = true;
      btnSubmitDiscordLogin.innerHTML = '<span>جاري التحقق من ديسكورد...</span>';
      loginStatusFeedback.style.display = 'none';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();

        if (data.success) {
          sessionToken = data.sessionToken;
          localStorage.setItem('customrp_session_token', sessionToken);
          setLoggedInUser(data.user);

          if (data.config) {
            populateFormFromState(data.config);
          }
          inpToken.value = token;

          discordLoginModal.classList.remove('open');
          showToast(`مرحباً بك يا ${data.user.displayName}! تم تسجيل الدخول وحفظ بياناتك بنجاح ✓`);
        } else {
          loginStatusFeedback.className = 'login-feedback error';
          loginStatusFeedback.textContent = data.message || 'فشل تسجيل الدخول';
          loginStatusFeedback.style.display = 'block';
        }
      } catch (err) {
        loginStatusFeedback.className = 'login-feedback error';
        loginStatusFeedback.textContent = 'خطأ في الاتصال بالسيرفر: ' + err.message;
        loginStatusFeedback.style.display = 'block';
      } finally {
        btnSubmitDiscordLogin.disabled = false;
        btnSubmitDiscordLogin.innerHTML = '<span>تسجيل الدخول الآن 🚀</span>';
      }
    });
  }

  // Profile Dropdown Toggle
  if (userProfilePill) {
    userProfilePill.addEventListener('click', (e) => {
      e.stopPropagation();
      userProfileDropdown.classList.toggle('open');
    });
  }

  document.addEventListener('click', () => {
    if (userProfileDropdown) userProfileDropdown.classList.remove('open');
  });

  // Copy User ID
  if (btnCopyUserId) {
    btnCopyUserId.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentUser && currentUser.id) {
        navigator.clipboard.writeText(currentUser.id);
        showToast(`تم نسخ معرف الحساب: ${currentUser.id} بنجاح! ✓`);
        userProfileDropdown.classList.remove('open');
      }
    });
  }

  // Account Details Modal
  if (btnOpenAccountDetails) {
    btnOpenAccountDetails.addEventListener('click', (e) => {
      e.stopPropagation();
      userProfileDropdown.classList.remove('open');
      accountDetailsModal.classList.add('open');
    });
  }

  if (btnCloseAccountDetailsModal) {
    btnCloseAccountDetailsModal.addEventListener('click', () => accountDetailsModal.classList.remove('open'));
  }

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (e) {}
    setLoggedOutUser();
    if (accountDetailsModal) accountDetailsModal.classList.remove('open');
    showToast('تم تسجيل الخروج بنجاح.');
  };

  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
  if (btnModalLogout) btnModalLogout.addEventListener('click', handleLogout);

  // 10. Initial Fetch
  async function init() {
    try {
      await checkAuthSession();
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.success) {
        if (!currentUser) {
          populateFormFromState(data.state.config);
        }
        applyStatus(data.state, data.userInfo);
        if (data.state.config && data.state.config.applicationId) {
          fetchApplicationAssets(data.state.config.applicationId);
        }
      }
    } catch (err) {}
    initLogsStream();
  }

  init();
});
