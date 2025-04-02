export class ScreenRecorder {
  constructor() {
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  async selectScreenSource() {
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: true,
    });
    return this.stream;
  }

  start(onData) {
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: "video/webm" });
      onData(blob);
    };
    this.mediaRecorder.start();
  }

  stop() {
    this.mediaRecorder?.stop();
  }
}
