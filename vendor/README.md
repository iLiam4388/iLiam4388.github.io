# Animation encoder dependencies

Pinned browser libraries, loaded locally; no build step:

- gifenc 1.0.3: https://github.com/mattdesl/gifenc (MIT, see gifenc-LICENSE.md).
- mp4-muxer 5.2.2: https://github.com/Vanilagy/mp4-muxer (MIT, see mp4-muxer-LICENSE).
- @ffmpeg/ffmpeg 0.12.15: https://github.com/ffmpegwasm/ffmpeg.wasm (MIT wrapper, see ffmpeg/LICENSE).
- @ffmpeg/core 0.12.10 (GPL-2.0-or-later, see ffmpeg/core-LICENSE-GPLv2): its ESM loader is local. The single-thread WASM binary
  downloads from the pinned jsDelivr URL on demand when H.264 WebCodecs encoding
  is unavailable. It needs no SharedArrayBuffer or special hosting headers.
  FFmpeg/libx264 core licensing and corresponding source/build instructions:
  https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/core
  and https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/build.
