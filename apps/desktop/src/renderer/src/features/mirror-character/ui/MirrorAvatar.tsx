export function MirrorAvatar(): React.JSX.Element {
  return (
    <div className="mirror-avatar" aria-label="Miro, your Mirror Character" role="img">
      <span className="mirror-avatar__aura" />
      <svg viewBox="0 0 260 300" aria-hidden="true">
        <defs>
          <filter id="character-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <ellipse cx="130" cy="278" rx="70" ry="12" fill="#5b43c6" opacity=".22" filter="url(#character-glow)" />
        <path d="M81 175c8-24 27-37 49-37s41 13 49 37l19 82c2 10-5 19-15 19H77c-10 0-17-9-15-19Z" fill="#765ce0" />
        <path d="M91 184c13 13 25 19 39 19s26-6 39-19l13 72H78Z" fill="#181b25" opacity=".7" />
        <rect x="112" y="187" width="36" height="8" rx="4" fill="#b6a7ff" opacity=".6" />
        <path d="M75 80c0-37 24-61 55-61s55 24 55 61v36c0 33-24 56-55 56s-55-23-55-56Z" fill="#765ce0" />
        <path d="M86 82c0-27 18-44 44-44s44 17 44 44v31c0 26-19 43-44 43s-44-17-44-43Z" fill="#11141b" />
        <path d="M98 103c10-8 20-12 32-12s22 4 32 12" fill="none" stroke="#8f78f5" strokeWidth="3" opacity=".45" />
        <circle cx="111" cy="111" r="6" fill="#b9fbea" />
        <circle cx="149" cy="111" r="6" fill="#b9fbea" />
        <circle cx="111" cy="111" r="12" fill="#45dfa0" opacity=".2" filter="url(#character-glow)" />
        <circle cx="149" cy="111" r="12" fill="#45dfa0" opacity=".2" filter="url(#character-glow)" />
        <path d="M118 135c8 4 16 4 24 0" fill="none" stroke="#a18cf8" strokeWidth="3" strokeLinecap="round" />
        <path d="M130 20V5m-8 1h16" fill="none" stroke="#a18cf8" strokeWidth="4" strokeLinecap="round" />
        <circle cx="130" cy="4" r="4" fill="#45dfa0" />
      </svg>
    </div>
  );
}
