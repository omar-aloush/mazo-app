import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { speechService } from '@/services/speech';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  /** 'permission' | 'empty' | 'failed' | null — so the UI can stop failing silently. */
  error: string | null;
  clearError: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true); // Always true now as we have a fallbacks/native impl
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);
  const lastResultIndexRef = useRef(0);

  useEffect(() => {
    // Web speech API check
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(true); // We support it via SpeechService regardless, but this is for web-native API
    }
  }, []);

  const createRecognition = useCallback(() => {
    if (Platform.OS !== 'web') return null;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        setTranscript(prev => {
          const separator = prev.length > 0 ? ' ' : '';
          return prev + separator + finalText.trim();
        });
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      shouldRestartRef.current = false;
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch (e) {
          shouldRestartRef.current = false;
          setIsListening(false);
          setInterimTranscript('');
        }
      } else {
        setIsListening(false);
        setInterimTranscript('');
      }
    };

    return recognition;
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          if (recognitionRef.current) {
            shouldRestartRef.current = false;
            recognitionRef.current.abort();
            recognitionRef.current = null;
          }

          const recognition = createRecognition();
          if (!recognition) return;

          recognitionRef.current = recognition;
          shouldRestartRef.current = true;
          lastResultIndexRef.current = 0;
          recognition.start();
          return;
        } catch (e) {
          console.error('Web SpeechRecognition error, falling back to SpeechService');
        }
      }
    }

    // Native or Fallback Web (using SpeechService recording)
    try {
      setIsListening(true);
      await speechService.startRecording();
    } catch (e: any) {
      setIsListening(false);
      const msg = String(e?.message || e);
      setError(/permission|denied/i.test(msg) ? 'permission' : 'failed');
      console.error('Error starting recording:', e);
    }
  }, [createRecognition]);

  const stopListening = useCallback(async () => {
    if (Platform.OS === 'web' && recognitionRef.current) {
      shouldRestartRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch (e) { }
      recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    // Native or Fallback Web
    try {
      const result = await speechService.stopRecording();
      if (result.text && result.text.trim()) {
        setTranscript(prev => {
          const separator = prev.length > 0 ? ' ' : '';
          return prev + separator + result.text!.trim();
        });
      } else if (result.error) {
        setError('failed');
      } else {
        setError('empty');
      }
    } catch (e) {
      setError('failed');
      console.error('Error stopping recording:', e);
    } finally {
      setIsListening(false);
      setInterimTranscript('');
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    lastResultIndexRef.current = 0;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) { }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
    clearError,
  };
}
