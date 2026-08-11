from PIL import Image, ImageDraw

S = 512
BG = (15, 23, 42, 255)        # slate 900
AMBER = (242, 160, 62, 255)   # staging
GREEN = (58, 200, 118, 255)   # local

def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m

def arrow(draw, x_tail, x_tip, yc, thickness, head_len, head_half, colour):
    direction = 1 if x_tip > x_tail else -1
    x_neck = x_tip - direction * head_len
    draw.rectangle(
        [min(x_tail, x_neck), yc - thickness / 2, max(x_tail, x_neck), yc + thickness / 2],
        fill=colour,
    )
    draw.polygon(
        [(x_neck, yc - head_half), (x_neck, yc + head_half), (x_tip, yc)],
        fill=colour,
    )

canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(canvas)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)

T, HEAD, HALF = 48, 90, 70
arrow(d, 88, 428, 151, T, HEAD, HALF, AMBER)   # top, pointing right
arrow(d, 424, 84, 361, T, HEAD, HALF, GREEN)   # bottom, pointing left

canvas.putalpha(rounded_mask(S, int(S * 0.22)))

for size in (16, 32, 48, 128):
    canvas.resize((size, size), Image.LANCZOS).save(f"icons/icon{size}.png")

# Contact sheet so I can eyeball the small sizes
sheet = Image.new("RGBA", (300, 150), (255, 255, 255, 255))
x = 12
for size in (16, 32, 48, 128):
    sheet.paste(canvas.resize((size, size), Image.LANCZOS), (x, 12), canvas.resize((size, size), Image.LANCZOS))
    x += size + 14
# sheet.save("tools/sheet-preview.png")
