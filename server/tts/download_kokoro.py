import os
import sys
import urllib.request
import time

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'kokoro')
os.makedirs(MODELS_DIR, exist_ok=True)

MODEL_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx'
VOICES_BIN_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin'
VOICES_JSON_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/voices.json'

def download_file(url, dest_path):
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000000:
        print(f"Already downloaded: {dest_path} ({os.path.getsize(dest_path)} bytes)")
        return
    print(f"Downloading {url} to {dest_path}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    start_time = time.time()
    with urllib.request.urlopen(req) as resp, open(dest_path, 'wb') as out_file:
        total = int(resp.headers.get('Content-Length', 0))
        downloaded = 0
        chunk_size = 1024 * 1024 # 1MB chunks
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)
            elapsed = time.time() - start_time
            speed = downloaded / (elapsed + 1e-6) / (1024 * 1024)
            pct = (downloaded / total * 100) if total else 0
            sys.stdout.write(f"\r  {downloaded / (1024*1024):.1f}/{total / (1024*1024):.1f} MB ({pct:.1f}%) @ {speed:.1f} MB/s")
            sys.stdout.flush()
    print(f"\nDone: {dest_path} ({os.path.getsize(dest_path)} bytes)")

if __name__ == '__main__':
    model_path = os.path.join(MODELS_DIR, 'kokoro-v1.0.onnx')
    voices_bin_path = os.path.join(MODELS_DIR, 'voices-v1.0.bin')
    voices_json_path = os.path.join(MODELS_DIR, 'voices.json')

    download_file(MODEL_URL, model_path)
    download_file(VOICES_BIN_URL, voices_bin_path)
    download_file(VOICES_JSON_URL, voices_json_path)
    print("Kokoro model files are ready!")
