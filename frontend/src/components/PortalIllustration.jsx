export default function PortalIllustration() {
  return (
    <svg viewBox="0 0 480 480" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Archway / portal outline */}
      <path
        d="M 150 430 L 150 220 A 90 90 0 0 1 330 220 L 330 430"
        fill="none"
        stroke="#4B5AE0"
        strokeWidth="3"
        strokeOpacity="0.55"
      />
      {/* Ground line */}
      <line x1="110" y1="430" x2="370" y2="430" stroke="#4B5AE0" strokeWidth="2" strokeOpacity="0.3" />

      {/* Star / sparkle accents */}
      <circle cx="104" cy="96" r="2.4" fill="#EEF0FB" fillOpacity="0.55" />
      <circle cx="362" cy="128" r="1.8" fill="#EEF0FB" fillOpacity="0.45" />
      <circle cx="206" cy="58" r="1.6" fill="#EEF0FB" fillOpacity="0.4" />
      <path
        d="M 316 70 L 319 79 L 328 82 L 319 85 L 316 94 L 313 85 L 304 82 L 313 79 Z"
        fill="#FF7A59"
        fillOpacity="0.85"
      />

      {/* Open book */}
      <line x1="240" y1="305" x2="240" y2="362" stroke="#FF7A59" strokeWidth="2" />
      <path
        d="M 240 312 C 202 300 162 305 128 332 L 128 378 C 162 351 202 346 240 358 Z"
        fill="#EEF0FB"
        fillOpacity="0.12"
        stroke="#FF7A59"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M 240 312 C 278 300 318 305 352 332 L 352 378 C 318 351 278 346 240 358 Z"
        fill="#EEF0FB"
        fillOpacity="0.12"
        stroke="#FF7A59"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Text hint lines - left page */}
      <line x1="150" y1="326" x2="205" y2="320" stroke="#EEF0FB" strokeOpacity="0.5" strokeWidth="1.5" />
      <line x1="150" y1="340" x2="212" y2="333" stroke="#EEF0FB" strokeOpacity="0.4" strokeWidth="1.5" />
      <line x1="150" y1="354" x2="200" y2="347" stroke="#EEF0FB" strokeOpacity="0.3" strokeWidth="1.5" />
      {/* Text hint lines - right page */}
      <line x1="275" y1="320" x2="330" y2="326" stroke="#EEF0FB" strokeOpacity="0.5" strokeWidth="1.5" />
      <line x1="268" y1="333" x2="330" y2="340" stroke="#EEF0FB" strokeOpacity="0.4" strokeWidth="1.5" />
      <line x1="280" y1="347" x2="330" y2="354" stroke="#EEF0FB" strokeOpacity="0.3" strokeWidth="1.5" />
    </svg>
  );
}
