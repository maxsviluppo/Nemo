
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
  
  // Custom Mappings State con nuove classifiche
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
  const isReactingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visionIntervalRef = useRef<any>(null);
  const volumeRequestRef = useRef<number | null>(null);

  const ROBOT_NAME = "Nemo";

  useEffect(() => {
    localStorage.setItem('nemo_mappings', JSON.stringify(customMappings));
  }, [customMappings]);

  // Funzione semplificata: ora il volto gestisce la maggior parte dei suoni via useEffect
  const triggerManualSound = useCallback((type: BeepType) => {
    if (!isSoundEnabled) return;
    soundService.playBeep(type);
  }, [isSoundEnabled]);

  const setEmotionTemporarily = useCallback((emotion: Emotion, duration: number = 3000) => {
    if (emotionTimeoutRef.current) clearTimeout(emotionTimeoutRef.current);
    isReactingRef.current = true;
    setCurrentEmotion(emotion);
    // soundService è ora attivato dal componente PetRobotFace al cambio di currentEmotion
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
              { text: `Sei la corteccia visiva di Nemo. Analizza l'ambiente con precisione per il tracciamento.
              Identifica l'oggetto o la persona più vicina o interessante. 
              Determina la sua posizione orizzontale relativa: 'left', 'center' o 'right'.
              Se non vedi nulla di chiaro, usa 'none' per 'seen' e 'center' per 'pos'.
              Scegli un'emozione coerente: [${emotionsList}].
              JSON: {"seen": "string|none", "pos": "left"|"center"|"right", "emotion": "EMO"}` }
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
        if (Object.values(Emotion).includes(emo) && !isReactingRef.current && Math.random() > 0.4) {
          setCurrentEmotion(emo);
        }
      } else {
        setTargetObject(null);
        setFacePosition('center');
      }
    } catch (error) {
      console.debug("Vision cycle skipped");
    }
  };

  useEffect(() => {
    if (isCameraEnabled && isAiEnabled) {
      visionIntervalRef.current = setInterval(processVisuals, 2500);
      processVisuals();
    } else {
      if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
      setTargetObject(null);
      setFacePosition('center');
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

    if (!isAiEnabled) {
      setNemoResponse("Collegamento neurale sospeso.");
      setEmotionTemporarily(Emotion.CONFUSED, 2000);
      return;
    }

    setIsThinking(true);
    setCurrentEmotion(Emotion.SCANNING); 
    setNemoResponse(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const emotionsList = Object.values(Emotion).join(", ");
      
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", 
        contents: `Tu sei Nemo, un petrobot vivace e intelligente. Rispondi brevemente (max 10 parole) a: "${text}".
        Emozione da: [${emotionsList}].
        JSON: {"text": "risposta", "emotion": "EMO"}` ,
        config: {
          tools: [{googleSearch: {}}],
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
      } else {
        setEmotionTemporarily(Emotion.HAPPY, 4000);
      }
    } catch (error) {
      setEmotionTemporarily(Emotion.CONFUSED, 3000);
      setNemoResponse("Oops, interferenza neurale!");
    } finally {
      setIsThinking(false);
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'it-IT';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          if (transcript.includes(ROBOT_NAME.toLowerCase())) {
            const cmd = transcript.split(ROBOT_NAME.toLowerCase())[1]?.trim();
            if (cmd && cmd.length > 1) processDiscourse(cmd);
            else {
              setCurrentEmotion(Emotion.ATTENTION);
              setIsListeningForCommand(true);
              setTimeout(() => setIsListeningForCommand(false), 5000);
            }
          } else if (isListeningForCommand) {
            processDiscourse(transcript);
            setIsListeningForCommand(false);
          }
        }
      }
    };

    recognition.onend = () => {
      if (isSensorEnabled) {
        try {
          recognition.start();
        } catch (e) {
          console.debug("Recognition auto-restart failed", e);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setPermissionError("Accesso al microfono negato dal browser.");
        setIsSensorEnabled(false);
      }
    };

    recognitionRef.current = recognition;

    if (isSensorEnabled) {
      try {
        recognition.start();
      } catch (e) {
        console.error("Failed to start recognition", e);
      }
    }

    return () => {
      recognition.onend = null;
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [isSensorEnabled, isListeningForCommand, isAiEnabled, customMappings]);

  const toggleSensor = async () => {
    setPermissionError(null);
    if (!isSensorEnabled) {
      const success = await audioSensorRef.current.start();
      if (success) {
        setIsSensorEnabled(true);
      } else {
        setPermissionError("Impossibile attivare il microfono. Controlla i permessi.");
      }
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
        console.error("Camera access failed", e);
        setPermissionError("Accesso alla fotocamera negato o non disponibile.");
      }
    } else {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      setIsCameraEnabled(false);
      setFacePosition('center');
      setBrightness(0.5);
    }
  };

  const addMapping = () => {
    if (newMappingPhrase.trim()) {
      setCustomMappings([...customMappings, { phrase: newMappingPhrase.trim(), emotion: newMappingEmotion }]);
      setNewMappingPhrase('');
    }
  };

  const removeMapping = (index: number) => {
    setCustomMappings(customMappings.filter((_, i) => i !== index));
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
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-red-500/20 backdrop-blur-xl border border-red-500/50 px-6 py-3 rounded-2xl flex items-center gap-4 text-xs font-bold text-red-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m10.29 3.86 7.92 14.17A2 2 0 0 1 16.47 21H3.53a2 2 0 0 1-1.74-2.97l7.92-14.17a2 2 0 0 1 3.58 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            {permissionError}
            <button onClick={() => setPermissionError(null)} className="ml-4 opacity-50 hover:opacity-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 w-full relative flex items-center justify-center">
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
          {targetObject && !nemoResponse && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.5, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-24 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black tracking-widest uppercase text-white/40 italic"
            >
              Tracking: {targetObject}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {nemoResponse && (
            <motion.div 
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              className="absolute top-6 right-8 max-w-sm bg-blue-500/10 backdrop-blur-3xl border border-blue-400/20 p-6 rounded-[32px] shadow-2xl z-20"
            >
              <div className="text-[7px] uppercase tracking-[0.4em] text-blue-400/60 font-black mb-2 italic text-right">Neural Response</div>
              <p className="text-xl font-medium tracking-tight text-white/90 leading-snug text-right">
                {nemoResponse}
              </p>
              <div className="mt-3 flex justify-end gap-1.5">
                {[0, 1, 2].map(i => <motion.div key={i} animate={{ scale: [1, 1.3, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }} className="w-1 h-1 rounded-full bg-blue-400" />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed top-8 left-8 flex flex-col gap-2 z-50 pointer-events-none">
        <div className="flex items-center gap-4">
            <div className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${!isAiEnabled ? 'bg-zinc-600' : isThinking ? 'bg-purple-500 shadow-[0_0_15px_#a855f7]' : isListeningForCommand ? 'bg-yellow-400 shadow-[0_0_15px_yellow]' : isSensorEnabled ? 'bg-green-500 shadow-[0_0_15px_green]' : 'bg-red-500 shadow-[0_0_15px_red]'}`} />
            <div className="flex flex-col">
              <span className="font-black text-2xl tracking-tighter uppercase leading-none">{ROBOT_NAME}</span>
              <span className="text-white/20 text-[8px] uppercase tracking-widest mt-1">
                {isAiEnabled ? "Neural Link Active (Pro)" : "Neural Link Suspended"}
              </span>
            </div>
        </div>
      </div>

      <div className={`fixed bottom-0 left-0 w-full p-6 transition-all duration-700 transform ${showControls ? 'translate-y-0' : 'translate-y-full opacity-0'} z-40`}>
        <div className="max-w-6xl mx-auto bg-zinc-900/90 backdrop-blur-3xl rounded-[40px] p-8 border border-white/5 shadow-2xl flex flex-col gap-8">
          
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <div>
                <h2 className="font-black text-xl tracking-tighter uppercase">Dashboard Neurale</h2>
                <div className="flex gap-4 text-[9px] text-white/30 font-bold uppercase tracking-widest mt-1">
                  <span>Pro Interface v2.6</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-[24px] border border-white/5">
                <div className="flex items-center gap-3 px-4">
                  <span className={`text-[9px] font-black tracking-widest uppercase ${isSoundEnabled ? 'text-yellow-400' : 'text-white/20'}`}>Sound</span>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isSoundEnabled ? 'bg-yellow-500' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: isSoundEnabled ? 26 : 2 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg" 
                    />
                  </motion.button>
                </div>

                <div className="w-[1px] h-8 bg-white/10" />

                <div className="flex items-center gap-3 px-4">
                  <span className={`text-[9px] font-black tracking-widest uppercase ${isAiEnabled ? 'text-blue-400' : 'text-white/20'}`}>Neural Link</span>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsAiEnabled(!isAiEnabled)}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isAiEnabled ? 'bg-blue-500' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: isAiEnabled ? 26 : 2 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg" 
                    />
                  </motion.button>
                </div>

                <div className="w-[1px] h-8 bg-white/10" />

                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleCamera} 
                  className={`px-6 py-3 rounded-xl border transition-all text-[9px] font-black tracking-widest ${isCameraEnabled ? 'bg-blue-500 border-blue-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                >
                  CAMERA
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleSensor} 
                  className={`px-6 py-3 rounded-xl border transition-all text-[9px] font-black tracking-widest ${isSensorEnabled ? 'bg-green-500 border-green-400 text-black' : 'bg-white/5 border-white/10 text-white/30'}`}
                >
                  MIC
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.1)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowControls(false)} 
                  className="bg-white/5 p-3 rounded-xl border border-white/10 text-gray-500 hover:text-white transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
                </motion.button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-48">
            <div className="flex flex-col gap-3">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-1">Trigger Emotivi</div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 overflow-y-auto pr-2 custom-scrollbar">
                {emotionsList.map((emotion) => (
                  <motion.button
                    key={emotion}
                    whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.15)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setEmotionTemporarily(emotion)}
                    className={`py-2.5 rounded-xl text-[7px] font-black uppercase tracking-tighter transition-all border ${currentEmotion === emotion ? 'bg-blue-600 border-blue-400 scale-105 shadow-xl' : 'bg-white/5 border-transparent text-white/20 hover:bg-white/10 hover:text-white/40'}`}
                  >
                    {emotion}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-l border-white/5 pl-8">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-1">Neural Mappings</div>
              <div className="flex gap-2 mb-2">
                <input 
                  type="text" 
                  placeholder="Frase chiave..." 
                  value={newMappingPhrase}
                  onChange={(e) => setNewMappingPhrase(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] focus:outline-none focus:border-blue-500 transition-colors text-white"
                />
                <select 
                  value={newMappingEmotion}
                  onChange={(e) => setNewMappingEmotion(e.target.value as Emotion)}
                  className="bg-zinc-800 border border-white/10 rounded-xl px-2 py-2 text-[10px] focus:outline-none text-white"
                >
                  {emotionsList.map(e => <option key={e} value={e} className="bg-zinc-900">{e}</option>)}
                </select>
                <motion.button 
                  whileHover={{ scale: 1.05, backgroundColor: "#3b82f6" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={addMapping}
                  className="bg-blue-500 hover:bg-blue-600 px-4 rounded-xl text-[10px] font-black transition-colors"
                >
                  ADD
                </motion.button>
              </div>
              <div className="overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-1.5">
                {customMappings.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl px-4 py-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-medium text-white/80 italic">"{m.phrase}"</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20"><path d="m9 18 6-6-6-6"/></svg>
                      <span className="text-[8px] font-black uppercase tracking-widest text-blue-400">{m.emotion}</span>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.2, color: "#ef4444" }}
                      whileTap={{ scale: 0.8 }}
                      onClick={() => removeMapping(i)} 
                      className="text-white/20 hover:text-red-400 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </motion.button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {!showControls && (
        <motion.button 
          whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.15)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowControls(true)} 
          className="fixed bottom-10 px-12 py-5 rounded-full bg-zinc-900/80 border border-white/10 text-[10px] font-black tracking-[0.6em] uppercase hover:bg-white/10 transition-all z-40 backdrop-blur-xl shadow-2xl"
        >
          INTERFACE
        </motion.button>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        option { color: white; }
      `}</style>
    </div>
  );
};

export default App;
