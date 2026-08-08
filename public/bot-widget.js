(function () {
  // Read configuration helper
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var userConfig = window.OpticsBotConfig || {};
  var botId = userConfig.botId || (currentScript ? currentScript.getAttribute('data-bot-id') : null) || 'bot_generic_252';
  var webhookUrl = userConfig.webhookUrl || (currentScript ? currentScript.getAttribute('data-webhook-url') : null) || 'https://n8n.srv1239769.hstgr.cloud/webhook/65325d34-0c9e-4cc3-8b7c-c03c47105b3a';
  var botTitle = userConfig.title || (currentScript ? currentScript.getAttribute('data-title') : null) || 'האופטיקה הטובה - מושב אמירים';
  var botSubtitle = userConfig.subtitle || (currentScript ? currentScript.getAttribute('data-subtitle') : null) || '';
  var whatsappNumber = userConfig.whatsappNumber || (currentScript ? currentScript.getAttribute('data-whatsapp') : null) || '972552502584';
  var themeColor = userConfig.themeColor || (currentScript ? currentScript.getAttribute('data-theme-color') : null) || '#0047AB';
  var conversationFlow = userConfig.conversationFlow || (currentScript ? currentScript.getAttribute('data-conversation-flow') : null) || '';

  var parseTitleAndSubtitle = function(rawTitle, rawSub) {
    var main = (rawTitle || '').trim();
    var sub = (rawSub || '').trim();

    if (!main) main = 'האופטיקה הטובה';

    if (!sub) {
      if (main.indexOf('-') !== -1) {
        var parts = main.split('-');
        main = parts[0].trim();
        sub = parts.slice(1).join('-').trim();
      } else if (main.indexOf('אמירים') !== -1) {
        main = main.replace('אמירים', '').trim();
        sub = 'מושב אמירים';
      } else {
        sub = 'מושב אמירים';
      }
    }

    if (!main) main = 'האופטיקה הטובה';
    if (!sub) sub = 'מושב אמירים';

    return { main: main, sub: sub };
  };

  if (window.__OpticsBotWidgetLoaded) {
    if (typeof window.OpticsBotWidgetUpdate === 'function') {
      window.OpticsBotWidgetUpdate({
        botId: botId,
        title: botTitle,
        webhookUrl: webhookUrl,
        whatsappNumber: whatsappNumber,
        themeColor: themeColor,
        conversationFlow: conversationFlow
      });
    }
    return;
  }
  window.__OpticsBotWidgetLoaded = true;

  // 2. Cookie & LocalStorage Session ID & User Name management (Persistent across device visits)
  var STORAGE_KEY = 'optics_bot_session_' + botId;
  var isReturningUser = false;

  var getCookie = function(name) {
    try {
      var nameEQ = name + "=";
      var ca = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
      }
    } catch(e) {}
    return null;
  };

  var setCookie = function(name, value, days) {
    try {
      var expires = "";
      if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
      }
      document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/; SameSite=Lax";
    } catch(e) {}
  };

  var getUserName = function() {
    var name = getCookie('optics_bot_user_name_' + botId) || getCookie('smartesek_user_name');
    if (!name) {
      try {
        name = localStorage.getItem('optics_bot_user_name_' + botId) || localStorage.getItem('smartesek_user_name');
      } catch (e) {}
    }
    return name || null;
  };

  var setUserName = function(name) {
    if (!name || typeof name !== 'string') return;
    var cleanName = name.trim().replace(/^[,\.\!\?\"\']+/, '').replace(/[,\.\!\?\"\']+$/, '');
    if (!cleanName || cleanName.length < 2) return;
    try {
      localStorage.setItem('optics_bot_user_name_' + botId, cleanName);
      localStorage.setItem('smartesek_user_name', cleanName);
    } catch (e) {}
    setCookie('optics_bot_user_name_' + botId, cleanName, 365);
    setCookie('smartesek_user_name', cleanName, 365);
  };

  var getUserPhone = function() {
    var phone = getCookie('optics_bot_user_phone_' + botId) || getCookie('smartesek_user_phone');
    if (!phone) {
      try {
        phone = localStorage.getItem('optics_bot_user_phone_' + botId) || localStorage.getItem('smartesek_user_phone');
      } catch (e) {}
    }
    return phone || null;
  };

  var setUserPhone = function(phone) {
    if (!phone || typeof phone !== 'string') return;
    var cleanPhone = phone.replace(/[- ]/g, '').trim();
    if (!cleanPhone || cleanPhone.length < 7) return;
    try {
      localStorage.setItem('optics_bot_user_phone_' + botId, cleanPhone);
      localStorage.setItem('smartesek_user_phone', cleanPhone);
    } catch (e) {}
    setCookie('optics_bot_user_phone_' + botId, cleanPhone, 365);
    setCookie('smartesek_user_phone', cleanPhone, 365);
  };

  var extractPhoneFromUserText = function(text) {
    if (!text || typeof text !== 'string') return null;
    var phoneMatch = text.match(/(?:05[0-9][- ]?[0-9]{7}|0[23489][- ]?[0-9]{7}|\+?972[- ]?5[0-9][- ]?[0-9]{7})/);
    if (phoneMatch && phoneMatch[0]) {
      return phoneMatch[0].replace(/[- ]/g, '').trim();
    }
    return null;
  };

  var extractNameFromUserText = function(text) {
    if (!text || typeof text !== 'string') return null;
    var clean = text.trim();

    // 1. Explicit phrase: "שמי X", "קוראים לי X", "אני X"
    var nameMatch = clean.match(/(?:קוראים\s*לי|שמי\s*הוא|שמי|אני|השם\s*שלי\s*הוא|מדבר|מדברת)\s+([א-תa-zA-Z]{2,20}(?:\s+[א-תa-zA-Z]{2,20})?)/i);
    if (nameMatch && nameMatch[1]) {
      var candidate = nameMatch[1].trim();
      if (candidate.length >= 2 && !/^(רוצה|צריך|אפשר|שלום|היי|בוקר|ערב|תודה|מתי|איפה|כמה|מה|איך)$/i.test(candidate)) {
        return candidate;
      }
    }

    // 2. Text containing a phone number alongside name: e.g. "חיים 0547866119" or "0547866119 חיים בר"
    var textWithoutPhone = clean.replace(/(?:05[0-9][- ]?[0-9]{7}|0[23489][- ]?[0-9]{7}|\+?972[- ]?5[0-9][- ]?[0-9]{7})/g, '').trim();
    textWithoutPhone = textWithoutPhone.replace(/^[,\.\!\?\"\':\-]+|[,\.\!\?\"\':\-]+$/g, '').trim();

    if (textWithoutPhone && !/\d/.test(textWithoutPhone) && !/http/i.test(textWithoutPhone)) {
      var words = textWithoutPhone.split(/\s+/).filter(Boolean);
      if (words.length >= 1 && words.length <= 3) {
        var isAllWordsLetters = words.every(function(w) {
          return /^[א-תa-zA-Z]{2,20}$/.test(w);
        });
        var commonWords = /^(שלום|היי|אפשר|רוצה|תודה|בבקשה|מידע|שאלה|תקשר|תתקשר|תחזור|צד|קורס|מחיר|מתי|איפה|כמה|מה|איך)$/i;
        if (isAllWordsLetters && !(words.length === 1 && commonWords.test(words[0]))) {
          return words.join(' ');
        }
      }
    }

    return null;
  };

  var saveSessionId = function(sid) {
    if (!sid) return;
    try {
      localStorage.setItem(STORAGE_KEY, sid);
      localStorage.setItem('smartesek_global_user_session', sid);
    } catch (e) {}
    setCookie('optics_bot_session_' + botId, sid, 365);
    setCookie('smartesek_session_' + botId, sid, 365);
    setCookie('smartesek_global_user_session', sid, 365);
  };

  var getSessionId = function() {
    var sid = null;

    // Check cookies first (per bot, or generic)
    sid = getCookie('optics_bot_session_' + botId) || getCookie('smartesek_session_' + botId) || getCookie('smartesek_global_user_session');

    // Check localStorage if not found in cookie
    if (!sid) {
      try {
        sid = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('smartesek_global_user_session');
      } catch (e) {}
    }

    var savedPhone = getUserPhone();

    if (sid) {
      isReturningUser = true;
      // If we have saved phone and the current sessionId is an anonymous web_ session, upgrade it to phone_botId
      if (savedPhone && (sid.startsWith('web_') || !sid.includes(savedPhone))) {
        sid = savedPhone + '_' + botId;
      }
    } else {
      isReturningUser = false;
      if (savedPhone) {
        sid = savedPhone + '_' + botId;
      } else {
        sid = 'web_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
      }
    }

    saveSessionId(sid);
    return sid;
  };

  var sessionId = getSessionId();

  var formatPersonalGreeting = function(baseText) {
    if (!baseText) return '';
    var savedName = getUserName();
    var cleanBase = baseText.replace(/^[ \t]*שלום!\s*👋\s*/i, '').replace(/^[ \t]*שלום[ \t]*[:\-\|]?[ \t]*/i, '');

    if (isReturningUser) {
      if (savedName) {
        return 'אני רואה שחזרת אלינו, ' + savedName + '! 👋\n' + cleanBase;
      } else {
        return 'אני רואה שחזרת אלינו! 👋\n' + cleanBase;
      }
    } else if (savedName) {
      return 'שלום ' + savedName + '! 👋\n' + cleanBase;
    }
    return baseText;
  };

  // Helper to parse ONLY the welcome message (הודעת פתיחה) up to "זרימת השיחה:" and extract options purely as interactive buttons
  var parseConversationFlow = function(flowStr, fallbackTitle) {
    var welcomeText = '';
    var buttons = [];

    if (flowStr && typeof flowStr === 'string' && flowStr.trim().length > 0) {
      var rawText = flowStr.trim();
      var openingSectionText = rawText;

      // 1. Cut off strictly at "זרימת השיחה" / "זרימת שיחה" / "שלב 2" / "המשך שיחה" / etc.
      var endBoundaryRegex = /(?:\r?\n|^)[ \t]*(?:(?:\d+[\.\)-]|[\-\*•▪️])\s*)?(?:זרימת\s*ה?שיחה|תרחיש(?:י)?\s*ה?שיחה|המשך\s*ה?שיחה|תסריט\s*ה?שיחה|שלב\s*2|סעיף\s*2|2\.)/i;
      var matchEnd = openingSectionText.match(endBoundaryRegex);
      if (matchEnd && matchEnd.index > 0) {
        openingSectionText = openingSectionText.substring(0, matchEnd.index);
      }

      // 2. Remove leading "הודעת פתיחה:" or "1. הודעת פתיחה:" header
      openingSectionText = openingSectionText.replace(/^[ \t]*(?:(?:\d+[\.\)-]|[\-\*•▪️])\s*)?(?:שלב\s*1\s*[:\-\|]?\s*|סעיף\s*1\s*[:\-\|]?\s*)?(?:הודעת\s*פתיחה|ברכת\s*פתיחה|שאלת\s*פתיחה|פתיחה)[ \t]*[:\-\|]?[ \t]*/i, '').trim();

      var lines = openingSectionText.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
      var textLines = [];

      lines.forEach(function(line) {
        // Skip pure section label headers like "אפשרויות:", "כפתורים:", "בחר אפשרות:"
        if (/^(?:אפשרויות|כפתורים|בחרו\s*אפשרות|אפשרויות\s*לבחירה|בחר\s*אחת\s*מהאפשרויות|אנא\s*בחר\s*מבין\s*האפשרויות|אפשרויות\s*זמינות|להלן\s*האפשרויות|תפריט)[ \t]*[:\-\|]?$/i.test(line)) {
          return;
        }

        // Skip option intro headers if they introduce list options
        if (/^(?:בחר|בחרו|להלן|אנא\s*לבחור|אפשרויות\s*לבחירה|ניתן\s*לבחור).*?(?:אפשרויות|כפתורים|באמצעות|הבאות)/i.test(line)) {
          return;
        }

        var cleanLineText = line.replace(/^["'«»“](.*)["'«»”]$/, '$1').trim();

        // Check if line is a bullet or numbered option (e.g. "1. xxx", "- xxx", "• xxx", "🔹 xxx", "אפשרות 1: xxx")
        var bulletMatch = line.match(/^(?:(?:\d+[\.\)-]|[\-\*•🔹▪️▫️👉▸>])|אפשרות\s*\d+\s*[:\-\|]?)\s*(.+)$/i);

        // Check if line is a short action option sitting at the end or as an option line (e.g. "לקבוע בדיקה", "שאלות אחרות")
        var isShortAction = false;
        if (!bulletMatch && cleanLineText.length > 0 && cleanLineText.length <= 45 && !/[.\!\?]$/.test(cleanLineText)) {
          var actionKeywords = /(?:לקבוע|קביעת|תיאום|תור|בדיקה|שאלות|אחרות|אחר|בירור|שיחה|נציג|אנושי|מידע|שעות|מיקום|כתובת|קטלוג|מחיר|מחירון|קנה|הזמנה|צור\s*קשר|פרטים|תפריט|עזרה)/i;
          if (actionKeywords.test(cleanLineText) && !cleanLineText.startsWith('✅')) {
            isShortAction = true;
          }
        }

        if (bulletMatch && bulletMatch[1]) {
          var btnTitle = bulletMatch[1].trim();
          btnTitle = btnTitle.replace(/^["'«»“](.*)["'«»”]$/, '$1').trim();
          if (btnTitle.length > 0 && btnTitle.length < 70) {
            buttons.push({
              id: 'btn_flow_' + buttons.length,
              title: btnTitle
            });
          }
        } else if (isShortAction) {
          buttons.push({
            id: 'btn_flow_' + buttons.length,
            title: cleanLineText
          });
        } else if (line.indexOf('|') !== -1 && !line.startsWith('http')) {
          // If options are listed inline separated by vertical bars e.g. "תיאום תור | קטלוג | שעות פעילות"
          var parts = line.split('|');
          parts.forEach(function(p) {
            var pTitle = p.trim().replace(/^["'«»“](.*)["'«»”]$/, '$1').trim();
            if (pTitle.length > 0 && pTitle.length < 70) {
              buttons.push({
                id: 'btn_flow_' + buttons.length,
                title: pTitle
              });
            }
          });
        } else {
          // Normal greeting text line
          textLines.push(line);
        }
      });

      // Clean trailing option intro lines from textLines
      while (textLines.length > 0) {
        var lastTextLine = textLines[textLines.length - 1].trim();
        if (/^(?:אפשרויות|כפתורים|בחרו\s*אפשרות|אפשרויות\s*לבחירה|בחר\s*אחת\s*מהאפשרויות|אנא\s*בחר|אפשרויות\s*זמינות|להלן\s*האפשרויות|תפריט|מה\s*תרצו\s*לעשות|איך\s*אפשר\s*לעזור)[ \t]*[:\-\|]?$/i.test(lastTextLine) ||
            /^(?:בחר|בחרו|להלן|אנא\s*לבחור|אפשרויות\s*לבחירה|ניתן\s*לבחור).*?(?:אפשרויות|כפתורים|באמצעות|הבאות)[ \t]*[:\-\|]?$/i.test(lastTextLine)) {
          textLines.pop();
        } else {
          break;
        }
      }

      if (textLines.length > 0) {
        welcomeText = textLines.join('\n');
      }
    }

    // Deduplicate buttons to prevent repeating options
    var uniqueButtons = [];
    var seenKeys = {};

    buttons.forEach(function(btn) {
      var raw = (btn.title || '').trim();
      var norm = raw.toLowerCase()
        .replace(/[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFA}]/gu, '')
        .replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '');

      if (norm && !seenKeys[norm]) {
        seenKeys[norm] = true;
        uniqueButtons.push(btn);
      }
    });

    buttons = uniqueButtons;

    if (!welcomeText) {
      welcomeText = 'ברוכים הבאים ל-' + (fallbackTitle || 'העסק שלנו') + '. במה אוכל לעזור לך היום?';
    }

    welcomeText = formatPersonalGreeting(welcomeText);

    if (buttons.length === 0) {
      buttons = [
        { id: 'btn_exam', title: '📅 תיאום בדיקה / תור' },
        { id: 'btn_catalog', title: '👓 קטלוג מוצרים ומחירים' },
        { id: 'btn_hours', title: '⏰ שעות פעילות ומיקום' },
        { id: 'btn_human', title: '📱 שיחה עם נציג אנושי' }
      ];
    }

    return { text: welcomeText, buttons: buttons };
  };

  // 3. Inject CSS styles into document head
  var css = `
    #obw-widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      direction: rtl;
      box-sizing: border-box;
    }
    #obw-widget-container * {
      box-sizing: border-box;
    }
    .obw-fab-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${themeColor};
      color: #ffffff;
      border: 2px solid #ffffff;
      box-shadow: 0 8px 24px rgba(0, 71, 171, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s ease;
      position: relative;
    }
    .obw-fab-button:hover {
      transform: scale(1.08);
      box-shadow: 0 10px 28px rgba(0, 71, 171, 0.45);
    }
    .obw-fab-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      background: #ef4444;
      color: #fff;
      font-size: 11px;
      font-weight: bold;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #fff;
    }
    .obw-window {
      position: absolute;
      bottom: 75px;
      right: 0;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 580px;
      max-height: calc(100vh - 100px);
      background: #ffffff;
      border-radius: 22px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.22);
      border: 1px solid #cbd5e1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: bottom right;
    }
    .obw-window.obw-hidden {
      opacity: 0;
      transform: scale(0.9) translateY(20px);
      pointer-events: none;
      visibility: hidden;
    }
    .obw-header {
      background: linear-gradient(135deg, #0056b3 0%, #003e8a 100%);
      color: #ffffff;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      direction: rtl;
    }
    .obw-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: right;
    }
    .obw-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      flex-shrink: 0;
    }
    .obw-avatar svg {
      width: 26px;
      height: 26px;
      stroke: #0056b3;
    }
    .obw-title-group {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: right;
    }
    .obw-title {
      font-weight: 900;
      font-size: 19px;
      margin: 0;
      line-height: 1.15;
      color: #ffffff;
      letter-spacing: -0.3px;
    }
    .obw-subtitle {
      font-size: 12.5px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
      margin: 3px 0 0 0;
      line-height: 1.15;
    }
    .obw-close-btn {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: #ffffff;
      font-size: 22px;
      cursor: pointer;
      opacity: 0.9;
      padding: 6px;
      border-radius: 50%;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .obw-close-btn:hover {
      opacity: 1;
      background: rgba(255,255,255,0.2);
    }
    .obw-close-btn:hover {
      opacity: 1;
      background: rgba(255,255,255,0.15);
    }
    .obw-messages {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .obw-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.45;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .obw-msg-bot {
      align-self: flex-start;
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      border-bottom-right-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .obw-msg-user {
      align-self: flex-end;
      background: ${themeColor};
      color: #ffffff;
      border-bottom-left-radius: 4px;
    }
    .obw-msg-time {
      font-size: 10px;
      opacity: 0.6;
      margin-top: 4px;
      text-align: left;
    }
    .obw-msg-image {
      max-width: 100%;
      border-radius: 12px;
      margin-top: 6px;
      border: 1px solid #cbd5e1;
    }
    .obw-inline-link-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin: 4px 0;
      padding: 7px 14px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      border-radius: 12px !important;
      font-size: 12.5px !important;
      font-weight: 800 !important;
      text-decoration: none !important;
      box-shadow: 0 3px 10px rgba(37, 99, 235, 0.3) !important;
      border: 1px solid #1e40af !important;
      transition: all 0.2s ease !important;
      cursor: pointer !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      vertical-align: middle;
    }
    .obw-inline-link-btn:hover {
      background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 5px 14px rgba(37, 99, 235, 0.4) !important;
    }
    .obw-msg-has-buttons {
      width: 92%;
      max-width: 92%;
    }
    .obw-buttons-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      margin-top: 10px;
      width: 100%;
      box-sizing: border-box;
      direction: rtl;
    }
    .obw-btn-action {
      background: #eff6ff;
      color: ${themeColor};
      border: 1px solid #bfdbfe;
      padding: 8px 10px;
      border-radius: 12px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 5px;
      width: 100%;
      box-sizing: border-box;
      line-height: 1.35;
      word-break: break-word;
    }
    .obw-btn-action:hover {
      background: ${themeColor};
      color: #ffffff;
      border-color: ${themeColor};
      transform: translateY(-1px);
    }
    .obw-btn-action:last-child:nth-child(odd) {
      grid-column: span 2;
    }
    .obw-btn-link {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      border: 1px solid #1e40af !important;
      padding: 8px 10px !important;
      border-radius: 12px !important;
      font-size: 12.5px !important;
      font-weight: 800 !important;
      text-decoration: none !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      box-shadow: 0 3px 10px rgba(37, 99, 235, 0.3) !important;
      transition: all 0.2s ease !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .obw-btn-link:hover {
      background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
      color: #ffffff !important;
      transform: translateY(-1px) scale(1.02) !important;
      box-shadow: 0 5px 14px rgba(37, 99, 235, 0.45) !important;
    }
    .obw-typing {
      align-self: flex-start;
      background: #ffffff;
      padding: 8px 14px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .obw-dot {
      width: 6px;
      height: 6px;
      background: #94a3b8;
      border-radius: 50%;
      animation: obwBlink 1.4s infinite ease-in-out both;
    }
    .obw-dot:nth-child(2) { animation-delay: .2s; }
    .obw-dot:nth-child(3) { animation-delay: .4s; }
    @keyframes obwBlink {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.1); }
    }
    .obw-footer {
      padding: 10px 12px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .obw-input {
      flex: 1;
      border: 1px solid #cbd5e1;
      padding: 9px 12px;
      border-radius: 12px;
      font-size: 13.5px;
      outline: none;
      direction: rtl;
    }
    .obw-input:focus {
      border-color: ${themeColor};
      box-shadow: 0 0 0 2px rgba(0,71,171,0.15);
    }
    .obw-send-btn {
      background: ${themeColor};
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 9px 14px;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .obw-send-btn:hover {
      background: #003580;
    }
    .obw-wa-banner {
      background: #f0fdf4;
      border-bottom: 1px solid #bbf7d0;
      padding: 6px 12px;
      font-size: 11.5px;
      color: #166534;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 600;
    }
    .obw-wa-link {
      color: #15803d;
      text-decoration: underline;
      font-weight: 800;
    }
    .obw-powered-by {
      background: #f1f5f9;
      border-top: 1px solid #e2e8f0;
      padding: 6px 12px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-weight: 500;
    }
    .obw-powered-link {
      color: #0284c7;
      font-weight: 800;
      text-decoration: none;
      transition: color 0.15s;
    }
    .obw-powered-link:hover {
      color: #0369a1;
      text-decoration: underline;
    }
  `;

  var styleEl = document.createElement('style');
  styleEl.innerHTML = css;
  document.head.appendChild(styleEl);

  // 4. Build Widget HTML markup
  var headerTitles = parseTitleAndSubtitle(botTitle, botSubtitle);

  var widgetContainer = document.createElement('div');
  widgetContainer.id = 'obw-widget-container';
  widgetContainer.innerHTML = `
    <button class="obw-fab-button" id="obw-fab" aria-label="צ'אט שירות לקוחות">
      <span class="obw-fab-badge" id="obw-badge">1</span>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>

    <div class="obw-window obw-hidden" id="obw-window">
      <div class="obw-header">
        <div class="obw-header-info">
          <div class="obw-avatar">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0056b3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="6" cy="12" r="4"/>
              <circle cx="18" cy="12" r="4"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
              <path d="M2 12h0.5M21.5 12h0.5"/>
            </svg>
          </div>
          <div class="obw-title-group">
            <div class="obw-title" id="obw-header-main-title">${headerTitles.main}</div>
            <div class="obw-subtitle" id="obw-header-sub-title">${headerTitles.sub}</div>
          </div>
        </div>
        <button class="obw-close-btn" id="obw-close" aria-label="סגור חלון">✕</button>
      </div>

      <div class="obw-wa-banner">
        <span>מעדיף בוואטסאפ?</span>
        <a href="https://wa.me/${whatsappNumber}?text=${encodeURIComponent('שלום, אשמח לקבל מידע נוסף')}" target="_blank" class="obw-wa-link">
          לחץ למעבר לוואטסאפ 📱
        </a>
      </div>

      <div class="obw-messages" id="obw-messages"></div>

      <div class="obw-footer">
        <input type="text" class="obw-input" id="obw-input" placeholder="קלד/י הודעה כאן..." />
        <button class="obw-send-btn" id="obw-send">שלח</button>
      </div>

      <div class="obw-powered-by">
        <span>Powered by</span>
        <a href="https://app.smartesek.com" target="_blank" rel="noopener noreferrer" class="obw-powered-link">
          בוט חכם 🤖
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(widgetContainer);

  // 5. State & Elements
  var fab = document.getElementById('obw-fab');
  var badge = document.getElementById('obw-badge');
  var win = document.getElementById('obw-window');
  var closeBtn = document.getElementById('obw-close');
  var messagesBox = document.getElementById('obw-messages');
  var inputEl = document.getElementById('obw-input');
  var sendBtn = document.getElementById('obw-send');

  var isOpen = false;
  var isTyping = false;

  // Initial welcome message from conversation flow
  var initialFlow = parseConversationFlow(conversationFlow, botTitle);
  var messages = [
    {
      id: 'welcome_1',
      sender: 'bot',
      text: initialFlow.text,
      buttons: initialFlow.buttons,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];

  var ensureButtonEmoji = function(title, url) {
    if (!title) title = url ? 'מעבר לקישור' : 'אפשרות';
    title = String(title).trim();

    var hasEmoji = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFA}]/u.test(title);
    if (hasEmoji) return title;

    var lower = title.toLowerCase();
    if (url || lower.indexOf('http') !== -1 || lower.indexOf('קישור') !== -1 || lower.indexOf('לינק') !== -1 || lower.indexOf('אתר') !== -1 || lower.indexOf('דף') !== -1) {
      return '🌐 ' + title;
    }
    if (lower.indexOf('וואטסאפ') !== -1 || lower.indexOf('ווטסאפ') !== -1 || lower.indexOf('whatsapp') !== -1 || lower.indexOf('wa.me') !== -1) {
      return '📱 ' + title;
    }
    if (lower.indexOf('בדיק') !== -1 || lower.indexOf('תור') !== -1 || lower.indexOf('תיאום') !== -1 || lower.indexOf('יומן') !== -1 || lower.indexOf('תאריך') !== -1) {
      return '📅 ' + title;
    }
    if (lower.indexOf('קטלוג') !== -1 || lower.indexOf('משקפ') !== -1 || lower.indexOf('מוצר') !== -1 || lower.indexOf('מחיר') !== -1 || lower.indexOf('חנות') !== -1) {
      return '👓 ' + title;
    }
    if (lower.indexOf('שעות') !== -1 || lower.indexOf('זמן') !== -1 || lower.indexOf('פעילות') !== -1 || lower.indexOf('מתי') !== -1) {
      return '⏰ ' + title;
    }
    if (lower.indexOf('מיקום') !== -1 || lower.indexOf('כתובת') !== -1 || lower.indexOf('ניווט') !== -1 || lower.indexOf('מפה') !== -1 || lower.indexOf('waze') !== -1) {
      return '📍 ' + title;
    }
    if (lower.indexOf('נציג') !== -1 || lower.indexOf('אנושי') !== -1 || lower.indexOf('טלפון') !== -1 || lower.indexOf('שיחה') !== -1 || lower.indexOf('שירות') !== -1) {
      return '📞 ' + title;
    }
    if (lower.indexOf('תשלום') !== -1 || lower.indexOf('אשראי') !== -1 || lower.indexOf('ביט') !== -1 || lower.indexOf('קנה') !== -1) {
      return '💳 ' + title;
    }
    if (lower.indexOf('אישור') !== -1 || lower.indexOf('כן') !== -1 || lower.indexOf('מאשר') !== -1) {
      return '✅ ' + title;
    }
    if (lower.indexOf('ביטול') !== -1 || lower.indexOf('לא') !== -1 || lower.indexOf('חזור') !== -1) {
      return '❌ ' + title;
    }
    if (lower.indexOf('מידע') !== -1 || lower.indexOf('עזרה') !== -1 || lower.indexOf('שאלה') !== -1 || lower.indexOf('פרטים') !== -1) {
      return '💡 ' + title;
    }
    if (lower.indexOf('הורדה') !== -1 || lower.indexOf('קובץ') !== -1 || lower.indexOf('pdf') !== -1) {
      return '📥 ' + title;
    }

    return '🔹 ' + title;
  };

  var renderMessages = function() {
    messagesBox.innerHTML = '';
    messages.forEach(function(msg) {
      var msgDiv = document.createElement('div');
      msgDiv.className = 'obw-msg ' + (msg.sender === 'user' ? 'obw-msg-user' : 'obw-msg-bot');

      var textSpan = document.createElement('div');
      var rawText = msg.text || '';
      var escapeHtml = function(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };

      var formatTextWithInlineButtons = function(str) {
        if (!str) return '';
        var lines = str.split('\n');
        var formattedLines = lines.map(function(line) {
          if (!/(https?:\/\/[^\s<]+|wa\.me\/[^\s<]+)/i.test(line)) {
            return escapeHtml(line);
          }

          var urlPattern = /(?:([^\n\r:\-•*]{1,40}[:\-•*]?)?\s*)?(https?:\/\/[^\s<]+|wa\.me\/[^\s<]+)/gi;

          return line.replace(urlPattern, function(fullMatch, rawPrefix, matchUrl) {
            var targetUrl = matchUrl.startsWith('wa.me') ? 'https://' + matchUrl : matchUrl;
            var plainTextBefore = '';
            var label = '';

            if (rawPrefix) {
              var lastPunct = rawPrefix.search(/[,\.\!\?\;\n][^,\.\!\?\;\n]*$/);
              if (lastPunct !== -1) {
                plainTextBefore = rawPrefix.substring(0, lastPunct + 1) + ' ';
                label = rawPrefix.substring(lastPunct + 1).trim();
              } else {
                label = rawPrefix.trim();
              }
            }

            label = label.replace(/[:\-•*]+$/, '').trim();

            if (!label || label.length > 35 || /[\.\!\?]$/.test(label)) {
              if (/waze\.com/i.test(targetUrl)) {
                label = '🚗 לניווט ב-Waze';
              } else if (/wa\.me|whatsapp\.com/i.test(targetUrl)) {
                label = '💬 פנייה ב-WhatsApp';
              } else if (/pdf|doc|file/i.test(targetUrl)) {
                label = '📥 הורדת קובץ';
              } else {
                label = '🌐 מעבר לקישור';
              }
            } else {
              if (/ניווט|וויז|waze|מפה|כתובת/i.test(label) && !/[\u{1F300}-\u{1F9FF}]/u.test(label)) {
                label = '🚗 ' + label;
              } else if (/תור|פגישה|יומן|קביעה/i.test(label) && !/[\u{1F300}-\u{1F9FF}]/u.test(label)) {
                label = '📅 ' + label;
              } else if (/ווטסאפ|whatsapp|שיחה|קשר/i.test(label) && !/[\u{1F300}-\u{1F9FF}]/u.test(label)) {
                label = '💬 ' + label;
              } else if (!/[\u{1F300}-\u{1F9FF}]/u.test(label)) {
                label = '🔗 ' + label;
              }
            }

            var buttonHtml = '<a href="' + escapeHtml(targetUrl) + '" target="_blank" rel="noopener noreferrer" class="obw-inline-link-btn"><span>' + escapeHtml(label) + '</span> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>';

            return escapeHtml(plainTextBefore) + buttonHtml;
          });
        });

        return formattedLines.join('<br/>');
      };

      textSpan.innerHTML = formatTextWithInlineButtons(rawText);
      msgDiv.appendChild(textSpan);

      if (msg.imageUrl) {
        var img = document.createElement('img');
        img.src = msg.imageUrl;
        img.className = 'obw-msg-image';
        msgDiv.appendChild(img);
      }

      // Filter out buttons with URLs that were already embedded as inline link buttons in body text
      var activeButtons = (msg.buttons || []).filter(function(btn) {
        if (btn.url && rawText.indexOf(btn.url) !== -1) {
          return false;
        }
        return true;
      });

      if (activeButtons.length > 0) {
        msgDiv.className += ' obw-msg-has-buttons';
        var btnsDiv = document.createElement('div');
        btnsDiv.className = 'obw-buttons-container';
        activeButtons.forEach(function(btn) {
          var formattedTitle = ensureButtonEmoji(btn.title, btn.url);
          if (btn.url) {
            var a = document.createElement('a');
            a.className = 'obw-btn-action obw-btn-link';
            a.href = btn.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.innerHTML = '<span>' + formattedTitle + '</span> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
            btnsDiv.appendChild(a);
          } else {
            var b = document.createElement('button');
            b.className = 'obw-btn-action';
            b.textContent = formattedTitle;
            b.onclick = function() {
              handleSendMessage(btn.title, btn.id);
            };
            btnsDiv.appendChild(b);
          }
        });
        msgDiv.appendChild(btnsDiv);
      }

      var timeDiv = document.createElement('div');
      timeDiv.className = 'obw-msg-time';
      timeDiv.textContent = msg.time;
      msgDiv.appendChild(timeDiv);

      messagesBox.appendChild(msgDiv);
    });

    if (isTyping) {
      var typingDiv = document.createElement('div');
      typingDiv.className = 'obw-typing';
      typingDiv.innerHTML = '<span>מחבר לבוט...</span> <div class="obw-dot"></div><div class="obw-dot"></div><div class="obw-dot"></div>';
      messagesBox.appendChild(typingDiv);
    }

    messagesBox.scrollTop = messagesBox.scrollHeight;
  };

  // Helper parser for n8n response nodes
  var parseN8nResponse = function(rawData) {
    var replyText = '';
    var imageUrl = null;
    var buttons = [];

    var addCandidateButton = function(btnObj) {
      if (!btnObj) return;
      var bTitle = '';
      var bId = null;
      var bUrl = null;

      if (typeof btnObj === 'string') {
        bTitle = btnObj.trim();
      } else if (typeof btnObj === 'object') {
        bTitle = btnObj.title || btnObj.text || btnObj.label || btnObj.name || btnObj.value || (btnObj.reply && btnObj.reply.title) || (btnObj.header && btnObj.header.text) || (btnObj.action && btnObj.action.label);
        bId = btnObj.id || btnObj.row_id || btnObj.key || (btnObj.reply && btnObj.reply.id);
        bUrl = btnObj.url || btnObj.link || btnObj.href || btnObj.uri || (btnObj.action && (btnObj.action.url || btnObj.action.link)) || (btnObj.parameters && (btnObj.parameters.url || btnObj.parameters.link));
      }

      if (typeof bTitle === 'string') {
        bTitle = bTitle.trim();
        if (/^https?:\/\//i.test(bTitle) || /^wa\.me\//i.test(bTitle)) {
          if (!bUrl) bUrl = bTitle.startsWith('wa.me') ? 'https://' + bTitle : bTitle;
          bTitle = 'מעבר לקישור 🌐';
        }
      }

      if (bTitle || bUrl) {
        if (!bTitle) bTitle = 'מעבר לקישור';
        var exists = buttons.some(function(existing) {
          return existing.title === bTitle || (bUrl && existing.url === bUrl);
        });
        if (!exists) {
          buttons.push({
            id: bId || ('btn_' + buttons.length + '_' + Date.now().toString(36)),
            title: bTitle,
            url: bUrl || null
          });
        }
      }
    };

    var parseRowsOrItems = function(arr) {
      if (!Array.isArray(arr)) return;
      arr.forEach(function(row) {
        addCandidateButton(row);
      });
    };

    var parseSections = function(sectionsArr) {
      if (!Array.isArray(sectionsArr)) return;
      sectionsArr.forEach(function(sec) {
        if (!sec || typeof sec !== 'object') return;
        var rows = sec.rows || sec.items || sec.options || sec.list || sec.list_items || sec.choices;
        if (Array.isArray(rows)) {
          parseRowsOrItems(rows);
        }
      });
    };

    var items = Array.isArray(rawData) ? rawData : [rawData];
    items.forEach(function(item) {
      var node = item.json || item || {};

      if (typeof node === 'string') {
        replyText += (replyText ? '\n' : '') + node;
        return;
      }

      // 1. WhatsApp interactive payload
      if (node.whatsapp_payload && node.whatsapp_payload.message) {
        var msg = node.whatsapp_payload.message;
        if (msg.interactive) {
          var parts = [];
          if (msg.interactive.header && msg.interactive.header.text) parts.push(msg.interactive.header.text);
          if (msg.interactive.body && msg.interactive.body.text) parts.push(msg.interactive.body.text);
          if (msg.interactive.footer && msg.interactive.footer.text) parts.push(msg.interactive.footer.text);
          if (parts.length > 0) replyText = parts.join('\n\n');

          var action = msg.interactive.action || {};
          if (Array.isArray(action.buttons)) {
            action.buttons.forEach(function(b) { addCandidateButton(b); });
          }
          if (Array.isArray(action.sections)) {
            parseSections(action.sections);
          }
          if (Array.isArray(action.rows)) {
            parseRowsOrItems(action.rows);
          }
        } else if (msg.text && msg.text.body) {
          replyText = msg.text.body;
        } else if (msg.body) {
          replyText = typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body);
        }

        // Image check inside whatsapp_payload.message
        if (msg.type === 'image' || msg.image) {
          if (typeof msg.image === 'string') {
            imageUrl = msg.image;
          } else if (msg.image && typeof msg.image === 'object') {
            if (!imageUrl) imageUrl = msg.image.link || msg.image.url;
            if (msg.image.caption && !replyText) {
              replyText = msg.image.caption;
            }
          }
          if (msg.caption && !replyText) {
            replyText = msg.caption;
          }
        }
      }

      // 2. Interactive or LIST objects directly on node or sub-objects
      var candidates = [
        node,
        node.message,
        node.reply,
        node.output,
        node.response,
        node.data,
        node.interactive,
        node.list,
        node.payload
      ];

      candidates.forEach(function(cand) {
        if (!cand || typeof cand !== 'object') return;

        // Check sections
        if (Array.isArray(cand.sections)) {
          parseSections(cand.sections);
        }
        // Check rows
        if (Array.isArray(cand.rows)) {
          parseRowsOrItems(cand.rows);
        }
        // Check items
        if (Array.isArray(cand.items)) {
          parseRowsOrItems(cand.items);
        }
        // Check options
        if (Array.isArray(cand.options)) {
          parseRowsOrItems(cand.options);
        }
        // Check choices
        if (Array.isArray(cand.choices)) {
          parseRowsOrItems(cand.choices);
        }
        // Check buttons
        if (Array.isArray(cand.buttons)) {
          parseRowsOrItems(cand.buttons);
        }
        // Check list if array
        if (Array.isArray(cand.list)) {
          parseRowsOrItems(cand.list);
        }
      });

      // 3. Text Extraction
      var msgObj = node.message || node.reply || node.output || node.response || node.data || node.text;
      if (typeof msgObj === 'string' && !replyText) {
        replyText = msgObj;
      } else if (msgObj && typeof msgObj === 'object') {
        if (msgObj.caption && !replyText) replyText = msgObj.caption;
        if (msgObj.image && typeof msgObj.image === 'object' && msgObj.image.caption && !replyText) {
          replyText = msgObj.image.caption;
        }
        if (msgObj.text && !replyText) replyText = typeof msgObj.text === 'string' ? msgObj.text : JSON.stringify(msgObj.text);
        if (msgObj.body && !replyText) replyText = typeof msgObj.body === 'string' ? msgObj.body : JSON.stringify(msgObj.body);
        if (msgObj.content && !replyText) replyText = typeof msgObj.content === 'string' ? msgObj.content : JSON.stringify(msgObj.content);
        if (msgObj.title && !replyText) replyText = typeof msgObj.title === 'string' ? msgObj.title : JSON.stringify(msgObj.title);
        if (msgObj.image && !imageUrl) {
          imageUrl = typeof msgObj.image === 'string' ? msgObj.image : (msgObj.image.link || msgObj.image.url);
        }
      }

      if (!replyText) {
        if (node.caption) replyText = node.caption;
        else if (node.image && typeof node.image === 'object' && node.image.caption) replyText = node.image.caption;
        else {
          var stringCand = node.reply || node.output || node.text || node.content || node.response || node.title || node.header || node.body || node.message;
          if (typeof stringCand === 'string') replyText = stringCand;
        }
      }

      if (!imageUrl) {
        var topImg = node.image || node.imageUrl;
        if (typeof topImg === 'string') imageUrl = topImg;
        else if (topImg && typeof topImg === 'object') imageUrl = topImg.link || topImg.url;
      }
    });

    // Automatically convert any URL contained in replyText into a prominent link button if not already present
    if (replyText) {
      var matchedUrls = replyText.match(/(https?:\/\/[^\s<>'"]+|wa\.me\/[^\s<>'"]+)/gi);
      if (matchedUrls && matchedUrls.length > 0) {
        matchedUrls.forEach(function(rawUrl) {
          var cleanUrl = rawUrl.startsWith('wa.me') ? 'https://' + rawUrl : rawUrl;
          addCandidateButton({
            title: 'לחץ למעבר לקישור 🌐',
            url: cleanUrl
          });
        });
      }
    }

    if (!replyText && buttons.length > 0) {
      replyText = 'אנא בחר מתוך האפשרויות הבאות:';
    }

    return { replyText: replyText, imageUrl: imageUrl, buttons: buttons };
  };

  var handleSendMessage = function(textToSend, buttonId) {
    var userText = textToSend || inputEl.value.trim();
    if (!userText) return;

    inputEl.value = '';

    var detectedPhone = extractPhoneFromUserText(userText);
    if (detectedPhone) {
      setUserPhone(detectedPhone);
    }

    var detectedName = extractNameFromUserText(userText);
    if (detectedName) {
      setUserName(detectedName);
    }

    // Upgrade sessionId if user phone is available
    var activePhone = getUserPhone();
    if (activePhone) {
      var updatedSid = activePhone + '_' + botId;
      if (sessionId !== updatedSid) {
        sessionId = updatedSid;
        saveSessionId(updatedSid);
      }
    }

    // Append user message
    messages.push({
      id: 'u_' + Date.now(),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    isTyping = true;
    renderMessages();

    // Prepare payload sending updated sessionId and user identity fields
    var payload = {
      bot_id: botId,
      botId: botId,
      message: userText,
      buttonId: buttonId || null,
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    };

    var currentUserName = getUserName();
    if (currentUserName) {
      payload.userName = currentUserName;
      payload.name = currentUserName;
    }

    var currentUserPhone = getUserPhone();
    if (currentUserPhone) {
      payload.userPhone = currentUserPhone;
      payload.phone = currentUserPhone;
    }

    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Network response error');
      return res.json();
    })
    .then(function(data) {
      isTyping = false;
      var parsed = parseN8nResponse(data);

      messages.push({
        id: 'b_' + Date.now(),
        sender: 'bot',
        text: parsed.replyText || 'תודה! קיבלנו את פנייתך.',
        imageUrl: parsed.imageUrl,
        buttons: parsed.buttons.length > 0 ? parsed.buttons : undefined,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      renderMessages();
    })
    .catch(function(err) {
      console.error('Optics Bot Webhook Error:', err);
      isTyping = false;
      messages.push({
        id: 'b_err_' + Date.now(),
        sender: 'bot',
        text: 'מצטערים, חלה שגיאה בתקשורת עם הבוט. ניתן ליצור קשר בטלפון: 054-913-1704 או בוואטסאפ.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      renderMessages();
    });
  };

  // Live dynamic update function for SPA
  window.OpticsBotWidgetUpdate = function(newConfig) {
    if (!newConfig) return;
    if (newConfig.botId) botId = newConfig.botId;
    if (newConfig.title) botTitle = newConfig.title;
    if (newConfig.subtitle !== undefined) botSubtitle = newConfig.subtitle;
    if (newConfig.whatsappNumber) whatsappNumber = newConfig.whatsappNumber;
    if (newConfig.webhookUrl) webhookUrl = newConfig.webhookUrl;
    if (newConfig.conversationFlow !== undefined) conversationFlow = newConfig.conversationFlow;

    var parsedTitles = parseTitleAndSubtitle(botTitle, botSubtitle);
    var mainTitleEl = document.querySelector('#obw-widget-container #obw-header-main-title');
    if (mainTitleEl) mainTitleEl.textContent = parsedTitles.main;
    var subTitleEl = document.querySelector('#obw-widget-container #obw-header-sub-title');
    if (subTitleEl) subTitleEl.textContent = parsedTitles.sub;

    var waLink = document.querySelector('#obw-widget-container .obw-wa-link');
    if (waLink) {
      waLink.href = 'https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent('שלום, אשמח לקבל מידע נוסף');
    }

    STORAGE_KEY = 'optics_bot_session_' + botId;
    sessionId = getSessionId();

    var updatedFlow = parseConversationFlow(conversationFlow, botTitle);

    messages = [
      {
        id: 'welcome_' + Date.now(),
        sender: 'bot',
        text: updatedFlow.text,
        buttons: updatedFlow.buttons,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    renderMessages();
  };

  // Event Listeners
  fab.onclick = function() {
    isOpen = !isOpen;
    if (isOpen) {
      win.classList.remove('obw-hidden');
      badge.style.display = 'none';
      inputEl.focus();
    } else {
      win.classList.add('obw-hidden');
    }
  };

  closeBtn.onclick = function() {
    isOpen = false;
    win.classList.add('obw-hidden');
  };

  sendBtn.onclick = function() {
    handleSendMessage();
  };

  inputEl.onkeypress = function(e) {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Initial render
  renderMessages();

})();
