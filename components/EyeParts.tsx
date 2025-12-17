
import React from 'react';

export const RectEye = () => <rect x="0" y="0" width="80" height="100" rx="20" />;
export const WideRectEye = () => <rect x="0" y="20" width="100" height="60" rx="15" />;
export const HappyEye = () => <path d="M0 60 Q 50 10 100 60" fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />;
export const SadEye = () => <path d="M0 20 Q 50 70 100 20" fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />;
export const HeartEye = () => <path d="M50 85 C 50 85 10 60 10 35 C 10 15 30 15 50 35 C 70 15 90 15 90 35 C 90 60 50 85 50 85" fill="currentColor" />;
export const StarEye = () => <path d="M50 0 L 65 35 L 100 50 L 65 65 L 50 100 L 35 65 L 0 50 L 35 35 Z" fill="currentColor" />;
export const SpiralEye = () => (
  <path d="M50 50 m -40 0 a 40 40 0 1 0 80 0 a 40 40 0 1 0 -80 0 M50 50 m -25 0 a 25 25 0 1 0 50 0 a 25 25 0 1 0 -50 0" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
);
export const QuestionEye = () => (
  <g>
    <rect x="0" y="40" width="80" height="20" rx="10" />
    <text x="50" y="30" fontSize="40" fontWeight="bold" fill="currentColor">?</text>
  </g>
);
export const SleepyEye = () => (
  <g>
    <rect x="0" y="45" width="100" height="10" rx="5" />
    <circle cx="110" cy="30" r="5" fill="currentColor" />
    <circle cx="125" cy="15" r="8" fill="currentColor" />
  </g>
);
export const AngryEye = () => (
    <path d="M0 20 L 100 60" fill="none" stroke="currentColor" strokeWidth="25" strokeLinecap="round" />
);
export const AttentionEye = () => (
  <rect x="15" y="0" width="50" height="110" rx="25" />
);

export const RecognizingEye = () => (
  <g>
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="20 10" />
    <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="5 5" />
    <circle cx="50" cy="50" r="10" fill="currentColor" />
    <rect x="0" y="48" width="100" height="4" fill="currentColor" opacity="0.6" />
  </g>
);

export const SpeechlessEye = () => (
  <rect x="0" y="45" width="100" height="15" rx="7.5" fill="currentColor" />
);

// New Expressions
export const ThinkingEye = () => (
  <g>
    <circle cx="20" cy="50" r="12" fill="currentColor" />
    <circle cx="50" cy="50" r="12" fill="currentColor" />
    <circle cx="80" cy="50" r="12" fill="currentColor" />
  </g>
);

export const CoolEye = () => (
  <g>
    <rect x="0" y="30" width="100" height="40" rx="5" fill="currentColor" />
    <rect x="10" y="35" width="80" height="10" rx="2" fill="white" opacity="0.3" />
  </g>
);

export const AnxiousEye = () => (
  <path d="M0 50 L 20 30 L 40 70 L 60 30 L 80 70 L 100 50" fill="none" stroke="currentColor" strokeWidth="15" strokeLinecap="round" strokeJoin="round" />
);

export const ShockedEye = () => (
  <g>
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" />
    <circle cx="50" cy="50" r="10" fill="currentColor" />
  </g>
);

export const DreamingEye = () => (
  <path d="M25 70 A 20 20 0 0 1 35 32 A 30 30 0 0 1 85 45 A 20 20 0 0 1 85 80 Z" fill="currentColor" />
);

// Weather Eyes
export const SunEye = () => (
  <g>
    <circle cx="50" cy="50" r="25" fill="currentColor" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
      <line 
        key={angle}
        x1="50" y1="10" x2="50" y2="20" 
        stroke="currentColor" strokeWidth="6" strokeLinecap="round"
        transform={`rotate(${angle} 50 50)`}
      />
    ))}
  </g>
);

export const RainEye = () => (
  <g>
    <path d="M20 20 Q 50 10 80 20 Q 90 40 50 45 Q 10 40 20 20" fill="currentColor" opacity="0.4" />
    <path d="M30 60 Q 35 55 40 60 Q 40 70 35 75 Q 30 70 30 60" fill="currentColor" />
    <path d="M60 60 Q 65 55 70 60 Q 70 70 65 75 Q 60 70 60 60" fill="currentColor" />
    <path d="M45 80 Q 50 75 55 80 Q 55 90 50 95 Q 45 90 45 80" fill="currentColor" />
  </g>
);

export const CloudEye = () => (
  <path d="M25 70 A 20 20 0 0 1 35 32 A 30 30 0 0 1 85 45 A 20 20 0 0 1 85 80 Z" fill="currentColor" />
);

export const SnowEye = () => (
  <g>
    {[0, 60, 120, 180, 240, 300].map(angle => (
      <line 
        key={angle}
        x1="50" y1="20" x2="50" y2="80" 
        stroke="currentColor" strokeWidth="4" strokeLinecap="round"
        transform={`rotate(${angle} 50 50)`}
      />
    ))}
    <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="4" />
  </g>
);
