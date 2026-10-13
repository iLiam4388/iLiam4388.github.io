/** Frame-by-frame exports; encoding speed never changes animation timing. */
import { GIFEncoder, quantize, applyPalette } from "./vendor/gifenc.js";

export function animationExportSettings({ start, end, fps, width, aspect }) {
  if (![start, end, fps, width, aspect].every(Number.isFinite) || start < 0 || end <= start || aspect <= 0)
    throw new Error("Choose an end time after the start time.");
  if (fps < 1 || fps > 60 || width < 16 || width > 1920) throw new Error("Choose a frame rate from 1–60 and a width from 16–1920.");
  const height = Math.max(2, Math.round(width / aspect / 2) * 2);
  width = Math.round(width / 2) * 2;
  if (height > 2160) throw new Error("Choose a smaller export size for this tall camera view.");
  const frames = Math.ceil((end - start) * fps - 1e-8);
  if (frames > 3600 || frames * width * height > 1.5e9)
    throw new Error("This export is too large for browser memory. Choose a shorter range, smaller size, or lower frame rate.");
  return { start, end, fps, width, height, frames };
}

const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));
function checkCancelled(signal) { signal?.throwIfAborted(); }

async function mp4Encoder(settings, signal, progress) {
  const { width, height, fps } = settings;
  const config = { codec: "avc1.420033", width, height, bitrate: Math.max(500000, width * height * fps * 0.15),
    framerate: fps, avc: { format: "avc" } };
  let supported = false;
  if (typeof VideoEncoder !== "undefined") {
    try { supported = (await VideoEncoder.isConfigSupported(config)).supported; } catch { /* use portable encoder */ }
  }
  checkCancelled(signal);
  if (supported) {
    const { Muxer, ArrayBufferTarget } = await import("./vendor/mp4-muxer.js");
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, video: { codec: "avc", width, height }, fastStart: "in-memory" });
    let failure;
    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (error) => { failure = error; } });
    encoder.configure(config);
    const abort = () => { if (encoder.state !== "closed") encoder.close(); };
    signal.addEventListener("abort", abort, { once: true });
    return {
      async frame(canvas, index, duration) {
        checkCancelled(signal);
        if (failure) throw failure;
        const frame = new VideoFrame(canvas, { timestamp: Math.round(index / fps * 1e6), duration: Math.round(duration * 1e6) });
        try { encoder.encode(frame, { keyFrame: index % (fps * 2) === 0 }); } finally { frame.close(); }
        while (encoder.encodeQueueSize > 4) { await yieldToBrowser(); checkCancelled(signal); if (failure) throw failure; }
      },
      async finish() {
        await encoder.flush(); if (failure) throw failure;
        muxer.finalize(); return new Blob([target.buffer], { type: "video/mp4" });
      },
      close() { signal.removeEventListener("abort", abort); abort(); },
    };
  }
  // Single-thread WASM works on GitHub Pages without cross-origin isolation.
  progress(0, "Loading the portable MP4 encoder…");
  const { FFmpeg } = await import("./vendor/ffmpeg/index.js");
  const ffmpeg = new FFmpeg();
  const abort = () => ffmpeg.terminate();
  signal.addEventListener("abort", abort, { once: true });
  try {
    await ffmpeg.load({ coreURL: new URL("./vendor/ffmpeg/ffmpeg-core.js", import.meta.url).href,
      wasmURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm" });
    checkCancelled(signal);
  } catch (error) {
    signal.removeEventListener("abort", abort); abort(); checkCancelled(signal);
    throw new Error("Could not load the MP4 encoder. Check your connection and try again. " + error.message);
  }
  return {
    async frame(canvas, index) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not capture an animation frame.");
      checkCancelled(signal);
      await ffmpeg.writeFile(`frame-${String(index).padStart(6, "0")}.png`, new Uint8Array(await blob.arrayBuffer()));
    },
    async finish() {
      ffmpeg.on("progress", ({ progress: value }) => progress(0.75 + Math.min(1, Math.max(0, value)) * 0.24, "Encoding MP4…"));
      const code = await ffmpeg.exec(["-framerate", String(fps), "-i", "frame-%06d.png", "-t", String(settings.end - settings.start),
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "output.mp4"]);
      checkCancelled(signal);
      if (code !== 0) throw new Error("The MP4 encoder could not finish this export. Try a smaller size or shorter range.");
      return new Blob([await ffmpeg.readFile("output.mp4")], { type: "video/mp4" });
    },
    close() { signal.removeEventListener("abort", abort); abort(); },
  };
}

/** renderFrame(time) must synchronously return a rendered canvas for that time. */
export async function exportAnimation({ format, settings, renderFrame, signal, progress = () => {}, loop = true }) {
  let encoder;
  try {
    if (format === "mp4") encoder = await mp4Encoder(settings, signal, progress);
    else if (format !== "gif") throw new Error("Unknown animation export format.");
    const gif = format === "gif" ? GIFEncoder() : null;
    const canvas = document.createElement("canvas");
    canvas.width = settings.width; canvas.height = settings.height;
    const context = canvas.getContext("2d", { willReadFrequently: !!gif });
    let gifDelay = 0;
    for (let index = 0; index < settings.frames; index++) {
      checkCancelled(signal);
      const time = settings.start + index / settings.fps;
      const duration = Math.min(1 / settings.fps, settings.end - time);
      context.drawImage(renderFrame(time), 0, 0, canvas.width, canvas.height);
      if (gif) {
        const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const palette = quantize(rgba, 256);
        const nextDelay = Math.round((time - settings.start + duration) * 100) * 10;
        gif.writeFrame(applyPalette(rgba, palette), canvas.width, canvas.height,
          { palette, delay: nextDelay - gifDelay, repeat: loop ? 0 : -1 });
        gifDelay = nextDelay;
      } else await encoder.frame(canvas, index, duration);
      progress((index + 1) / settings.frames * 0.75, `Rendering frame ${index + 1} of ${settings.frames}…`);
      await yieldToBrowser();
    }
    checkCancelled(signal);
    progress(0.75, `Finishing ${format.toUpperCase()}…`);
    let blob;
    if (gif) { gif.finish(); blob = new Blob([gif.bytesView()], { type: "image/gif" }); }
    else blob = await encoder.finish();
    checkCancelled(signal); progress(1, "Export complete");
    return blob;
  } finally { encoder?.close(); }
}
