import os
import re
import json
import requests
import subprocess
from io import BytesIO
from PIL import Image

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
    output_img = crop_to_square(output_img)
    
    # Save optimized file to assets directory as transparent PNG
    dest_path = os.path.join(ASSETS_DIR, filename)
    output_img.save(dest_path, "PNG")
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
    if SHARED_ALBUM_URL == "YOUR_SHARED_ALBUM_LINK_HERE":
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
        
        # Check if they want to import this photo (to prevent double-importing duplicate sets)
        import_choice = input("Do you want to add this photo to the website? (y/n, Default: y): ").strip().lower()
        if import_choice == 'n':
            print("[*] Skipping photo (marking as synced so it won't ask again).")
            synced_ids.add(photo_id)
            continue
            
        # Determine image file name
        clean_title = f"set-{len(gallery_items) + 1}"
        filename = f"{clean_title}.png"
        
        # Process and save the image
        success = process_image(img_url, filename)
        if not success:
            continue
            
        # Ask for details in interactive console
        print("\n--- Enter Details for Emma's Website ---")
        title = input(f"Title [Default: Style Set {len(gallery_items) + 1}]: ").strip()
        if not title:
            title = f"Style Set {len(gallery_items) + 1}"
            
        print("\nService Types:")
        print("1) Gel-X extensions")
        print("2) Classic Gel Manicure")
        print("3) Soak & Massage Manicure")
        srv_choice = input("Select Service [1-3, Default: 1]: ").strip()
        
        if srv_choice == "2":
            base_category = "normal-gel"
        elif srv_choice == "3":
            base_category = "spa-mani"
        else:
            base_category = "gel-x"
            
        is_classic = input("Is this a neutral/classic design? (y/n, Default: n): ").strip().lower()
        category = base_category
        if is_classic == "y":
            category += " classic"
            
        meta = input("Enter brief description (e.g. Soft pink base with chrome finish): ").strip()
        if not meta:
            meta = "Premium custom nail styling by Emma."
            
        # Append to gallery JSON database
        new_item = {
            "id": f"gallery-item-{len(gallery_items) + 1}",
            "image": f"assets/{filename}",
            "category": category,
            "title": title,
            "meta": meta
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
            
        print(f"\n[+] Added {new_additions} new nail portfolio photos to the gallery!")
        
        # Deploy live!
        run_git_sync()
    else:
        print("\n[+] No new photos found in the Google Photos album.")


if __name__ == "__main__":
    main()
