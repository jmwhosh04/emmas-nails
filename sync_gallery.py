import os
import re
import json
import requests
import subprocess
import ctypes
from io import BytesIO
from PIL import Image, ImageFilter

# =====================================================================
# CONFIGURATION
# =====================================================================
# Replace this with Emma's public Shared Google Photos Album Link
SHARED_ALBUM_URL = "https://photos.app.goo.gl/TonFQRqmTVudyv9w9"

# Local directories and paths
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(PROJECT_DIR, "assets")
GALLERY_JSON = os.path.join(PROJECT_DIR, "gallery.json")
SYNC_REGISTRY = os.path.join(PROJECT_DIR, ".synced_photos.json")

def copy_to_clipboard(text):
    """
    Copies text to the Windows clipboard using native ctypes (no external library required).
    """
    if not ctypes.windll.user32.OpenClipboard(None):
        return
    try:
        ctypes.windll.user32.EmptyClipboard()
        data = text.encode('utf-16le') + b'\x00\x00'
        h_global = ctypes.windll.kernel32.GlobalAlloc(2, len(data)) # GMEM_MOVEABLE = 2
        if h_global:
            ptr = ctypes.windll.kernel32.GlobalLock(h_global)
            if ptr:
                ctypes.memmove(ptr, data, len(data))
                ctypes.windll.kernel32.GlobalUnlock(h_global)
                ctypes.windll.user32.SetClipboardData(13, h_global) # CF_UNICODETEXT = 13
    except Exception as e:
        print(f"[!] Clipboard copy failed: {e}")
    finally:
        ctypes.windll.user32.CloseClipboard()

# Make sure assets folder exists
os.makedirs(ASSETS_DIR, exist_ok=True)

# Load existing synced photos registry
if os.path.exists(SYNC_REGISTRY):
    with open(SYNC_REGISTRY, "r") as f:
        synced_ids = set(json.load(f))
else:
    synced_ids = set()

# Load current gallery data
if os.path.exists(GALLERY_JSON):
    with open(GALLERY_JSON, "r", encoding="utf-8") as f:
        gallery_items = json.load(f)
else:
    gallery_items = []


def extract_image_urls(album_url):
    """
    Fetches the public shared album URL and extracts direct photo source URLs.
    """
    print(f"[*] Fetching album link: {album_url}")
    try:
        response = requests.get(album_url, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"[!] Error loading shared album link: {e}")
        return []

    # Find the redirects URL contents
    html = response.text
    
    # Regex to find direct image URLs inside Google Photos script blocks
    # Google Photos direct image URLs start with https://lh3.googleusercontent.com/pw/
    urls = re.findall(r'https://lh3\.googleusercontent\.com/pw/[a-zA-Z0-9\-_=]+', html)
    
    # Clean and filter duplicates
    cleaned_urls = []
    seen = set()
    for url in urls:
        # Strip sizing parameters if they exist
        base_url = url.split("=")[0]
        if base_url not in seen:
            seen.add(base_url)
            cleaned_urls.append(base_url)
            
    print(f"[+] Found {len(cleaned_urls)} unique photo references in album.")
    return cleaned_urls


def crop_to_square(img):
    """
    Crops an image to a 1:1 square ratio centered around the middle.
    """
    width, height = img.size
    if width == height:
        return img
    min_dim = min(width, height)
    left = (width - min_dim) / 2
    top = (height - min_dim) / 2
    right = (width + min_dim) / 2
    bottom = (height + min_dim) / 2
    return img.crop((left, top, right, bottom))


def process_image(img_url, filename):
    """
    Downloads, removes background using rembg, crops to square, and saves.
    """
    # Append width parameter to fetch high res (1200px)
    download_url = f"{img_url}=w1200"
    print(f"[*] Downloading photo: {download_url}")
    
    try:
        res = requests.get(download_url, timeout=20)
        res.raise_for_status()
        input_img = Image.open(BytesIO(res.content))
    except Exception as e:
        print(f"[!] Error downloading/opening image: {e}")
        return False

    # Perform background removal
    print("[*] Processing AI background removal...")
    try:
        from rembg import remove
        # rembg returns transparent background PNG
        output_img = remove(input_img)
    except ImportError:
        print("[!] rembg library not installed! Saving original image instead.")
        print("[!] Install it with: pip install rembg")
        output_img = input_img
    except Exception as e:
        print(f"[!] Background removal failed: {e}. Saving original image.")
        output_img = input_img

    # Crop to 1:1 square
    # Crop to 1:1 square
    output_img = crop_to_square(input_img)
    
    # Save optimized file to assets directory as high-quality JPEG
    dest_path = os.path.join(ASSETS_DIR, filename)
    output_img.save(dest_path, "JPEG", quality=95)
    print(f"[+] Image saved successfully to: {dest_path}")
    return True


def run_git_sync():
    """
    Commits and pushes updates automatically to GitHub.
    """
    print("[*] Committing changes and pushing to GitHub Pages...")
    try:
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", "Auto-sync Google Photos album"], check=True)
        subprocess.run(["git", "push", "origin", "main"], check=True)
        print("[+] Website pushed live successfully!")
    except Exception as e:
        print(f"[!] Git upload failed: {e}")


def main():
    if SHARED_ALBUM_URL == "https://photos.app.goo.gl/TonFQRqmTVudyv9w9" and False: # check placeholder
        print("[!] Setup Required: Please open sync_gallery.py and paste your shared Google Photos album link into SHARED_ALBUM_URL!")
        return

    photo_urls = extract_image_urls(SHARED_ALBUM_URL)
    new_additions = 0

    for idx, img_url in enumerate(photo_urls):
        # Extract a unique identifier from the Google Photos URL
        photo_id = img_url.split("/")[-1][:30] # first 30 chars of the key
        
        if photo_id in synced_ids:
            continue
            
        print(f"\n[!] New photo detected! [ID: {photo_id}]")
        
        # Determine image file name
        clean_title = f"set-{len(gallery_items) + 1}"
        filename = f"{clean_title}.png"
        
        # Process and save the image
        success = process_image(img_url, filename)
        if not success:
            continue
            
        # Append to gallery JSON database with a pending flag for the AI to process later
        new_item = {
            "id": f"gallery-item-{len(gallery_items) + 1}",
            "image": f"assets/{filename}",
            "category": "pending-ai",
            "title": f"Style Set {len(gallery_items) + 1}",
            "meta": "Pending AI description and tags review."
        }
        gallery_items.append(new_item)
        
        # Mark as synced
        synced_ids.add(photo_id)
        new_additions += 1

    if new_additions > 0:
        # Save updated JSON database
        with open(GALLERY_JSON, "w", encoding="utf-8") as f:
            json.dump(gallery_items, f, indent=2)
            
        # Save sync registry
        with open(SYNC_REGISTRY, "w") as f:
            json.dump(list(synced_ids), f, indent=2)
            
        print(f"\n[+] Added {new_additions} new nail portfolio photos as 'pending-ai'!")
        
        # Deploy live!
        run_git_sync()
        
        # Copy review prompt to clipboard for user
        copy_to_clipboard("Review the new nails.")
        print("[+] Auto-copied 'Review the new nails.' to your clipboard!")
        print("[*] Switch to your chat with Gemini and press Ctrl+V to paste and send!")
    else:
        print("\n[+] No new photos found in the Google Photos album.")


if __name__ == "__main__":
    main()
