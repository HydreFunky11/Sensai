import io
from PIL import Image
from manga_ocr import MangaOcr

mocr = MangaOcr()
img = Image.new('RGB', (100, 100), color=(255, 255, 255))
buf = io.BytesIO()
img.save(buf, format='PNG')
img_bytes = buf.getvalue()

try:
    print("Testing bytes...")
    res = mocr(img_bytes)
    print("Result:", res)
except Exception as e:
    print("Error with bytes:", e)

try:
    print("\nTesting BytesIO...")
    buf.seek(0)
    res = mocr(buf)
    print("Result:", res)
except Exception as e:
    print("Error with BytesIO:", e)
