const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');

class PresetManager {
  constructor() {
    this.ensureDataDir();
    this.presets = this.loadPresets();
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  getDefaultPresets() {
    return [
      {
        id: 'default-coding',
        name: 'برمجة وتطوير (Coding Mode)',
        applicationId: '1347000000000000000',
        activityName: 'Visual Studio Code',
        type: 0,
        details: 'Developing Modern Web Apps',
        state: 'CustomRP 24/7 Cloud Service',
        largeImage: 'https://i.imgur.com/8Q1Q5vM.png',
        largeText: 'VS Code Dark Mode',
        smallImage: 'https://i.imgur.com/Y3KkQjP.png',
        smallText: 'Active',
        button1Text: 'عرض المشروع',
        button1Url: 'https://github.com/maximmax42/Discord-CustomRP',
        button2Text: 'سيرفر الدعم',
        button2Url: 'https://discord.gg/928333025652121630'
      },
      {
        id: 'default-gaming',
        name: 'وضع الألعاب (Gaming Mode)',
        applicationId: '1347000000000000001',
        activityName: 'Cyberpunk 2077',
        type: 0,
        details: 'Exploring Night City',
        state: 'Act II - Free Roam',
        largeImage: 'https://i.imgur.com/8Q1Q5vM.png',
        largeText: 'Cyberpunk 2077',
        smallImage: 'https://i.imgur.com/Y3KkQjP.png',
        smallText: 'Level 50',
        button1Text: 'Steam Profile',
        button1Url: 'https://steamcommunity.com',
        button2Text: 'Join Game',
        button2Url: 'https://discord.gg'
      },
      {
        id: 'default-music',
        name: 'استماع للموسيقى (Listening to Music)',
        applicationId: '1347000000000000002',
        activityName: 'Lo-Fi Chill Beats',
        type: 2, // Listening
        details: 'Chillhop Radio - Beats to relax/study to',
        state: 'Synthesized Dreams',
        largeImage: 'https://i.imgur.com/8Q1Q5vM.png',
        largeText: 'Lo-Fi Beats',
        smallImage: 'https://i.imgur.com/Y3KkQjP.png',
        smallText: 'Listening',
        button1Text: 'استمع الآن',
        button1Url: 'https://youtube.com',
        button2Text: 'قائمة التشغيل',
        button2Url: 'https://spotify.com'
      }
    ];
  }

  loadPresets() {
    try {
      if (fs.existsSync(PRESETS_FILE)) {
        const raw = fs.readFileSync(PRESETS_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[PresetManager] خطأ في قراءة ملف التخصيصات:', err.message);
    }
    const defaults = this.getDefaultPresets();
    this.savePresets(defaults);
    return defaults;
  }

  savePresets(presets) {
    try {
      this.ensureDataDir();
      fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets || this.presets, null, 2), 'utf8');
      if (presets) this.presets = presets;
    } catch (err) {
      console.error('[PresetManager] خطأ في حفظ ملف التخصيصات:', err.message);
    }
  }

  getAll() {
    return this.presets;
  }

  getById(id) {
    return this.presets.find(p => p.id === id);
  }

  savePreset(presetData) {
    const id = presetData.id || `preset-${Date.now()}`;
    const newPreset = {
      ...presetData,
      id,
      updatedAt: new Date().toISOString()
    };

    const index = this.presets.findIndex(p => p.id === id);
    if (index >= 0) {
      this.presets[index] = newPreset;
    } else {
      this.presets.push(newPreset);
    }

    this.savePresets();
    return newPreset;
  }

  deletePreset(id) {
    this.presets = this.presets.filter(p => p.id !== id);
    this.savePresets();
    return true;
  }

  /**
   * استيراد ملف CustomRP XML (.crp) وتحويله لإعدادات الويب
   */
  async importFromCrpXml(xmlString) {
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });
    const result = await parser.parseStringPromise(xmlString);
    const p = result.Preset || result;

    return {
      applicationId: p.ID || '',
      type: parseInt(p.Type || '0', 10),
      name: p.Name || '',
      details: p.Details || '',
      detailsUrl: p.DetailsURL || '',
      state: p.State || '',
      stateUrl: p.StateURL || '',
      largeImage: p.LargeKey || p.LargeURL || '',
      largeText: p.LargeText || '',
      smallImage: p.SmallKey || p.SmallURL || '',
      smallText: p.SmallText || '',
      button1Text: p.Button1Text || '',
      button1Url: p.Button1URL || '',
      button2Text: p.Button2Text || '',
      button2Url: p.Button2URL || ''
    };
  }

  /**
   * تصدير إعدادات الويب إلى ملف CustomRP XML (.crp) متوافق 100% مع البرنامج المكتبي
   */
  exportToCrpXml(config) {
    const builder = new xml2js.Builder({
      rootName: 'Preset',
      xmldec: { version: '1.0', encoding: 'utf-8' }
    });

    const presetObj = {
      $: {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema'
      },
      ID: config.applicationId || '',
      Type: config.type || 0,
      Display: 0,
      Name: config.name || '',
      Details: config.details || '',
      DetailsURL: config.detailsUrl || '',
      State: config.state || '',
      StateURL: config.stateUrl || '',
      PartySize: 0,
      PartyMax: 0,
      Timestamps: 1,
      CustomTimestamp: new Date().toISOString(),
      CustomTimestampEndEnabled: false,
      CustomTimestampEnd: new Date().toISOString(),
      LargeKey: config.largeImage || '',
      LargeText: config.largeText || '',
      LargeURL: '',
      SmallKey: config.smallImage || '',
      SmallText: config.smallText || '',
      SmallURL: '',
      Button1Text: config.button1Text || '',
      Button1URL: config.button1Url || '',
      Button2Text: config.button2Text || '',
      Button2URL: config.button2Url || ''
    };

    return builder.buildObject(presetObj);
  }
}

module.exports = new PresetManager();
