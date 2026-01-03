"use client";

// Singleton per gestire l'AudioContext globale ed evitare errori di "MediaElementAudioSourceNode" duplicati.
class GlobalAudioManager {
  private static instance: GlobalAudioManager;
  
  public context: AudioContext | null = null;
  public source: MediaElementAudioSourceNode | null = null;
  public element: HTMLAudioElement | null = null;
  public analyserL: AnalyserNode | null = null;
  public analyserR: AnalyserNode | null = null;
  public analyserSpectrum: AnalyserNode | null = null;
  
  private constructor() {}

  public static getInstance(): GlobalAudioManager {
    if (!GlobalAudioManager.instance) {
      GlobalAudioManager.instance = new GlobalAudioManager();
    }
    return GlobalAudioManager.instance;
  }

  public attach(audioEl: HTMLAudioElement) {
    if (this.source && this.element === audioEl) return; // Già attaccato allo stesso elemento

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      
      if (!this.context) {
        this.context = new Ctx();
      } else if (this.context.state === 'closed') {
        this.context = new Ctx();
      }

      // Se avevamo già una source su un altro elemento, la disconnettiamo (best effort)
      if (this.source) {
        try { this.source.disconnect(); } catch (e) {}
        this.source = null;
      }
      
      this.element = audioEl;

      // Crea source
      this.source = this.context.createMediaElementSource(audioEl);
      
      // Crea analizzatori se non esistono
      if (!this.analyserL) {
        this.analyserL = this.context.createAnalyser();
        this.analyserL.fftSize = 2048;
      }
      if (!this.analyserR) {
        this.analyserR = this.context.createAnalyser();
        this.analyserR.fftSize = 2048;
      }
      if (!this.analyserSpectrum) {
        this.analyserSpectrum = this.context.createAnalyser();
        this.analyserSpectrum.fftSize = 4096;
        this.analyserSpectrum.smoothingTimeConstant = 0.6;
      }

      // Routing
      const splitter = this.context.createChannelSplitter(2);
      
      // Source -> Splitter -> L/R Analysers
      this.source.connect(splitter);
      splitter.connect(this.analyserL, 0);
      splitter.connect(this.analyserR, 1);

      // Source -> Spectrum Analyser (Mono mix implicito o primo canale)
      this.source.connect(this.analyserSpectrum);

      // Source -> Speakers (importante!)
      this.source.connect(this.context.destination);

    } catch (err) {
      console.error("GlobalAudioManager attach error:", err);
    }
  }

  public resume() {
    if (this.context && this.context.state === "suspended") {
      this.context.resume();
    }
  }
}

export const audioManager = GlobalAudioManager.getInstance();
