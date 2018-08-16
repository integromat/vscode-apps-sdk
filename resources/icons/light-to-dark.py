import os
from PIL import Image
import PIL.ImageOps    

for file in os.listdir("light"):
    if file.endswith(".png"):
        path = os.path.join("light", file)
        print("[ LOG ] Loading file " + path)
        image = Image.open(path)
        r,g,b,a = image.split()
        rgb_image = Image.merge('RGB', (r,g,b))
        inverted_image = PIL.ImageOps.invert(rgb_image)
        r2,g2,b2 = inverted_image.split()
        final_transparent_image = Image.merge('RGBA', (r2,g2,b2,a))
        new_path = os.path.join("dark", file)
        print("[ LOG ] Saving file to " + new_path)
        final_transparent_image.save(new_path)
print("Done")