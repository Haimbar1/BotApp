import React, { useEffect, useRef, useState } from "react";
import { Settings, ExternalLink } from "lucide-react";

export interface SettingsItem {
  label: string;
  onClick: () => void;
}

interface Props {
  showPortalAdmin: boolean;
  appItems: SettingsItem[]; // this app's own settings
  integrationItems: SettingsItem[]; // WhatsApp / API connections
  onLogout: () => void;
}

const PORTAL_URL = "https://portal.smartesek.com";

// The same gear, in the same place (right after the app switcher), with the same menu layout in
// every SmartEsek app: portal admin link, app settings, integrations, log out.
export const AppSettingsMenu: React.FC<Props> = ({ showPortalAdmin, appItems, integrationItems, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  const toggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const width = 256;
      setPos({ top: rect.bottom + 8, left: Math.min(Math.max(rect.right - width, 8), window.innerWidth - width - 8) });
    }
    setIsOpen((v) => !v);
  };

  const run = (fn: () => void) => () => {
    setIsOpen(false);
    fn();
  };
  const itemClass = "w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-sm text-slate-200 cursor-pointer";
  const sectionClass = "px-2.5 pt-2 pb-0.5 text-[10px] font-bold text-slate-500";

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        title="הגדרות"
        className="p-2 bg-[#171A24] text-slate-300 hover:text-sky-400 rounded-xl border border-slate-800 transition cursor-pointer"
      >
        <Settings className="w-4 h-4" />
      </button>

      {isOpen && pos && (
        <div
          ref={panelRef}
          dir="rtl"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 256 }}
          className="bg-[#171A24] text-slate-200 rounded-xl shadow-2xl border border-slate-800 p-2 z-50"
        >
          {showPortalAdmin && (
            <a
              href={PORTAL_URL}
              target="_blank"
              rel="noopener"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sm font-bold text-sky-300"
            >
              <span>ניהול עסק ומשתמשים</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {appItems.length > 0 && (
            <>
              <div className={sectionClass}>הגדרות האפליקציה</div>
              {appItems.map((it) => (
                <button key={it.label} onClick={run(it.onClick)} className={itemClass}>
                  {it.label}
                </button>
              ))}
            </>
          )}

          {integrationItems.length > 0 && (
            <>
              <div className={sectionClass}>וואטסאפ ואינטגרציות</div>
              {integrationItems.map((it) => (
                <button key={it.label} onClick={run(it.onClick)} className={itemClass}>
                  {it.label}
                </button>
              ))}
            </>
          )}

          <div className="border-t border-slate-800 mt-1.5 pt-1">
            <button onClick={run(onLogout)} className={itemClass}>
              התנתקות
            </button>
          </div>
        </div>
      )}
    </>
  );
};
