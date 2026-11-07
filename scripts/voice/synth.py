"""Record Uncle Sam's lines with Kokoro, an open-weight neural text-to-speech model (Apache-2.0).

usage: python synth.py LINES.json MODEL_DIR OUT_DIR MANIFEST.json [--cache DIR] [--voice am_michael] [--speed 0.97]

LINES.json is {"banks": {"level-1": ["sentence", ...], ...}} as written by collect.mjs. Each bank
becomes one MP3 (the clips back to back) under OUT_DIR, and MANIFEST.json maps every sentence's
key to [bank, byte offset, byte length, seconds, loudness]. The loudness is a digit 0-3 for every
1/15 s, so Uncle Sam's mouth can follow his voice. Already-recorded sentences are
reused from the cache, so re-running only records new lines.
"""
import argparse, hashlib, json, os, subprocess, sys, tempfile

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


def key(s: str) -> str:
    # FNV-1a, 32 bit, over UTF-16 code units: the same function the page uses (src/game/voice.tsx).
    h = 0x811C9DC5
    b = s.encode("utf-16-le")
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "08x")


ENV_FPS = 15  # how often the mouth can change (voice.tsx reads the same rate)


def envelope(mp3: str) -> str:
    """How loud the clip is, ENV_FPS times a second, as digits 0-3 (closed to wide open).
    Cached next to the recording, so only new clips are measured."""
    cached = mp3 + ".env"
    if os.path.exists(cached):
        return open(cached).read().strip()
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", mp3, "-f", "s16le", "-ac", "1", "-ar", "24000", "-"], capture_output=True, check=True).stdout
    pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    step = 24000 // ENV_FPS
    n = max(1, len(pcm) // step)
    rms = np.array([np.sqrt(np.mean(pcm[i * step:(i + 1) * step] ** 2)) if (i + 1) * step <= len(pcm) else 0.0 for i in range(n)])
    ref = float(np.percentile(rms, 95)) or 1.0
    levels = np.digitize(rms / ref, [0.12, 0.38, 0.7])
    out = "".join(str(int(v)) for v in levels)
    open(cached, "w").write(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lines"); ap.add_argument("model_dir"); ap.add_argument("out_dir"); ap.add_argument("manifest")
    ap.add_argument("--cache", default=os.path.join(os.path.expanduser("~"), ".cache", "uncle-sam-voice"))
    ap.add_argument("--voice", default="am_michael"); ap.add_argument("--speed", type=float, default=0.97)
    ap.add_argument("--only", type=int, default=0)
    a = ap.parse_args()
    banks = json.load(open(a.lines))["banks"]
    k = Kokoro(os.path.join(a.model_dir, "kokoro-v1.0.int8.onnx"), os.path.join(a.model_dir, "voices-v1.0.bin"))
    cache = a.cache; os.makedirs(cache, exist_ok=True); os.makedirs(a.out_dir, exist_ok=True)
    manifest, seen, n = {}, {}, 0
    for bank, sentences in banks.items():
        clips = []
        for s in sentences:
            kk = key(s)
            if kk in seen:
                if seen[kk] != s: sys.exit(f"key collision: {s!r} vs {seen[kk]!r}")
                continue
            seen[kk] = s
            mp3 = os.path.join(cache, f"{a.voice}-{a.speed}-{hashlib.sha1(s.encode()).hexdigest()[:16]}.mp3")
            if not os.path.exists(mp3):
                audio, sr = k.create(s, voice=a.voice, speed=a.speed, lang="en-us")
                pad = np.zeros(int(sr * 0.06), dtype=audio.dtype)  # a breath of silence at each end
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t:
                    sf.write(t.name, np.concatenate([pad, audio, pad]), sr)
                    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", t.name, "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "40k", "-write_xing", "0", "-id3v2_version", "0", mp3], check=True)
                    os.unlink(t.name)
                n += 1
                if a.only and n >= a.only: break
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], capture_output=True, text=True).stdout.strip() or 0)
            clips.append((kk, open(mp3, "rb").read(), dur, envelope(mp3)))
        off = 0
        with open(os.path.join(a.out_dir, f"{bank}.mp3"), "wb") as f:
            for kk, data, dur, env in clips:
                f.write(data)
                manifest[kk] = [bank, off, len(data), round(dur, 2), env]
                off += len(data)
        print(f"{bank}: {len(clips)} clips, {off/1024:.0f} KB", flush=True)
        if a.only and n >= a.only: break
    json.dump(manifest, open(a.manifest, "w"), separators=(",", ":"))
    print(f"recorded {n} new clips; {len(manifest)} in manifest")


if __name__ == "__main__":
    main()
