
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PetRobotFace from './components/PetRobotFace';
import { Emotion } from './types';
import { useNemoSensors } from './hooks/useNemoSensors';
import { useNemoBrain } from './hooks/useNemoBrain';

const App: React.FC = () => {
  const ROBOT_NAME = "Nemo";
  const INACTIVITY_DELAY = 8000;

  // Environment Check
  // Supports both Vite standard and the custom define in vite.config
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;

  const [showControls, setShowControls] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [brightness, setBrightness] = useState(0.5);
  const inactivityTimeoutRef = useRef<any>(null);
  const visionIntervalRef = useRef<any>(null);


  const sensors = useNemoSensors(ROBOT_NAME);
  // Brain now connects to sensors for reflexes
  const brain = useNemoBrain(API_KEY, sensors.volume);

  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);

  // Mouse Tracking for Interaction
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Don't track if sleeping
      if (brain.currentEmotion === Emotion.SLEEPING) {
        if (mousePos) setMousePos(null);
        return;
      }

      const { clientX, clientY } = e;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Calculate normalized coordinates (-1 to +1)
      const x = (clientX / width) * 2 - 1;
      const y = (clientY / height) * 2 - 1;

      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [brain.currentEmotion, mousePos]);

  // Inactivity Timer for Controls
  useEffect(() => {
    const resetTimer = () => {
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      if (showControls) {
        inactivityTimeoutRef.current = setTimeout(() => setShowControls(false), INACTIVITY_DELAY);
      }
    };

    if (showControls) {
      resetTimer();
      ['mousemove', 'mousedown', 'touchstart', 'keydown'].forEach(e => window.addEventListener(e, resetTimer));
    }
    return () => {
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      window.removeEventListener('mousemove', resetTimer); // simplified cleanup
    };
  }, [showControls]);

  // Connect Sensors to Brain: Vision
  useEffect(() => {
    if (sensors.isCameraEnabled && sensors.videoRef.current) {
      // Run vision check every 4 seconds
      visionIntervalRef.current = setInterval(() => {
        if (sensors.videoRef.current) {
          brain.processVisuals(sensors.videoRef.current);
        }
      }, 4000);
    } else {
      if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
    }
    return () => clearInterval(visionIntervalRef.current);
  }, [sensors.isCameraEnabled, brain.processVisuals]);

  // Connect Sensors to Brain: Voice
  useEffect(() => {
    if (sensors.lastCommand) {
      brain.processText(sensors.lastCommand);
      sensors.clearCommand();
    }
  }, [sensors.lastCommand, brain.processText, sensors.clearCommand]);

  // Handle Missing Key UI
  if (!API_KEY) {
    return (
      <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center font-mono">
        <h1 className="text-4xl font-bold mb-4 text-red-500">SYSTEM ERROR: MISSING CORTEX</h1>
        <p className="mb-8 max-w-lg text-zinc-400">
          Nemo requires a Gemini API Key to function.
          Please create a <code className="bg-zinc-800 px-2 py-1 rounded">.env.local</code> file in the root directory with:
        </p>
        <div className="bg-zinc-900 p-4 rounded border border-zinc-700 select-all">
          VITE_GEMINI_API_KEY=your_api_key_here
        </div>
      </div>
    );
  }

  const emotionsList = Object.values(Emotion);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden flex flex-col items-center justify-center font-sans text-white relative select-none">
      {/* Hidden Video Element for Sensors */}
      <video ref={sensors.videoRef} autoPlay playsInline className="hidden" muted />

      {/* Header Statues */}
      <div className="absolute top-8 left-8 z-50 pointer-events-none flex items-center gap-3">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`w-3 h-3 rounded-full ${sensors.isSensorEnabled ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-red-500'}`}
        />
        <span className="font-black text-xl tracking-tighter uppercase font-mono text-zinc-300">
          {ROBOT_NAME} <span className="text-xs ml-1 text-zinc-500">OS v2.1</span>
        </span>
      </div>

      {/* Main Face Container */}
      <div className="flex-1 w-full relative flex items-center justify-center cursor-pointer"
        onClick={() => {
          // Priority to petting interaction
          brain.handleTouch();
        }}
      >
        <PetRobotFace
          currentEmotion={brain.currentEmotion}
          isListening={sensors.isListeningForCommand || brain.isThinking} // Show active when listening OR thinking
          isSoundEnabled={isSoundEnabled}
          lookDirection={brain.facePosition}
          targetObject={brain.targetObject}
          volume={sensors.volume}
          brightness={brain.brightness}
          mousePos={mousePos}
        />

        {/* Subtitles (Hearing) */}
        <div className="absolute bottom-24 w-full flex justify-center pointer-events-none">
          <span className="text-white/50 text-sm font-mono bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm transition-opacity duration-300"
            style={{ opacity: sensors.transcript ? 1 : 0 }}>
            👂 {sensors.transcript}
          </span>
        </div>

        {/* Brain Output / Dialogue Bubbles */}
        <AnimatePresence>
          {brain.nemoResponse && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              className="absolute top-24 right-8 md:top-32 md:right-32 max-w-sm z-20"
            >
              <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl rounded-tr-none shadow-2xl relative">
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full animate-ping" />
                <p className="text-lg font-medium italic text-right text-blue-100">"{brain.nemoResponse}"</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Dashboard */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 w-full p-4 md:p-6 z-40 flex justify-center"
          >
            <div className="w-full max-w-4xl bg-black/80 backdrop-blur-3xl rounded-[3rem] p-6 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5">

              {/* Toolbar */}
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">System Control</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full 
                        ${brain.isThinking ? 'bg-purple-500 animate-pulse' :
                        sensors.isSensorEnabled ? 'bg-green-500 shadow-[0_0_5px_green]' : 'bg-zinc-700'}`}
                    />
                    <span className="text-xs font-mono text-zinc-400">
                      {brain.isThinking ? 'NEURAL PROCESSING' :
                        sensors.isSensorEnabled ? 'SYSTEM ONLINE (LISTENING)' : 'SYSTEM OFFLINE'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <ControlBtn
                    active={sensors.isCameraEnabled}
                    onClick={sensors.toggleCamera}
                    icon={<CameraIcon />}
                    color="blue"
                  />
                  <ControlBtn
                    active={sensors.isSensorEnabled}
                    onClick={sensors.toggleSensor}
                    icon={<MicIcon />}
                    color="green"
                  />
                  <ControlBtn
                    active={isSoundEnabled}
                    onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                    icon={<SoundIcon muted={!isSoundEnabled} />}
                    color="yellow"
                  />
                  <button onClick={() => setShowControls(false)} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                    <ChevronDownIcon />
                  </button>
                </div>
              </div>

              {/* Emotion Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 overflow-y-auto max-h-40 p-2 custom-scrollbar">
                {emotionsList.map((emo) => (
                  <button
                    key={emo}
                    onClick={() => brain.setEmotionTemporarily(emo)}
                    className={`py-3 px-2 rounded-xl text-[10px] font-bold uppercase transition-all duration-200 border border-transparent
                        ${brain.currentEmotion === emo
                        ? 'bg-white text-black scale-105 shadow-lg shadow-white/20'
                        : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 hover:border-white/10'}`}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showControls && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowControls(true)}
          className="fixed bottom-8 px-8 py-3 rounded-full bg-zinc-900/90 backdrop-blur border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] transition-all z-30 hover:bg-zinc-800 shadow-2xl"
        >
          SYSTEM MENU
        </motion.button>
      )}

      {sensors.permissionError && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur text-white text-xs font-bold px-6 py-3 rounded-full z-[60] shadow-xl flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-bounce" />
          <span>{sensors.permissionError}</span>
          <button
            onClick={() => alert("Se il microfono è bloccato:\n1. Clicca sull'icona del lucchetto 🔒 nella barra degli indirizzi (in alto a sinistra).\n2. Clicca su 'Impostazioni sito' o attiva l'interruttore 'Microfono'.\n3. Ricarica la pagina.")}
            className="ml-2 bg-white text-red-600 px-3 py-1 rounded-full text-[10px] uppercase shadow-sm hover:bg-zinc-100"
          >
            Come Risolvere
          </button>
        </div>
      )}
    </div>
  );
};

// Subcomponents for cleaner JSX
const ControlBtn = ({ active, onClick, icon, color }: any) => {
  const colorClasses = {
    blue: active ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'bg-zinc-800/50 text-zinc-500',
    green: active ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'bg-zinc-800/50 text-zinc-500',
    yellow: active ? 'bg-yellow-500 text-white shadow-[0_0_20px_rgba(234,179,8,0.5)]' : 'bg-zinc-800/50 text-zinc-500',
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-2xl transition-all duration-300 backdrop-blur-sm ${colorClasses[color as keyof typeof colorClasses]} hover:scale-105 active:scale-95`}
    >
      {icon}
    </button>
  );
}

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
);

const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v11" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 23v-4" /></svg>
);

const SoundIcon = ({ muted }: { muted: boolean }) => (
  muted
    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
);

const ChevronDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);

export default App;
