export class AudioRecorder {
  constructor(stream, sourceLabel) {
    this.stream = stream;
    this.sourceLabel = sourceLabel;
    this.mediaRecorder = null;
    this.chunks = [];
    this.analyser = null;
    this.audioContext = null;
  }

  start(onData) {
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: "audio/webm" });
      onData(blob);
    };
    this.mediaRecorder.start();

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    source.connect(this.analyser);
  }

  stop() {
    this.mediaRecorder?.stop();
    this.audioContext?.close();
  }

  getLevel() {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteFrequencyData(data);
    return Math.max(...data) / 255;
  }
}
