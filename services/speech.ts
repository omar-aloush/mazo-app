import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export interface TranscriptionResult {
    text?: string;
    error?: string;
}

export class SpeechService {
    private static instance: SpeechService;
    private recording: Audio.Recording | null = null;
    private mediaRecorder: any = null; // MediaRecorder for Web
    private audioChunks: Blob[] = [];

    private constructor() { }

    public static getInstance(): SpeechService {
        if (!this.instance) {
            this.instance = new SpeechService();
        }
        return this.instance;
    }

    public async startRecording(): Promise<void> {
        if (Platform.OS === 'web') {
            return this.startRecordingWeb();
        } else {
            return this.startRecordingNative();
        }
    }

    public async stopRecording(): Promise<TranscriptionResult> {
        if (Platform.OS === 'web') {
            return this.stopRecordingWeb();
        } else {
            return this.stopRecordingNative();
        }
    }

    private async startRecordingNative(): Promise<void> {
        try {
            // Clean up any existing recording first
            if (this.recording) {
                try {
                    await this.recording.stopAndUnloadAsync();
                } catch (_) {
                    // Ignore errors from cleanup
                }
                this.recording = null;
            }

            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) throw new Error('Microphone permission denied');

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Use the modern createAsync API (expo-av v14+)
            const { recording } = await Audio.Recording.createAsync(
                {
                    android: {
                        extension: '.m4a',
                        outputFormat: 4, // MPEG_4
                        audioEncoder: 3, // AAC
                        sampleRate: 44100,
                        numberOfChannels: 1,
                        bitRate: 128000,
                    },
                    ios: {
                        extension: '.m4a',
                        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                        audioQuality: Audio.IOSAudioQuality.HIGH,
                        sampleRate: 44100,
                        numberOfChannels: 1,
                        bitRate: 128000,
                    },
                    web: {},
                }
            );

            this.recording = recording;
        } catch (error: any) {
            console.error('Error starting native recording:', error);
            throw error;
        }
    }

    private async startRecordingWeb(): Promise<void> {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Microphone access is blocked. Please use HTTPS or localhost for web testing.');
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new (window as any).MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event: any) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start();
        } catch (error: any) {
            console.error('Error starting web recording:', error);
            throw error;
        }
    }

    private async stopRecordingNative(): Promise<TranscriptionResult> {
        try {
            if (!this.recording) return { error: 'No active recording' };

            try {
                await this.recording.stopAndUnloadAsync();
            } catch (stopError) {
                console.warn('Recording may have already been stopped:', stopError);
            }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

            const uri = this.recording.getURI();
            this.recording = null;

            if (!uri) return { error: 'No recording URI found' };

            return this.transcribeAudio(uri);
        } catch (error: any) {
            console.error('Error stopping native recording:', error);
            this.recording = null;
            return { error: error.message };
        }
    }

    private async stopRecordingWeb(): Promise<TranscriptionResult> {
        try {
            if (!this.mediaRecorder) return { error: 'No active media recorder' };

            return new Promise((resolve) => {
                this.mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    const result = await this.transcribeAudioWeb(audioBlob);

                    const stream = this.mediaRecorder.stream;
                    stream.getTracks().forEach((track: any) => track.stop());
                    this.mediaRecorder = null;

                    resolve(result);
                };
                this.mediaRecorder.stop();
            });
        } catch (error: any) {
            console.error('Error stopping web recording:', error);
            return { error: error.message };
        }
    }

    private async transcribeAudio(uri: string): Promise<TranscriptionResult> {
        try {
            const uriParts = uri.split('.');
            const fileType = uriParts[uriParts.length - 1];

            const formData = new FormData();
            const audioFile = {
                uri,
                name: `recording.${fileType}`,
                type: `audio/${fileType}`,
            };
            formData.append('audio', audioFile as any);

            const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Transcription service error');

            return await response.json();
        } catch (error: any) {
            console.error('Error transcribing native audio:', error);
            return { error: error.message };
        }
    }

    private async transcribeAudioWeb(audioBlob: Blob): Promise<TranscriptionResult> {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Transcription service error');

            return await response.json();
        } catch (error: any) {
            console.error('Error transcribing web audio:', error);
            return { error: error.message };
        }
    }
}

export const speechService = SpeechService.getInstance();
