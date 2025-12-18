
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AudioSensor } from '../services/audioSensor';

export interface SensorState {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isCameraEnabled: boolean;
    isSensorEnabled: boolean;
    volume: number;
    lastCommand: string | null;
    clearCommand: () => void;
    toggleCamera: () => Promise<void>;
    toggleSensor: () => Promise<void>;
    permissionError: string | null;
    isListeningForCommand: boolean;
    transcript: string;
}

export const useNemoSensors = (robotName: string): SensorState => {
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [isSensorEnabled, setIsSensorEnabled] = useState(false);
    const [volume, setVolume] = useState(0);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [lastCommand, setLastCommand] = useState<string | null>(null);
    const [isListeningForCommand, setIsListeningForCommand] = useState(false);
    const isListeningRef = useRef(false); // Ref for immediate access in callbacks

    useEffect(() => {
        isListeningRef.current = isListeningForCommand;
    }, [isListeningForCommand]);

    const [transcript, setTranscript] = useState<string>("");

    // Auto-clear transcript after 5 seconds
    useEffect(() => {
        if (transcript) {
            const timer = setTimeout(() => setTranscript(""), 5000);
            return () => clearTimeout(timer);
        }
    }, [transcript]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioSensorRef = useRef<AudioSensor>(new AudioSensor());
    const volumeRequestRef = useRef<number | null>(null);

    // Volume Loop
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

    // Auto-start Sensors on Mount
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            // Start Camera
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
                if (mounted && videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setIsCameraEnabled(true);
                }
            } catch (e) {
                console.warn("Auto-start camera failed (interaction needed?):", e);
            }

            // Start Mic
            try {
                const result = await audioSensorRef.current.start();
                if (mounted) {
                    if (result === true) setIsSensorEnabled(true);
                }
            } catch (e) {
                console.warn("Auto-start mic failed:", e);
            }
        };

        // Small delay to ensure refs are bound
        setTimeout(init, 500);

        return () => { mounted = false; };
    }, []);

    // Camera Toggle
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
        }
    };

    // Audio/Speech Toggle
    const toggleSensor = async () => {
        setPermissionError(null);
        if (!isSensorEnabled) {
            const result = await audioSensorRef.current.start();
            if (result === true) setIsSensorEnabled(true);
            else setPermissionError(typeof result === 'string' ? result : "Microfono negato.");
        } else {
            audioSensorRef.current.stop();
            setIsSensorEnabled(false);
        }
    };

    // Speech Recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'it-IT';

        recognition.onresult = (event: any) => {
            const current = event.results[event.results.length - 1][0].transcript;
            setTranscript(current);

            const lowerTranscript = current.toLowerCase();

            // Check for wake word
            if (lowerTranscript.includes(robotName.toLowerCase())) {
                const cmd = lowerTranscript.split(robotName.toLowerCase())[1]?.trim();

                // Wake up effect managed by finding the word "nemo"
                setIsListeningForCommand(true); // Visual feedback

                if (cmd) {
                    setLastCommand(cmd);
                    // Visual flash then reset
                    setIsListeningForCommand(true); // Trigger UI green
                    setTimeout(() => setIsListeningForCommand(false), 1000);
                } else {
                    // Just "Nemo" called
                    setLastCommand("WAKE_UP_TRIGGER");
                    setIsListeningForCommand(true);
                    setTimeout(() => setIsListeningForCommand(false), 3000);
                }
            } else if (isListeningRef.current) {
                // If we were already listening (green eyes), take this sentence as command
                setLastCommand(lowerTranscript);
                setIsListeningForCommand(false);
            }
        };

        recognition.onend = () => {
            // Always try to restart if enabled
            if (isSensorEnabled) {
                setTimeout(() => {
                    try { recognition.start(); } catch { /* ignore if already started */ }
                }, 300); // Small delay prevents rapid loops
            }
        };

        if (isSensorEnabled) {
            try { recognition.start(); } catch { }
        }

        return () => {
            recognition.onend = null; // Prevent restart loop on cleanup
            try { recognition.stop(); } catch { }
        };
    }, [isSensorEnabled, robotName]); // Removed isListeningForCommand dependent to avoid recreation

    const clearCommand = useCallback(() => setLastCommand(null), []);

    return {
        videoRef,
        isCameraEnabled,
        isSensorEnabled,
        volume,
        lastCommand,
        transcript, // Exported
        clearCommand,
        toggleCamera,
        toggleSensor,
        permissionError,
        isListeningForCommand
    };
};
