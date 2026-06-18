import { motion } from "motion/react";

interface SmartBusinessLogoProps {
  size?: "sm" | "md" | "lg";
  showContact?: boolean;
}

export default function SmartBusinessLogo({ size = "md", showContact = false }: SmartBusinessLogoProps) {
  // Define sizing classes
  const robotWidth = size === "sm" ? 36 : size === "md" ? 64 : 120;
  const robotHeight = size === "sm" ? 36 : size === "md" ? 64 : 120;
  
  return (
    <div className={`flex flex-col items-center justify-center select-none ${size === "lg" ? "p-8 rounded-2xl bg-gradient-to-b from-[#0B0D13]/90 to-[#05060A]/95 border border-[#141F35]/70 shadow-[0_0_50px_rgba(30,144,255,0.15)] max-w-sm w-full" : ""}`}>
      
      {/* Animated Glowing Robot SVG */}
      <motion.div
        animate={{ 
          y: size === "lg" ? [0, -6, 0] : 0,
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="relative flex items-center justify-center"
      >
        {/* Glow Background Effect for large size */}
        {size === "lg" && (
          <div className="absolute w-24 h-24 bg-sky-500/20 blur-2xl rounded-full animate-pulse" />
        )}

        <svg 
          width={robotWidth} 
          height={robotHeight} 
          viewBox="0 0 120 120" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_0_12px_rgba(56,189,248,0.7)]"
        >
          {/* Head Antenna */}
          <path d="M60 45V30" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="60" cy="27" r="4" fill="#38BDF8" className="animate-pulse" />
          
          {/* Ears */}
          <rect x="23" y="55" width="6" height="18" rx="3" fill="#38BDF8" />
          <rect x="91" y="55" width="6" height="18" rx="3" fill="#38BDF8" />
          
          {/* Head outline */}
          <rect x="32" y="42" width="56" height="42" rx="16" stroke="#38BDF8" strokeWidth="4" fill="#0B0D13" />
          
          {/* Eyes */}
          <circle cx="48" cy="62" r="4.5" fill="#38BDF8" />
          <circle cx="72" cy="62" r="4.5" fill="#38BDF8" />
          
          {/* Smile */}
          <path d="M52 72 Q60 77 68 72" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" fill="none" />
          
          {/* Body Connection Neck */}
          <rect x="54" y="84" width="12" height="6" fill="#38BDF8" />
          
          {/* Torso/Body */}
          <path d="M42 90 H78 C86 90 90 98 84 108 L72 120 H48 L36 108 C30 98 34 90 42 90 Z" stroke="#38BDF8" strokeWidth="4" fill="#0B0D13" />
          
          {/* Arms */}
          <path d="M30 94 Q22 102 30 114" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M90 94 Q98 102 90 114" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" fill="none" />

          {/* AI Text on Chest */}
          <text 
            x="60" 
            y="108" 
            fill="#38BDF8" 
            fontSize="13" 
            fontFamily="monospace" 
            fontWeight="bold" 
            textAnchor="middle"
            className="animate-pulse"
          >
            AI
          </text>
        </svg>
      </motion.div>

      {/* Brand Text Header "עסק חכם" with Cyan/Neon Glow */}
      <h2 className={`font-sans font-black text-center text-[#38BDF8] tracking-wide select-none drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] ${
        size === "sm" ? "text-sm mt-1" : size === "md" ? "text-xl mt-2" : "text-3xl mt-5"
      }`}>
        עסק חכם
      </h2>

      {/* Sub-label for large card display or manual activation */}
      {(showContact || size === "lg") && (
        <div className="flex flex-col items-center gap-1 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-sky-400 font-bold tracking-wider">
            <span>✦</span>
            <span>חיים בר - מנהל המערכת</span>
            <span>✦</span>
          </div>
        </div>
      )}
    </div>
  );
}
