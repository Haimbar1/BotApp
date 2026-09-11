/**
 * Prompt Diagnosis and Semantic Fix Engine
 * Formulates expert, clean Hebrew prompt rules for conversational AI agents.
 * Ensures the bot never receives raw user complaints or conversational meta-text.
 */

export interface DiagnosisResult {
  needsClarification: boolean;
  clarifyingQuestion?: string;
  changes: Record<string, string>;
  touchedParts: string[];
  summary: string;
}

export const PROMPT_PART_TITLES: Record<string, string> = {
  welcomeMessage: "הודעת פתיחה ותפריט ראשי",
  botIdentity: "זהות הבוט ומאפייניו",
  coursesInfo: "מה אני מוכר — שירותים/מוצרים/קורסים",
  kidsCourses: "קהל יעד וסיגמנטים מיוחדים",
  conversationFlow: "זרימת ושלבי השיחה",
  writingStyle: "טון ואופן כתיבה",
  faqAnswers: "שאלות פופולריות (FAQ)",
  whatNotToDo: "חוקי ברזל (מה לא לעשות)",
  syllabusLinks: "ברושורים, חומרי מידע וקישורים",
  humanEscalation: "אסקלציה לאנוש (הפניה לנציג)",
  imagesInfo: "תמונות וגלריית מדיה",
  videosInfo: "סרטוני וידאו והדרכה"
};

/**
 * Strips raw bug-report noise or conversational chatter directed at the developer/system.
 */
export function cleanRawUserComplaint(text: string): string {
  let cleaned = text || "";

  // Remove common meta-conversational prefixes
  const noisePrefixes = [
    /^(לא נראה לי שהבנת|כנראה לא הבנת מה אני רוצה|לא הבנת|אמרתי לך ש|כתבתי לך ש|אני כתבתי לו ש|אני רוצה שהמערכת|במקום זה היא כתבה|במקום זה הוא כתב|שטויות|בשביל זה אני לא צריך|שיהרוס את הפרומפט|הבעיה היא ש|הבעייה היא ש)[\s,:;\-–—]*/gi,
    /^(למה הוא|איך זה ש|הבוט לא עובד|יש תקלה ב|תקן את זה ש)[\s,:;\-–—]*/gi
  ];

  for (const regex of noisePrefixes) {
    cleaned = cleaned.replace(regex, "").trim();
  }

  return cleaned.trim();
}

/**
 * Removes corrupted lines from an existing block value.
 */
export function sanitizeBlockContent(val: string): string {
  if (!val) return "";
  const lines = val.split("\n");
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- קישור ופרטי מידע רלוונטיים: בהתאם להנחיה -")) return false;
    if (trimmed.startsWith("[הנחיה מעודכנת]:")) return false;
    if (trimmed.includes("לא נראה לי שהבנת")) return false;
    if (trimmed.includes("במקום זה הוא כתב")) return false;
    if (trimmed.includes("בשביל זה אני לא צריך אותו")) return false;
    return true;
  });
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Deep semantic prompt synthesis when AI is offline or as fallback.
 * Formulates pristine, professional prompt block rules in Hebrew.
 */
export function synthesizePromptFixes(
  rawIssueDescription: string,
  currentParts: Record<string, string>,
  businessName: string = "עסק חכם",
  ownerName: string = "מנהל",
  ownerPhone: string = "טרם הוגדר"
): DiagnosisResult {
  const issue = cleanRawUserComplaint(rawIssueDescription);
  const issueLower = (rawIssueDescription + " " + issue).toLowerCase();

  const changes: Record<string, string> = {};
  const touchedParts: string[] = [];
  const summaryBullets: string[] = [];

  // 1. Website, Proactive links, and Facebook redirection issue
  const isWebsiteIssue = /אתר|דף נחיתה|אינטרנט|website|כתובת האתר|לינק לאתר/.test(issueLower);
  const mentionsFacebook = /פייסבוק|facebook/.test(issueLower);
  const isProactiveRequested = /ביוזמתו|יוזמה|פרואקטיבי|להציע|לתת את המידע|מבלי שיבקשו/.test(issueLower);
  const isNegativeFacebook = /אל תפנה לפייסבוק|רק מפנה לפייסבוק|לא היה צריך בכלל לדבר על העמוד פייסבוק|בלי פייסבוק|להפסיק להפנות לפייסבוק/.test(issueLower);

  if (isWebsiteIssue || (mentionsFacebook && isNegativeFacebook)) {
    // --- WHAT NOT TO DO (חוקי ברזל) ---
    const curWhatNot = sanitizeBlockContent(currentParts.whatNotToDo || "");
    const whatNotLines = curWhatNot.split("\n").filter(l => !/פייסבוק/.test(l));
    const ruleWhatNot = "❌ חל איסור מוחלט להפנות לפייסבוק כששואלים על אתר האינטרנט או על מידע על העסק. כאשר לקוח שואל אם יש אתר או מעוניין במידע נוסף, חובה להשיב שיש אתר פעיל ומעודכן ולמסור את כתובת האתר הרשמית.";
    changes.whatNotToDo = [...whatNotLines, ruleWhatNot].filter(Boolean).join("\n");
    touchedParts.push("whatNotToDo");
    summaryBullets.push("• חוקי ברזל: נוסף איסור מוחלט על הפניה לפייסבוק כאשר שואלים על האתר, והוגדרה חובה לציין שיש אתר פעיל.");

    // --- FAQ ANSWERS (שאלות נפוצות) ---
    const curFaq = sanitizeBlockContent(currentParts.faqAnswers || "");
    const websiteFaqSnippet = 
`ש: האם יש לכם אתר אינטרנט?
ת: בהחלט! יש לנו אתר אינטרנט רשמי ומעודכן שבו תוכלו למצוא את כל המידע, לקרוא פרטים מורחבים ולהתרשם. בנוסף אני כאן בשמחה לענות על כל שאלה ולעזור לכם בכל נושא!

ש: אפשר קישור לאתר שלכם?
ת: בוודאי, הנה הקישור לאתר הרשמי שלנו [כתובת אתר העסק] לעיונכם המלא. אם יש משהו ספציפי שתרצו לדעת, אשמח לפרט גם כאן!`;

    // Check if FAQ already has website question; if so, replace or append
    if (/האם יש לכם אתר/.test(curFaq)) {
      changes.faqAnswers = curFaq.replace(/ש: האם יש לכם אתר[\s\S]*?(?=(\n\nש:|$))/, websiteFaqSnippet.split("\n\n")[0]);
    } else {
      changes.faqAnswers = curFaq ? `${curFaq}\n\n${websiteFaqSnippet}` : websiteFaqSnippet;
    }
    touchedParts.push("faqAnswers");
    summaryBullets.push("• שאלות נפוצות (FAQ): נוספה תשובה ברורה ומזמינה המאשרת קיום אתר אינטרנט פעיל ומציעה את הקישור הרשמי.");

    // --- SYLLABUS & LINKS (חומרי מידע וקישורים) ---
    const curLinks = sanitizeBlockContent(currentParts.syllabusLinks || "");
    const websiteLinkSnippet = 
`- אתר הבית הרשמי של ${businessName}: [כתובת האתר הרשמי]
- הנחיית חובה: חובה למסור את כתובת האתר לכל לקוח ששואל אם יש אתר, וכן להציע את הקישור לאתר ביוזמתך באופן פרואקטיבי לכל לקוח שמתעניין במידע נוסף!`;
    
    // Remove old corrupted lines and ensure clean link
    const cleanLinksList = curLinks.split("\n").filter(l => !/פייסבוק|facebook/.test(l) && !l.includes("כתובת האתר"));
    changes.syllabusLinks = [...cleanLinksList, websiteLinkSnippet].filter(Boolean).join("\n");
    touchedParts.push("syllabusLinks");
    summaryBullets.push("• קישורים וחומרי מידע: הוסרה כל הפניה מיותרת לפייסבוק, ונוספה הנחיה יזומה למסירת קישור האתר הרשמי.");

    // --- CONVERSATION FLOW (זרימת שיחה) ---
    if (isProactiveRequested) {
      const curFlow = sanitizeBlockContent(currentParts.conversationFlow || "");
      const flowAddition = `• מתן מידע יזום על האתר: כאשר לקוח מתעניין בפרטים נוספים או שואל על האתר, מסור מיד ביוזמתך את הקישור לאתר העסק והמשך ללוות אותו בשיחה בסבלנות.`;
      changes.conversationFlow = curFlow ? `${curFlow}\n${flowAddition}` : flowAddition;
      touchedParts.push("conversationFlow");
      summaryBullets.push("• זרימת שיחה: הוגדרה הנחיה פרואקטיבית לשליחת קישור האתר ביוזמת הבוט ברגע שהלקוח מתעניין במידע נוסף.");
    }
  }

  // 2. Pricing and quote restrictions
  if (/מחיר|מחירים|עלות|הנחה|מבצע|כמה עולה/.test(issueLower)) {
    if (!touchedParts.includes("whatNotToDo")) {
      const curWhatNot = sanitizeBlockContent(currentParts.whatNotToDo || "");
      const priceRule = "❌ אין להמציא מחירים, מבצעים או הנחות שלא מוגדרים במפורש במידע הרשמי של העסק.";
      changes.whatNotToDo = curWhatNot ? `${curWhatNot}\n${priceRule}` : priceRule;
      touchedParts.push("whatNotToDo");
      summaryBullets.push("• חוקי ברזל: הוגדר איסור מוחלט על המצאת מחירים או הנחות שלא צוינו.");
    }
    if (!touchedParts.includes("faqAnswers")) {
      const curFaq = sanitizeBlockContent(currentParts.faqAnswers || "");
      const priceFaq = 
`ש: כמה זה עולה / מה המחירים?
ת: המחירים נקבעים בהתאם לשירות המותאם אישית עבורכם. נשמח לתאם שיחה קצרה ולהתאים לכם הצעת מחיר מדויקת!`;
      changes.faqAnswers = curFaq ? `${curFaq}\n\n${priceFaq}` : priceFaq;
      touchedParts.push("faqAnswers");
      summaryBullets.push("• שאלות נפוצות: נוספה תשובה מובנית לשאלת עלויות ומחירים.");
    }
  }

  // 3. Human Escalation / Representative
  if (/נציג|אנושי|מנהל|טלפון|שיחה עם|להתקשר/.test(issueLower)) {
    const curEsc = sanitizeBlockContent(currentParts.humanEscalation || "");
    const escRule = `בכל מקרה של בקשה לנציג אנושי או צורך במענה מורכב, יש לענות באדיבות רבה ולהפנות אל ${ownerName} בטלפון ${ownerPhone}. חשוב: לעולם אל תסיים את השיחה מיוזמתך, אלא שאל: "בינתיים, האם יש עוד משהו שאוכל לעזור בו?".`;
    changes.humanEscalation = escRule;
    touchedParts.push("humanEscalation");
    summaryBullets.push(`• אסקלציה לאנוש: עודכנו פרטי ההפניה למנהל (${ownerName}, ${ownerPhone}) וההנחיה שלא לסיים את השיחה באופן חד-צדדי.`);
  }

  // 4. Tone / Style / Message Length
  if (/קצר|ארוך|חופר|מגילה|אימוג'י|טון|סגנון/.test(issueLower)) {
    const curStyle = sanitizeBlockContent(currentParts.writingStyle || "");
    const styleRule = `• הודעות קצרות וממוקדות: לא יותר מ-2 עד 4 שורות בהודעה אחת.
• שבירת שורות נוחה לקריאה ב-WhatsApp.
• טון שירותי, אדיב, מקצועי ובגובה העיניים.
• שימוש מתון ומדויק באימוג'י (1-2 להודעה לכל היותר).`;
    changes.writingStyle = styleRule;
    touchedParts.push("writingStyle");
    summaryBullets.push("• טון ואופן כתיבה: הוגדרו כללים להודעות קצרות וממוקדות ללא מלל עודף.");
  }

  // 5. Welcome Message
  if (/הודעת פתיחה|ברכה|פתיח|התחלה|תפריט/.test(issueLower)) {
    const curWelcome = sanitizeBlockContent(currentParts.welcomeMessage || "");
    const welcomeRule = `שלום וברוכים הבאים ל${businessName}! 👋
שמח שהגעתם אלינו. איך אוכל לעזור לכם היום?`;
    changes.welcomeMessage = curWelcome || welcomeRule;
    touchedParts.push("welcomeMessage");
    summaryBullets.push("• הודעת פתיחה: עודכנה ברכת הפתיחה להיות חמה, שירותית וקולעת.");
  }

  // Fallback if no specific rule matched: generate a clean professional instruction
  if (touchedParts.length === 0) {
    const curWhatNot = sanitizeBlockContent(currentParts.whatNotToDo || "");
    const curFaq = sanitizeBlockContent(currentParts.faqAnswers || "");

    const newRule = `• הנחיית התנהגות מחייבת: יש לפעול באופן מדויק - ${issue}.`;
    changes.whatNotToDo = curWhatNot ? `${curWhatNot}\n${newRule}` : newRule;
    touchedParts.push("whatNotToDo");

    changes.faqAnswers = curFaq;
    touchedParts.push("faqAnswers");
    summaryBullets.push(`• חוקי ברזל ושאלות נפוצות: עודכנו ההנחיות בהתאם לדרישה המבוקשת.`);
  }

  // Build a crisp, structured Hebrew summary for the user
  const summary = `בוצע אבחון ותיקון יסודי של הפרומפט (${touchedParts.length} בלוקים עודכנו):\n` + summaryBullets.join("\n");

  return {
    needsClarification: false,
    changes,
    touchedParts,
    summary
  };
}
