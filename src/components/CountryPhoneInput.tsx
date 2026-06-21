import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface Country {
  name: string;
  englishName: string;
  code: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: "ישראל", englishName: "Israel", code: "972", flag: "🇮🇱" },
  { name: "ארצות הברית", englishName: "United States", code: "1", flag: "🇺🇸" },
  { name: "קנדה", englishName: "Canada", code: "1", flag: "🇨🇦" },
  { name: "בריטניה", englishName: "United Kingdom", code: "44", flag: "🇬🇧" },
  { name: "צרפת", englishName: "France", code: "33", flag: "🇫🇷" },
  { name: "גרמניה", englishName: "Germany", code: "49", flag: "🇩🇪" },
  { name: "איטליה", englishName: "Italy", code: "39", flag: "🇮🇹" },
  { name: "ספרד", englishName: "Spain", code: "34", flag: "🇪🇸" },
  { name: "רוסיה", englishName: "Russia", code: "7", flag: "🇷🇺" },
  { name: "אוקראינה", englishName: "Ukraine", code: "380", flag: "🇺🇦" },
  { name: "קפריסין", englishName: "Cyprus", code: "357", flag: "🇨🇾" },
  { name: "יוון", englishName: "Greece", code: "30", flag: "🇬🇷" },
  { name: "בלגיה", englishName: "Belgium", code: "32", flag: "🇧🇪" },
  { name: "הולנד", englishName: "Netherlands", code: "31", flag: "🇳🇱" },
  { name: "שווייץ", englishName: "Switzerland", code: "41", flag: "🇨🇭" },
  { name: "אוסטריה", englishName: "Austria", code: "43", flag: "🇦🇹" },
  { name: "פורטוגל", englishName: "Portugal", code: "351", flag: "🇵🇹" },
  { name: "רומניה", englishName: "Romania", code: "40", flag: "🇷🇴" },
  { name: "טורקיה", englishName: "Turkey", code: "90", flag: "🇹🇷" },
  { name: "פולין", englishName: "Poland", code: "48", flag: "🇵🇱" },
  { name: "אוסטרליה", englishName: "Australia", code: "61", flag: "🇦🇺" },
  { name: "ניו זילנד", englishName: "New Zealand", code: "64", flag: "🇳🇿" },
  { name: "דרום אפריקה", englishName: "South Africa", code: "27", flag: "🇿🇦" },
  { name: "יפן", englishName: "Japan", code: "81", flag: "🇯🇵" },
  { name: "סין", englishName: "China", code: "86", flag: "🇨🇳" },
  { name: "הודו", englishName: "India", code: "91", flag: "🇮🇳" },
  { name: "ברזיל", englishName: "Brazil", code: "55", flag: "🇧🇷" },
  { name: "מקסיקו", englishName: "Mexico", code: "52", flag: "🇲🇽" },
  { name: "ארגנטינה", englishName: "Argentina", code: "54", flag: "🇦🇷" },
  { name: "איחוד האמירויות", englishName: "United Arab Emirates", code: "971", flag: "🇦🇪" },
  { name: "ערב הסעודית", englishName: "Saudi Arabia", code: "966", flag: "🇸🇦" },
  { name: "ירדן", englishName: "Jordan", code: "962", flag: "🇯🇴" },
  { name: "מצרים", englishName: "Egypt", code: "20", flag: "🇪🇬" },
  { name: "סינגפור", englishName: "Singapore", code: "65", flag: "🇸🇬" },
  { name: "תאילנד", englishName: "Thailand", code: "66", flag: "🇹🇭" },
];

export function parsePhoneNumber(phone: string): { countryCode: string; nationalNumber: string } {
  const clean = (phone || "").replace(/\D/g, "");
  if (!clean) {
    return { countryCode: "972", nationalNumber: "" };
  }

  // Find matching country code by trying to match longest codes first
  const sortedCountries = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sortedCountries) {
    if (clean.startsWith(c.code)) {
      let rest = clean.substring(c.code.length);
      // For Israel, if the rest doesn't start with 0 but is a 9-digit number starting with 5,
      // or if it was saved directly as 9725XXXXXXXX, we want to reconstruct to e.g. 05XXXXXXXX
      if (c.code === "972" && rest.startsWith("5") && rest.length === 9) {
        rest = "0" + rest;
      }
      return {
        countryCode: c.code,
        nationalNumber: rest
      };
    }
  }

  // Handle case where it doesn't start with a prefix but has 10 digits starting with 05
  if (clean.startsWith("05") && clean.length === 10) {
    return { countryCode: "972", nationalNumber: clean };
  }

  // Default to Israel if no match
  return {
    countryCode: "972",
    nationalNumber: clean
  };
}

interface CountryPhoneInputProps {
  id: string;
  value: string; // Packed normalized number: code + clean number
  onChange: (normalizedValue: string, isValid: boolean, errorMsg: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CountryPhoneInput({
  id,
  value,
  onChange,
  placeholder = "חיוג מהיר ללא הקידומת, למשל: 054-7866119",
  disabled = false
}: CountryPhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Extract initial country and state
  const { countryCode: initialCountryCode, nationalNumber: initialNationalNumber } = parsePhoneNumber(value);
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    COUNTRIES.find((c) => c.code === initialCountryCode) || COUNTRIES[0]
  );
  const [phoneInput, setPhoneInput] = useState(initialNationalNumber);
  const [validationError, setValidationError] = useState("");

  // Sync state if external value changes (e.g. active agent changes)
  useEffect(() => {
    const { countryCode, nationalNumber } = parsePhoneNumber(value);
    const country = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
    setSelectedCountry(country);
    setPhoneInput(nationalNumber);
    setValidationError("");
  }, [value]);

  // Click outside close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter countries according to search query and specific Israeli auto-complete requests
  const filteredCountries = COUNTRIES.filter((country) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    // Special Auto-complete/search rules:
    // "אם הוא מתחיל ב97 תשלים לו ואם israe או ישר" -> Match Israel (+972)
    if (q === "97" && country.code === "972") return true;
    if (
      "israe".startsWith(q) || 
      q.includes("israe") || 
      "ישראל".includes(q) || 
      "ישר".startsWith(q) || 
      q.includes("ישר")
    ) {
      if (country.code === "972") return true;
    }

    return (
      country.name.toLowerCase().includes(q) ||
      country.englishName.toLowerCase().includes(q) ||
      country.code.includes(q)
    );
  });

  // If search query is "97", "israe" or "ישר", let's re-order countries to put Israel first!
  const sortedCountries = [...filteredCountries].sort((a, b) => {
    const q = searchQuery.toLowerCase().trim();
    if (q === "97" || "israe".startsWith(q) || "ישר".startsWith(q)) {
      if (a.code === "972") return -1;
      if (b.code === "972") return 1;
    }
    return 0;
  });

  // Update logic with validity check
  const handlePhoneInputChange = (text: string, country: Country = selectedCountry) => {
    // Only permit digits and hyphens
    const cleanText = text.replace(/[^\d-]/g, "");
    setPhoneInput(cleanText);

    // Normalize out non-digits for validation and shipping
    let bodyOnly = cleanText.replace(/\D/g, "");
    
    // Auto-strip leading code duplication if they type it in the local input box (e.g., they typed 972 in phone field)
    if (bodyOnly.startsWith(country.code) && bodyOnly.length > country.code.length) {
      bodyOnly = bodyOnly.substring(country.code.length);
    } else if (country.code === "972" && bodyOnly.startsWith("0972") && bodyOnly.length > 4) {
      bodyOnly = bodyOnly.substring(4);
    }

    // Validation
    let error = "";
    let isValid = false;
    let normalized = "";

    if (!cleanText.trim()) {
      error = "מספר הטלפון הוא שדה חובה *";
    } else {
      // Validate characters
      const invalidChars = /[^0-9-]/.test(cleanText);
      if (invalidChars) {
        error = "מותר להזין ספרות ומקפים בלבד";
      } else {
        // Validation per country
        if (country.code === "972") {
          // If Israeli, strip leading 0 for normalized shipping
          let cleanLocal = bodyOnly;
          if (cleanLocal.startsWith("0")) {
            cleanLocal = cleanLocal.substring(1);
          }

          if (cleanLocal.length < 9) {
            error = "חסרות ספרות במספר הטלפון (מספר נייד ישראלי חייב להכיל 9 ספרות)";
          } else if (cleanLocal.length > 9) {
            error = "יותר מדי ספרות במספר הטלפון";
          } else {
            isValid = true;
            normalized = country.code + cleanLocal;
          }
        } else {
          // General validation
          let cleanLocal = bodyOnly;
          if (cleanLocal.startsWith("0")) {
            cleanLocal = cleanLocal.substring(1);
          }

          if (cleanLocal.length < 6) {
            error = "מספר הטלפון קצר מדי";
          } else if (cleanLocal.length > 15) {
            error = "מספר הטלפון ארוך מדי";
          } else {
            isValid = true;
            normalized = country.code + cleanLocal;
          }
        }
      }
    }

    setValidationError(error);
    
    // Even if invalid, return what they have normalized best-effort
    const fallbackNormalized = normalized || (country.code + bodyOnly.replace(/^0/, ""));
    onChange(fallbackNormalized, isValid, error);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery("");
    handlePhoneInputChange(phoneInput, country);
  };

  return (
    <div className="w-full relative flex flex-col gap-1" id={`phone-wrapper-${id}`}>
      <div className="flex gap-2 relative">
        {/* Country Code Dropdown Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="h-full px-3 py-2.5 bg-[#151720] border border-slate-800 rounded-xl text-xs text-white hover:bg-[#1c1e2a] focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 min-w-[90px] justify-center cursor-pointer font-mono"
            id={`country-btn-${id}`}
          >
            <span className="text-base leading-none select-none">{selectedCountry.flag}</span>
            <span className="text-slate-200">+{selectedCountry.code}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {/* Dropdown panel */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 mt-1 right-0 w-64 bg-[#11121d] border border-slate-850 rounded-xl shadow-2xl overflow-hidden focus:outline-none"
                id={`country-dropdown-${id}`}
              >
                {/* Search country box */}
                <div className="p-2 border-b border-slate-850 flex items-center gap-2 bg-[#151724]">
                  <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    dir="rtl"
                    placeholder="חפש לפי מדינה או קידומת..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Scrollable options list */}
                <div className="max-h-52 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-800">
                  {sortedCountries.length > 0 ? (
                    sortedCountries.map((c) => (
                      <button
                        key={`${c.code}-${c.englishName}`}
                        type="button"
                        onClick={() => handleCountrySelect(c)}
                        className={`w-full px-3 py-2 text-right hover:bg-[#1a1c2a] flex items-center justify-between text-xs transition duration-100 cursor-pointer ${
                          selectedCountry.code === c.code ? "bg-indigo-650/10 text-indigo-400 font-bold" : "text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Check className={`w-3 h-3 text-indigo-400 ${selectedCountry.code === c.code ? "opacity-100" : "opacity-0"}`} />
                          <span className="font-mono text-slate-500">+{c.code}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">{c.name}</span>
                          <span className="text-base">{c.flag}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center text-[10px] text-slate-500">
                      לא נמצאו מדינות מתאימות לחיפוש
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Core Telephone number digits input */}
        <input
          type="text"
          id={id}
          dir="ltr"
          value={phoneInput}
          onChange={(e) => handlePhoneInputChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3.5 py-2.5 bg-[#151720] border ${
            validationError ? "border-red-500/50 focus:border-red-500" : "border-slate-800 focus:border-sky-500/80"
          } rounded-xl text-xs text-white focus:outline-none focus:ring-1 ${
            validationError ? "focus:ring-red-500/50" : "focus:ring-sky-500"
          } transition duration-150 font-mono text-left tracking-wider`}
        />
      </div>

      {/* Validation warning */}
      {validationError && (
        <span className="text-[10px] text-red-400 font-bold flex items-center gap-1 mt-0.5" id={`phone-err-${id}`}>
          <AlertCircle className="w-3 h-3 text-red-400" />
          {validationError}
        </span>
      )}
    </div>
  );
}
