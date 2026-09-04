const WebSocket = require('ws');
const stateManager = require('./state-manager');

class DiscordGateway {
  constructor() {
    this.ws = null;
    this.heartbeatInterval = null;
    this.lastSequence = null;
    this.lastHeartbeatAck = true;
    this.sessionId = null;
    this.resumeGatewayUrl = null;
    this.reconnectTimeout = null;
    this.isManualStop = false;
    this.userInfo = null;
    this.appAssetsCache = new Map();
    this.logCallbacks = new Set();
  }

  async fetchAppAssets(appId) {
    if (!appId || !/^\d+$/.test(appId)) return [];
    if (this.appAssetsCache.has(appId)) {
      return this.appAssetsCache.get(appId);
    }
    try {
      const res = await fetch(`https://discord.com/api/v9/oauth2/applications/${appId}/assets`);
      if (res.ok) {
        const assets = await res.json();
        this.appAssetsCache.set(appId, assets);
        this.log('info', `تم جلب أصول تطبيق ديسكورد (${assets.length} صورة مسجلة) بنجاح`);
        return assets;
      }
    } catch (e) {
      // ignore
    }
    return this.appAssetsCache.get(appId) || [];
  }

  resolveAssetToSnowflake(key, appId) {
    if (!key) return null;
    let k = String(key).trim();
    if (!k) return null;

    // 1. إذا كان Snowflake ID رقمي مباشر (17 إلى 21 رقم)
    if (/^\d{17,21}$/.test(k)) {
      return k;
    }

    // 2. إذا كان مسار محلي على الكمبيوتر أو يحتوي على اسم الصورة
    if (k.startsWith('file://') || /^[A-Z]:[\\\/]/i.test(k) || k.includes('هورايزن') || k.includes('%D9%87%D9%88%D8%B1%D8%A7%D9%8A%D8%B2%D9%86')) {
      k = 'hz';
    }

    // 3. البحث في كاش أصول التطبيق المجلوبة من ديسكورد
    const cached = this.appAssetsCache.get(appId);
    if (cached && Array.isArray(cached)) {
      const found = cached.find(a => a.name && a.name.toLowerCase() === k.toLowerCase());
      if (found) {
        return found.id; // Snowflake ID الرسمي المطلوب لديسكورد لمنع النرد والاستفهام!
      }
      if (cached.length === 1 && (k === 'hz' || k === 'logo' || k === 'default')) {
        return cached[0].id;
      }
    }

    // 4. تعويضات مباشرة لتطبيقات Horizon
    if (appId === '1545546198675624016') {
      return '1545574027740053535';
    }
    if (appId === '1536166390443278337') {
      return '1545569728041582713';
    }

    return k;
  }

  onLog(cb) {
    this.logCallbacks.add(cb);
    return () => this.logCallbacks.delete(cb);
  }

  log(type, message, data = null) {
    const logItem = {
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString('ar-EG'),
      type, // 'info' | 'success' | 'warn' | 'error' | 'heartbeat'
      message,
      data
    };
    console.log(`[${logItem.type.toUpperCase()}] ${message}`);
    for (const cb of this.logCallbacks) {
      try {
        cb(logItem);
      } catch (e) {
        // ignore
      }
    }
  }

  start() {
    this.isManualStop = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const state = stateManager.getState();
    const token = state.config.token ? state.config.token.trim() : '';

    if (!token) {
      this.log('error', 'تعذر بدء التشغيل: لم يتم إدخال رمز الحساب (Discord Token) في الإعدادات!');
      stateManager.recordStop('يرجى إدخال رمز الحساب (Token) أولاً', false);
      return false;
    }

    this.connect();
    return true;
  }

  stop(reason = 'تم إيقاف الخدمة يدوياً') {
    this.isManualStop = true;
    this.sessionId = null;
    this.lastSequence = null;
    this.resumeGatewayUrl = null;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close(1000, 'User requested stop');
      } catch (e) {}
      this.ws = null;
    }

    stateManager.recordStop(reason, false);
    this.log('warn', `تم إيقاف الخدمة: ${reason}`);
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const gatewayUrl = this.resumeGatewayUrl || 'wss://gateway.discord.gg/?v=10&encoding=json';
    this.log('info', `جاري الاتصال بخوادم ديسكورد عبر Gateway: ${gatewayUrl}`);

    try {
      this.ws = new WebSocket(gatewayUrl);
    } catch (err) {
      this.log('error', `فشل إنشاء اتصال WebSocket: ${err.message}`);
      this.handleDisconnect('خطأ في إنشاء الاتصال', true);
      return;
    }

    this.ws.on('open', () => {
      this.log('info', 'تم فتح قناة اتصال WebSocket مع ديسكورد بنجاح');
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString() : 'بدون سبب معلن';
      this.log('warn', `أُغلق الاتصال مع ديسكورد (الرمز: ${code}) - السبب: ${reasonStr}`);
      this.handleClose(code, reasonStr);
    });

    this.ws.on('error', (err) => {
      this.log('error', `خطأ في اتصال ديسكورد: ${err.message}`);
    });
  }

  handleMessage(data) {
    try {
      const payload = JSON.parse(data.toString());
      const { op, d, s, t } = payload;

      if (s !== null && s !== undefined) {
        this.lastSequence = s;
      }

      switch (op) {
        case 10: // Hello
          this.handleHello(d);
          break;
        case 11: // Heartbeat ACK
          this.lastHeartbeatAck = true;
          this.log('heartbeat', 'تم استلام تأكيد النبضة (Heartbeat ACK) من ديسكورد بنجاح ✓');
          break;
        case 1: // Heartbeat requested by server
          this.sendHeartbeat();
          break;
        case 7: // Reconnect requested by Discord
          this.log('warn', 'طلب خادم ديسكورد إعادة الاتصال (Opcode 7 Reconnect)');
          this.handleDisconnect('طلب ديسكورد إعادة الاتصال', true);
          break;
        case 9: // Invalid Session
          this.log('warn', 'جلسة ديسكورد غير صالحة (Opcode 9 Invalid Session)');
          this.sessionId = null;
          this.handleDisconnect('جلسة غير صالحة', true);
          break;
        case 0: // Dispatch
          this.handleDispatch(t, d);
          break;
        default:
          break;
      }
    } catch (err) {
      this.log('error', `خطأ في معالجة رسالة واردة من ديسكورد: ${err.message}`);
    }
  }

  handleHello(data) {
    const interval = data.heartbeat_interval;
    this.log('info', `تم استلام نبضات القلب الافتراضية: كل ${interval / 1000} ثانية`);
    this.startHeartbeat(interval);

    // التحقق هل يمكن استئناف الجلسة (Resume) أم إرسال تعريف جديد (Identify)
    if (this.sessionId && this.lastSequence) {
      this.sendResume();
    } else {
      this.sendIdentify();
    }
  }

  startHeartbeat(interval) {
    this.stopHeartbeat();
    this.lastHeartbeatAck = true;

    // أول نبضة عشوائية بفترة أولية كما تنص مواصفات ديسكورد
    const initialDelay = Math.floor(Math.random() * interval);
    setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendHeartbeat();
      }
    }, initialDelay);

    this.heartbeatInterval = setInterval(() => {
      if (!this.lastHeartbeatAck) {
        this.log('error', 'لم يتم استلام تأكيد النبضة السابقة (Zombie Connection)! جاري إعادة الاتصال...');
        this.handleDisconnect('انقطاع نبضات القلب', true);
        return;
      }
      this.lastHeartbeatAck = false;
      this.sendHeartbeat();
    }, interval);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        op: 1,
        d: this.lastSequence
      }));
    }
  }

  async sendIdentify() {
    const state = stateManager.getState();
    const token = state.config.token.trim();
    const appId = state.config.applicationId ? state.config.applicationId.trim() : '';
    if (appId) {
      await this.fetchAppAssets(appId);
    }
    this.log('info', 'جاري إرسال بيانات التعريف (Identify) مع تفاصيل التواجد الكاملة...');

    const payload = {
      op: 2,
      d: {
        token: token,
        capabilities: 16381,
        properties: {
          os: 'Windows',
          browser: 'Discord Client',
          release_channel: 'stable',
          client_version: '1.0.9025',
          os_version: '10.0.19045',
          os_arch: 'x64',
          system_locale: 'ar-EG',
          client_build_number: 175240
        },
        presence: this.buildPresencePayload()
      }
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  sendResume() {
    const state = stateManager.getState();
    const token = state.config.token.trim();
    this.log('info', `جاري استئناف جلسة سابقة (Resume: ${this.sessionId})...`);

    const payload = {
      op: 6,
      d: {
        token: token,
        session_id: this.sessionId,
        seq: this.lastSequence
      }
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  handleDispatch(eventName, data) {
    if (eventName === 'READY') {
      this.sessionId = data.session_id;
      this.resumeGatewayUrl = data.resume_gateway_url;
      this.userInfo = {
        id: data.user.id,
        username: data.user.username,
        discriminator: data.user.discriminator,
        global_name: data.user.global_name || data.user.username,
        avatar: data.user.avatar 
          ? `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png`
          : 'https://cdn.discordapp.com/embed/avatars/0.png'
      };

      this.log('success', `تم تسجيل الدخول بنجاح بحساب: ${this.userInfo.global_name} (@${this.userInfo.username})`);
      stateManager.recordStart();

      // إرسال تحديث النشاط للتأكيد
      this.updatePresence();
    } else if (eventName === 'RESUMED') {
      this.log('success', 'تم استئناف جلسة ديسكورد بنجاح وبدون انقطاع (Resumed)');
      stateManager.recordStart();
    }
  }

  /**
   * إنشاء كائن النشاط (Activity Payload) بالكامل
   */
  buildPresencePayload() {
    const state = stateManager.getState();
    const cfg = state.config;

    const activity = {
      name: (cfg.name || 'CustomRP 24/7').trim(),
      type: parseInt(cfg.type, 10) || 0,
      created_at: Date.now()
    };

    if (cfg.applicationId && cfg.applicationId.trim()) {
      activity.application_id = cfg.applicationId.trim();
    }

    if (cfg.details && cfg.details.trim()) {
      activity.details = cfg.details.trim();
    }

    if (cfg.state && cfg.state.trim()) {
      activity.state = cfg.state.trim();
    }

    // دعم نظام الحفلة (Party: [size, max])
    const partySize = parseInt(cfg.partySize, 10);
    const partyMax = parseInt(cfg.partyMax, 10);
    if (!isNaN(partySize) && !isNaN(partyMax) && partySize > 0 && partyMax > 0) {
      activity.party = {
        id: `crp_${cfg.applicationId || 'app'}_${partySize}_${partyMax}_${Date.now()}`,
        size: [partySize, Math.max(partySize, partyMax)]
      };
    }

    // حساب التوقيت بدقة
    if (cfg.timestampType === 4) {
      // Custom timestamp
      let startMs = null;
      if (cfg.customTimestampStart && cfg.customTimestampStart.trim()) {
        const parsed = new Date(cfg.customTimestampStart).getTime();
        if (!isNaN(parsed)) startMs = parsed;
      }
      // إذا كانت القيمة ناقصة (مثل اختيار التاريخ دون كتابة الساعة)، نبدأ من الوقت الحالي أو قبل ساعة
      if (!startMs) {
        startMs = Date.now() - 3600000;
      }
      activity.timestamps = { start: startMs };

      if (cfg.customTimestampEndEnabled && cfg.customTimestampEnd && cfg.customTimestampEnd.trim()) {
        const endMs = new Date(cfg.customTimestampEnd).getTime();
        if (!isNaN(endMs)) {
          activity.timestamps.end = endMs;
        }
      }
    } else if (cfg.timestampType === 3) {
      // Your local time (بداية اليوم الحالي)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      activity.timestamps = { start: startOfToday.getTime() };
    } else {
      // أوضاع الوقت المنقضي والاستئناف التلقائي 24/7
      const calculatedStart = stateManager.calculateDiscordStartTimestamp();
      if (calculatedStart) {
        activity.timestamps = { start: calculatedStart };
      }
    }

    // الصور والنصوص التوضيحية (Assets: Large Image & Small Image)
    const assets = {};
    const rawLarge = cfg.largeKey || cfg.largeImage || '';
    const largeAssetId = this.resolveAssetToSnowflake(rawLarge, cfg.applicationId);
    if (largeAssetId) {
      assets.large_image = largeAssetId;
      if (cfg.largeText && cfg.largeText.trim()) {
        assets.large_text = cfg.largeText.trim();
      }
    }

    const rawSmall = cfg.smallKey || cfg.smallImage || '';
    const smallAssetId = this.resolveAssetToSnowflake(rawSmall, cfg.applicationId);
    if (smallAssetId) {
      assets.small_image = smallAssetId;
      if (cfg.smallText && cfg.smallText.trim()) {
        assets.small_text = cfg.smallText.trim();
      }
    }

    if (Object.keys(assets).length > 0) {
      activity.assets = assets;
    }

    // الأزرار (Buttons)
    const buttons = [];
    const buttonUrls = [];
    if (cfg.button1Text && cfg.button1Text.trim() && cfg.button1Url && cfg.button1Url.trim()) {
      buttons.push(cfg.button1Text.trim());
      buttonUrls.push(cfg.button1Url.trim());
    }
    if (cfg.button2Text && cfg.button2Text.trim() && cfg.button2Url && cfg.button2Url.trim()) {
      buttons.push(cfg.button2Text.trim());
      buttonUrls.push(cfg.button2Url.trim());
    }

    if (buttons.length > 0) {
      activity.buttons = buttons;
      activity.metadata = {
        button_urls: buttonUrls
      };
    }

    return {
      since: null,
      activities: [activity],
      status: 'online',
      afk: false
    };
  }

  /**
   * إرسال Opcode 3 لتحديث الحالة أو بعد تعديل أي نص في الواجهة
   */
  async updatePresence() {
    const state = stateManager.getState();
    const appId = state.config.applicationId ? state.config.applicationId.trim() : '';
    if (appId) {
      await this.fetchAppAssets(appId);
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const presence = this.buildPresencePayload();
      const largeImg = presence.activities[0]?.assets?.large_image || 'بدون';
      const smallImg = presence.activities[0]?.assets?.small_image || 'بدون';
      this.log('info', `تم إرسال تحديث النشاط (Opcode 3) مع معرّف الصورة الرسمي: الكبير=${largeImg}، الصغير=${smallImg}`);
      this.ws.send(JSON.stringify({
        op: 3,
        d: presence
      }));
    }
  }

  handleClose(code, reason) {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws = null;
    }

    if (this.isManualStop) {
      return;
    }

    // رموز أخطاء ديسكورد المعروفة
    if (code === 4004) {
      this.log('error', 'فشل المصادقة (كود 4004): رمز الحساب (Token) غير صالح أو منتهي الصلاحية!');
      stateManager.recordStop('رمز الحساب (Token) غير صالح', false);
      return;
    }

    if (code === 4014) {
      this.log('error', 'خطأ في صلاحيات ديسكورد (كود 4014): Disallowed Intent');
      stateManager.recordStop('صلاحيات غير كافية', false);
      return;
    }

    this.handleDisconnect(`إغلاق غير متوقع (${code}: ${reason})`, true);
  }

  handleDisconnect(reason, isCrashOrError = false) {
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    stateManager.recordStop(reason, isCrashOrError);

    const state = stateManager.getState();
    if (!this.isManualStop && state.autoRestart) {
      const attempts = state.reconnectAttempts;
      // خوارزمية Exponential Backoff: تبدأ من 5 ثوانٍ، وتتزايد حتى حد أقصى 30 ثانية
      const delay = Math.min(30000, Math.max(5000, 3000 * Math.pow(1.5, Math.min(attempts, 6)))) + Math.floor(Math.random() * 2000);
      
      this.log('warn', `سيتم استئناف الاتصال تلقائياً خلال ${(delay / 1000).toFixed(1)} ثانية مع استئناف الوقت المحفوظ بدقة... (المحاولة #${attempts})`);

      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => {
        if (!this.isManualStop && stateManager.getState().autoRestart) {
          this.log('info', 'جاري محاولة استئناف النشاط الآن...');
          this.connect();
        }
      }, delay);
    }
  }

  getUserInfo() {
    return this.userInfo;
  }
}

module.exports = new DiscordGateway();
