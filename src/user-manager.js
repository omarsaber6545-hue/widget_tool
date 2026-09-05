const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
const USERS_DIR = path.join(BASE_DIR, 'users');
const SESSIONS_FILE = path.join(BASE_DIR, 'sessions.json');

class UserManager {
  constructor() {
    this.ensureDirs();
    this.sessions = this.loadSessions();
  }

  ensureDirs() {
    try {
      if (!fs.existsSync(BASE_DIR)) {
        fs.mkdirSync(BASE_DIR, { recursive: true });
      }
      if (!fs.existsSync(USERS_DIR)) {
        fs.mkdirSync(USERS_DIR, { recursive: true });
      }
    } catch (e) {
      console.error('[UserManager] Error creating directories:', e.message);
    }
  }

  loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('[UserManager] Error reading sessions:', e.message);
    }
    return {};
  }

  saveSessions() {
    try {
      this.ensureDirs();
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(this.sessions, null, 2), 'utf8');
    } catch (e) {
      console.error('[UserManager] Error saving sessions:', e.message);
    }
  }

  getUserFilePath(userId) {
    return path.join(USERS_DIR, `${userId}.json`);
  }

  getUser(userId) {
    try {
      const file = this.getUserFilePath(userId);
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (e) {
      console.error(`[UserManager] Error loading user ${userId}:`, e.message);
    }
    return null;
  }

  saveUser(userId, userData) {
    try {
      this.ensureDirs();
      const file = this.getUserFilePath(userId);
      fs.writeFileSync(file, JSON.stringify(userData, null, 2), 'utf8');
    } catch (e) {
      console.error(`[UserManager] Error saving user ${userId}:`, e.message);
    }
  }

  /**
   * التحقق المباشر من رمز الحساب (Discord Token) عبر خوادم ديسكورد الرسمية
   */
  async verifyDiscordToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('رمز الحساب (Token) غير صالح أو فارغ');
    }
    // تنظيف التوكن من المسافات، علامات التنصيص الفردية أو المزدوجة، وبادئة Bot
    const cleanToken = token.trim().replace(/^["']|["']$/g, '').replace(/^Bot\s+/i, '');

    const res = await fetch('https://discord.com/api/v9/users/@me', {
      headers: {
        'Authorization': cleanToken,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('رمز الحساب (Token) غير صحيح أو منتهي الصلاحية. يرجى التأكد من نسخه بدقة');
      }
      throw new Error(`فشل الاتصال بديسكورد (كود الخطأ: ${res.status})`);
    }

    const discordUser = await res.json();
    return this.formatUserProfile(discordUser, cleanToken);
  }

  /**
   * استخراج وتنسيق بيانات المستخدم بصيغة احترافية وشاملة
   */
  formatUserProfile(raw, token = null) {
    const avatarUrl = raw.avatar
      ? `https://cdn.discordapp.com/avatars/${raw.id}/${raw.avatar}.${raw.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${(parseInt(raw.discriminator, 10) || 0) % 5}.png`;

    const bannerUrl = raw.banner
      ? `https://cdn.discordapp.com/banners/${raw.id}/${raw.banner}.${raw.banner.startsWith('a_') ? 'gif' : 'png'}?size=512`
      : null;

    return {
      id: raw.id,
      username: raw.username,
      discriminator: raw.discriminator === '0' ? '' : raw.discriminator,
      global_name: raw.global_name || raw.username,
      displayName: raw.global_name || raw.username,
      avatar: avatarUrl,
      banner: bannerUrl,
      accent_color: raw.accent_color || null,
      flags: raw.flags || 0,
      public_flags: raw.public_flags || 0,
      premium_type: raw.premium_type || 0, // 0 = None, 1 = Nitro Classic, 2 = Nitro, 3 = Nitro Basic
      hasNitro: Boolean(raw.premium_type && raw.premium_type > 0),
      mfa_enabled: Boolean(raw.mfa_enabled),
      verified: Boolean(raw.verified),
      email: raw.email || null,
      token: token || undefined,
      lastLogin: new Date().toISOString()
    };
  }

  /**
   * تسجيل دخول حقيقي للمستخدم، وحفظ بياناته، وإصدار جلسة دائمة
   */
  async loginWithToken(token, currentConfig = null) {
    const profile = await this.verifyDiscordToken(token);
    const userId = profile.id;
    const cleanToken = token.trim().replace(/^["']|["']$/g, '').replace(/^Bot\s+/i, '');

    // استرجاع الإعدادات المحفوظة لهذا المستخدم أو إنشاء إعدادات جديدة بالاعتماد على ما أدخله المستخدم في الفورم
    let userRecord = this.getUser(userId);
    if (!userRecord) {
      userRecord = {
        profile,
        config: {
          token: cleanToken,
          applicationId: currentConfig?.applicationId || '1545546198675624016',
          name: currentConfig?.name || '',
          type: currentConfig?.type !== undefined ? currentConfig.type : 0,
          display: currentConfig?.display !== undefined ? currentConfig.display : 0,
          details: currentConfig?.details || '',
          detailsUrl: currentConfig?.detailsUrl || '',
          state: currentConfig?.state || '',
          stateUrl: currentConfig?.stateUrl || '',
          partySize: currentConfig?.partySize !== undefined ? currentConfig.partySize : 1,
          partyMax: currentConfig?.partyMax !== undefined ? currentConfig.partyMax : 1,
          timestampType: currentConfig?.timestampType !== undefined ? currentConfig.timestampType : 0,
          customTimestampStart: currentConfig?.customTimestampStart || '',
          customTimestampEndEnabled: !!currentConfig?.customTimestampEndEnabled,
          customTimestampEnd: currentConfig?.customTimestampEnd || '',
          largeKey: currentConfig?.largeKey || '',
          largeText: currentConfig?.largeText || '',
          largeUrl: currentConfig?.largeUrl || '',
          smallKey: currentConfig?.smallKey || '',
          smallText: currentConfig?.smallText || '',
          smallUrl: currentConfig?.smallUrl || '',
          button1Text: currentConfig?.button1Text || '',
          button1Url: currentConfig?.button1Url || '',
          button2Text: currentConfig?.button2Text || '',
          button2Url: currentConfig?.button2Url || ''
        },
        createdAt: new Date().toISOString()
      };
    } else {
      // تحديث بيانات البروفايل الحديثة
      userRecord.profile = {
        ...userRecord.profile,
        ...profile
      };
      // إذا قام المستخدم بتعديل بيانات على الشاشة قبل تسجيل الدخول، نحفظها له ولا نمسحها
      if (currentConfig && Object.keys(currentConfig).length > 0) {
        userRecord.config = {
          ...userRecord.config,
          ...currentConfig
        };
      }
      userRecord.config.token = cleanToken;
    }

    this.saveUser(userId, userRecord);

    // إنشاء جلسة آمنة (Session Token)
    const sessionToken = 'crp_sess_' + crypto.randomBytes(32).toString('hex');
    this.sessions[sessionToken] = {
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 يوماً
    };
    this.saveSessions();

    return {
      success: true,
      sessionToken,
      user: profile,
      config: userRecord.config
    };
  }

  /**
   * جلب بيانات الجلسة الحالية
   */
  getSessionUser(sessionToken) {
    if (!sessionToken || !this.sessions[sessionToken]) {
      return null;
    }
    const session = this.sessions[sessionToken];
    if (Date.now() > session.expiresAt) {
      delete this.sessions[sessionToken];
      this.saveSessions();
      return null;
    }

    const userRecord = this.getUser(session.userId);
    if (!userRecord) return null;

    return {
      sessionToken,
      user: userRecord.profile,
      config: userRecord.config
    };
  }

  /**
   * حفظ إعدادات الـ CustomRP الخاصة بمستخدم محدد
   */
  updateUserConfig(userId, newConfig) {
    const userRecord = this.getUser(userId);
    if (!userRecord) return false;

    userRecord.config = {
      ...userRecord.config,
      ...newConfig
    };
    userRecord.updatedAt = new Date().toISOString();
    this.saveUser(userId, userRecord);
    return true;
  }

  /**
   * تسجيل الخروج وإبطال الجلسة
   */
  logout(sessionToken) {
    if (sessionToken && this.sessions[sessionToken]) {
      delete this.sessions[sessionToken];
      this.saveSessions();
      return true;
    }
    return false;
  }
}

module.exports = new UserManager();
