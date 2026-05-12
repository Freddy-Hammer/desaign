"use client";

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.openCookieSettings) {
          window.openCookieSettings();
        }
      }}
      className={className}
    >
      Cookie settings
    </button>
  );
}
