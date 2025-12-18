
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Emotion } from '../types';
import * as EyeParts from './EyeParts';
import { soundService, BeepType } from '../services/soundService';

interface PetRobotFaceProps {
  currentEmotion: Emotion;
  isListening?: boolean;
  isSoundEnabled?: boolean;
  lookDirection?: 'left' | 'center' | 'right';
  targetObject?: string | null;
  volume?: number;
  brightness?: number;
}

const PetRobotFace: React.FC<PetRobotFaceProps> = ({ 
  currentEmotion, 
  isListening, 
  isSoundEnabled = true,
  lookDirection = 'center',
  targetObject = null,
  volume = 0,
  brightness = 0.5
}) => {
  const [lookOffset, setLookOffset] = useState({ x: 0, y: 0, rotate: 0, scanScale: 1 });
  const [blink, setBlink] = useState(false);
  const [isDrifting, setIsDrifting] = useState(false);
  const [floating, setFloating] = useState({ y: 0, x: 0 });
  const timerRef = useRef<any>(null);
  const microSaccadeRef = useRef<any>(null);
  const lookRef = useRef(lookOffset);

  // Trigger sonoro automatico al cambio di emozione
  useEffect(() => {
    if (!isSoundEnabled) return;

    switch (currentEmotion) {
      case Emotion.HAPPY:
      case Emotion.LOVE:
      case Emotion.YES:
      case Emotion.STAR:
        soundService.playBeep(BeepType.HAPPY);
        break;
      case Emotion.SAD:
      case Emotion.BORED:
      case Emotion.NO:
      case Emotion.CRYING:
        soundService.playBeep(BeepType.SAD);
        break;
      case Emotion.SURPRISED:
      case Emotion.SHOCKED:
        soundService.playBeep(BeepType.SURPRISED);
        break;
      case Emotion.ANGRY:
        soundService.playBeep(BeepType.ANGRY);
        break;
      case Emotion.CONFUSED:
      case Emotion.DIZZY:
      case Emotion.ANXIOUS:
        soundService.playBeep(BeepType.CONFUSED);
        break;
      case Emotion.RECOGNIZING:
        soundService.playBeep(BeepType.RECOGNIZING);
        break;
      case Emotion.SCANNING:
      case Emotion.THINKING:
        soundService.playBeep(BeepType.SCANNING);
        break;
      case Emotion.COOL:
        soundService.playBeep(BeepType.COOL);
        break;
      case Emotion.DREAMING:
        soundService.playBeep(BeepType.DREAMING);
        break;
      case Emotion.ATTENTION:
        soundService.playBeep(BeepType.BLIP);
        break;
    }
  }, [currentEmotion, isSoundEnabled]);

  // Manteniamo il riferimento aggiornato per evitare closure stale nelle funzioni di logica
  useEffect(() => {
    lookRef.current = lookOffset;
  }, [lookOffset]);

  // Logica di dilatazione pupillare dinamica (basata su luce e suono)
  const dilationFactor = useMemo(() => {
    const lightEffect = (1 - brightness) * 0.12; 
    const volumeEffect = Math.max(0, (volume - 40) / 200); 
    return 1 + lightEffect + Math.min(volumeEffect, 0.25);
  }, [brightness, volume]);

  // Jitter ambientale basato sul volume per simulare la sensibilità del robot
  const soundJitter = useMemo(() => {
    if (volume < 45) return { x: 0, y: 0, rotate: 0 };
    const intensity = Math.min((volume - 40) / 30, 2.5);
    const activeMultiplier = (lookDirection !== 'center' || targetObject) ? 0.15 : 1;
    return {
      x: (Math.random() - 0.5) * intensity * activeMultiplier,
      y: (Math.random() - 0.5) * intensity * activeMultiplier,
      rotate: (Math.random() - 0.5) * (intensity * 0.3) * activeMultiplier
    };
  }, [volume, lookDirection, targetObject]);

  // Simulazione dello sguardo biologico: Saccadi, Drift e Fissazioni
  useEffect(() => {
    const updateGaze = () => {
      if (
        currentEmotion === Emotion.SLEEPING || 
        currentEmotion === Emotion.YES ||
        currentEmotion === Emotion.NO ||
        currentEmotion === Emotion.RECOGNIZING ||
        currentEmotion === Emotion.SPEECHLESS ||
        currentEmotion === Emotion.THINKING
      ) {
        setLookOffset({ x: 0, y: 0, rotate: 0, scanScale: 1 });
        setIsDrifting(false);
        timerRef.current = setTimeout(updateGaze, 2500);
        return; 
      }
      
      let targetX = 0;
      let targetY = 0;
      let targetRotate = 0;
      let targetScanScale = 1;
      let nextJump = 2800 + Math.random() * 5500;
      let drifting = false;

      const isTrackingObject = !!targetObject;
      const prevRotation = lookRef.current.rotate;

      if (currentEmotion === Emotion.ANXIOUS) {
        // Logica specifica per ANXIOUS: sguardi rapidi ed erratici
        targetX = (Math.random() - 0.5) * 110;
        targetY = (Math.random() - 0.5) * 50;
        targetRotate = targetX * 0.12;
        targetScanScale = 0.85 + Math.random() * 0.3;
        nextJump = 200 + Math.random() * 600; // Molto frequente
      } else if (isTrackingObject) {
        const offsetMultiplier = 95;
        if (lookDirection === 'left') targetX = -offsetMultiplier;
        else if (lookDirection === 'right') targetX = offsetMultiplier;
        else targetX = 0;

        targetY = (Math.random() - 0.5) * 4; 
        targetRotate = (targetX * 0.08);
        targetScanScale = 1.18; 
        nextJump = nextJump * 4.0;
      } else if (lookDirection !== 'center') {
        targetX = lookDirection === 'left' ? -82 : 82;
        targetY = (Math.random() - 0.5) * 10;
        targetRotate = lookDirection === 'left' ? -7 : 7;
        targetScanScale = 1.12; 
        nextJump = nextJump * 2.2;
      } else {
        const rand = Math.random();
        const curiositySaccade = rand > 0.85; 
        const curiosityDrift = rand > 0.65 && rand <= 0.85;

        if (curiositySaccade) {
          const momentumX = prevRotation * 8; 
          const momentumY = prevRotation * 2.5;
          targetX = ((Math.random() - 0.5) * 110) + momentumX; 
          targetY = ((Math.random() - 0.5) * 50) + momentumY;
          targetX = Math.max(-115, Math.min(115, targetX));
          targetY = Math.max(-60, Math.min(60, targetY));
          targetRotate = (targetX * 0.12) + (targetY * 0.06);
          targetScanScale = 0.8 + Math.random() * 0.35; 
        } else if (curiosityDrift) {
          drifting = true;
          targetX = (Math.random() - 0.5) * 70;
          targetY = (Math.random() - 0.5) * 40;
          targetRotate = targetX * 0.06;
          targetScanScale = 0.95 + Math.random() * 0.1;
          nextJump = 6000 + Math.random() * 5000; 
        } else {
          targetX = (Math.random() - 0.5) * 22;
          targetY = (Math.random() - 0.5) * 10;
          targetRotate = (targetX * 0.03);
          targetScanScale = 1;
        }
      }

      const soundModifier = volume > 80 ? 0.7 : 1.3;
      setIsDrifting(drifting);
      setLookOffset({ x: targetX, y: targetY, rotate: targetRotate, scanScale: targetScanScale });
      timerRef.current = setTimeout(updateGaze, nextJump * soundModifier);
    };

    const applyMicroSaccade = () => {
      const stabilityFactor = !!targetObject || isDrifting ? 0.2 : (currentEmotion === Emotion.ANXIOUS ? 2.5 : 1);
      setLookOffset(prev => ({
        ...prev,
        x: prev.x + (Math.random() - 0.5) * 0.7 * stabilityFactor, 
        y: prev.y + (Math.random() - 0.5) * 0.7 * stabilityFactor,
        rotate: prev.rotate + (Math.random() - 0.5) * 0.18 * stabilityFactor
      }));
      
      const jitterFrequency = (volume > 60 || currentEmotion === Emotion.ANXIOUS) ? 150 : 550;
      microSaccadeRef.current = setTimeout(applyMicroSaccade, jitterFrequency + Math.random() * 400);
    };

    updateGaze();
    applyMicroSaccade();

    return () => { 
      if (timerRef.current) clearTimeout(timerRef.current);
      if (microSaccadeRef.current) clearTimeout(microSaccadeRef.current);
    };
  }, [currentEmotion, lookDirection, targetObject, volume, isDrifting]);

  // Gestione ammiccamento e galleggiamento organico
  useEffect(() => {
    const blinkInterval = setInterval(() => {
        if (currentEmotion === Emotion.SLEEPING || currentEmotion === Emotion.RECOGNIZING || currentEmotion === Emotion.SPEECHLESS) return;
        const isDouble = Math.random() > 0.85 || currentEmotion === Emotion.ANXIOUS;
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          if (isDouble) {
            setTimeout(() => {
              setBlink(true);
              setTimeout(() => setBlink(false), 90);
            }, 70);
          }
        }, 110);
    }, (currentEmotion === Emotion.ANXIOUS ? 1200 : 4500) + Math.random() * 8000); 

    const floatInterval = setInterval(() => {
        const time = Date.now() / 3200;
        setFloating({ 
          y: Math.sin(time) * (currentEmotion === Emotion.ANXIOUS ? 6 : 4),
          x: Math.cos(time * 0.6) * 1.5 
        }); 
    }, 16);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(floatInterval);
    };
  }, [currentEmotion]);

  const renderEyeShape = (emotion: Emotion, side: 'left' | 'right') => {
    switch (emotion) {
      case Emotion.HAPPY: return <EyeParts.HappyEye />;
      case Emotion.SAD: return <EyeParts.SadEye />;
      case Emotion.LOVE: return <EyeParts.HeartEye />;
      case Emotion.STAR: return <EyeParts.StarEye />;
      case Emotion.CONFUSED: return <EyeParts.QuestionEye />;
      case Emotion.SLEEPING: return <EyeParts.SleepyEye />;
      case Emotion.DIZZY: return <EyeParts.SpiralEye />;
      case Emotion.SPEECHLESS: return <EyeParts.SpeechlessEye />;
      case Emotion.THINKING: 
        return (
          <motion.g 
            animate={{ opacity: [1, 0.4, 1] }} 
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          >
            <EyeParts.ThinkingEye />
          </motion.g>
        );
      case Emotion.COOL: return <EyeParts.CoolEye />;
      case Emotion.ANXIOUS: 
        return (
          <motion.g 
            animate={{ x: [-3, 3, -3], y: [-2, 2, -2] }} 
            transition={{ repeat: Infinity, duration: 0.08 }}
          >
            <EyeParts.AnxiousEye />
          </motion.g>
        );
      case Emotion.SHOCKED: return <EyeParts.ShockedEye />;
      case Emotion.DREAMING: return <EyeParts.DreamingEye />;
      case Emotion.RECOGNIZING: 
        return (
          <motion.g 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          >
            <EyeParts.RecognizingEye />
          </motion.g>
        );
      case Emotion.ANGRY: 
          return <g transform={side === 'left' ? 'scale(1,1)' : 'scale(-1,1) translate(-100,0)'}><EyeParts.AngryEye /></g>;
      case Emotion.SURPRISED: return <circle cx="50" cy="50" r="45" />;
      case Emotion.BORED: return <rect x="0" y="48" width="100" height="12" rx="6" />;
      case Emotion.ATTENTION: return <EyeParts.AttentionEye />;
      case Emotion.SCANNING: return <rect x="0" y="20" width="100" height="60" rx="10" />;
      case Emotion.WINK: 
        return side === 'left' ? <EyeParts.RectEye /> : <path d="M0 60 Q 50 50 100 60" fill="none" stroke="currentColor" strokeWidth="15" strokeLinecap="round" />;
      case Emotion.SUNNY: return <EyeParts.SunEye />;
      case Emotion.RAINY: return <EyeParts.RainEye />;
      case Emotion.CLOUDY: return <EyeParts.CloudEye />;
      case Emotion.SNOWY: return <EyeParts.SnowEye />;
      case Emotion.YES: return <EyeParts.HappyEye />;
      case Emotion.NO: return <EyeParts.SadEye />;
      default: return <EyeParts.RectEye />;
    }
  };

  const eyeColor = useMemo(() => {
    if (currentEmotion === Emotion.RECOGNIZING) return '#22d3ee'; 
    if (currentEmotion === Emotion.ATTENTION) return '#fbbf24'; 
    if (currentEmotion === Emotion.SCANNING) return '#a855f7'; 
    if (currentEmotion === Emotion.HAPPY || currentEmotion === Emotion.LOVE || currentEmotion === Emotion.YES) return '#f472b6'; 
    if (currentEmotion === Emotion.NO) return '#ef4444'; 
    if (currentEmotion === Emotion.SUNNY) return '#facc15'; 
    if (currentEmotion === Emotion.RAINY) return '#60a5fa'; 
    if (currentEmotion === Emotion.SNOWY) return '#e0f2fe'; 
    if (currentEmotion === Emotion.CLOUDY) return '#94a3b8'; 
    if (currentEmotion === Emotion.SPEECHLESS) return '#64748b'; 
    if (currentEmotion === Emotion.THINKING) return '#fbbf24'; 
    if (currentEmotion === Emotion.COOL) return '#2dd4bf'; 
    if (currentEmotion === Emotion.ANXIOUS) return '#f97316'; 
    if (currentEmotion === Emotion.SHOCKED) return '#ffffff'; 
    if (currentEmotion === Emotion.DREAMING) return '#c084fc'; 
    return isListening ? '#4ade80' : '#38bdf8';
  }, [currentEmotion, isListening]);

  const organicTransition = {
    type: 'spring',
    stiffness: isDrifting ? 15 : (currentEmotion === Emotion.ANXIOUS ? 250 : (!!targetObject ? 115 : 80)), 
    damping: isDrifting ? 25 : (currentEmotion === Emotion.ANXIOUS ? 12 : 16),
    mass: isDrifting ? 2.5 : (currentEmotion === Emotion.ANXIOUS ? 0.8 : 1.5), 
    restDelta: 0.001
  };

  const eyeVariants = {
    initial: { 
      opacity: 0, 
      scale: 0.8, 
      rotate: 0,
      filter: 'blur(10px)',
    },
    animate: () => ({ 
      opacity: 1, 
      scale: blink ? 0.02 : (dilationFactor * lookOffset.scanScale),
      rotate: lookOffset.rotate + soundJitter.rotate, 
      filter: 'blur(0px)',
      x: (currentEmotion === Emotion.NO ? [0, -35, 35, -35, 35, 0] : lookOffset.x) + soundJitter.x + floating.x,
      y: (currentEmotion === Emotion.YES ? [0, -35, 10, -35, 10, 0] : (lookOffset.y + floating.y)) + soundJitter.y,
      transition: {
        ...(currentEmotion === Emotion.YES || currentEmotion === Emotion.NO 
           ? { x: { duration: 0.8 }, y: { duration: 0.8 } } 
           : organicTransition
        )
      }
    }),
    exit: { 
      opacity: 0, 
      scale: 0.7, 
      rotate: 0,
      filter: 'blur(15px)',
      transition: { duration: 0.35, ease: "circIn" }
    }
  };

  return (
    <div className="flex items-center justify-center gap-20 md:gap-40 h-full w-full bg-black overflow-hidden relative perspective-1000">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div 
              animate={{ 
                scale: [1, 1.05, 1], 
                opacity: isListening ? [0.12, 0.25, 0.12] : [0.03, 0.06, 0.03],
                boxShadow: `0 0 ${230 * dilationFactor * lookOffset.scanScale}px 90px ${eyeColor}`
              }}
              transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
              className="w-[90vw] h-[70vh] border-[50px] border-white/5 blur-3xl rounded-[220px] transition-colors duration-2500" 
            />
        </div>

        <div className="flex gap-20 md:gap-40 relative z-10 h-[260px] items-center">
            {['left', 'right'].map((side) => (
              <div key={side} className="relative w-[240px] h-[240px] flex items-center justify-center">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={`${currentEmotion}-${side}`}
                    variants={eyeVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ 
                      color: eyeColor,
                      strokeWidth: dilationFactor * 2.2 
                    }}
                  >
                    <motion.div
                      animate={isListening ? { opacity: [1, 0.7, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                    >
                      <svg width="230" height="230" viewBox="0 0 120 120" className="fill-current stroke-current drop-shadow-[0_0_20px_rgba(255,255,255,0.06)]">
                        <g transform="translate(10, 10)">
                          {renderEyeShape(currentEmotion, side as 'left' | 'right')}
                        </g>
                      </svg>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </div>
            ))}
        </div>

        {(isListening || currentEmotion === Emotion.SCANNING || currentEmotion === Emotion.RECOGNIZING) && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="absolute bottom-16 flex flex-col items-center gap-5"
            >
                <div className="flex gap-3 h-8 items-center">
                  {[...Array(15)].map((_, i) => (
                      <motion.div 
                          key={i}
                          animate={{ height: [6, 26, 6], opacity: [0.1, 1, 0.1] }}
                          transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.07, ease: "circInOut" }}
                          className={`w-1.5 rounded-full ${currentEmotion === Emotion.RECOGNIZING ? 'bg-cyan-500/60' : currentEmotion === Emotion.SCANNING ? 'bg-purple-500/60' : 'bg-green-500/60'}`}
                      />
                  ))}
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-[9px] uppercase font-black italic tracking-[0.8em] transition-colors ${currentEmotion === Emotion.RECOGNIZING ? 'text-cyan-400 opacity-70' : currentEmotion === Emotion.SCANNING ? 'text-purple-400 opacity-70' : 'text-green-400 opacity-70'}`}>
                    {currentEmotion === Emotion.RECOGNIZING ? "Neural Recognizing" : currentEmotion === Emotion.SCANNING ? "Neural Sync" : "Quantum Stream"}
                  </span>
                  <div className={`h-[1px] w-28 mt-2 transition-colors ${currentEmotion === Emotion.RECOGNIZING ? 'bg-cyan-500/30' : currentEmotion === Emotion.SCANNING ? 'bg-purple-500/30' : 'bg-green-500/30'}`} />
                </div>
            </motion.div>
        )}
    </div>
  );
};

export default PetRobotFace;
