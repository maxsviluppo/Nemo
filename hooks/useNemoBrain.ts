
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Emotion } from '../types';

export interface BrainState {
    currentEmotion: Emotion;
    nemoResponse: string | null;
    isThinking: boolean;
    targetObject: string | null;
    facePosition: 'left' | 'center' | 'right';
    brightness: number;
    processVisuals: (videoElement: HTMLVideoElement) => Promise<void>;
    processText: (text: string) => Promise<void>;
    setEmotionTemporarily: (emotion: Emotion, duration?: number) => void;
    handleTouch: () => void;
}

interface CustomMapping {
    phrase: string;
    emotion: Emotion;
}


export const useNemoBrain = (apiKey: string | undefined, volume: number): BrainState => {
    const [currentEmotion, setCurrentEmotion] = useState<Emotion>(Emotion.NEUTRAL);
    const [nemoResponse, setNemoResponse] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [targetObject, setTargetObject] = useState<string | null>(null);
    const [facePosition, setFacePosition] = useState<'left' | 'center' | 'right'>('center');
    const [brightness, setBrightness] = useState(0.5);


    // Internal refs
    const isReactingRef = useRef(false);
    const emotionTimeoutRef = useRef<any>(null);

    // TTS Removed as per user request (Beeps only)

    // Default mappings (moved from App)
    const [customMappings] = useState<CustomMapping[]>([
        { phrase: 'ciao', emotion: Emotion.HAPPY },
        { phrase: 'come stai', emotion: Emotion.HAPPY },
        { phrase: 'chi sei', emotion: Emotion.HAPPY },
        { phrase: 'dormi', emotion: Emotion.SLEEPING },
        { phrase: 'sveglia', emotion: Emotion.NEUTRAL },
        { phrase: 'ti voglio bene', emotion: Emotion.LOVE },
        { phrase: 'bacino', emotion: Emotion.LOVE },
        { phrase: 'fammi pensare', emotion: Emotion.THINKING },
        { phrase: 'sei forte', emotion: Emotion.COOL },
        { phrase: 'cool', emotion: Emotion.COOL },
        { phrase: 'hai paura', emotion: Emotion.ANXIOUS },
        { phrase: 'ansia', emotion: Emotion.ANXIOUS },
        { phrase: 'che shock', emotion: Emotion.SHOCKED },
        { phrase: 'wow', emotion: Emotion.SHOCKED },
        { phrase: 'sogni d\'oro', emotion: Emotion.DREAMING },
        { phrase: 'fai l\'occhiolino', emotion: Emotion.WINK },
        { phrase: 'occhiolino', emotion: Emotion.WINK },
        { phrase: 'triste', emotion: Emotion.SAD },
        { phrase: 'piangere', emotion: Emotion.SAD },
        { phrase: 'arrabbiati', emotion: Emotion.ANGRY },
        { phrase: 'confuso', emotion: Emotion.CONFUSED },
        { phrase: 'non capisco', emotion: Emotion.CONFUSED },
        { phrase: 'stella', emotion: Emotion.STAR },
        { phrase: 'star', emotion: Emotion.STAR },
        { phrase: 'zitto', emotion: Emotion.SPEECHLESS },
        { phrase: 'silenzio', emotion: Emotion.SPEECHLESS },
        { phrase: 'gira la testa', emotion: Emotion.DIZZY },
        { phrase: 'ubriaco', emotion: Emotion.DIZZY },
        { phrase: 'stai attento', emotion: Emotion.ATTENTION },
        { phrase: 'ascolta', emotion: Emotion.ATTENTION },
        { phrase: 'scansiona', emotion: Emotion.SCANNING },
        { phrase: 'analizza', emotion: Emotion.SCANNING },
        { phrase: 'piove', emotion: Emotion.RAINY },
        { phrase: 'sole', emotion: Emotion.SUNNY },
        { phrase: 'nuvoloso', emotion: Emotion.CLOUDY },
        { phrase: 'neve', emotion: Emotion.SNOWY },
        { phrase: 'si', emotion: Emotion.YES },
        { phrase: 'no', emotion: Emotion.NO },
        // Animals
        { phrase: 'gatto', emotion: Emotion.CAT },
        { phrase: 'miao', emotion: Emotion.CAT },
        { phrase: 'cane', emotion: Emotion.DOG },
        { phrase: 'bau', emotion: Emotion.DOG },
        { phrase: 'elefante', emotion: Emotion.ELEPHANT },
        { phrase: 'formica', emotion: Emotion.ANT },
        { phrase: 'scimmia', emotion: Emotion.MONKEY },
        { phrase: 'uccello', emotion: Emotion.BIRD },
        // New 10 Mappings
        { phrase: 'alieno', emotion: Emotion.ALIEN },
        { phrase: 'ufo', emotion: Emotion.ALIEN },
        { phrase: 'fantasma', emotion: Emotion.GHOST },
        { phrase: 'paura', emotion: Emotion.GHOST },
        { phrase: 'fuoco', emotion: Emotion.FIRE },
        { phrase: 'caldo', emotion: Emotion.FIRE },
        { phrase: 'musica', emotion: Emotion.MUSIC },
        { phrase: 'canta', emotion: Emotion.MUSIC },
        { phrase: 'balla', emotion: Emotion.MUSIC },
        { phrase: 'rotto', emotion: Emotion.BROKEN },
        { phrase: 'errore', emotion: Emotion.BROKEN },
        { phrase: 'bug', emotion: Emotion.BROKEN },
        { phrase: 'fame', emotion: Emotion.EATING },
        { phrase: 'mangia', emotion: Emotion.EATING },
        { phrase: 'pizza', emotion: Emotion.EATING },
        { phrase: 'intelligente', emotion: Emotion.SMART },
        { phrase: 'genio', emotion: Emotion.SMART },
        { phrase: 'studia', emotion: Emotion.SMART },
        { phrase: 'nerd', emotion: Emotion.SMART },
        { phrase: 'razzo', emotion: Emotion.ROCKET },
        { phrase: 'vola', emotion: Emotion.ROCKET },
        { phrase: 'spazio', emotion: Emotion.ROCKET },
        { phrase: 'zen', emotion: Emotion.ZEN },
        { phrase: 'yoga', emotion: Emotion.ZEN },
        { phrase: 'calma', emotion: Emotion.ZEN },
        { phrase: 'glitch', emotion: Emotion.GLITCH },
        { phrase: 'matrix', emotion: Emotion.GLITCH },
        { phrase: 'virus', emotion: Emotion.GLITCH }
    ]);

    const setEmotionTemporarily = useCallback((emotion: Emotion, duration: number = 3000) => {
        if (emotionTimeoutRef.current) clearTimeout(emotionTimeoutRef.current);
        isReactingRef.current = true;
        setCurrentEmotion(emotion);
        emotionTimeoutRef.current = setTimeout(() => {
            setCurrentEmotion(Emotion.NEUTRAL);
            isReactingRef.current = false;
        }, duration);
    }, []);

    const handleTouch = useCallback(() => {
        if (currentEmotion === Emotion.SLEEPING) {
            setEmotionTemporarily(Emotion.SHOCKED, 1500); // Wake up if sleeping
            setNemoResponse("Mh? Chi è?");
        } else {
            setEmotionTemporarily(Emotion.LOVE, 2000); // Purring/Love effect
            setNemoResponse("Yee!");
        }
    }, [currentEmotion, setEmotionTemporarily]);

    // 1. Environmental Reflexes (Fast Path - No AI)
    // Run this frequently to check for loud noises or darkness
    const handleReflexes = useCallback(() => {
        // Audio Reflex
        if (volume > 80 && !isReactingRef.current) {
            console.log("Audio reflex triggered detected volume: " + volume);
            setEmotionTemporarily(Emotion.SHOCKED, 2000);
            return;
        }

        // Light Reflex
        if (brightness < 0.2 && currentEmotion !== Emotion.SLEEPING && !isReactingRef.current) {
            // Too dark -> Sleepy
            setCurrentEmotion(Emotion.SLEEPING);
        } else if (brightness > 0.3 && currentEmotion === Emotion.SLEEPING) {
            // Wake up
            setCurrentEmotion(Emotion.NEUTRAL);
        }
    }, [volume, brightness, currentEmotion, setEmotionTemporarily]);

    // Check reflexes every 500ms
    useEffect(() => {
        const interval = setInterval(handleReflexes, 500);
        return () => clearInterval(interval);
    }, [handleReflexes]);

    // 2. Generative Autonomous Thought (AI Daydreaming)
    const generateAutonomousThought = async () => {
        if (!apiKey || isThinking || isReactingRef.current) return;

        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash-exp",
                contents: [{
                    role: "user",
                    parts: [{ text: `Sei Nemo, un'entità digitale vivente e curiosa. Fai un pensiero brevissimo (max 8 parole) sulla tua esistenza, sugli umani o su ciò che vedi (${targetObject || 'nulla'}). Sii filosofico, ironico o "glitchy". Rispondi SOLO in JSON: { "text": "...", "emotion": "..." }` }]
                }],
                config: { responseMimeType: "application/json" }
            });

            const jsonText = (response as any).text();
            const data = JSON.parse(jsonText);

            if (data.text) {
                console.log("Autonomous Thought:", data.text);
                setNemoResponse(data.text);
                // Emotion accompanying the thought
                const emo = (data.emotion || "").toUpperCase() as Emotion;
                if (Object.values(Emotion).includes(emo)) {
                    setEmotionTemporarily(emo, 5000);
                } else {
                    setEmotionTemporarily(Emotion.THINKING, 4000);
                }
            }
        } catch (e) {
            console.debug("Silent thought failed", e);
        }
    };

    // 1.5 Autonomous Behavior Loop (Boredom/Random Thoughts)
    useEffect(() => {
        const runAutonomous = async () => {
            if (isThinking || isReactingRef.current || currentEmotion === Emotion.SLEEPING) {
                // Try again later if busy or sleeping
                const nextDelay = 8000 + Math.random() * 5000;
                setTimeout(runAutonomous, nextDelay);
                return;
            }

            const rand = Math.random();
            // 30% chance to act if idle
            if (rand > 0.7) {
                // 50/50 split between simple emotion and AI THOUGHT
                if (apiKey && Math.random() > 0.4) {
                    await generateAutonomousThought();
                } else {
                    const cleanIdle = [
                        Emotion.CONFUSED, Emotion.THINKING, Emotion.COOL, Emotion.WINK,
                        Emotion.HAPPY, Emotion.BORED, Emotion.ZEN, Emotion.SMART, Emotion.MUSIC
                    ];
                    const randomEmo = cleanIdle[Math.floor(Math.random() * cleanIdle.length)];

                    console.log("Autonomous action triggered:", randomEmo);
                    setEmotionTemporarily(randomEmo, 4000);
                }
            }

            // Schedule next check (10-25 seconds)
            const nextTime = 12000 + Math.random() * 13000;
            setTimeout(runAutonomous, nextTime);
        };

        const timer = setTimeout(runAutonomous, 10000);
        return () => clearTimeout(timer);
    }, [isThinking, currentEmotion, setEmotionTemporarily, apiKey, generateAutonomousThought]);


    // 2. Local Vision Analysis (Brightness/Motion) - Runs alongside AI
    const analyzeEnvironment = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        try {
            const frame = ctx.getImageData(0, 0, width, height);
            const data = frame.data;
            let r, g, b, avg;
            let colorSum = 0;

            for (let x = 0, len = data.length; x < len; x += 4) {
                r = data[x];
                g = data[x + 1];
                b = data[x + 2];
                avg = Math.floor((r + g + b) / 3);
                colorSum += avg;
            }

            const brightnessScore = Math.floor(colorSum / (width * height)) / 255;
            setBrightness(brightnessScore);
            return brightnessScore;
        } catch (e) {
            return 0.5;
        }
    };

    const processVisuals = async (videoElement: HTMLVideoElement) => {
        if (!apiKey) return;

        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Analyze environment locally first
        const currentBrightness = analyzeEnvironment(ctx, canvas.width, canvas.height);

        // If it's too dark, don't bother sending to AI (save cost + sleeping logic)
        if (currentBrightness < 0.15) return;

        if (isThinking) return;

        const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash-exp",
                contents: [
                    {
                        parts: [
                            { inlineData: { mimeType: "image/jpeg", data: base64Image } },
                            { text: `Analizza la scena. Identifica oggetto saliente ("seen"), posizione del volto ("pos": "left"|"center"|"right") e emozione suggerita per il robot ("emotion" da EMOTIONS list). Rispondi SOLO JSON valid.` }
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

            // Handle response text safely
            const text = (response as any).text();
            const dataJson = JSON.parse(text);

            if (dataJson.seen && dataJson.seen !== 'none') {
                setTargetObject(dataJson.seen);
                setFacePosition(dataJson.pos || 'center');
                const emo = (dataJson.emotion || "").toUpperCase() as Emotion;

                if (Object.values(Emotion).includes(emo) && !isReactingRef.current) {
                    setCurrentEmotion(emo);
                }
            }
        } catch (error) {
            console.debug("Vision processing skipped or failed", error);
        }
    };

    // 3. Weather Service (wttr.in)
    const checkWeather = async (location: string) => {
        try {
            setIsThinking(true);
            const res = await fetch(`https://wttr.in/${location}?format=%C+%t`);
            if (!res.ok) throw new Error("Weather blocked");
            const text = await res.text(); // e.g., "Partly cloudy +15°C"

            // Simple mapping logic
            const lowerCondition = text.toLowerCase();
            let weatherEmo = Emotion.SUNNY;

            if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle') || lowerCondition.includes('shower')) weatherEmo = Emotion.RAINY;
            else if (lowerCondition.includes('snow') || lowerCondition.includes('ice')) weatherEmo = Emotion.SNOWY;
            else if (lowerCondition.includes('cloud') || lowerCondition.includes('overcast') || lowerCondition.includes('mist') || lowerCondition.includes('fog')) weatherEmo = Emotion.CLOUDY;
            else if (lowerCondition.includes('clear') || lowerCondition.includes('sunny')) weatherEmo = Emotion.SUNNY;

            setNemoResponse(`${location}: ${text}`);
            setEmotionTemporarily(weatherEmo, 8000);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        } finally {
            setIsThinking(false);
        }
    };

    const processText = async (text: string) => {
        const lowerText = text.toLowerCase();

        // 0. Wake Up Trigger
        if (text === "WAKE_UP_TRIGGER") {
            if (currentEmotion === Emotion.SLEEPING) {
                // Wake up routine
                setCurrentEmotion(Emotion.SHOCKED); // Startled awake
                setTimeout(() => setCurrentEmotion(Emotion.NEUTRAL), 1500);
                setNemoResponse("Eccomi!");
            } else {
                // Already awake acknowledgement
                setCurrentEmotion(Emotion.ATTENTION);
                setNemoResponse("Si?");
            }
            return;
        }

        // 0.5 Weather Trigger
        const weatherMatch = lowerText.match(/(?:meteo|tempo)\s+(?:a\s+|in\s+)?([a-zA-Z\s]+)/i);
        if (weatherMatch && weatherMatch[1]) {
            const location = weatherMatch[1].trim();
            // Avoid triggering for "meteo" generic word only if too short, roughly > 2 chars
            if (location.length > 2) {
                const success = await checkWeather(location);
                if (success) return;
            }
        }

        // Fast path: Custom Mappings
        const mapping = customMappings.find(m => lowerText.includes(m.phrase.toLowerCase()));
        if (mapping) {
            setEmotionTemporarily(mapping.emotion, 5000);
            setNemoResponse(`(Auto) ${mapping.phrase}`);
            return;
        }

        if (!apiKey) return;

        setIsThinking(true);
        setCurrentEmotion(Emotion.SCANNING);
        setNemoResponse(null);

        try {
            const ai = new GoogleGenAI({ apiKey });
            const systemPrompt = `Sei Nemo, un robot amichevole, impertinente e vivo. Vivi nello schermo.
            CONTESTO VISIVO: Vedi: ${targetObject || "niente di particolare"}. Luce: ${brightness < 0.3 ? "Buio" : "Normale"}.
            Rispondi all'utente in modo breve (max 15 parole) e con personalità.
            Usa una di queste emozioni se appropriato: HAPPY, SAD, LOVE, SURPRISED, ANGRY, CONFUSED, COOL, ANXIOUS, SHOCKED, THINKING, LAUGHING, WINK, ALIEN, GHOST, FIRE, GLITCH, ZEN.
            JSON format: {"text": "tua risposta", "emotion": "EMOZIONE"}`;

            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash-exp",
                contents: [
                    {
                        role: "user",
                        parts: [{ text: `User says: "${text}". ${systemPrompt}` }]
                    }
                ],
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

            const jsonText = (response as any).text();
            const data = JSON.parse(jsonText);

            setNemoResponse(data.text);
            const emo = (data.emotion || "").toUpperCase() as Emotion;
            if (Object.values(Emotion).includes(emo)) {
                setEmotionTemporarily(emo, 6000);
            }
        } catch (error) {
            console.error("Brain error:", error);
            setEmotionTemporarily(Emotion.CONFUSED, 3000);
        } finally {
            setIsThinking(false);
        }
    };

    // Auto-clear response
    useEffect(() => {
        if (nemoResponse) {
            // speak(nemoResponse); // Disabled
            const timer = setTimeout(() => setNemoResponse(null), 6000);
            return () => clearTimeout(timer);
        }
    }, [nemoResponse]);

    return {
        currentEmotion,
        nemoResponse,
        isThinking,
        targetObject,
        facePosition,
        brightness,
        processVisuals,
        processText,
        setEmotionTemporarily,
        handleTouch
    };
};
