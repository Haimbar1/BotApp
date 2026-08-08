(function () {
  // Read configuration helper
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var userConfig = window.OpticsBotConfig || {};
  var botId = userConfig.botId || (currentScript ? currentScript.getAttribute('data-bot-id') : null) || 'bot_generic_252';
  var webhookUrl = userConfig.webhookUrl || (currentScript ? currentScript.getAttribute('data-webhook-url') : null) || 'https://n8n.srv1239769.hstgr.cloud/webhook/65325d34-0c9e-4cc3-8b7c-c03c47105b3a';
  var botTitle = userConfig.title || (currentScript ? currentScript.getAttribute('data-title') : null) || 'אופטיקה הטובה אמירים';
  var whatsappNumber = userConfig.whatsappNumber || (currentScript ? currentScript.getAttribute('data-whatsapp') : null) || '972552502584';
  var themeColor = userConfig.themeColor || (currentScript ? currentScript.getAttribute('data-theme-color') : null) || '#0047AB';

  if (window.__OpticsBotWidgetLoaded) {
    if (typeof window.OpticsBotWidgetUpdate === 'function') {
      window.OpticsBotWidgetUpdate({
        botId: botId,
        title: botTitle,
        webhookUrl: webhookUrl,
        whatsappNumber: whatsappNumber,
        themeColor: themeColor
      });
    }
    return;
  }
  window.__OpticsBotWidgetLoaded = true;

  // 2. Session ID management
  var STORAGE_KEY = 'optics_bot_session_' + botId;
  var getSessionId = function() {
    try {
      var sid = localStorage.getItem(STORAGE_KEY);
      if (!sid) {
        sid = 'web_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
        localStorage.setItem(STORAGE_KEY, sid);
      }
      return sid;
    } catch (e) {
      return 'web_' + Math.random().toString(36).substring(2, 10);
    }
  };

  var sessionId = getSessionId();

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
      border-radius: 20px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.18);
      border: 1px solid #e2e8f0;
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
      background: linear-gradient(135deg, ${themeColor} 0%, #002D6B 100%);
      color: #ffffff;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .obw-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .obw-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .obw-title {
      font-weight: 800;
      font-size: 14px;
      margin: 0;
      line-height: 1.2;
    }
    .obw-subtitle {
      font-size: 11px;
      opacity: 0.85;
      margin: 2px 0 0 0;
    }
    .obw-close-btn {
      background: transparent;
      border: none;
      color: #ffffff;
      font-size: 20px;
      cursor: pointer;
      opacity: 0.8;
      padding: 4px;
      border-radius: 8px;
      line-height: 1;
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
    .obw-buttons-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .obw-btn-action {
      background: #eff6ff;
      color: ${themeColor};
      border: 1px solid #bfdbfe;
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .obw-btn-action:hover {
      background: ${themeColor};
      color: #ffffff;
      border-color: ${themeColor};
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
  `;

  var styleEl = document.createElement('style');
  styleEl.innerHTML = css;
  document.head.appendChild(styleEl);

  // 4. Build Widget HTML markup
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
          <div class="obw-avatar">👓</div>
          <div>
            <div class="obw-title">${botTitle}</div>
            <div class="obw-subtitle">בוט מענה חכם ומהיר 24/7</div>
          </div>
        </div>
        <button class="obw-close-btn" id="obw-close">✕</button>
      </div>

      <div class="obw-wa-banner">
        <span>מעדיף בוואטסאפ?</span>
        <a href="https://wa.me/${whatsappNumber}?text=${encodeURIComponent('שלום, אשמח לקבל מידע על בדיקות ראייה ומשקפיים')}" target="_blank" class="obw-wa-link">
          לחץ למעבר לוואטסאפ 📱
        </a>
      </div>

      <div class="obw-messages" id="obw-messages"></div>

      <div class="obw-footer">
        <input type="text" class="obw-input" id="obw-input" placeholder="קלד/י הודעה כאן..." />
        <button class="obw-send-btn" id="obw-send">שלח</button>
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

  // Initial welcome message
  var messages = [
    {
      id: 'welcome_1',
      sender: 'bot',
      text: 'שלום! 👋 ברוכים הבאים ל-' + botTitle + '. במה אוכל לעזור לך היום?',
      buttons: [
        { id: 'btn_exam', title: '📅 תיאום בדיקת ראייה' },
        { id: 'btn_catalog', title: '👓 קטלוג משקפיים ומחירים' },
        { id: 'btn_hours', title: '⏰ שעות פעילות ומיקום' },
        { id: 'btn_human', title: '📱 שיחה עם נציג אנושי' }
      ],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];

  var renderMessages = function() {
    messagesBox.innerHTML = '';
    messages.forEach(function(msg) {
      var msgDiv = document.createElement('div');
      msgDiv.className = 'obw-msg ' + (msg.sender === 'user' ? 'obw-msg-user' : 'obw-msg-bot');

      var textSpan = document.createElement('div');
      textSpan.textContent = msg.text;
      msgDiv.appendChild(textSpan);

      if (msg.imageUrl) {
        var img = document.createElement('img');
        img.src = msg.imageUrl;
        img.className = 'obw-msg-image';
        msgDiv.appendChild(img);
      }

      if (msg.buttons && msg.buttons.length > 0) {
        var btnsDiv = document.createElement('div');
        btnsDiv.className = 'obw-buttons-container';
        msg.buttons.forEach(function(btn) {
          var b = document.createElement('button');
          b.className = 'obw-btn-action';
          b.textContent = btn.title;
          b.onclick = function() {
            handleSendMessage(btn.title, btn.id);
          };
          btnsDiv.appendChild(b);
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

    var items = Array.isArray(rawData) ? rawData : [rawData];
    items.forEach(function(item) {
      var node = item.json || item || {};

      if (typeof node === 'string') {
        replyText += node;
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

          var rawBtns = (msg.interactive.action && msg.interactive.action.buttons) || [];
          rawBtns.forEach(function(b) {
            buttons.push({ id: (b.reply && b.reply.id) || b.id || ('btn_' + buttons.length), title: (b.reply && b.reply.title) || b.title || 'בחירה' });
          });
        } else if (msg.text && msg.text.body) {
          replyText = msg.text.body;
        }
        if (msg.image && (msg.image.link || msg.image.url)) {
          imageUrl = msg.image.link || msg.image.url;
        }
      }

      // 2. Direct properties
      var msgObj = node.message || node.reply || node.output || node.response || node.data || node.text;
      if (typeof msgObj === 'string' && !replyText) {
        replyText = msgObj;
      } else if (msgObj && typeof msgObj === 'object') {
        if (msgObj.text) replyText = typeof msgObj.text === 'string' ? msgObj.text : JSON.stringify(msgObj.text);
        if (msgObj.body && !replyText) replyText = typeof msgObj.body === 'string' ? msgObj.body : JSON.stringify(msgObj.body);
        if (msgObj.content && !replyText) replyText = typeof msgObj.content === 'string' ? msgObj.content : JSON.stringify(msgObj.content);
        if (msgObj.image) {
          imageUrl = typeof msgObj.image === 'string' ? msgObj.image : (msgObj.image.link || msgObj.image.url);
        }
      }

      if (!replyText) {
        var cand = node.reply || node.output || node.text || node.content || node.response;
        if (typeof cand === 'string') replyText = cand;
      }

      if (!imageUrl) {
        var topImg = node.image || node.imageUrl;
        if (typeof topImg === 'string') imageUrl = topImg;
        else if (topImg && typeof topImg === 'object') imageUrl = topImg.link || topImg.url;
      }

      var rawButtons = node.buttons || (msgObj && msgObj.buttons);
      if (Array.isArray(rawButtons)) {
        rawButtons.forEach(function(b) {
          if (typeof b === 'string') buttons.push({ id: 'btn_' + buttons.length, title: b });
          else if (b && typeof b === 'object') buttons.push({ id: b.id || ('btn_' + buttons.length), title: b.title || b.text || 'כפתור' });
        });
      }
    });

    return { replyText: replyText, imageUrl: imageUrl, buttons: buttons };
  };

  var handleSendMessage = function(textToSend, buttonId) {
    var userText = textToSend || inputEl.value.trim();
    if (!userText) return;

    inputEl.value = '';

    // Append user message
    messages.push({
      id: 'u_' + Date.now(),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    isTyping = true;
    renderMessages();

    // Prepare payload including bot_id
    var payload = {
      bot_id: botId,
      botId: botId,
      message: userText,
      buttonId: buttonId || null,
      sessionId: sessionId,
      sessionID: sessionId,
      timestamp: new Date().toISOString()
    };

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
    if (newConfig.whatsappNumber) whatsappNumber = newConfig.whatsappNumber;
    if (newConfig.webhookUrl) webhookUrl = newConfig.webhookUrl;

    var titleEl = document.querySelector('#obw-widget-container .obw-title');
    if (titleEl) titleEl.textContent = botTitle;

    var waLink = document.querySelector('#obw-widget-container .obw-wa-link');
    if (waLink) {
      waLink.href = 'https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent('שלום, אשמח לקבל מידע נוסף');
    }

    STORAGE_KEY = 'optics_bot_session_' + botId;
    sessionId = getSessionId();

    messages = [
      {
        id: 'welcome_' + Date.now(),
        sender: 'bot',
        text: 'שלום! 👋 ברוכים הבאים ל-' + botTitle + '. במה אוכל לעזור לך היום?',
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
