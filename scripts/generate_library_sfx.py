"""
Generates rich, distinct acoustic audio fixtures for each curated sound library item.
"""
import os
import sys
import soundfile as sf
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from server.sfx.soundbox_service import synthesize_sfx

PUBLIC_SFX = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public', 'sfx'))
os.makedirs(PUBLIC_SFX, exist_ok=True)

ITEMS = [
    ('whoosh-cinematic.wav', 'cinematic sub whoosh air displacement low frequency sweep', 1.2),
    ('whoosh-fast.wav', 'fast whoosh whip swish transition clean', 0.6),
    ('impact-cinematic-boom.wav', 'heavy cinematic boom impact sub bass trailer explosion', 2.0),
    ('impact-slam.wav', 'punchy kick slam drop hit attack', 1.0),
    ('ui-modern-click.wav', 'glass interface tap clean minimal modern click button', 0.3),
    ('ui-switch-toggle.wav', 'mechanical toggle switch snap clack', 0.35),
    ('transition-digital-shimmer.wav', 'magic sparkle digital shimmer reveal chime', 1.5),
    ('transition-air-suction.wav', 'reverse vacuum air suction whoosh pass', 1.2),
    ('riser-tension-build.wav', 'riser tension build swell acceleration pitch climb', 2.5),
    ('drop-bass-fall.wav', 'bass drop 808 sub fall low frequency dive', 2.2),
    ('foley-paper-slide.wav', 'paper foley texture rustle page flip slide', 0.8),
    ('tech-hud-beep.wav', 'tech hud beep cyber digital data telemetry code', 0.4),
    ('cinematic-drone-dark.wav', 'drone cinematic atmosphere dark ambient rumble pad', 3.0),
    ('logo-stinger-chime.wav', 'logo stinger chime bell metallic accent reveal sparkle', 2.2),
]

for filename, prompt, duration in ITEMS:
    audio, sr, rep = synthesize_sfx(prompt, duration_s=duration)
    out_path = os.path.join(PUBLIC_SFX, filename)
    sf.write(out_path, audio, sr, subtype='PCM_16')
    print(f"Generated {filename}: {duration}s, {len(audio)} samples, peak={rep['peakDb']}dB, rms={rep['rmsDb']}dB")

print("All curated sound library items generated with distinct acoustic DSP profiles.")
