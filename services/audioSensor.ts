
export class AudioSensor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private dataArray: Uint8Array | null = null;

  async start(): Promise<boolean | string> {
    try {
      console.log("Requesting microphone access...");
      // 1. Get Stream FIRST (Hardware/Permission Check)
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted:", this.stream.id);

      // 2. Init Audio Context (Software Verification)
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // 3. Connect
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // 4. Resume if needed
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return true;
    } catch (e: any) {
      console.error("Audio Start Error:", e);

      // Cleanup
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }

      return `${e.name} (${e.message})`;
    }
  }

  stop() {
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  getVolume(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    return sum / this.dataArray.length;
  }
}
