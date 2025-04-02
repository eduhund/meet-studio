export class VideoRecorder {
  constructor(stream, sourceLabel) {
    this.stream = stream;
    this.sourceLabel = sourceLabel;
    this.mediaRecorder = null;
    this.chunks = [];
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
