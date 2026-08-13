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
  var welcomeMessage = userConfig.welcomeMessage || userConfig.FirstMessage || userConfig.firstMessage || (currentScript ? currentScript.getAttribute('data-welcome-message') : null) || '';
  var conversationFlow = userConfig.conversationFlow || (currentScript ? currentScript.getAttribute('data-conversation-flow') : null) || '';
  var customOptions = userConfig.options || (currentScript ? currentScript.getAttribute('data-options') : null) || '';

  var cleanStringAttr = function(val) {
    if (!val || typeof val !== 'string') return val || '';
    var res = val.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    if (res.indexOf('\\n') !== -1) {
      res = res.replace(/\\n/g, '\n');
    }
    return res.trim();
  };

  welcomeMessage = cleanStringAttr(welcomeMessage);
  conversationFlow = cleanStringAttr(conversationFlow);
  if (typeof customOptions === 'string') {
    customOptions = cleanStringAttr(customOptions);
  }

  // Header title: show only the bot name.
  // Do not automatically add a location/subtitle such as "מושב אמירים".
  // If the bot name itself contains a location, it remains part of the name.
  var parseTitleAndSubtitle = function(rawTitle, rawSub) {
    var main = (rawTitle || '').trim();

    if (!main) main = 'האופטיקה הטובה';

    // Keep the full configured bot name, including "אמירים" if it is
    // actually part of the configured name.
    return {
      main: main,
      sub: ''
    };
  };

  if (window.__OpticsBotWidgetLoaded) {
    if (typeof window.OpticsBotWidgetUpdate === 'function') {
      window.OpticsBotWidgetUpdate({
        botId: botId,
        title: botTitle,
        webhookUrl: webhookUrl,
        whatsappNumber: whatsappNumber,
        themeColor: themeColor,
        welcomeMessage: welcomeMessage,
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

    // Do not use old menu selections as customer names.
    var invalidSavedName = /^(?:דרכי\s+הגעה|הגעה|מיקום|כתובת|שעות|קביעת\s+תור|קביעת\s+בדיקת\s+ראייה|בדיקת\s+ראייה|תור|עדשות\s+מגע|עדשות\s+מולטיפוקל|מולטיפוקל|מסגרות(?:\s+למשקפיים)?|משקפי\s+שמש|משקפים\s+לשחייה|משקפי\s+שחייה|קבלת\s+משקפיים\s+מוכנים|איסוף\s+הזמנה|אחריות|פערי\s+מחירים|מחירים|רוד['’]?י\s+פרוג['’]?קט|שאל\s+נציג\s+אנושי|נציג\s+אנושי|מידע|שאלה|עזרה|תפריט)$/i;

    if (name && invalidSavedName.test(String(name).trim())) {
      try {
        localStorage.removeItem('optics_bot_user_name_' + botId);
        localStorage.removeItem('smartesek_user_name');
      } catch (e) {}
      try {
        setCookie('optics_bot_user_name_' + botId, '', -1);
        setCookie('smartesek_user_name', '', -1);
      } catch (e) {}
      return null;
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

  // Extract a customer name ONLY when there is a strong indication that
  // the user actually supplied a name. Never treat a menu/button choice
  // such as "דרכי הגעה" as a customer name.
  var extractNameFromUserText = function(text) {
    if (!text || typeof text !== 'string') return null;

    var clean = text.trim();
    if (!clean) return null;

    // Menu/action phrases that must NEVER become a saved customer name.
    var forbiddenNamePhrases = /^(?:דרכי\s+הגעה|הגעה|מיקום|כתובת|שעות\s*(?:פתיחה|פעילות)?|קביעת\s+תור|קביעת\s+בדיקת\s+ראייה|בדיקת\s+ראייה|תור|עדשות\s+מגע|עדשות\s+מולטיפוקל|מולטיפוקל|מסגרות(?:\s+למשקפיים)?|מסגרות\s+למשקפים|משקפי\s+שמש|משקפים\s+לשחייה|משקפי\s+שחייה|קבלת\s+משקפיים\s+מוכנים|איסוף\s+הזמנה|איסוף\s+משקפיים|אחריות|פערי\s+מחירים|מחירים|רוד['’]?י\s+פרוג['’]?קט|שאל\s+נציג\s+אנושי|נציג\s+אנושי|לדבר\s+עם\s+צביקה|מידע|שאלה|עזרה|תפריט|חזרה)$/i;

    if (forbiddenNamePhrases.test(clean)) return null;

    // 1. Strong explicit phrases:
    // "שמי חיים", "קוראים לי חיים", "אני חיים", "השם שלי הוא חיים".
    var nameMatch = clean.match(
      /(?:קוראים\s*לי|שמי\s*הוא|שמי|השם\s*שלי\s*הוא|מדבר|מדברת)\s+([א-תa-zA-Z]{2,20}(?:\s+[א-תa-zA-Z]{2,20})?)/i
    );

    if (nameMatch && nameMatch[1]) {
      var candidate = nameMatch[1].trim();

      // Remove trailing conversational words accidentally captured after a name.
      candidate = candidate
        .replace(/\s+(?:ואני|ורוצה|רוצה|צריך|צריכה|מבקש|מבקשת|שואל|שואלת|רק|בעניין).*$/i, '')
        .trim();

      if (
        candidate.length >= 2 &&
        !forbiddenNamePhrases.test(candidate) &&
        !/^(רוצה|צריך|צריכה|אפשר|שלום|היי|בוקר|ערב|תודה|מתי|איפה|כמה|מה|איך|לקבוע|לקבל|לדעת)$/i.test(candidate)
      ) {
        return candidate;
      }
    }

    // "אני X" is handled separately so "אני רוצה..." can never become
    // the name "רוצה".
    var iAmMatch = clean.match(/^אני\s+([א-תa-zA-Z]{2,20}(?:\s+[א-תa-zA-Z]{2,20})?)\s*$/i);
    if (iAmMatch && iAmMatch[1]) {
      var iAmCandidate = iAmMatch[1].trim();

      if (
        !forbiddenNamePhrases.test(iAmCandidate) &&
        !/^(רוצה|צריך|צריכה|מבקש|מבקשת|שואל|שואלת|רוצה\s+ל|צריך\s+ל)$/i.test(iAmCandidate)
      ) {
        return iAmCandidate;
      }
    }

    // 2. Name + phone / phone + name.
    var phoneRegex = /(?:05[0-9][- ]?[0-9]{7}|0[23489][- ]?[0-9]{7}|\+?972[- ]?5[0-9][- ]?[0-9]{7})/g;
    var textWithoutPhone = clean.replace(phoneRegex, '').trim();
    textWithoutPhone = textWithoutPhone.replace(/^[,\.\!\?\"\':\-]+|[,\.\!\?\"\':\-]+$/g, '').trim();

    if (
      textWithoutPhone &&
      !/\d/.test(textWithoutPhone) &&
      !/http/i.test(textWithoutPhone) &&
      !forbiddenNamePhrases.test(textWithoutPhone)
    ) {
      var words = textWithoutPhone.split(/\s+/).filter(Boolean);

      if (words.length >= 1 && words.length <= 3) {
        var isAllWordsLetters = words.every(function(w) {
          return /^[א-תa-zA-Z]{2,20}$/.test(w);
        });

        var commonWords =
          /^(שלום|היי|אפשר|רוצה|צריך|צריכה|תודה|בבקשה|מידע|שאלה|תקשר|תתקשר|תחזור|מתי|איפה|כמה|מה|איך|לקבוע|בדיקה|תור|הגעה|דרכי|מיקום|כתובת|שעות|מסגרות|משקפים|משקפיים|עדשות|אחריות|מחירים|הזמנה|איסוף|נציג|אנושי)$/i;

        if (
          isAllWordsLetters &&
          !(words.length === 1 && commonWords.test(words[0]))
        ) {
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

  // Helper to preserve button title exactly as written without inventing emojis
  var ensureButtonEmoji = function(title, url) {
    if (!title) return url ? 'מעבר לקישור' : '';
    return String(title).trim();
  };

  // Helper to parse welcome message and conversation flow to extract options purely as interactive buttons
  var parseConversationFlow = function(flowStr, fallbackTitle, secondaryFlowStr, explicitOptions) {
    var welcomeText = '';
    var buttons = [];

    // 1. Process explicit options if provided via data-options or window.OpticsBotConfig.options
    if (explicitOptions) {
      var rawOpts = Array.isArray(explicitOptions) 
        ? explicitOptions 
        : String(explicitOptions).split(/[\n|;,]/);
      rawOpts.forEach(function(opt) {
        var title = String(opt || '').trim();
        if (title.length > 0 && title.length <= 90) {
          buttons.push({
            id: 'btn_flow_' + buttons.length,
            title: ensureButtonEmoji(title)
          });
        }
      });
    }

    var extractFromText = function(str) {
      var extractedText = '';
      var extractedButtons = [];

      if (!str || typeof str !== 'string' || str.trim().length === 0) {
        return { text: extractedText, buttons: extractedButtons };
      }

      var rawText = str.trim();
      var openingSectionText = rawText;

      // 1. Cut off strictly at "זרימת השיחה" / "זרימת שיחה" / "שלב 2" / "המשך שיחה" / etc.
      var endBoundaryRegex = /(?:\r?\n|^)[ \t]*(?:(?:\d+[\.\)-]|[\-\*•])\s*)?(?:זרימת\s*ה?שיחה|תרחיש(?:י)?\s*ה?שיחה|המשך\s*ה?שיחה|תסריט\s*ה?שיחה|שלב\s*2|סעיף\s*2)(?:[ \t]*[:\-\|]|\r?\n|$)/i;
      var matchEnd = openingSectionText.match(endBoundaryRegex);
      if (matchEnd && matchEnd.index > 0) {
        openingSectionText = openingSectionText.substring(0, matchEnd.index);
      }

      // 2. Remove leading "הודעת פתיחה:" or "1. הודעת פתיחה:" header
      openingSectionText = openingSectionText.replace(/^[ \t]*(?:(?:\d+[\.\)-]|[\-\*•▪️])\s*)?(?:שלב\s*1\s*[:\-\|]?\s*|סעיף\s*1\s*[:\-\|]?\s*)?(?:הודעת\s*פתיחה|ברכת\s*פתיחה|שאלת\s*פתיחה|פתיחה)[ \t]*[:\-\|]?[ \t]*/i, '').trim();

      var rawLines = openingSectionText.split(/\r?\n/);
      var textLines = [];
      var inOptionsSection = false;

      var hasExplicitHeader = rawLines.some(function(l) {
        var clean = l.replace(/^["'«»“](.*)["'«»”]$/, '$1').trim();
        return /^(?:אפשרויות|אפשריות|כפתורים|בחרו?\s*אפשרות|אפשרויות\s*לבחירה|אפשריות\s*לבחירה|בחר\s*אחת\s*מהאפשרויות|אנא\s*בחר\s*מבין\s*האפשרויות|אפשרויות\s*זמינות|להלן\s*האפשרויות|תפריט|תפריט\s*ראשי|מה\s*תרצ[וה]\s*לעשות|איך\s*אפשר\s*לעזור|איך\s*נוכל\s*לסייע|נושאים\s*לבחירה|שאלות\s*נפוצות)[ \t]*[:\-\|]?$/i.test(clean) ||
          /^(?:בחר|בחרו|להלן|אנא\s*לבחור|אפשרויות\s*לבחירה|אפשריות\s*לבחירה|ניתן\s*לבחור).*?(?:אפשרויות|אפשריות|כפתורים|באמצעות|הבאות)[ \t]*[:\-\|]?$/i.test(clean);
      });

      rawLines.forEach(function(line) {
        var cleanLineText = line.replace(/^["'«»“](.*)["'«»”]$/, '$1').trim();
        if (!cleanLineText) {
          if (textLines.length > 0 && textLines[textLines.length - 1] !== '') {
            textLines.push('');
          }
          return;
        }

        var isOptionHeader = /^(?:אפשרויות|אפשריות|כפתורים|בחרו?\s*אפשרות|אפשרויות\s*לבחירה|אפשריות\s*לבחירה|בחר\s*אחת\s*מהאפשרויות|אנא\s*בחר\s*מבין\s*האפשרויות|אפשרויות\s*זמינות|להלן\s*האפשרויות|תפריט|תפריט\s*ראשי|מה\s*תרצ[וה]\s*לעשות|איך\s*אפשר\s*לעזור|איך\s*נוכל\s*לסייע|נושאים\s*לבחירה|שאלות\s*נפוצות)[ \t]*[:\-\|]?$/i.test(cleanLineText) ||
          /^(?:בחר|בחרו|להלן|אנא\s*לבחור|אפשרויות\s*לבחירה|אפשריות\s*לבחירה|ניתן\s*לבחור).*?(?:אפשרויות|אפשריות|כפתורים|באמצעות|הבאות)[ \t]*[:\-\|]?$/i.test(cleanLineText);

        if (isOptionHeader) {
          inOptionsSection = true;
          return;
        }

        var isServiceButton = /^(?:משקפים?\s+לשחייה|משקפי\s+שחייה|מסגרות(?:\s+למשקפיים)?|מסגרות\s+למשקפים|עדשות\s+מגע|עדשות\s+מולטיפוקל|מולטיפוקל|קבלת\s+משקפיים\s+מוכנים|משקפי\s+שמש|רוד['’]?י\s+פרוג['’]?קט|קביעת\s+תור|קביעת\s+בדיקת\s+ראייה|איסוף\s+הזמנה|דרכי\s+הגעה|אחריות|פערי\s+מחירים(?:\s*\([^)]*\))?|שאל\s+נציג\s+אנושי)$/i.test(cleanLineText);

        var bulletMatch = line.match(/^(?:(?:\d+[\.\)-]|[\-\*•🔹▪️▫️👉▸>])|אפשרות\s*\d+\s*[:\-\|]?)\s*(.+)$/iu);
        var emojiMatch = line.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFA}])\s*(.+)$/u);

        var isShortText = cleanLineText.length > 0 && cleanLineText.length <= 90;
        var isQuestionLine = isShortText && (cleanLineText.indexOf('?') !== -1 || /^(?:איך|מה|מהי|מהם|מתי|איפה|למה|מי|האם|כיצד|אילו|איזה)\b/i.test(cleanLineText));
        var actionKeywords = /(?:לקבוע|קביעת|תיאום|תור|בדיקה|שאלות|אחרות|אחר|בירור|שיחה|נציג|אנושי|מידע|שעות|מיקום|כתובת|קטלוג|מחיר|מחירון|קנה|הזמנה|צור\s*קשר|פרטים|תפריט|עזרה|משקפ|מסגר|עדשות|שחייה|שמש|מוכנים|פרוג['’]?קט|מולטיפוקל|איסוף|אחריות|Waze|ניווט|הרשמה|רישום|אודות|שירות|קורס|אפיון|לימודים|תמיכה|ייעוץ|אופטיקה|חברתית|מרשמים|רגילים)/i;

        var isOptionLine = false;
        var candidateTitle = cleanLineText;

        if (bulletMatch && bulletMatch[1]) {
          isOptionLine = true;
          candidateTitle = bulletMatch[1].trim();
        } else if (emojiMatch && emojiMatch[2] && isShortText && !line.startsWith('✅')) {
          isOptionLine = true;
          candidateTitle = line.trim();
        } else if (inOptionsSection && isShortText && !line.startsWith('✅')) {
          isOptionLine = true;
          candidateTitle = cleanLineText;
        } else if (!hasExplicitHeader) {
          if (isQuestionLine && !line.startsWith('✅')) {
            isOptionLine = true;
            candidateTitle = cleanLineText;
          } else if (isShortText && (actionKeywords.test(cleanLineText) || isServiceButton) && !cleanLineText.startsWith('✅')) {
            isOptionLine = true;
            candidateTitle = cleanLineText;
          }
        } else if (line.indexOf('|') !== -1 && !line.startsWith('http')) {
          var parts = line.split('|');
          parts.forEach(function(p) {
            var pTitle = p.trim().replace(/^["'«»“](.*)["'«»”]$/, '$1').trim();
            if (pTitle.length > 0 && pTitle.length <= 90) {
              extractedButtons.push({
                id: 'btn_flow_' + extractedButtons.length,
                title: ensureButtonEmoji(pTitle)
              });
            }
          });
          return;
        }

        if (isOptionLine) {
          var finalTitle = candidateTitle.replace(/^["'«»“](.*)["'«»”]$/, '$1').trim();
          finalTitle = finalTitle.replace(/^(?:\d+[\.\)-]|[\-\*•])\s*/, '').trim();
          if (finalTitle.length > 0 && finalTitle.length <= 90) {
            extractedButtons.push({
              id: 'btn_flow_' + extractedButtons.length,
              title: ensureButtonEmoji(finalTitle)
            });
          }
        } else {
          textLines.push(line);
        }
      });

      while (textLines.length > 0) {
        var lastTextLine = textLines[textLines.length - 1].trim();
        if (!lastTextLine ||
            /^(?:אפשרויות|אפשריות|כפתורים|בחרו\s*אפשרות|אפשרויות\s*לבחירה|אפשריות\s*לבחירה|בחר\s*אחת\s*מהאפשרויות|אנא\s*בחר|אפשרויות\s*זמינות|להלן\s*האפשרויות|תפריט|מה\s*תרצו\s*לעשות|איך\s*אפשר\s*לעזור)[ \t]*[:\-\|]?$/i.test(lastTextLine) ||
            /^(?:בחר|בחרו|להלן|אנא\s*לבחור|אפשרויות\s*לבחירה|ניתן\s*לבחור).*?(?:אפשרויות|אפשריות|כפתורים|באמצעות|הבאות)[ \t]*[:\-\|]?$/i.test(lastTextLine)) {
          textLines.pop();
        } else {
          break;
        }
      }

      if (textLines.length > 0) {
        extractedText = textLines
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
      }

      return { text: extractedText, buttons: extractedButtons };
    };

    // 2. Extract from primary flowStr (welcomeMessage)
    var primaryRes = extractFromText(flowStr);
    welcomeText = primaryRes.text;
    if (primaryRes.buttons.length > 0) {
      buttons = buttons.concat(primaryRes.buttons);
    }

    // 3. If primary flowStr had no buttons, check secondaryFlowStr (conversationFlow)
    if (buttons.length === 0 && secondaryFlowStr) {
      var secondaryRes = extractFromText(secondaryFlowStr);
      if (secondaryRes.buttons.length > 0) {
        buttons = buttons.concat(secondaryRes.buttons);
      }
      if (!welcomeText && secondaryRes.text) {
        welcomeText = secondaryRes.text;
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

    // Limit for the opening/conversation-flow menu options.
    if (buttons.length > 10) {
      var normalizedWelcome = String(welcomeText || '')
        .toLowerCase()
        .replace(/[\u0591-\u05C7]/g, '')
        .replace(/[^\u0590-\u05ff\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      var welcomeConcepts = [
        ['בדיקת','בדיקה','ראייה','ראיה','אופטומטריסט','תור','קביעת'],
        ['מולטיפוקל','עדשות','עדשה'],
        ['מסגרת','מסגרות','משקפיים','משקפים','דגמים'],
        ['מגע'],
        ['אחריות','ציפויים'],
        ['מיקום','כתובת','הגעה','waze','ניווט','חניה','אמירים'],
        ['שעות','פתיחה','פעילות','פתוחים'],
        ['איסוף','הזמנה','מוכנים','קבלה'],
        ['מחיר','מחירים','זול','זולים','עלות','משתלם','פערי'],
        ['שמש','שחייה','שחיה'],
        ['נציג','אנושי','צביקה','טלפון','שיחה']
      ];

      var scoredWelcomeButtons = buttons.map(function(btn, index) {
        var title = String(
          btn && (btn.rawTitle || btn.title || btn.text || '')
        )
          .toLowerCase()
          .replace(/[\u0591-\u05C7]/g, '')
          .replace(/[^\u0590-\u05ff\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        var score = 0;

        if (title && normalizedWelcome.indexOf(title) !== -1) {
          score += 20;
        }

        title.split(/\s+/).forEach(function(word) {
          if (word.length >= 2 && normalizedWelcome.indexOf(word) !== -1) {
            score += 3;
          }
        });

        welcomeConcepts.forEach(function(group) {
          var titleMatch = group.some(function(word) {
            return title.indexOf(word) !== -1;
          });
          var welcomeMatch = group.some(function(word) {
            return normalizedWelcome.indexOf(word) !== -1;
          });

          if (titleMatch && welcomeMatch) score += 7;
        });

        return { button: btn, score: score, index: index };
      });

      scoredWelcomeButtons.sort(function(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      });

      // Never let a link button replace a normal menu option.
      var welcomeRegularOptions = scoredWelcomeButtons.filter(function(item) {
        return !(item.button && item.button.url);
      });

      var welcomeLinkOptions = scoredWelcomeButtons.filter(function(item) {
        return item.button && item.button.url;
      });

      var selectedWelcome = welcomeRegularOptions.slice(0, 10);

      if (selectedWelcome.length < 10) {
        selectedWelcome = selectedWelcome.concat(
          welcomeLinkOptions.slice(0, 10 - selectedWelcome.length)
        );
      }

      buttons = selectedWelcome.slice(0, 10).map(function(item) {
        return item.button;
      });
    }

    if (!welcomeText) {
      welcomeText = 'ברוכים הבאים ל-' + (fallbackTitle || 'העסק שלנו') + '. במה אוכל לעזור לך היום?';
    }

    welcomeText = formatPersonalGreeting(welcomeText);

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
      bottom: 70px;
      right: 0;
      width: 400px;
      max-width: calc(100vw - 20px);
      height: 650px;
      max-height: calc(100vh - 84px);
      background: #ffffff;
      border-radius: 22px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.22);
      border: 1px solid #cbd5e1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: bottom right;
      direction: rtl;
      text-align: right;
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
      padding: 10px 14px;
      min-height: 58px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      direction: rtl;
      text-align: right;
    }
    .obw-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: right;
      direction: rtl;
    }
    .obw-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      flex-shrink: 0;
    }
    .obw-avatar svg {
      width: 31px;
      height: 22px;
    }

    .obw-avatar .obw-glasses-logo {
      display: block;
    }
    .obw-title-group {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      width: max-content;
      max-width: calc(100% - 130px);
      direction: rtl;
    }
    .obw-title {
      font-weight: 700;
      font-size: 17px;
      margin: 0;
      line-height: 1.15;
      color: #ffffff;
      letter-spacing: -0.3px;
      text-align: right;
      direction: rtl;
    }
    .obw-subtitle {
      font-size: 11.5px;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.9);
      margin: 3px 0 0 0;
      line-height: 1.15;
      text-align: right;
      direction: rtl;
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
      min-height: 0;
      padding: 9px 10px;
      overflow-y: auto;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 6px;
      direction: rtl;
      text-align: right;
    }
    .obw-messages,
    .obw-messages * {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Hebrew", Arial, sans-serif;
    }

    .obw-msg {
      max-width: 95%;
      padding: 9px 12px;
      border-radius: 14px;
      font-size: 12.8px;
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-wrap;
      font-weight: 400;
      letter-spacing: -0.05px;
      direction: rtl;
      text-align: right;
    }
    .obw-msg-bot {
      align-self: flex-start;
      background: #ffffff;
      color: #384860;
      border: 2px solid #cfd9f8;
      border-bottom-right-radius: 6px;
      box-shadow: 0 1px 3px rgba(60, 80, 130, 0.05);
      font-weight: 400;
      direction: rtl;
      text-align: right;
    }
    .obw-msg-lead {
      color: #314d73;
      font-weight: 550;
      letter-spacing: -0.05px;
      direction: rtl;
      text-align: right;
    }

    /* Opening/welcome message: spacious line rhythm */
    .obw-msg.obw-opening-msg {
      line-height: 1.55;
      font-weight: 400;
      direction: rtl;
      text-align: right;
      padding: 10px 13px;
    }

    /* Opening screen: a little extra breathing room before the six options. */
    .obw-msg.obw-opening-msg .obw-buttons-container {
      padding-top: 18px;
    }

    .obw-msg.obw-opening-msg > div {
      margin: 0;
      padding: 0;
      direction: rtl;
      text-align: right;
    }

    .obw-msg.obw-opening-msg .obw-msg-bullet {
      margin: 2px 0;
    }

    .obw-msg-bullet {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      margin: 2px 0;
      padding-right: 0;
      direction: rtl;
      text-align: right;
    }

    .obw-msg-bullet-mark {
      flex: 0 0 auto;
      color: #2f6fa3;
      font-weight: 600;
      font-size: 13.5px;
      line-height: 1.4;
      direction: rtl;
      text-align: right;
    }

    .obw-msg-bullet-text {
      flex: 1 1 auto;
      min-width: 0;
      font-weight: 400;
      direction: rtl;
      text-align: right;
      line-height: 1.45;
    }

    .obw-msg-user {
      align-self: flex-end;
      max-width: 78%;
      background: #eef4fb;
      color: #475569;
      border: 1px solid #dbe5f0;
      border-bottom-left-radius: 4px;
      padding: 6px 9px;
      font-size: 12px;
      font-weight: 400;
      direction: rtl;
      text-align: right;
    }
    .obw-msg-time {
      display: none !important;
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
      width: 96%;
      max-width: 96%;
    }
    .obw-buttons-container {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px 8px;
      margin-top: 0;
      padding-top: 18px;
      width: 100%;
      box-sizing: border-box;
      direction: rtl;
      align-items: stretch;
    }

    .obw-btn-action {
      background: #ffffff;
      color: #3158d8;
      border: 1px solid #c3cef8;
      padding: 6px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 4px;
      width: 100%;
      min-height: 30px;
      max-width: 100%;
      box-sizing: border-box;
      line-height: 1.2;
      word-break: break-word;
      box-shadow: 0 1px 2px rgba(49, 88, 216, 0.05);
    }

    .obw-btn-action:hover {
      background: #eef2ff;
      color: #2448c7;
      border-color: #526fe0;
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(63, 88, 190, 0.14);
    }

    .obw-btn-link {
      background: #ffffff !important;
      color: #3158d8 !important;
      border: 1px solid #c3cef8 !important;
      padding: 6px 8px !important;
      border-radius: 12px !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      text-decoration: none !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 4px !important;
      box-shadow: 0 1px 2px rgba(49, 88, 216, 0.05) !important;
      transition: all 0.15s ease !important;
      width: 100% !important;
      min-height: 30px !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    .obw-btn-link:hover {
      background: #eef2ff !important;
      color: #2448c7 !important;
      border-color: #526fe0 !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 2px 6px rgba(63, 88, 190, 0.14) !important;
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
      padding: 7px 9px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .obw-input {
      flex: 1;
      border: 2px solid #b8c6f4;
      padding: 7px 10px;
      border-radius: 11px;
      font-size: 12.5px;
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
      border-radius: 10px;
      padding: 7px 12px;
      font-weight: 600;
      font-size: 12px;
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
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 4px 10px;
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
    /* Mobile: use almost the full viewport so the answer and options remain visible. */
    @media (max-width: 600px) {
      .obw-window {
        right: 4%;
        bottom: 14px;
        width: 92vw;
        max-width: 400px;
        height: 60vh;
        max-height: 60vh;
        min-height: 0;
        border-radius: 18px;
      }

      .obw-header {
        min-height: 48px;
        padding: 6px 9px;
      }

      .obw-avatar {
        width: 38px;
        height: 38px;
      }

      .obw-avatar .obw-glasses-logo {
        width: 29px;
        height: 21px;
      }

      .obw-title-group {
        max-width: calc(100% - 105px);
      }

      .obw-title {
        font-size: 16px;
      }

      .obw-subtitle {
        font-size: 11px;
      }

      .obw-messages {
        padding: 6px 7px;
        gap: 4px;
        min-height: 0;
      }

      .obw-msg {
        font-size: 11.5px;
        line-height: 1.3;
        padding: 5px 8px;
        font-weight: 400;
      }

      .obw-msg-bot {
        background: #f5f9ff;
        color: #24415f;
        border-color: #c9d9ea;
        font-weight: 500;
      }

      .obw-msg-lead {
        color: #173f68;
        font-weight: 650;
      }

      .obw-msg-has-buttons {
        width: 97%;
        max-width: 97%;
      }

      .obw-buttons-container {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 5px 7px;
        margin-top: 0;
        padding-top: 16px;
      }

      .obw-btn-action,
      .obw-btn-link {
        font-size: 10.5px !important;
        min-height: 29px !important;
        padding: 4px 6px !important;
        border-width: 2px !important;
        border-radius: 14px !important;
      }

      .obw-msg-bot {
        background: #ffffff;
        color: #30435b;
        border-color: #cfd9f8;
      }

      .obw-msg.obw-opening-msg .obw-buttons-container {
        padding-top: 20px;
      }

      .obw-footer {
        padding: 5px 6px;
      }

      .obw-input {
        padding: 5px 8px;
        font-size: 11.5px;
      }

      .obw-send-btn {
        padding: 5px 9px;
        font-size: 11px;
      }
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
            <!-- Eyeglasses logo -->
            <svg class="obw-glasses-logo" width="32" height="22" viewBox="0 0 32 22" fill="none" aria-hidden="true">
              <path d="M2.2 6.2C2.45 4.75 3.55 3.8 5 3.8H11.1C12.65 3.8 13.75 4.75 14.05 6.2L14.65 9.35C14.95 10.95 13.85 12.45 12.25 12.7L8.2 13.35C6.15 13.7 4.45 12.35 4.1 10.35L2.2 6.2Z"
                    stroke="#1f5ed6" stroke-width="1.9" stroke-linejoin="round"/>
              <path d="M29.8 6.2C29.55 4.75 28.45 3.8 27 3.8H20.9C19.35 3.8 18.25 4.75 17.95 6.2L17.35 9.35C17.05 10.95 18.15 12.45 19.75 12.7L23.8 13.35C25.85 13.7 27.55 12.35 27.9 10.35L29.8 6.2Z"
                    stroke="#1f5ed6" stroke-width="1.9" stroke-linejoin="round"/>
              <path d="M14.1 6.2C14.85 5.45 17.15 5.45 17.9 6.2"
                    stroke="#1f5ed6" stroke-width="1.9" stroke-linecap="round"/>
              <path d="M2.6 6.1L1.1 5.1M29.4 6.1L30.9 5.1"
                    stroke="#1f5ed6" stroke-width="1.9" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="obw-title-group">
            <div class="obw-title" id="obw-header-main-title">${headerTitles.main}</div>
            <div class="obw-subtitle" id="obw-header-sub-title" style="${headerTitles.sub ? '' : 'display:none;'}">${headerTitles.sub}</div>
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

  // Initial welcome message from welcomeMessage or conversation flow
  var initialFlow = parseConversationFlow(welcomeMessage, botTitle, conversationFlow, customOptions);
  var messages = [
    {
      id: 'welcome_1',
      sender: 'bot',
      text: initialFlow.text,
      buttons: initialFlow.buttons,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];



  var renderMessages = function() {
    messagesBox.innerHTML = '';
    messages.forEach(function(msg) {
      var msgDiv = document.createElement('div');
      msgDiv.className = 'obw-msg ' +
        (msg.sender === 'user' ? 'obw-msg-user' : 'obw-msg-bot') +
        ((msg.sender !== 'user' && messages.indexOf(msg) === 0) ? ' obw-opening-msg' : '');

      var textSpan = document.createElement('div');
      var rawText = msg.text || '';

      if (msg.sender !== 'user' && messages.indexOf(msg) === 0) {
        rawText = String(rawText)
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      var escapeHtml = function(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };

      var formatTextWithInlineButtons = function(str) {
        if (!str) return '';
        var lines = str.split('\n');
        var formattedLines = lines.map(function(line) {
          var trimmedLine = line.trim();

          // Support clean bullet formatting:
          // - item
          // • item
          // * item
          // numbered items such as 1. item
          var bulletMatch = trimmedLine.match(
            /^(?:[-*•▪▫‣▸►]|(?:\d+)[.)])\s+(.+)$/u
          );

          var emojiBulletMatch = trimmedLine.match(
            /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFA}\u{2700}-\u{27BF}])\s*(.+)$/u
          );

          if (bulletMatch) {
            var originalMarkMatch = trimmedLine.match(
              /^(?:[-*•▪▫‣▸►]|(?:\d+)[.)])\s+/u
            );

            var bulletMark = originalMarkMatch ? originalMarkMatch[0].trim() : '•';
            var bulletText = bulletMatch[1].trim();

            if (/^[-*•▪▫‣▸►]$/.test(bulletMark)) {
              bulletMark = '•';
            }

            var formattedBulletText = escapeHtml(bulletText);

            if (/(https?:\/\/[^\s<]+|wa\.me\/[^\s<]+)/i.test(bulletText)) {
              formattedBulletText = formatTextWithInlineButtons(bulletText);
            }

            return '<div class="obw-msg-bullet">' +
              '<span class="obw-msg-bullet-mark">' + escapeHtml(bulletMark) + '</span>' +
              '<span class="obw-msg-bullet-text">' + formattedBulletText + '</span>' +
              '</div>';
          }

          if (emojiBulletMatch) {
            var emojiMark = emojiBulletMatch[1];
            var emojiText = emojiBulletMatch[2].trim();
            var formattedEmojiText = escapeHtml(emojiText);

            if (/(https?:\/\/[^\s<]+|wa\.me\/[^\s<]+)/i.test(emojiText)) {
              formattedEmojiText = formatTextWithInlineButtons(emojiText);
            }

            return '<div class="obw-msg-bullet">' +
              '<span class="obw-msg-bullet-mark">' + escapeHtml(emojiMark) + '</span>' +
              '<span class="obw-msg-bullet-text">' + formattedEmojiText + '</span>' +
              '</div>';
          }

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

        var joinFormattedLines = function(lines) {
          var result = '';
          for (var i = 0; i < lines.length; i++) {
            var curr = lines[i];
            if (i > 0) {
              var prev = lines[i - 1];
              var prevIsBlock = /^<div/i.test(prev.trim()) || /<\/div>$/i.test(prev.trim());
              var currIsBlock = /^<div/i.test(curr.trim());

              if (!prevIsBlock && !currIsBlock) {
                result += '<br/>';
              }
            }
            result += curr;
          }
          return result;
        };

        var formatted = joinFormattedLines(formattedLines);

        // Professional visual hierarchy:
        // emphasize only the first line/sentence, while keeping the rest
        // medium-weight and easy to read.
        if (msg.sender !== 'user' && formattedLines.length > 0) {
          var firstNonEmptyIndex = -1;

          for (var lineIndex = 0; lineIndex < formattedLines.length; lineIndex++) {
            if (formattedLines[lineIndex].replace(/<[^>]*>/g, '').trim()) {
              firstNonEmptyIndex = lineIndex;
              break;
            }
          }

          if (firstNonEmptyIndex === 0) {
            formattedLines[0] =
              '<span class="obw-msg-lead">' + formattedLines[0] + '</span>';
            formatted = joinFormattedLines(formattedLines);
          }
        }

        return formatted;
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
              handleSendMessage(btn.rawTitle || btn.title, btn.id);
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

  // Robust n8n response parser
  // Supports:
  // - n8n arrays: [{ json: {...} }]
  // - output/reply/response containing JSON as a string
  // - ```json ... ``` and `json ... ` wrappers
  // - reply + list_options.options
  // - buttons / rows / sections / choices
  // - WhatsApp payloads (text, image, interactive)
  // - direct image/imageUrl fields
  // - URLs inside reply text
  var parseN8nResponse = function(rawData) {
    var replyText = '';
    var imageUrl = null;
    var buttons = [];

    var cleanString = function(value) {
      if (typeof value !== 'string') return value;
      return value.trim();
    };

    var tryParseJsonString = function(value) {
      if (typeof value !== 'string') return value;

      var original = value.trim();
      if (!original) return value;

      var candidates = [];

      var addCandidate = function(s) {
        if (typeof s !== 'string') return;
        s = s.trim();
        if (s && candidates.indexOf(s) === -1) candidates.push(s);
      };

      addCandidate(original);

      // Remove common Markdown code fences/backticks.
      var stripped = original
        .replace(/^```(?:json|javascript|js)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();

      stripped = stripped
        .replace(/^`(?:json|javascript|js)?\s*/i, '')
        .replace(/\s*`\s*$/i, '')
        .trim();

      addCandidate(stripped);

      // Remove a leading "json" marker.
      addCandidate(stripped.replace(/^json\s*/i, '').trim());

      // Extract the outermost JSON object/array if there is surrounding text.
      var firstObj = stripped.indexOf('{');
      var lastObj = stripped.lastIndexOf('}');
      if (firstObj !== -1 && lastObj > firstObj) {
        addCandidate(stripped.substring(firstObj, lastObj + 1));
      }

      var firstArr = stripped.indexOf('[');
      var lastArr = stripped.lastIndexOf(']');
      if (firstArr !== -1 && lastArr > firstArr) {
        addCandidate(stripped.substring(firstArr, lastArr + 1));
      }

      // Also try a decoded version for strings containing escaped JSON.
      var decoded = stripped
        .replace(/\r\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');

      addCandidate(decoded);

      var firstDecodedObj = decoded.indexOf('{');
      var lastDecodedObj = decoded.lastIndexOf('}');
      if (firstDecodedObj !== -1 && lastDecodedObj > firstDecodedObj) {
        addCandidate(decoded.substring(firstDecodedObj, lastDecodedObj + 1));
      }

      for (var i = 0; i < candidates.length; i++) {
        try {
          var parsed = JSON.parse(candidates[i]);
          if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
            return parsed;
          }
        } catch (e) {}
      }

      return value;
    };

    var normalizeNode = function(value) {
      var current = value;
      var guard = 0;

      // Unwrap JSON strings repeatedly, e.g.
      // { output: "`json {...}`" } -> { ... }
      while (typeof current === 'string' && guard < 4) {
        var parsed = tryParseJsonString(current);
        if (parsed === current) break;
        current = parsed;
        guard++;
      }

      return current;
    };

    var addCandidateButton = function(btnObj) {
      if (!btnObj) return;

      var bTitle = '';
      var bId = null;
      var bUrl = null;

      if (typeof btnObj === 'string') {
        bTitle = btnObj.trim();
      } else if (typeof btnObj === 'object') {
        bTitle =
          btnObj.title ||
          btnObj.text ||
          btnObj.label ||
          btnObj.name ||
          btnObj.value ||
          btnObj.description ||
          (btnObj.reply && (btnObj.reply.title || btnObj.reply.text)) ||
          (btnObj.header && btnObj.header.text) ||
          (btnObj.action && (btnObj.action.label || btnObj.action.text));

        bId =
          btnObj.id ||
          btnObj.row_id ||
          btnObj.key ||
          btnObj.value_id ||
          (btnObj.reply && btnObj.reply.id);

        bUrl =
          btnObj.url ||
          btnObj.link ||
          btnObj.href ||
          btnObj.uri ||
          (btnObj.action && (btnObj.action.url || btnObj.action.link)) ||
          (btnObj.parameters && (btnObj.parameters.url || btnObj.parameters.link));

        // WhatsApp button format:
        // { reply: { id: "...", title: "..." } }
        if (btnObj.reply && typeof btnObj.reply === 'object') {
          bId = bId || btnObj.reply.id;
          bTitle = bTitle || btnObj.reply.title;
        }

        // WhatsApp URL button format:
        // { type: "url", url: "...", title: "..." }
        if (!bUrl && btnObj.type === 'url') {
          bUrl = btnObj.url || btnObj.link;
        }
      }

      if (typeof bTitle === 'string') {
        bTitle = bTitle.trim();

        if (/^https?:\/\//i.test(bTitle) || /^wa\.me\//i.test(bTitle)) {
          if (!bUrl) {
            bUrl = bTitle.startsWith('wa.me') ? 'https://' + bTitle : bTitle;
          }
          bTitle = 'מעבר לקישור 🌐';
        }
      }

      if (bTitle || bUrl) {
        if (!bTitle) bTitle = 'מעבר לקישור';

        var normalizeForDedup = function(s) {
          return String(s || '')
            .replace(/[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFA}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
            .replace(/[^\u0590-\u05FFa-zA-Z0-9]+/g, '')
            .toLowerCase()
            .trim();
        };
        var normalizedNewTitle = normalizeForDedup(bTitle);

        var exists = buttons.some(function(existing) {
          return (
            existing.title === bTitle ||
            (normalizedNewTitle && normalizeForDedup(existing.title) === normalizedNewTitle) ||
            (bUrl && existing.url === bUrl) ||
            (bId && existing.id === bId)
          );
        });

        if (!exists) {
          buttons.push({
            id: bId || ('btn_' + buttons.length + '_' + Date.now().toString(36)),
            title: addButtonEmoji(bTitle, bUrl),
            rawTitle: bTitle,
            url: bUrl || null
          });
        }
      }
    };

    var addButtonEmoji = function(title, url) {
      if (!title) return url ? '🌐 מעבר לקישור' : '🔹 אפשרות';

      var value = String(title).trim();

      if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(value)) {
        return value;
      }

      var lower = value.toLowerCase();

      if (url || /http|קישור|לינק|אתר|דף/.test(lower)) return '🌐 ' + value;
      if (/וואטסאפ|ווטסאפ|whatsapp/.test(lower)) return '📱 ' + value;
      if (/בדיק|תור|תיאום|פגישה|יומן|תאריך|קביעת/.test(lower)) return '📅 ' + value;
      if (/מולטיפוקל|עדשות|משקפ|מסגר|קטלוג|מוצר|מחיר|חנות/.test(lower)) return '👓 ' + value;
      if (/שעות|זמן|פעילות|מתי/.test(lower)) return '⏰ ' + value;
      if (/מיקום|כתובת|ניווט|מפה|waze|הגעה|דרכי הגעה/.test(lower)) return '📍 ' + value;
      if (/נציג|אנושי|טלפון|שיחה|שאל/.test(lower)) return '📞 ' + value;
      if (/אחריות/.test(lower)) return '🛡️ ' + value;
      if (/איסוף|הזמנה/.test(lower)) return '📦 ' + value;
      if (/תשלום|אשראי|ביט|קנה/.test(lower)) return '💳 ' + value;
      if (/מידע|עזרה|שאלה|פרטים/.test(lower)) return '💡 ' + value;

      return '🔹 ' + value;
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

        var rows =
          sec.rows ||
          sec.items ||
          sec.options ||
          sec.list ||
          sec.list_items ||
          sec.choices;

        if (Array.isArray(rows)) {
          parseRowsOrItems(rows);
        }
      });
    };

    var extractImage = function(obj) {
      if (!obj || typeof obj !== 'object') return null;

      var candidates = [
        obj.imageUrl,
        obj.image_url,
        obj.image,
        obj.mediaUrl,
        obj.media_url,
        obj.picture,
        obj.photo
      ];

      for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i];

        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim();
        }

        if (candidate && typeof candidate === 'object') {
          var nested =
            candidate.url ||
            candidate.link ||
            candidate.src ||
            candidate.href;

          if (typeof nested === 'string' && nested.trim()) {
            return nested.trim();
          }
        }
      }

      return null;
    };

    var extractTextFromObject = function(obj) {
      if (!obj || typeof obj !== 'object') return '';

      var candidates = [
        obj.reply,
        obj.body,
        obj.text,
        obj.content,
        obj.caption,
        obj.message
      ];

      for (var i = 0; i < candidates.length; i++) {
        var value = candidates[i];

        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }

        if (value && typeof value === 'object') {
          var nested =
            value.body ||
            value.text ||
            value.content ||
            value.caption;

          if (typeof nested === 'string' && nested.trim()) {
            return nested.trim();
          }
        }
      }

      return '';
    };

    var parseStructuredObject = function(obj) {
      if (!obj || typeof obj !== 'object') return;

      // First unwrap common nested fields if they themselves contain JSON.
      var nestedFields = ['output', 'reply', 'response', 'data', 'result'];

      nestedFields.forEach(function(field) {
        if (typeof obj[field] === 'string') {
          var parsedNested = normalizeNode(obj[field]);

          if (
            parsedNested &&
            typeof parsedNested === 'object' &&
            parsedNested !== obj[field]
          ) {
            parseStructuredObject(parsedNested);
          }
        }
      });

      // Direct reply text.
      if (!replyText) {
        var directText =
          obj.reply ||
          obj.text ||
          obj.body ||
          obj.content ||
          obj.caption;

        if (typeof directText === 'string') {
          var parsedDirect = normalizeNode(directText);

          if (parsedDirect && typeof parsedDirect === 'object') {
            parseStructuredObject(parsedDirect);
          } else if (directText.trim()) {
            replyText = directText.trim();
          }
        }
      }

      // Generic message object.
      if (obj.message) {
        if (typeof obj.message === 'string' && !replyText) {
          var parsedMessage = normalizeNode(obj.message);

          if (parsedMessage && typeof parsedMessage === 'object') {
            parseStructuredObject(parsedMessage);
          } else {
            replyText = obj.message.trim();
          }
        } else if (obj.message && typeof obj.message === 'object') {
          parseStructuredObject(obj.message);
        }
      }

      // list_options: { list_title, options: [...] }
      if (obj.list_options) {
        var listOptions = normalizeNode(obj.list_options);

        if (Array.isArray(listOptions)) {
          parseRowsOrItems(listOptions);
        } else if (listOptions && typeof listOptions === 'object') {
          var optionArray =
            listOptions.options ||
            listOptions.items ||
            listOptions.rows ||
            listOptions.choices ||
            listOptions.list_items;

          if (Array.isArray(optionArray)) {
            parseRowsOrItems(optionArray);
          }

          // Support list_options.sections: [{ options: [...] }] or [{ rows: [...] }]
          if (Array.isArray(listOptions.sections)) {
            parseSections(listOptions.sections);
          }

          // Some formats put the title as a header.
          if (!replyText && typeof listOptions.list_title === 'string') {
            // Do not use list_title as the customer reply.
            // It is only the button/list title.
          }
        }
      }

      // Common interactive structures.
      if (Array.isArray(obj.buttons)) parseRowsOrItems(obj.buttons);
      if (Array.isArray(obj.options)) parseRowsOrItems(obj.options);
      if (Array.isArray(obj.choices)) parseRowsOrItems(obj.choices);
      if (Array.isArray(obj.rows)) parseRowsOrItems(obj.rows);
      if (Array.isArray(obj.items)) parseRowsOrItems(obj.items);
      if (Array.isArray(obj.list)) parseRowsOrItems(obj.list);
      if (Array.isArray(obj.sections)) parseSections(obj.sections);

      if (obj.list_options && typeof obj.list_options === 'object') {
        if (Array.isArray(obj.list_options.sections)) {
          parseSections(obj.list_options.sections);
        }
        if (Array.isArray(obj.list_options.buttons)) {
          parseRowsOrItems(obj.list_options.buttons);
        }
      }

      // WhatsApp payload.
      if (obj.whatsapp_payload) {
        var wp = normalizeNode(obj.whatsapp_payload);

        if (wp && typeof wp === 'object') {
          // Actual structure supplied by the user's webhook:
          // whatsapp_payload.type = "text"
          // whatsapp_payload.text.body = "..."
          if (wp.text && typeof wp.text === 'object') {
            if (!replyText && typeof wp.text.body === 'string') {
              replyText = wp.text.body.trim();
            }
          }

          if (wp.body && typeof wp.body === 'string' && !replyText) {
            replyText = wp.body.trim();
          }

          if (wp.caption && typeof wp.caption === 'string' && !replyText) {
            replyText = wp.caption.trim();
          }

          // Image directly in whatsapp_payload.
          var wpImage = extractImage(wp);
          if (wpImage && !imageUrl) {
            imageUrl = wpImage;
          }

          // Support direct whatsapp_payload.interactive (LIST / BUTTON)
          if (wp.interactive) {
            var directInteractive = normalizeNode(wp.interactive);

            if (directInteractive && typeof directInteractive === 'object') {
              if (directInteractive.body && typeof directInteractive.body.text === 'string' && !replyText) {
                replyText = directInteractive.body.text.trim();
              }

              var directAction = directInteractive.action || {};

              if (Array.isArray(directAction.buttons)) {
                parseRowsOrItems(directAction.buttons);
              }

              if (Array.isArray(directAction.sections)) {
                parseSections(directAction.sections);
              }

              if (Array.isArray(directAction.rows)) {
                parseRowsOrItems(directAction.rows);
              }
            }
          }

          // WhatsApp interactive message.
          if (wp.message) {
            var wpm = normalizeNode(wp.message);

            if (wpm && typeof wpm === 'object') {
              parseStructuredObject(wpm);

              if (wpm.interactive) {
                var interactive = normalizeNode(wpm.interactive);

                if (interactive && typeof interactive === 'object') {
                  if (
                    interactive.body &&
                    typeof interactive.body.text === 'string' &&
                    !replyText
                  ) {
                    replyText = interactive.body.text.trim();
                  }

                  if (
                    interactive.header &&
                    typeof interactive.header.text === 'string' &&
                    !replyText
                  ) {
                    replyText = interactive.header.text.trim();
                  }

                  var action = interactive.action || {};

                  if (Array.isArray(action.buttons)) {
                    parseRowsOrItems(action.buttons);
                  }

                  if (Array.isArray(action.sections)) {
                    parseSections(action.sections);
                  }

                  if (Array.isArray(action.rows)) {
                    parseRowsOrItems(action.rows);
                  }
                }
              }
            }
          }
        }
      }

      // Generic image support.
      var objImage = extractImage(obj);
      if (objImage && !imageUrl) {
        imageUrl = objImage;
      }

      // If output itself is a JSON string, parse it.
      if (typeof obj.output === 'string') {
        var parsedOutput = normalizeNode(obj.output);

        if (
          parsedOutput &&
          typeof parsedOutput === 'object' &&
          parsedOutput !== obj.output
        ) {
          parseStructuredObject(parsedOutput);
        } else if (!replyText && obj.output.trim()) {
          // Only use output as text if it is genuinely plain text,
          // not a failed JSON string.
          var looksLikeJson =
            obj.output.indexOf('{') !== -1 ||
            obj.output.indexOf('[') !== -1 ||
            /```|`json/i.test(obj.output);

          if (!looksLikeJson) {
            replyText = obj.output.trim();
          }
        }
      }
    };

    var items = Array.isArray(rawData) ? rawData : [rawData];

    items.forEach(function(item) {
      if (!item) return;

      var node = item;

      // n8n Webhook commonly returns [{ json: {...} }]
      if (item.json !== undefined) {
        node = item.json;
      }

      node = normalizeNode(node);

      // If the entire node is a JSON string, parse it.
      if (typeof node === 'string') {
        var parsedNode = normalizeNode(node);

        if (parsedNode && typeof parsedNode === 'object') {
          node = parsedNode;
        } else {
          if (!replyText && node.trim()) {
            replyText = node.trim();
          }
          return;
        }
      }

      if (node && typeof node === 'object') {
        parseStructuredObject(node);
      }
    });

    // Convert URLs in the response into buttons.
    if (replyText) {
      var matchedUrls = replyText.match(
        /(https?:\/\/[^\s<>'"`]+|wa\.me\/[^\s<>'"`]+)/gi
      );

      if (matchedUrls && matchedUrls.length > 0) {
        matchedUrls.forEach(function(rawUrl) {
          var cleanUrl = rawUrl.startsWith('wa.me')
            ? 'https://' + rawUrl
            : rawUrl;

          addCandidateButton({
            title: 'לחץ למעבר לקישור 🌐',
            url: cleanUrl
          });
        });
      }
    }

    // Limit the UI to a maximum of 6 buttons.
    // When more than 6 are supplied/discovered, prioritize buttons that are
    // actually related to the current reply. Original order is used as the
    // final tie-breaker so the agent's preferred ordering is preserved.
    var selectRelevantButtons = function(reply, candidateButtons) {
      if (!Array.isArray(candidateButtons) || candidateButtons.length <= 6) {
        return candidateButtons || [];
      }

      var replyTextForScore = String(reply || '').toLowerCase();

      // Normalize Hebrew/Latin text for matching.
      var normalizeForMatch = function(value) {
        return String(value || '')
          .toLowerCase()
          .replace(/[\u0591-\u05C7]/g, '')
          .replace(/[^\u0590-\u05ff\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      var normalizedReply = normalizeForMatch(replyTextForScore);

      // Common stop words should not make unrelated buttons look relevant.
      var stopWords = {
        'של':1,'על':1,'עם':1,'את':1,'אל':1,'או':1,'גם':1,'אם':1,'לא':1,
        'יש':1,'זה':1,'זו':1,'הוא':1,'היא':1,'אני':1,'אנחנו':1,'אתם':1,
        'אתן':1,'מה':1,'איך':1,'למה':1,'לכם':1,'לכן':1,'כאן':1,'שם':1,
        'כדי':1,'אפשר':1,'ניתן':1,'רוצים':1,'רוצה':1,'מידע':1,'עוד':1,
        'בכל':1,'כל':1,'דרך':1,'דרכי':1,'ישנו':1,'אצלנו':1
      };

      var replyWords = normalizedReply.split(/\s+/).filter(function(word) {
        return word.length >= 2 && !stopWords[word];
      });

      // Related concepts get a stronger score than generic word overlap.
      var conceptGroups = [
        { words: ['בדיקת','בדיקה','אופטומטריסט','ראייה','ראיה','תור','קביעת','פגישה'], score: 7 },
        { words: ['מולטיפוקל','מולטיפוקליים','עדשות','עדשה'], score: 7 },
        { words: ['מסגרת','מסגרות','משקפיים','משקפים','דגמים'], score: 7 },
        { words: ['מגע','עדשות'], score: 7 },
        { words: ['אחריות','אחריותנו','ציפויים'], score: 7 },
        { words: ['מיקום','כתובת','הגעה','waze','ניווט','חניה','אמירים'], score: 7 },
        { words: ['שעות','פתיחה','פעילות','פתוחים'], score: 7 },
        { words: ['איסוף','הזמנה','מוכנים','קבלה'], score: 7 },
        { words: ['מחיר','מחירים','זול','זולים','עלות','משתלם','פערי'], score: 7 },
        { words: ['שמש','שחייה','שחיה'], score: 7 },
        { words: ['נציג','אנושי','צביקה','טלפון','שיחה'], score: 7 }
      ];

      var getTitleForMatch = function(button) {
        return normalizeForMatch(
          button && (button.rawTitle || button.title || button.text || '')
        );
      };

      var scoreButton = function(button, index) {
        var title = getTitleForMatch(button);
        if (!title) return { button: button, score: -1000, index: index };

        var score = 0;

        // A URL button generated from the current reply is highly relevant.
        if (button && button.url && normalizedReply.indexOf(normalizeForMatch(button.url)) !== -1) {
          score += 20;
        }

        // Exact title/phrase match is the strongest textual signal.
        if (title.length >= 3 && normalizedReply.indexOf(title) !== -1) {
          score += 18;
        }

        var titleWords = title.split(/\s+/).filter(function(word) {
          return word.length >= 2 && !stopWords[word];
        });

        titleWords.forEach(function(word) {
          if (normalizedReply.indexOf(word) !== -1) {
            score += 4;
          }
        });

        // Match broader service concepts even when wording differs.
        conceptGroups.forEach(function(group) {
          var titleHasConcept = group.words.some(function(word) {
            return title.indexOf(word) !== -1;
          });

          var replyHasConcept = group.words.some(function(word) {
            return normalizedReply.indexOf(word) !== -1;
          });

          if (titleHasConcept && replyHasConcept) {
            score += group.score;
          }
        });

        // Small relevance boost for a meaningful word overlap.
        var overlapCount = titleWords.filter(function(word) {
          return replyWords.indexOf(word) !== -1;
        }).length;

        score += Math.min(overlapCount * 2, 8);

        // Preserve original agent order for equal/near-equal relevance.
        return {
          button: button,
          score: score,
          index: index
        };
      };

      var scored = candidateButtons.map(scoreButton);

      scored.sort(function(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      });

      // Keep the six actual menu options whenever six real options exist.
      // A URL/link button should not displace a normal option. Links in the
      // message body are rendered separately and never count toward the six.
      var regularOptions = scored.filter(function(item) {
        return !(item.button && item.button.url);
      });

      var linkOptions = scored.filter(function(item) {
        return item.button && item.button.url;
      });

      var selected = regularOptions.slice(0, 6);

      // Only use a URL button to fill a missing slot if fewer than 6 normal
      // options were actually supplied by the agent.
      if (selected.length < 6) {
        selected = selected.concat(linkOptions.slice(0, 6 - selected.length));
      }

      return selected.slice(0, 6).map(function(item) {
        return item.button;
      });
    };

    if (!replyText && buttons.length > 0) {
      replyText = 'אנא בחר מתוך האפשרויות הבאות:';
    }

    // Never show more than 6 options in the widget.
    buttons = selectRelevantButtons(replyText, buttons);

    return {
      replyText: replyText,
      imageUrl: imageUrl,
      buttons: buttons
    };
  };

  var handleSendMessage = function(textToSend, buttonId) {
    var userText = textToSend || inputEl.value.trim();
    if (!userText) return;

    inputEl.value = '';

    var detectedPhone = extractPhoneFromUserText(userText);
    if (detectedPhone) {
      setUserPhone(detectedPhone);
    }

    // A button/menu selection is NOT a customer name.
    // Only inspect free-typed customer text for a name.
    if (!buttonId) {
      var detectedName = extractNameFromUserText(userText);
      if (detectedName) {
        setUserName(detectedName);
      }
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
    if (newConfig.welcomeMessage !== undefined) welcomeMessage = newConfig.welcomeMessage;
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

    var updatedFlow = parseConversationFlow(welcomeMessage, botTitle, conversationFlow, customOptions);

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

  // Helper to apply newly fetched bot config
  var applyFetchedBotConfig = function(data) {
    if (!data) return;
    var hasChanges = false;
    if (data.welcomeMessage && data.welcomeMessage !== welcomeMessage) {
      welcomeMessage = data.welcomeMessage;
      hasChanges = true;
    }
    if (data.conversationFlow && data.conversationFlow !== conversationFlow) {
      conversationFlow = data.conversationFlow;
      hasChanges = true;
    }
    if (data.title && data.title !== botTitle) {
      botTitle = data.title;
      hasChanges = true;
    }
    if (data.whatsappNumber && data.whatsappNumber !== whatsappNumber) {
      whatsappNumber = data.whatsappNumber;
      hasChanges = true;
    }

    if (hasChanges && typeof window.OpticsBotWidgetUpdate === 'function') {
      window.OpticsBotWidgetUpdate({
        botId: botId,
        title: botTitle,
        whatsappNumber: whatsappNumber,
        welcomeMessage: welcomeMessage,
        conversationFlow: conversationFlow
      });
    }
  };

  // Fetch dynamic bot config from database endpoint or fallback to n8n webhook
  var fetchBotConfigFromDatabase = function() {
    if (!botId) return;

    var origin = '';
    if (currentScript && currentScript.src) {
      try {
        origin = new URL(currentScript.src).origin;
      } catch (e) {}
    }

    var endpoint = (origin ? origin : '') + '/api/public/bot-config?bot_id=' + encodeURIComponent(botId);

    fetch(endpoint)
      .then(function(res) {
        if (!res.ok) throw new Error('Local fetch failed');
        return res.json();
      })
      .then(function(data) {
        if (!data) throw new Error('Empty local response');
        applyFetchedBotConfig(data);
      })
      .catch(function(err) {
        // Fallback: fetch directly from n8n GET webhook using botId parameter
        var n8nGetUrl = 'https://n8n.srv1239769.hstgr.cloud/webhook/eacddf0e-4128-4097-8d47-62c142d05283';
        var directN8nUrl = n8nGetUrl + (n8nGetUrl.indexOf('?') !== -1 ? '&' : '?') + 'botId=' + encodeURIComponent(botId);
        fetch(directN8nUrl)
          .then(function(res) {
            if (!res.ok) return null;
            return res.json();
          })
          .then(function(n8nData) {
            if (!n8nData) return;
            var item = Array.isArray(n8nData) ? (n8nData.find(function(x) {
              return String(x.botId || x['Bot ID'] || x.id || '') === botId;
            }) || n8nData[0]) : n8nData;

            if (item) {
              applyFetchedBotConfig({
                welcomeMessage: item.FirstMessage || item.firstMessage || item.welcomeMessage || item['First Message'] || '',
                conversationFlow: item.conversationFlow || item['Conversation Flow'] || '',
                title: item.businessName || item.name || item.title || item['Business Name'] || '',
                whatsappNumber: item.ownerPhone || item.phone || item.whatsappNumber || item['Owner Phone'] || ''
              });
            }
          })
          .catch(function(e) {});
      });
  };

  // Only fetch from server/n8n if no welcome message or options were provided directly in script tag / config
  if (!welcomeMessage && !customOptions && !conversationFlow) {
    fetchBotConfigFromDatabase();
  }

  // Initial render
  renderMessages();

})();