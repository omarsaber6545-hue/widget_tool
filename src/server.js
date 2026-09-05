require('dotenv').config();
const express = require('express');
const path = require('path');
const stateManager = require('./state-manager');
const discordGateway = require('./discord-gateway');
const presetManager = require('./preset-manager');
const userManager = require('./user-manager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['text/xml', 'application/xml'], limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// مساعدة للحصول على جلسة المستخدم الحالي
function getSessionFromReq(req) {
  const authHeader = req.headers['authorization'] || req.headers['x-session-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  return userManager.getSessionUser(token);
}

// قائمة مشتركي البث الحي للسجلات (SSE)
const logSubscribers = new Set();

discordGateway.onLog((logItem) => {
  const data = `data: ${JSON.stringify(logItem)}\n\n`;
  for (const res of logSubscribers) {
    try {
      res.write(data);
    } catch (e) {
      logSubscribers.delete(res);
    }
  }
});

// بث حي لتحديثات الحالة (SSE)
stateManager.onChange((state) => {
  const data = `data: ${JSON.stringify({ type: 'state_update', state })}\n\n`;
  for (const res of logSubscribers) {
    try {
      res.write(data);
    } catch (e) {
      logSubscribers.delete(res);
    }
  }
});

// --- API Endpoints ---

// 0. مسارات تسجيل الدخول والمصادقة الحقيقية (Real Discord Auth)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { token, currentConfig } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'يرجى إدخال رمز حساب ديسكورد (Token)' });
    }

    const result = await userManager.loginWithToken(token, currentConfig);
    stateManager.updateConfig(result.config);
    discordGateway.log('success', `تم تسجيل دخول المستخدم بنجاح: ${result.user.displayName} (@${result.user.username})`);
    
    // تشغيل الاتصال تلقائياً عند تسجيل الدخول
    if (stateManager.getState().status !== 'running') {
      discordGateway.start();
    }

    res.json(result);
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const session = getSessionFromReq(req);
  if (session) {
    return res.json({
      success: true,
      authenticated: true,
      user: session.user,
      config: session.config
    });
  }
  res.json({
    success: true,
    authenticated: false,
    user: null
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'] || req.headers['x-session-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  userManager.logout(token);
  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// 1. فحص الحالة الشاملة
app.get('/api/status', (req, res) => {
  const state = stateManager.getState();
  const userInfo = discordGateway.getUserInfo();
  res.json({
    success: true,
    state,
    userInfo,
    serverUptime: Math.floor(process.uptime()),
    serverTime: new Date().toISOString()
  });
});

// 2. تشغيل الخدمة
app.post('/api/start', (req, res) => {
  const started = discordGateway.start();
  if (started) {
    res.json({ success: true, message: 'جاري بدء الاتصال بديسكورد...' });
  } else {
    res.status(400).json({ success: false, message: 'يرجى إدخال رمز الحساب (Token) أولاً في الإعدادات.' });
  }
});

// 3. إيقاف الخدمة
app.post('/api/stop', (req, res) => {
  discordGateway.stop('تم الإيقاف بواسطة المستخدم من لوحة التحكم');
  res.json({ success: true, message: 'تم إيقاف الخدمة وحفظ الوقت المنقضي بنجاح' });
});

// 4. تصفير العداد الزمني
app.post('/api/reset-timer', (req, res) => {
  stateManager.resetTimer();
  discordGateway.log('info', 'تم تصفير عداد الوقت المنقضي إلى 00:00:00');
  if (stateManager.getState().status === 'running') {
    discordGateway.updatePresence();
  }
  res.json({ success: true, message: 'تم تصفير العداد الزمني بنجاح' });
});

// 5. تحديث الإعدادات
app.post('/api/config', async (req, res) => {
  const newConfig = req.body;
  if (!newConfig) {
    return res.status(400).json({ success: false, message: 'بيانات غير صالحة' });
  }

  stateManager.updateConfig(newConfig);
  const session = getSessionFromReq(req);
  if (session && session.user) {
    userManager.updateUserConfig(session.user.id, newConfig);
  }
  discordGateway.log('info', 'تم حفظ وتحديث إعدادات التواجد بنجاح');

  // إرسال تحديث النشاط فوراً إلى ديسكورد إذا كان متصلاً، أو بدء الاتصال إذا كان متوقفاً
  if (stateManager.getState().status === 'running') {
    await discordGateway.updatePresence();
  } else if (newConfig.token && newConfig.token.trim()) {
    discordGateway.start();
  }

  res.json({ success: true, state: stateManager.getState() });
});

// 6. تبديل وضع إعادة التشغيل التلقائي
app.post('/api/auto-restart', (req, res) => {
  const { enabled } = req.body;
  stateManager.setAutoRestart(enabled);
  res.json({ success: true, autoRestart: stateManager.getState().autoRestart });
});

// 7. تحديد وضع احتساب الوقت
app.post('/api/time-mode', (req, res) => {
  const { mode } = req.body;
  stateManager.setTimeHandlingMode(mode);
  if (stateManager.getState().status === 'running') {
    discordGateway.updatePresence();
  }
  res.json({ success: true, timeHandlingMode: stateManager.getState().timeHandlingMode });
});

// 8. رفع صورة إلى أصول ديسكورد الرسمية أو خادم عام (Upload to Discord Assets or Public CDN)
app.post('/api/upload-image', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '15mb' }), async (req, res) => {
  try {
    const buffer = req.body;
    let fileName = 'asset_' + Date.now();
    if (req.headers['x-filename']) {
      fileName = decodeURIComponent(req.headers['x-filename']).replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }
    if (!fileName) fileName = 'image_' + Date.now();

    const state = stateManager.getState();
    const appId = req.headers['x-app-id'] || state.config.applicationId;
    const token = state.config.token;

    // محاولة أولى: رفع الصورة مباشرة إلى Discord Developer Portal عبر API
    if (appId && token && /^\d+$/.test(appId)) {
      try {
        const mime = req.headers['content-type'] || 'image/png';
        const base64Data = `data:${mime};base64,` + buffer.toString('base64');
        const discordRes = await fetch(`https://discord.com/api/v9/oauth2/applications/${appId}/assets`, {
          method: 'POST',
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: fileName.slice(0, 32),
            type: 1,
            image: base64Data
          })
        });

        if (discordRes.ok) {
          const assetData = await discordRes.json();
          discordGateway.log('success', `تم رفع الصورة مباشرة إلى Discord Developer Portal كأصل رسمي: ${assetData.name}`);
          return res.json({ success: true, key: assetData.name, assetId: assetData.id, isDiscordAsset: true });
        }
      } catch (err) {
        console.error('[Upload] Discord API asset upload failed, falling back to public CDN:', err.message);
      }
    }

    // محاولة ثانية: الرفع إلى خادم Catbox العام المعتمد
    const blob = new Blob([buffer], { type: req.headers['content-type'] || 'image/png' });
    const fd = new FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('fileToUpload', blob, fileName + '.png');

    const uploadRes = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: fd
    });

    if (uploadRes.ok) {
      const imageUrl = (await uploadRes.text()).trim();
      return res.json({ success: true, url: imageUrl, key: imageUrl, isDiscordAsset: false });
    } else {
      return res.status(500).json({ success: false, message: 'Upload failed' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 9. جلب أصول وصور التطبيق من ديسكورد مباشرة (Discord Application Assets)
app.get('/api/discord/assets/:appId', async (req, res) => {
  const { appId } = req.params;
  if (!appId || !/^\d+$/.test(appId)) {
    return res.json({ success: true, assets: [] });
  }

  const KNOWN_FALLBACKS = {
    '1545546198675624016': [
      { id: '1545574027740053535', type: 1, name: 'hz' },
      { id: '1545575767713390622', type: 1, name: 'an' },
      { id: '1545595183033225346', type: 1, name: 'google_antigravity_icon_full_col' }
    ],
    '1536166390443278337': [
      { id: '1545569728041582713', type: 1, name: 'hz' },
      { id: '1545576290281721926', type: 1, name: 'google_antigravity_icon_full_col' }
    ]
  };

  try {
    const response = await fetch(`https://discord.com/api/v9/oauth2/applications/${appId}/assets`);
    if (response.ok) {
      const assets = await response.json();
      if (Array.isArray(assets) && assets.length > 0) {
        return res.json({ success: true, assets });
      }
    }
  } catch (err) {}

  const fallback = KNOWN_FALLBACKS[appId] || [];
  res.json({ success: true, assets: fallback });
});

// 9. الـ Presets (التخصيصات)
app.get('/api/presets', (req, res) => {
  res.json({ success: true, presets: presetManager.getAll() });
});

app.post('/api/presets', (req, res) => {
  const preset = presetManager.savePreset(req.body);
  res.json({ success: true, preset });
});

app.delete('/api/presets/:id', (req, res) => {
  presetManager.deletePreset(req.params.id);
  res.json({ success: true });
});

// 9. استيراد ملف CustomRP XML (.crp)
app.post('/api/presets/import-crp', async (req, res) => {
  try {
    let xmlContent = req.body;
    if (typeof xmlContent === 'object' && xmlContent.xml) {
      xmlContent = xmlContent.xml;
    }
    const importedConfig = await presetManager.importFromCrpXml(xmlContent);
    res.json({ success: true, config: importedConfig });
  } catch (err) {
    res.status(400).json({ success: false, message: 'فشل تحليل ملف .crp: ' + err.message });
  }
});

// 10. تصدير ملف CustomRP XML (.crp)
app.post('/api/presets/export-crp', (req, res) => {
  try {
    const config = req.body;
    const xml = presetManager.exportToCrpXml(config);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="preset.crp"');
    res.send(xml);
  } catch (err) {
    res.status(500).json({ success: false, message: 'فشل التصدير: ' + err.message });
  }
});

// 11. بث حي للسجلات عبر SSE
app.get('/api/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  logSubscribers.add(res);

  // إرسال رسالة ترحيبية أولى
  const welcome = {
    timestamp: new Date().toISOString(),
    timeFormatted: new Date().toLocaleTimeString('ar-EG'),
    type: 'info',
    message: 'تم الاتصال بوحدة التحكم المباشرة للخادم ✓'
  };
  res.write(`data: ${JSON.stringify(welcome)}\n\n`);

  req.on('close', () => {
    logSubscribers.delete(res);
  });
});

// 12. نقاط فحص الحالة 24/7 (Keep-Alive & Health Check)
app.get(['/health', '/ping', '/api/keepalive'], (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    richPresenceStatus: stateManager.getState().status
  });
});

// تشغيل الخادم محلياً أو على Render/VPS
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 خادم CustomRP Web 24/7 يعمل بنجاح على المنفذ ${PORT}`);
    console.log(`🌐 افتح لوحة التحكم عبر: http://localhost:${PORT}`);
    console.log(`=======================================================`);

    // ميزة الاستئناف التلقائي الفوري عند إقلاع النظام / السيرفر:
    const state = stateManager.getState();
    if (state.autoRestart && state.config.token && state.config.token.trim()) {
      console.log(`[Auto-Start] جاري استئناف النشاط تلقائياً بناءً على الحالة المحفوظة...`);
      discordGateway.log('info', 'تم تشغيل الخادم، جاري استئناف النشاط تلقائياً وحساب الوقت المنقضي...');
      discordGateway.start();
    }
  });
} else {
  // عند التشغيل على Vercel Serverless
  const state = stateManager.getState();
  if (state.config.token && state.config.token.trim()) {
    discordGateway.start();
  }
}

// الإيقاف الآمن (Graceful Shutdown) لحفظ الثواني المنقضية بدقة عند إعادة تشغيل السيرفر أو الحاوية
const handleExit = (signal) => {
  console.log(`\n[Shutdown] تم استلام إشارة ${signal} - جاري حفظ الوقت المنقضي وإيقاف الاتصال بأمان...`);
  discordGateway.stop('إعادة تشغيل الخادم');
  setTimeout(() => process.exit(0), 500);
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

module.exports = app;
