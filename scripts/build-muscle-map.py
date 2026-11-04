# Genera los recursos del mapa muscular 3D (public/muscles/<cuerpo>/).
# Uso: python3 -I scripts/build-muscle-map.py <render.jpg> <carpeta_salida>
# Entrada: render con la vista frontal a la izquierda y la posterior a la derecha, fondo blanco.
# Salida: body.webp (fondo transparente) y una máscara por grupo muscular, todas con el mismo recorte.
# Las coordenadas de REG y FIX corresponden al render de 1024 x 576 usado para cada cuerpo.
import sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from collections import deque

src, out = sys.argv[1], sys.argv[2]
FIX = [(677, 700, 800, 80, 165), (341, 342, 380, 0, 45), (677, 678, 716, 0, 45), (341, 425, 460, 185, 225)]
im = Image.open(src).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.int16)

# 1. Fondo: relleno desde los bordes sobre píxeles casi blancos y sin color.
mx, mn = a.max(2), a.min(2)
bgish = (mn > 228) & (mx - mn < 14)
seen = np.zeros((H, W), bool)
q = deque()
for x in range(W):
    for y in (0, H - 1):
        if bgish[y, x]: seen[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if bgish[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = y+dy, x+dx
        if 0 <= ny < H and 0 <= nx < W and not seen[ny, nx] and bgish[ny, nx]:
            seen[ny, nx] = True; q.append((ny, nx))
solid = np.where(seen, 0, 255).astype(np.uint8)
# Brillos tan blancos como el fondo en el hombro derecho de la vista de espalda: se rellenan con la silueta del hombro izquierdo en espejo.
for (cx, x0r, x1r, y0r, y1r) in FIX:
    for x in range(x0r, x1r):
        mxr = 2*cx - x
        if 0 <= mxr < W: solid[y0r:y1r, x] = np.maximum(solid[y0r:y1r, x], solid[y0r:y1r, mxr])
# Cabezas: cada fila se rellena entre su primer y su último píxel de cuerpo (la cabeza es convexa).
for (x0r, x1r, y0r, y1r) in [(300, 385, 0, 60), (635, 720, 0, 60)]:
    for y in range(y0r, y1r):
        xs = np.nonzero(solid[y, x0r:x1r])[0]
        if len(xs): solid[y, x0r + xs[0]:x0r + xs[-1] + 1] = 255
body = Image.fromarray(solid)
body = body.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))

def mirror(pts, c): return [(2*c - x, y) for x, y in pts]
FC, BC = 341, 677
L = lambda pts, c: [pts, mirror(pts, c)]
REG = {
  "shoulders": L([(292,98),(272,104),(260,118),(257,140),(265,152),(282,140),(295,118)], FC)
             + L([(622,100),(605,104),(595,118),(594,142),(602,150),(615,140),(625,118)], BC),
  "chest": [[(300,106),(340,104),(382,106),(396,118),(398,140),(378,151),(341,148),(304,151),(285,140),(287,118)]],
  "biceps": L([(262,150),(280,148),(278,175),(268,198),(255,195),(253,172)], FC),
  "triceps": L([(600,148),(618,146),(620,172),(612,198),(598,198),(593,172)], BC),
  "forearms": L([(255,198),(270,202),(262,230),(245,262),(232,268),(228,255),(240,225)], FC)
            + L([(598,200),(612,203),(600,232),(585,262),(572,268),(570,255),(585,225)], BC),
  "core": [[(306,150),(376,150),(386,176),(384,214),(371,238),(341,250),(311,238),(298,214),(296,176)],
           [(662,198),(692,198),(691,228),(677,236),(663,228)]],
  "quads": L([(290,255),(318,262),(334,290),(333,340),(325,376),(300,378),(288,350),(283,300)], FC),
  "adductors": L([(320,258),(336,288),(337,330),(330,322),(322,292)], FC)
             + L([(666,302),(676,302),(675,345),(668,340)], BC),
  "calves": L([(292,400),(312,398),(318,430),(312,470),(302,480),(294,450)], FC)
          + L([(625,398),(655,398),(663,425),(656,462),(640,468),(626,455),(618,425)], BC),
  "back": [[(650,88),(677,80),(704,88),(724,105),(734,140),(729,175),(714,204),(695,226),(677,230),(659,226),(640,204),(625,175),(620,140),(630,105)]],
  "glutes": L([(633,240),(660,232),(677,240),(677,298),(650,302),(630,290),(626,265)], BC),
  "hamstrings": L([(628,300),(672,300),(670,340),(660,390),(640,392),(628,360),(622,330)], BC),
}

# Recorte común: caja del cuerpo con margen.
bb = np.argwhere(np.asarray(body) > 20); y0, x0 = bb.min(0); y1, x1 = bb.max(0)
pad = 10; box = tuple(int(v) for v in (max(0, x0-pad), max(0, y0-pad), min(W, x1+pad), min(H, y1+pad)))
print("box", box)

rgba = im.copy(); rgba.putalpha(body)
rgba.crop(box).save(f"{out}/body.webp", quality=88, method=6)

S4 = 4
masks = {}
for name, polys in REG.items():
    m = Image.new("L", (W*S4, H*S4), 0); d = ImageDraw.Draw(m)
    for p in polys: d.polygon([(x*S4, y*S4) for x, y in p], fill=255)
    m = m.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.2))
    m = Image.fromarray((np.asarray(m, float) * np.asarray(body, float) / 255).astype(np.uint8))
    white = Image.new("RGBA", (W, H), (255, 255, 255, 0)); white.putalpha(m)
    white.crop(box).save(f"{out}/{name}.webp", lossless=True, method=6)
    masks[name] = m.crop(box)

# Vista previa: todos los grupos tintados en rosa (multiplicar) sobre fondo blanco.
base = im.crop(box).convert("RGB")
prev = np.asarray(base, float)
tint = np.array([214, 51, 108], float)
for name, m in masks.items():
    al = np.asarray(m, float)[..., None] / 255 * 0.85
    prev = prev * (1 - al) + (prev * tint / 255) * al
Image.fromarray(prev.astype(np.uint8)).save(f"{out}/../work/preview_all.png")
json.dump({"box": box, "size": [box[2]-box[0], box[3]-box[1]]}, open(f"{out}/meta.json", "w"))
