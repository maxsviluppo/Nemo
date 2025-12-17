
// Add React import to resolve React namespace error
import React from 'react';

export enum Emotion {
  NEUTRAL = 'NEUTRAL',
  HAPPY = 'HAPPY',
  SAD = 'SAD',
  ANGRY = 'ANGRY',
  LOVE = 'LOVE',
  STAR = 'STAR',
  CONFUSED = 'CONFUSED',
  SLEEPING = 'SLEEPING',
  DIZZY = 'DIZZY',
  SURPRISED = 'SURPRISED',
  BORED = 'BORED',
  RICH = 'RICH',
  WINK = 'WINK',
  CRYING = 'CRYING',
  SHY = 'SHY',
  SCANNING = 'SCANNING',
  ATTENTION = 'ATTENTION',
  RECOGNIZING = 'RECOGNIZING',
  SPEECHLESS = 'SPEECHLESS',
  THINKING = 'THINKING',
  COOL = 'COOL',
  ANXIOUS = 'ANXIOUS',
  SHOCKED = 'SHOCKED',
  DREAMING = 'DREAMING',
  // Weather states
  SUNNY = 'SUNNY',
  RAINY = 'RAINY',
  CLOUDY = 'CLOUDY',
  SNOWY = 'SNOWY',
  // Affirmation/Negation
  YES = 'YES',
  NO = 'NO'
}

export interface EyeState {
  emotion: Emotion;
  leftEye: React.ReactNode;
  rightEye: React.ReactNode;
  color: string;
}
