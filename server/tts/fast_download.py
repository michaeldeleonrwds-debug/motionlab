import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'kokoro')
os.makedirs(MODELS_DIR, exist_ok=True)

def get_final_url_and_length(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        length = int(resp.headers.get('Content-Length', 0))
        final_url = resp.geturl()
        return final_url, length

def download_chunk(url, start_byte, end_byte, part_path):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0',
        'Range': f'bytes={start_byte}-{end_byte}'
    })
    with urllib.request.urlopen(req) as resp, open(part_path, 'wb') as f:
        while True:
            chunk = resp.read(256 * 1024)
            if not chunk:
                break
            f.write(chunk)

def download_parallel(url, dest_path, num_workers=12):
    print(f"\nResolving {url}...")
    final_url, total_length = get_final_url_and_length(url)
    if os.path.exists(dest_path) and os.path.getsize(dest_path) == total_length:
        print(f"Already complete: {dest_path} ({os.path.getsize(dest_path)} bytes)")
        return

    print(f"Total length: {total_length / (1024*1024):.1f} MB. Starting {num_workers} parallel workers...")

    chunk_size = total_length // num_workers
    part_files = []
    futures = []
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        for i in range(num_workers):
            start_byte = i * chunk_size
            end_byte = total_length - 1 if i == num_workers - 1 else (i + 1) * chunk_size - 1
            part_path = f"{dest_path}.part{i}"
            part_files.append(part_path)
            futures.append(executor.submit(download_chunk, final_url, start_byte, end_byte, part_path))

        while any(not f.done() for f in futures):
            time.sleep(0.5)
            downloaded = sum(os.path.getsize(p) for p in part_files if os.path.exists(p))
            elapsed = time.time() - start_time
            speed = downloaded / (elapsed + 1e-6) / (1024 * 1024)
            pct = (downloaded / total_length * 100) if total_length else 0
            sys.stdout.write(f"\r  {downloaded / (1024*1024):.1f}/{total_length / (1024*1024):.1f} MB ({pct:.1f}%) @ {speed:.2f} MB/s")
            sys.stdout.flush()

        for f in futures:
            f.result()

    print("\nMerging chunks...")
    with open(dest_path, 'wb') as out_f:
        for part_path in part_files:
            with open(part_path, 'rb') as p_in:
                while True:
                    buf = p_in.read(1024 * 1024)
                    if not buf:
                        break
                    out_f.write(buf)
            if os.path.exists(part_path):
                os.remove(part_path)

    elapsed = time.time() - start_time
    print(f"Done: {dest_path} in {elapsed:.1f}s ({os.path.getsize(dest_path)} bytes)")

if __name__ == '__main__':
    model_path = os.path.join(MODELS_DIR, 'kokoro-v1.0.onnx')
    voices_bin_path = os.path.join(MODELS_DIR, 'voices-v1.0.bin')
    voices_json_path = os.path.join(MODELS_DIR, 'voices.json')

    download_parallel('https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx', model_path, num_workers=16)
    download_parallel('https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin', voices_bin_path, num_workers=8)
    download_parallel('https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/voices.json', voices_json_path, num_workers=6)
    print("All Kokoro model assets successfully downloaded!")
