"""
Seed script to pre-generate curated offline Sound FX library for MotionLab 3.0.
Calls the local Soundbox service (http://127.0.0.1:17494/api/generate) and saves
canonical WAV files in public/sfx/.
"""

import urllib.request
import json
import os
import shutil

SOUNDS = [
    {
        "filename": "whoosh-cinematic.wav",
        "prompt": "Deep cinematic bass whoosh with air displacement and stereo sweep",
        "duration": 1.2,
        "seed": 101
    },
    {
        "filename": "whoosh-fast.wav",
        "prompt": "Quick sleek digital whip whoosh transition",
        "duration": 0.6,
        "seed": 102
    },
    {
        "filename": "impact-cinematic-boom.wav",
        "prompt": "Heavy cinematic sub bass impact with metallic resonance and dark decay",
        "duration": 2.0,
        "seed": 201
    },
    {
        "filename": "impact-slam.wav",
        "prompt": "Aggressive punchy kick slam with tight tail",
        "duration": 1.0,
        "seed": 202
    },
    {
        "filename": "ui-modern-click.wav",
        "prompt": "Crisp tactile glass button tap for clean modern interface",
        "duration": 0.3,
        "seed": 301
    },
    {
        "filename": "ui-switch-toggle.wav",
        "prompt": "Subtle mechanical toggle switch click snap",
        "duration": 0.35,
        "seed": 302
    },
    {
        "filename": "transition-digital-shimmer.wav",
        "prompt": "High-tech digital shimmer swipe with granular sparkles",
        "duration": 1.5,
        "seed": 401
    },
    {
        "filename": "transition-air-suction.wav",
        "prompt": "Atmospheric reverse vacuum suction whoosh",
        "duration": 1.2,
        "seed": 402
    },
    {
        "filename": "riser-tension-build.wav",
        "prompt": "Dark analog synth pitch riser building tension to climax",
        "duration": 2.5,
        "seed": 501
    },
    {
        "filename": "drop-bass-fall.wav",
        "prompt": "Heavy subwoofer pitch drop falling from 200Hz to 35Hz",
        "duration": 1.8,
        "seed": 601
    },
    {
        "filename": "foley-paper-slide.wav",
        "prompt": "Clean parchment paper rustle and fast slide foley",
        "duration": 0.8,
        "seed": 701
    },
    {
        "filename": "tech-hud-beep.wav",
        "prompt": "Sci-fi holographic HUD scan telemetry chime sequence",
        "duration": 0.9,
        "seed": 801
    },
    {
        "filename": "cinematic-drone-dark.wav",
        "prompt": "Ominous cinematic brass braam and low frequency rumble",
        "duration": 2.8,
        "seed": 901
    },
    {
        "filename": "logo-stinger-chime.wav",
        "prompt": "Lush brand logo chord chime with crystal overtone reverb",
        "duration": 2.2,
        "seed": 1001
    }
]

API_URL = "http://127.0.0.1:17494/api/generate"
PUBLIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "public", "sfx"))
os.makedirs(PUBLIC_DIR, exist_ok=True)

print(f"Generating {len(SOUNDS)} curated sound effects into {PUBLIC_DIR}...")

for item in SOUNDS:
    target_path = os.path.join(PUBLIC_DIR, item["filename"])
    if os.path.exists(target_path) and os.path.getsize(target_path) > 10000:
        print(f"Skipping {item['filename']} (already exists, {os.path.getsize(target_path)} bytes)")
        continue

    payload = {
        "prompt": item["prompt"],
        "duration": item["duration"],
        "seed": item["seed"],
        "model": "audiocraft-small"
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            sound_id = data.get("id")
            audio_url = data.get("audio_url")
            print(f"Generated {item['filename']} -> ID: {sound_id}, URL: {audio_url}")

            # Fetch audio file
            if not audio_url.startswith("http"):
                audio_url = f"http://127.0.0.1:17494{audio_url}"

            with urllib.request.urlopen(audio_url) as file_resp:
                with open(target_path, "wb") as f:
                    shutil.copyfileobj(file_resp, f)
            print(f"Saved {item['filename']} ({os.path.getsize(target_path)} bytes)")
    except Exception as e:
        print(f"ERROR generating {item['filename']}: {e}")

print("Sound library generation complete!")
