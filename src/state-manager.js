const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'presence-state.json');

class StateManager {
  constructor() {
    this.ensureDataDir();
    this.state = this.loadState();
    this.listeners = new Set();
    this.periodicSaveTimer = null;
    this.startPeriodicSave();
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  getDefaultState() {
    return {
      status: 'stopped', // stopped, connecting, running, reconnecting, error
      statusMessage: 'الخدمة متوقفة حالياً',
      autoRestart: true,
      timeHandlingMode: 'resume_elapsed', // 'resume_elapsed' | 'continuous' | 'none' | 'countdown'
      accumulatedElapsedSeconds: 0,
      sessionStartTime: null,
      lastStoppedTimestamp: null,
      lastStartedTimestamp: null,
      totalRestarts: 0,
      reconnectAttempts: 0,
      config: {
        token: '',
        applicationId: '1545546198675624016',
        name: '',
        type: 0, // 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching, 5 = Competing
        display: 0, // 0 = Name, 1 = Details, 2 = State
        details: 'dev server',
        detailsUrl: '',
        state: 'codeing',
        stateUrl: '',
        partySize: 2,
        partyMax: 2,
        timestampType: 4, // 0: connection, 1: update, 2: startup, 3: local, 4: custom
        customTimestampStart: '',
        customTimestampEndEnabled: false,
        customTimestampEnd: '',
        largeKey: '',
        largeText: '',
        largeUrl: '',
        smallKey: '',
        smallText: '',
        smallUrl: '',
        button1Text: '',
        button1Url: '',
        button2Text: '',
        button2Url: ''
      }
    };
  }

  loadState() {
    const defaults = this.getDefaultState();
    if (process.env.DISCORD_TOKEN) {
      defaults.config.token = process.env.DISCORD_TOKEN;
    }
    if (process.env.DISCORD_APP_ID) {
      defaults.config.applicationId = process.env.DISCORD_APP_ID;
    }
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          ...defaults,
          ...parsed,
          config: {
            ...defaults.config,
            ...(parsed.config || {})
          }
        };
      }
    } catch (err) {
      console.error('[StateManager] خطأ أثناء قراءة ملف الحالة:', err.message);
    }
    return defaults;
  }

  saveState() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[StateManager] خطأ أثناء حفظ الحالة على القرص:', err.message);
    }
  }

  startPeriodicSave() {
    if (this.periodicSaveTimer) clearInterval(this.periodicSaveTimer);
    // حفظ دوري كل 5 ثوانٍ لضمان عدم ضياع أي ثانية في حال حدوث توقف مفاجئ
    this.periodicSaveTimer = setInterval(() => {
      if (this.state.status === 'running') {
        this.updateCurrentElapsed();
        this.saveState();
        this.notify();
      }
    }, 5000);
    if (this.periodicSaveTimer.unref) {
      this.periodicSaveTimer.unref();
    }
  }

  updateCurrentElapsed() {
    if (this.state.status === 'running' && this.state.sessionStartTime) {
      const currentSessionSecs = Math.floor((Date.now() - this.state.sessionStartTime) / 1000);
      if (currentSessionSecs > 0) {
        this.state.accumulatedElapsedSeconds += currentSessionSecs;
        this.state.sessionStartTime = Date.now();
      }
    }
  }

  /**
   * تسجيل بدء جلسة تشغيل جديدة مع استئناف الوقت
   */
  recordStart() {
    this.state.status = 'running';
    this.state.statusMessage = 'يعمل الآن بنجاح على ديسكورد 24/7';
    this.state.sessionStartTime = Date.now();
    this.state.lastStartedTimestamp = Date.now();
    this.state.reconnectAttempts = 0;
    this.saveState();
    this.notify();
  }

  /**
   * تسجيل التوقف أو الانقطاع مع تجميد الوقت المنقضي بدقة
   */
  recordStop(reason = 'تم إيقاف الخدمة يدوياً', isCrashOrDisconnect = false) {
    this.updateCurrentElapsed();
    this.state.sessionStartTime = null;
    this.state.lastStoppedTimestamp = Date.now();
    
    if (isCrashOrDisconnect) {
      this.state.status = 'reconnecting';
      this.state.statusMessage = `انقطع الاتصال (${reason}) - جاري محاولة الاستئناف التلقائي...`;
      this.state.totalRestarts += 1;
      this.state.reconnectAttempts += 1;
    } else {
      this.state.status = 'stopped';
      this.state.statusMessage = reason;
      this.state.reconnectAttempts = 0;
    }

    this.saveState();
    this.notify();
  }

  /**
   * حساب الطابع الزمني (Unix Timestamp بالمللي ثانية) لإرساله لديسكورد
   * يحقق شرط المستخدم: "يشغل على الوقت الي هو وقف فيه"
   */
  calculateDiscordStartTimestamp() {
    if (this.state.timeHandlingMode === 'none') {
      return null;
    }

    if (this.state.timeHandlingMode === 'continuous' && this.state.lastStartedTimestamp) {
      // وقت مستمر منذ أول تشغيل
      return this.state.lastStartedTimestamp;
    }

    // الوضع الافتراضي: resume_elapsed
    // استئناف الوقت التراكمي المنقضي بحيث يكمل ديسكورد من نفس الدقيقة والثانية
    const totalSecs = this.state.accumulatedElapsedSeconds;
    return Date.now() - (totalSecs * 1000);
  }

  /**
   * حساب إجمالي الثواني المنقضية الحالية للعرض اللحظي في الواجهة
   */
  getTotalElapsedSeconds() {
    let total = this.state.accumulatedElapsedSeconds;
    if (this.state.status === 'running' && this.state.sessionStartTime) {
      total += Math.floor((Date.now() - this.state.sessionStartTime) / 1000);
    }
    return total;
  }

  /**
   * تصفير عداد الوقت
   */
  resetTimer() {
    this.state.accumulatedElapsedSeconds = 0;
    this.state.sessionStartTime = this.state.status === 'running' ? Date.now() : null;
    this.state.lastStartedTimestamp = this.state.status === 'running' ? Date.now() : null;
    this.saveState();
    this.notify();
  }

  /**
   * تحديث الإعدادات
   */
  updateConfig(newConfig) {
    this.state.config = {
      ...this.state.config,
      ...newConfig
    };
    this.saveState();
    this.notify();
  }

  setAutoRestart(enabled) {
    this.state.autoRestart = Boolean(enabled);
    this.saveState();
    this.notify();
  }

  setTimeHandlingMode(mode) {
    if (['resume_elapsed', 'continuous', 'none', 'countdown'].includes(mode)) {
      this.state.timeHandlingMode = mode;
      this.saveState();
      this.notify();
    }
  }

  getState() {
    return {
      ...this.state,
      currentTotalElapsedSeconds: this.getTotalElapsedSeconds()
    };
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const currentState = this.getState();
    for (const cb of this.listeners) {
      try {
        cb(currentState);
      } catch (err) {
        console.error('[StateManager] خطأ في مستمع التغييرات:', err.message);
      }
    }
  }
}

module.exports = new StateManager();
