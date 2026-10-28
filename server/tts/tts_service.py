import os
import sys
import io
import json
import time
import math
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(CURRENT_DIR, 'models', 'kokoro')
MODEL_PATH = os.path.join(MODELS_DIR, 'kokoro-v1.0.onnx')
VOICES_BIN_PATH = os.path.join(MODELS_DIR, 'voices-v1.0.bin')
VOICES_JSON_PATH = os.path.join(MODELS_DIR, 'voices.json')

# Global Kokoro instance
_kokoro_instance = None

def get_kokoro():
    global _kokoro_instance
    if _kokoro_instance is not None:
        return _kokoro_instance

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Kokoro model not found at {MODEL_PATH}")

    voices_path = VOICES_BIN_PATH if os.path.exists(VOICES_BIN_PATH) else VOICES_JSON_PATH
    if not os.path.exists(voices_path):
        raise FileNotFoundError(f"Kokoro voices not found at {voices_path}")

    print(f"Loading Kokoro-82M ONNX model from {MODEL_PATH}...")
    _kokoro_instance = Kokoro(MODEL_PATH, voices_path)
    print("Kokoro-82M successfully loaded.")
    return _kokoro_instance

VOICE_MAP = {
    # Custom profiles mapped to best Kokoro equivalents
    'angora-exec-male': 'am_michael',
    'angora-dynamic-female': 'af_sarah',
    'cinematic-deep-baritone': 'bm_george',
    'swiss-editorial-female': 'af_bella',
    'friendly-explainer': 'am_adam',
    # Direct Kokoro names
    'af_sarah': 'af_sarah',
    'af_bella': 'af_bella',
    'af_sky': 'af_sky',
    'af_nicole': 'af_nicole',
    'af_heart': 'af_heart',
    'am_adam': 'am_adam',
    'am_michael': 'am_michael',
    'am_eric': 'am_eric',
    'am_fenrir': 'am_fenrir',
    'am_liam': 'am_liam',
    'bf_emma': 'bf_emma',
    'bf_isabella': 'bf_isabella',
    'bm_george': 'bm_george',
    'bm_fable': 'bm_fable',
    'bm_lewis': 'bm_lewis',
}

PROFILES_METADATA = [
    {
        'id': 'af_sarah',
        'name': 'Sarah (American Female — Dynamic & Clear)',
        'voiceType': 'preset',
        'engine': 'kokoro',
        'language': 'en',
        'accent': 'General American',
        'gender': 'female',
        'ageRange': 'young',
        'description': 'Crisp, articulate female voice with natural intonation, ideal for commercial narration and brand storytelling.',
        'authorizedForCommercialUse': True,
        'createdAt': 1772000000000,
        'tags': ['commercial', 'clarity', 'energetic', 'female', 'neural']
    },
    {
        'id': 'am_michael',
        'name': 'Michael (Executive Baritone — Corporate & Confident)',
        'voiceType': 'preset',
        'engine': 'kokoro',
        'language': 'en',
        'accent': 'General American / Corporate',
        'gender': 'male',
        'ageRange': 'middle-aged',
        'description': 'Authoritative, resonant, and articulate baritone voice calibrated for premium B2B commercial advertisements.',
        'authorizedForCommercialUse': True,
        'createdAt': 1772000000000,
        'tags': ['commercial', 'corporate', 'baritone', 'authoritative', 'neural']
    },
    {
        'id': 'af_bella',
        'name': 'Bella (Editorial Minimal — Sophisticated & Intimate)',
        'voiceType': 'preset',
        'engine': 'kokoro',
        'language': 'en',
        'accent': 'Neutral American',
        'gender': 'female',
        'ageRange': 'young',
        'description': 'Minimal, understated, sophisticated narration perfect for design documentaries and editorial showcase videos.',
        'authorizedForCommercialUse': True,
        'createdAt': 1772000000000,
        'tags': ['editorial', 'minimal', 'sophisticated', 'female', 'neural']
    },
    {
        'id': 'am_adam',
        'name': 'Adam (Conversational Narrator — Friendly & Articulate)',
        'voiceType': 'preset',
        'engine': 'kokoro',
        'language': 'en',
        'accent': 'Warm American',
        'gender': 'male',
        'ageRange': 'young',
        'description': 'Warm, approachable, conversational tone ideal for SaaS explainers and tech tutorials.',
        'authorizedForCommercialUse': True,
        'createdAt': 1772000000000,
        'tags': ['tutorial', 'friendly', 'warm', 'conversational', 'neural']
    },
    {
        'id': 'bf_emma',
        'name': 'Emma (British Editorial — Refined & Poised)',
        'voiceType': 'preset',
        'engine': 'kokoro',
        'language': 'en',
        'accent': 'British RP',
        'gender': 'female',
        'ageRange': 'young',
        'description': 'Elegant British female voice with polished diction and subtle warmth for luxury and creative agency films.',
        'authorizedForCommercialUse': True,
        'createdAt': 1772000000000,
        'tags': ['british', 'luxury', 'editorial', 'female', 'neural']
    },
    {
        'id': 'bm_george',
        'name': 'George (British Cinematic — Deep & Prestigious)',
        'voiceType': 'preset',
        'engine': 'kokoro',
        'language': 'en',
        'accent': 'British Classical',
        'gender': 'male',
        'ageRange': 'mature',
        'description': 'Rich, resonant British voice with cinematic depth and commanding presence for dramatic agency trailers.',
        'authorizedForCommercialUse': True,
        'createdAt': 1772000000000,
        'tags': ['cinematic', 'deep', 'trailer', 'british', 'neural']
    },
    {
        'id': 'af_sky',
        'name': 'Sky (American Female — Bright & Optimistic)',
        'voiceType': 'preset',
        'engine': 'kokoro',
        'language': 'en',
        'accent': 'General American',
        'gender': 'female',
        'ageRange': 'young',
        'description': 'Bright, modern, optimistic tone for consumer apps and social media reels.',
        'authorizedForCommercialUse': True,
        'createdAt': 1772000000000,
        'tags': ['bright', 'social', 'modern', 'female', 'neural']
    },
    {
        'id': 'am_eric',
        'name': 'Eric (American Male — Professional & Punchy)',
        'voiceType': 'preset',
        'engine': 'kokoro',
        'language': 'en',
        'accent': 'General American',
        'gender': 'male',
        'ageRange': 'young',
        'description': 'Punchy, confident delivery designed for fast-paced promo cuts and product drops.',
        'authorizedForCommercialUse': True,
        'createdAt': 1772000000000,
        'tags': ['promo', 'punchy', 'commercial', 'male', 'neural']
    }
]

def normalize_language(lang: str, voice_name: str) -> str:
    resolved_voice = VOICE_MAP.get(voice_name, voice_name)
    if not lang or lang.strip().lower() in ['en', 'eng', 'english', '']:
        if resolved_voice.startswith('b'):
            return 'en-gb'
        return 'en-us'

    clean = lang.strip().lower().replace('_', '-')
    mapping = {
        'en': 'en-us',
        'en-us': 'en-us',
        'en-gb': 'en-gb',
        'us': 'en-us',
        'gb': 'en-gb',
        'uk': 'en-gb',
        'es': 'es',
        'fr': 'fr-fr',
        'fr-fr': 'fr-fr',
        'it': 'it',
        'pt': 'pt-br',
        'pt-br': 'pt-br',
        'ja': 'ja',
        'zh': 'zh',
        'hi': 'hi',
    }
    return mapping.get(clean, 'en-gb' if resolved_voice.startswith('b') else 'en-us')

def synthesize_speech(text: str, voice_name: str = 'am_michael', speed: float = 1.0, lang: str = 'en-us'):
    """
    Synthesize natural neural speech using Kokoro-82M.
    Returns (wav_bytes, duration_seconds, sample_rate, quality_report)
    """
    kokoro = get_kokoro()

    # Resolve voice name
    resolved_voice = VOICE_MAP.get(voice_name, voice_name)
    available_voices = kokoro.get_voices()
    if resolved_voice not in available_voices:
        print(f"Voice '{resolved_voice}' not in Kokoro voices. Available: {available_voices[:5]}... Falling back to 'am_michael'")
        resolved_voice = 'am_michael' if 'am_michael' in available_voices else available_voices[0]

    # Clean text
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Cannot synthesize empty text")

    # Normalize language code for espeak-ng
    clean_lang = normalize_language(lang, resolved_voice)

    # Generate audio
    t0 = time.time()
    samples, sample_rate = kokoro.create(clean_text, voice=resolved_voice, speed=float(speed), lang=clean_lang)
    elapsed = time.time() - t0

    # Ensure samples is a float numpy array in [-1.0, 1.0]
    samples = np.array(samples, dtype=np.float32)
    duration = float(len(samples)) / float(sample_rate)

    # Audio quality metrics
    peak_linear = float(np.max(np.abs(samples))) if len(samples) > 0 else 0.0
    rms_linear = float(np.sqrt(np.mean(samples ** 2))) if len(samples) > 0 else 0.0

    peak_db = 20.0 * math.log10(peak_linear + 1e-9)
    rms_db = 20.0 * math.log10(rms_linear + 1e-9)
    is_silent = peak_linear < 0.01 or rms_linear < 0.005
    has_clipping = peak_linear >= 0.999

    # Encode to 24kHz 16-bit PCM WAV
    out_buf = io.BytesIO()
    sf.write(out_buf, samples, sample_rate, format='WAV', subtype='PCM_16')
    wav_bytes = out_buf.getvalue()

    quality_report = {
        'isValid': not is_silent and len(wav_bytes) > 1024,
        'durationSeconds': round(duration, 3),
        'sampleRate': sample_rate,
        'hasClipping': has_clipping,
        'hasSilence': is_silent,
        'peakDb': round(peak_db, 1),
        'rmsDb': round(rms_db, 1),
        'inferenceTimeSec': round(elapsed, 2),
        'rtf': round(elapsed / max(0.01, duration), 3),
        'voice': resolved_voice,
    }

    print(f"Synthesized {duration:.2f}s audio with '{resolved_voice}' in {elapsed:.2f}s (RTF: {quality_report['rtf']}) | Peak: {peak_db:.1f}dB, RMS: {rms_db:.1f}dB")

    return wav_bytes, duration, sample_rate, quality_report

class TTSRequestHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        self.send_header('Access-Control-Expose-Headers', 'X-Audio-Duration, X-Audio-Sample-Rate, X-Audio-Quality, Content-Length')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/health' or self.path == '/api/voicebox/health':
            try:
                kokoro = get_kokoro()
                voices = kokoro.get_voices()
                body = json.dumps({
                    'ok': True,
                    'connected': True,
                    'engine': 'kokoro',
                    'version': '0.19-onnx',
                    'model': 'Kokoro-82M',
                    'voices': voices,
                    'engines': ['kokoro']
                }).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors()
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                body = json.dumps({'ok': False, 'connected': False, 'error': str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self._send_cors()
                self.end_headers()
                self.wfile.write(body)
            return

        if self.path == '/profiles' or self.path == '/api/voicebox/profiles':
            body = json.dumps(PROFILES_METADATA).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors()
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == '/engines' or self.path == '/api/voicebox/engines':
            engines = [{
                'id': 'kokoro',
                'name': 'Kokoro 82M (Real Neural TTS)',
                'version': 'v0.19-onnx',
                'description': 'Ultra-fast, lightweight 82M parameter neural text-to-speech engine with natural human intonation. CPU-optimized.',
                'supportsCloning': False,
                'supportsVoiceDesign': False,
                'supportsEmotionTags': False,
                'supportsStreaming': False,
                'sampleRate': 24000,
                'supportedLanguages': ['en'],
                'approxModelSizeBytes': 325 * 1024 * 1024,
                'isInstalled': True,
                'isAvailable': True,
                'license': 'Apache-2.0'
            }]
            body = json.dumps(engines).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors()
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == '/generate' or self.path == '/api/voicebox/generate':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                text = data.get('text', '')
                profile_id = data.get('profile_id') or data.get('profileId') or 'am_michael'
                speed = float(data.get('speed', 1.0))
                lang = data.get('language', 'en-us')

                wav_bytes, duration, sample_rate, report = synthesize_speech(
                    text=text,
                    voice_name=profile_id,
                    speed=speed,
                    lang=lang
                )

                self.send_response(200)
                self.send_header('Content-Type', 'audio/wav')
                self.send_header('X-Audio-Duration', str(duration))
                self.send_header('X-Audio-Sample-Rate', str(sample_rate))
                self.send_header('X-Audio-Quality', json.dumps(report))
                self._send_cors()
                self.send_header('Content-Length', str(len(wav_bytes)))
                self.end_headers()
                self.wfile.write(wav_bytes)
            except Exception as e:
                err_body = json.dumps({'error': str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self._send_cors()
                self.end_headers()
                self.wfile.write(err_body)
            return

        self.send_response(404)
        self.end_headers()

def run_server(port=17493):
    # Preload Kokoro
    try:
        get_kokoro()
    except Exception as e:
        print(f"Warning: could not preload Kokoro: {e}")

    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, TTSRequestHandler)
    print(f"MotionLab Neural TTS Service running on http://127.0.0.1:{port}")
    httpd.serve_forever()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="MotionLab Local Neural TTS Service (Kokoro-82M)")
    parser.add_argument('--server', action='store_true', help="Run HTTP server daemon on port 17493")
    parser.add_argument('--port', type=int, default=17493, help="Port to listen on (default 17493)")
    parser.add_argument('--text', type=str, help="Text to synthesize")
    parser.add_argument('--voice', type=str, default='am_michael', help="Voice ID")
    parser.add_argument('--speed', type=float, default=1.0, help="Speech pacing multiplier")
    parser.add_argument('--output', type=str, help="Output WAV path")

    args = parser.parse_args()

    if args.server:
        run_server(args.port)
    elif args.text:
        out_path = args.output or 'generated_voice.wav'
        wav_bytes, duration, sample_rate, report = synthesize_speech(
            text=args.text,
            voice_name=args.voice,
            speed=args.speed
        )
        with open(out_path, 'wb') as f:
            f.write(wav_bytes)
        print(f"Successfully generated {out_path} ({len(wav_bytes)} bytes, {duration:.2f}s). Quality report: {report}")
    else:
        # Default run as server
        run_server(args.port)
