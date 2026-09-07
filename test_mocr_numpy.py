import numpy as np
from PIL import Image
from manga_ocr import MangaOcr

mocr = MangaOcr()
img = Image.new('RGB', (100, 100), color=(255, 255, 255))
img_array = np.array(img)

try:
    print("Testing numpy array...")
    res = mocr(img_array)
    print("Result:", res)
except Exception as e:
    print("Error with numpy:", e)
