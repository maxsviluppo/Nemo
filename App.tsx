
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
  const [brightness, setBrightness] = useState(0.5); 
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

  const audioSensorRef = useRef<AudioSensor>(new AudioSensor());
  const emotionTimeoutRef = useRef<any | null>(null);
  const inactivityTimeoutRef = useRef<any | null>(null);
  const isReactingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visionIntervalRef = useRef<any>(null);
  const volumeRequestRef = useRef<number | null>(null);

  const ROBOT_NAME = "Nemo";
  const INACTIVITY_DELAY = 8000;

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
    if (!videoRef.current || !canvasRef.current || isThinking || !isAiEnabled || !process.env.API_KEY) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    canvas.width = 320;
    canvas.height = 240;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: [
          {
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: base64Image } },
              { text: `Analizza la scena. JSON: {"seen": "string", "pos": "left"|"center"|"right", "emotion": "EMO"}` }
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
      console.debug("Vision skipped");
    }
  };

  useEffect(() => {
    if (isCameraEnabled && isAiEnabled) {
      visionIntervalRef.current = setInterval(processVisuals, 4000);
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
      setNemoResponse(`Mappa: ${mapping.phrase}`);
      return;
    }

    if (!isAiEnabled || !process.env.API_KEY) return;

    setIsThinking(true);
    setCurrentEmotion(Emotion.SCANNING); 
    setNemoResponse(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
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

    if (isSensorEnabled) try { recognition.start(); } catch {}
    return () => { try { recognition.stop(); } catch {} };
  }, [isSensorEnabled, isListeningForCommand, isAiEnabled]);

  const toggleSensor = async () => {
    setPermissionError(null);
    if (!isSensorEnabled) {
      const success = await audioSensorRef.current.start();
      if (success) setIsSensorEnabled(true);
      else setPermissionError("Microfono negato.");
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
        }
      } catch (e) { 
        setPermissionError("Fotocamera negata.");
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
    <div className="h-screen w-screen bg-black overflow-hidden flex flex-col items-center justify-center font-sans text-white relative">
      <video ref={videoRef} autoPlay playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute top-8 left-8 z-50 pointer-events-none flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isSensorEnabled ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-red-500'}`} />
          <span className="font-black text-xl tracking-tighter uppercase">{ROBOT_NAME} v2.0</span>
      </div>

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
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-12 right-12 max-w-sm bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl z-20"
            >
              <p className="text-lg font-medium italic text-right">"{nemoResponse}"</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 w-full p-6 z-40"
          >
            <div className="max-w-4xl mx-auto bg-zinc-900/95 backdrop-blur-2xl rounded-[32px] p-6 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Nemo OS Dashboard</span>
                <div className="flex gap-2">
                  <button onClick={toggleCamera} className={`p-3 rounded-xl transition-all ${isCameraEnabled ? 'bg-blue-500' : 'bg-white/5 opacity-50'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </button>
                  <button onClick={toggleSensor} className={`p-3 rounded-xl transition-all ${isSensorEnabled ? 'bg-green-500' : 'bg-white/5 opacity-50'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1v11"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 23v-4"/></svg>
                  </button>
                  <button onClick={() => setIsSoundEnabled(!isSoundEnabled)} className={`p-3 rounded-xl transition-all ${isSoundEnabled ? 'bg-yellow-500' : 'bg-white/5 opacity-50'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  </button>
                  <button onClick={() => setShowControls(false)} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 overflow-y-auto max-h-32 pr-2">
                {emotionsList.map((emo) => (
                  <button key={emo} onClick={() => setEmotionTemporarily(emo)} className={`py-2 px-1 rounded-lg text-[9px] font-bold uppercase transition-all ${currentEmotion === emo ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
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
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          onClick={() => setShowControls(true)}
          className="fixed bottom-8 px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all z-30"
        >
          Controlli
        </motion.button>
      )}

      {permissionError && (
        <div className="fixed top-8 right-8 bg-red-500 text-white text-[10px] font-bold px-4 py-2 rounded-full z-[60] shadow-xl">
          {permissionError}
        </div>
      )}
    </div>
  );
};

export default App;
