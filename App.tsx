
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PetRobotFace from './components/PetRobotFace';
import { Emotion } from './types';
import { AudioSensor } from './services/audioSensor';
import { soundService, BeepType } from './services/soundService';
import { GoogleGenAI, Type } from "@google/genai";

interface CustomMapping {
  phrase: string;
  emotion: Emotion;
}

const App: React.FC = () => {
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>(Emotion.NEUTRAL);
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [isSensorEnabled, setIsSensorEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isListeningForCommand, setIsListeningForCommand] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [nemoResponse, setNemoResponse] = useState<string | null>(null);
  const [facePosition, setFacePosition] = useState<'left' | 'center' | 'right'>('center');
  const [targetObject, setTargetObject] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [brightness, setBrightness] = useState(0.5); // 0 to 1
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const [customMappings, setCustomMappings] = useState<CustomMapping[]>(() => {
    const saved = localStorage.getItem('nemo_mappings');
    return saved ? JSON.parse(saved) : [
      { phrase: 'ciao', emotion: Emotion.HAPPY },
      { phrase: 'dormi', emotion: Emotion.SLEEPING },
      { phrase: 'ti voglio bene', emotion: Emotion.LOVE },
      { phrase: 'fammi pensare', emotion: Emotion.THINKING },
      { phrase: 'sei forte', emotion: Emotion.COOL },
      { phrase: 'hai paura', emotion: Emotion.ANXIOUS },
      { phrase: 'che shock', emotion: Emotion.SHOCKED },
      { phrase: 'sogni d\'oro', emotion: Emotion.DREAMING }
    ];
  });
  const [newMappingPhrase, setNewMappingPhrase] = useState('');
  const [newMappingEmotion, setNewMappingEmotion] = useState<Emotion>(Emotion.HAPPY);

  const audioSensorRef = useRef<AudioSensor>(new AudioSensor());
  const emotionTimeoutRef = useRef<any | null>(null);
  const inactivityTimeoutRef = useRef<any | null>(null);
  const isReactingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visionIntervalRef = useRef<any>(null);
  const volumeRequestRef = useRef<number | null>(null);

  const ROBOT_NAME = "Nemo";
  const INACTIVITY_DELAY = 10000;

  useEffect(() => {
    localStorage.setItem('nemo_mappings', JSON.stringify(customMappings));
  }, [customMappings]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    if (showControls) {
      inactivityTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, INACTIVITY_DELAY);
    }
  }, [showControls]);

  useEffect(() => {
    if (showControls) {
      resetInactivityTimer();
      const events = ['mousemove', 'mousedown', 'touchstart', 'keydown'];
      events.forEach(e => window.addEventListener(e, resetInactivityTimer));
      return () => {
        events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      };
    }
  }, [showControls, resetInactivityTimer]);

  const setEmotionTemporarily = useCallback((emotion: Emotion, duration: number = 3000) => {
    if (emotionTimeoutRef.current) clearTimeout(emotionTimeoutRef.current);
    isReactingRef.current = true;
    setCurrentEmotion(emotion);
    emotionTimeoutRef.current = setTimeout(() => {
      setCurrentEmotion(Emotion.NEUTRAL);
      isReactingRef.current = false;
    }, duration);
  }, []);

  const updateVolume = useCallback(() => {
    if (isSensorEnabled) {
      const v = audioSensorRef.current.getVolume();
      setVolume(v);
      volumeRequestRef.current = requestAnimationFrame(updateVolume);
    }
  }, [isSensorEnabled]);

  useEffect(() => {
    if (isSensorEnabled) {
      volumeRequestRef.current = requestAnimationFrame(updateVolume);
    } else {
      if (volumeRequestRef.current) cancelAnimationFrame(volumeRequestRef.current);
      setVolume(0);
    }
    return () => {
      if (volumeRequestRef.current) cancelAnimationFrame(volumeRequestRef.current);
    };
  }, [isSensorEnabled, updateVolume]);

  const processVisuals = async () => {
    if (!videoRef.current || !canvasRef.current || isThinking || !isAiEnabled) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    canvas.width = 320;
    canvas.height = 240;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let r, g, b, avg;
    let colorSum = 0;
    for(let x = 0, len = data.length; x < len; x+=4) {
      r = data[x];
      g = data[x+1];
      b = data[x+2];
      avg = Math.floor((r+g+b)/3);
      colorSum += avg;
    }
    const bright = colorSum / (canvas.width * canvas.height * 255);
    setBrightness(bright);

    const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const emotionsList = Object.values(Emotion).join(", ");
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: [
          {
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: base64Image } },
              { text: `Analizza l'ambiente. JSON: {"seen": "string|none", "pos": "left"|"center"|"right", "emotion": "EMO"}` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              seen: { type: Type.STRING },
              pos: { type: Type.STRING },
              emotion: { type: Type.STRING }
            },
            required: ["seen", "pos", "emotion"]
          }
        }
      });

      const dataJson = JSON.parse(response.text || "{}");
      if (dataJson.seen && dataJson.seen !== 'none') {
        setTargetObject(dataJson.seen);
        setFacePosition(dataJson.pos || 'center');
        const emo = (dataJson.emotion || "").toUpperCase() as Emotion;
        if (Object.values(Emotion).includes(emo) && !isReactingRef.current) {
          setCurrentEmotion(emo);
        }
      }
    } catch (error) {
      console.debug("Vision cycle skipped");
    }
  };

  useEffect(() => {
    if (isCameraEnabled && isAiEnabled) {
      visionIntervalRef.current = setInterval(processVisuals, 3000);
      processVisuals();
    } else {
      if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
    }
    return () => clearInterval(visionIntervalRef.current);
  }, [isCameraEnabled, isAiEnabled]);

  const processDiscourse = async (text: string) => {
    const lowerText = text.toLowerCase();
    const mapping = customMappings.find(m => lowerText.includes(m.phrase.toLowerCase()));
    
    if (mapping) {
      setEmotionTemporarily(mapping.emotion, 5000);
      setNemoResponse(`Mappa neurale: ${mapping.phrase} -> ${mapping.emotion}`);
      return;
    }

    if (!isAiEnabled) return;

    setIsThinking(true);
    setCurrentEmotion(Emotion.SCANNING); 
    setNemoResponse(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const emotionsList = Object.values(Emotion).join(", ");
      
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", 
        contents: `Sei Nemo. Rispondi brevemente a: "${text}". JSON: {"text": "risposta", "emotion": "EMO"}` ,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              emotion: { type: Type.STRING }
            },
            required: ["text", "emotion"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      setNemoResponse(data.text);
      const emo = (data.emotion || "").toUpperCase() as Emotion;
      if (Object.values(Emotion).includes(emo)) {
        setEmotionTemporarily(emo, 6000);
      }
    } catch (error) {
      setEmotionTemporarily(Emotion.CONFUSED, 3000);
    } finally {
      setIsThinking(false);
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'it-IT';

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      if (transcript.includes(ROBOT_NAME.toLowerCase())) {
        const cmd = transcript.split(ROBOT_NAME.toLowerCase())[1]?.trim();
        if (cmd) processDiscourse(cmd);
        else {
          setCurrentEmotion(Emotion.ATTENTION);
          setIsListeningForCommand(true);
          setTimeout(() => setIsListeningForCommand(false), 5000);
        }
      } else if (isListeningForCommand) {
        processDiscourse(transcript);
        setIsListeningForCommand(false);
      }
    };

    recognition.onend = () => { if (isSensorEnabled) try { recognition.start(); } catch {} };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setPermissionError("Microfono negato. Controlla i permessi del browser (icona lucchetto).");
        setIsSensorEnabled(false);
      }
    };

    if (isSensorEnabled) try { recognition.start(); } catch {}
    return () => { try { recognition.stop(); } catch {} };
  }, [isSensorEnabled, isListeningForCommand, isAiEnabled]);

  const toggleSensor = async () => {
    setPermissionError(null);
    if (!isSensorEnabled) {
      const success = await audioSensorRef.current.start();
      if (success) setIsSensorEnabled(true);
      else setPermissionError("Permesso microfono negato o non disponibile.");
    } else {
      audioSensorRef.current.stop();
      setIsSensorEnabled(false);
    }
  };

  const toggleCamera = async () => {
    setPermissionError(null);
    if (!isCameraEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraEnabled(true);
          setEmotionTemporarily(Emotion.SURPRISED, 1200);
        }
      } catch (e) { 
        setPermissionError("Fotocamera negata. Clicca sul lucchetto nella barra degli indirizzi e abilita la fotocamera.");
      }
    } else {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      setIsCameraEnabled(false);
      setFacePosition('center');
    }
  };

  const emotionsList = Object.values(Emotion);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden flex flex-col items-center justify-center font-sans text-white">
      <video ref={videoRef} autoPlay playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      <AnimatePresence>
        {permissionError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-red-500/30 backdrop-blur-xl border border-red-500/50 px-6 py-4 rounded-2xl flex flex-col items-center gap-2 text-xs font-bold text-red-100 max-w-sm text-center shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m10.29 3.86 7.92 14.17A2 2 0 0 1 16.47 21H3.53a2 2 0 0 1-1.74-2.97l7.92-14.17a2 2 0 0 1 3.58 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              ERRORE PERMESSI
            </div>
            <p>{permissionError}</p>
            <button onClick={() => setPermissionError(null)} className="mt-2 text-[10px] underline opacity-70">Chiudi</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 w-full relative flex items-center justify-center" onClick={() => setShowControls(true)}>
        <PetRobotFace 
          currentEmotion={currentEmotion} 
          isListening={isThinking} 
          isSoundEnabled={isSoundEnabled}
          lookDirection={facePosition}
          targetObject={targetObject}
          volume={volume}
          brightness={brightness}
        />

        <AnimatePresence>
          {nemoResponse && (
            <motion.div 
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              className="absolute top-6 right-8 max-w-sm bg-blue-500/10 backdrop-blur-3xl border border-blue-400/20 p-6 rounded-[32px] shadow-2xl z-20"
            >
              <p className="text-xl font-medium tracking-tight text-white/90 leading-snug text-right italic">
                "{nemoResponse}"
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed top-8 left-8 flex flex-col gap-2 z-50 pointer-events-none">
        <div className="flex items-center gap-4">
            <div className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${!isAiEnabled ? 'bg-zinc-600' : isThinking ? 'bg-purple-500 shadow-[0_0_15px_#a855f7]' : isListeningForCommand ? 'bg-yellow-400 shadow-[0_0_15px_yellow]' : isSensorEnabled ? 'bg-green-500 shadow-[0_0_15px_green]' : 'bg-red-500 shadow-[0_0_15px_red]'}`} />
            <div className="flex flex-col">
              <span className="font-black text-2xl tracking-tighter uppercase leading-none">{ROBOT_NAME}</span>
            </div>
        </div>
      </div>

      <div className={`fixed bottom-0 left-0 w-full p-6 transition-all duration-700 transform ${showControls ? 'translate-y-0' : 'translate-y-full opacity-0'} z-40`}>
        <div className="max-w-6xl mx-auto bg-zinc-900/90 backdrop-blur-3xl rounded-[40px] p-8 border border-white/5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <h2 className="font-black text-xl tracking-tighter uppercase text-blue-400">Dashboard</h2>
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSoundEnabled(!isSoundEnabled)} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${isSoundEnabled ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-white/5 border-white/10 text-white/40'}`}>AUDIO: {isSoundEnabled ? 'ON' : 'OFF'}</button>
                <button onClick={toggleCamera} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${isCameraEnabled ? 'bg-blue-500 border-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}>CAMERA</button>
                <button onClick={toggleSensor} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${isSensorEnabled ? 'bg-green-500 border-green-400 text-black' : 'bg-white/5 border-white/10 text-white/40'}`}>MIC</button>
                <button onClick={() => setShowControls(false)} className="bg-white/10 p-2 rounded-xl"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg></button>
            </div>
          </div>
          
          <div className="mt-8 grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
            {emotionsList.map((emo) => (
              <button key={emo} onClick={() => setEmotionTemporarily(emo)} className={`py-2 rounded-lg text-[8px] font-bold uppercase border ${currentEmotion === emo ? 'bg-blue-500 border-blue-400' : 'bg-white/5 border-transparent text-white/40'}`}>{emo}</button>
            ))}
          </div>
        </div>
      </div>

      {!showControls && (
        <motion.button 
          whileHover={{ scale: 1.05 }}
          onClick={() => setShowControls(true)} 
          className="fixed bottom-10 px-10 py-4 rounded-full bg-zinc-900/80 border border-white/10 text-[10px] font-black uppercase tracking-widest z-40 backdrop-blur-xl"
        >
          Menu
        </motion.button>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
