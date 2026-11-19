import React, { useEffect, useRef, useState } from "react";
import { Grid3x3 } from "lucide-react";

interface SwitcherModule {
  id: number;
  key: string;
  name: string;
  icon: string | null;
  base_url: string;
}

const ICONS: Record<string, string> = { CRM: "📇", WHATSAPP: "💬", TASKS: "✅", BOTAPP: "🤖", SITE: "🌐", PRICING: "🧮", PURCHASING: "🛒", ONBOARDING: "🚀", TASKSYSTEM: "✅" };

// The marketing module (organic + paid posts) - by its key, or its name if the key was typed differently.
const isMarketingModule = (m: { key: string; name?: string | null }) =>
  m.key.toLowerCase() === "marketing" || /פרסום|פירסום|שיווק/.test(m.name || "");

// The label without the word "מערכת" (Haim, 2026-11-19); the full name stays as the tooltip.
const shortName = (name: string) => name.replace(/מערכת\s*/g, "").trim() || name;

export const AppSwitcher: React.FC<{ token: string | null }> = ({ token }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [modules, setModules] = useState<SwitcherModule[] | null>(null);
  const [launchingKey, setLaunchingKey] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const authHeaders = { Authorization: `Bearer ${token || localStorage.getItem("cyber_session_token")}` };

  useEffect(() => {
    if (!isOpen || modules !== null) return;
    fetch("/api/switcher/modules", { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => setModules(d.modules || []))
      .catch(() => setModules([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, modules]);

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

  const launch = async (moduleKey: string) => {
    setLaunchingKey(moduleKey);
    // Open the tab synchronously in direct response to the click (opening it after the
    // await gets popup-blocked). No 'noreferrer' flag: it makes window.open return null.
    const newTab = window.open("", "_blank");
    if (newTab) newTab.opener = null;
    try {
      const res = await fetch("/api/switcher/token", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ moduleKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl) throw new Error(data.error || "failed");
      if (newTab) newTab.location.href = data.redirectUrl;
      else window.location.href = data.redirectUrl;
      setIsOpen(false);
    } catch {
      newTab?.close();
    } finally {
      setLaunchingKey(null);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        title="מעבר בין מערכות"
        className="p-2 bg-[#171A24] text-slate-300 hover:text-sky-400 rounded-xl border border-slate-800 transition cursor-pointer"
      >
        <Grid3x3 className="w-4 h-4" />
      </button>

      {isOpen && pos && (
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 256 }}
          className="bg-[#171A24] text-slate-200 rounded-xl shadow-2xl border border-slate-800 p-3 z-50"
        >
          {modules === null ? (
            <p className="text-xs text-slate-500 text-center py-4">טוען...</p>
          ) : modules.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">אין מערכות נוספות זמינות</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {modules.map((m) => (
                <button
                  key={m.key}
                  onClick={() => launch(m.key)}
                  disabled={launchingKey === m.key}
                  title={m.name}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isMarketingModule(m) ? (
                    <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
                    </span>
                  ) : (
                    <span className="text-2xl">{ICONS[m.key.toUpperCase()] || m.icon || "🔗"}</span>
                  )}
                  <span className="text-[10px] text-slate-300 truncate w-full text-center">{shortName(m.name)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
