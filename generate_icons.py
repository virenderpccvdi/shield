#!/usr/bin/env python3
"""
Generate Shield app Android launcher icons.
Deep blue gradient shield with white shield body and checkmark.
"""

import os
import math
from PIL import Image, ImageDraw, ImageFilter

SIZES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

BASE_DIR = "/var/www/ai/FamilyShield/shield-app/android/app/src/main/res"

# Colors
BLUE_TOP    = (21,  101, 192)   # #1565C0
BLUE_BOTTOM = (13,  71,  161)   # #0D47A1
WHITE       = (255, 255, 255)
WHITE_ALPHA = (255, 255, 255, 255)


def draw_rounded_rect_background(draw, size, radius_frac=0.18):
    """Draw a deep-blue rounded rectangle background with vertical gradient simulation."""
    s = size
    r = int(s * radius_frac)
    # Simulate gradient by drawing horizontal bands
    for y in range(s):
        t = y / (s - 1)
        color = (
            int(BLUE_TOP[0] + (BLUE_BOTTOM[0] - BLUE_TOP[0]) * t),
            int(BLUE_TOP[1] + (BLUE_BOTTOM[1] - BLUE_TOP[1]) * t),
            int(BLUE_TOP[2] + (BLUE_BOTTOM[2] - BLUE_TOP[2]) * t),
            255,
        )
        draw.line([(0, y), (s - 1, y)], fill=color)

    # Now cut out corners using a rounded-rect mask
    # We'll use a separate mask image
    mask = Image.new("L", (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=255)
    return mask


def shield_points(cx, cy, w, h):
    """
    Return polygon points for a shield shape centered at (cx, cy)
    with total width w and height h.
    The shield: wide at top, tapers to a point at bottom.
    """
    # Shield proportions (normalized 0..1 relative to w/h)
    # Top edge spans full width with rounded shoulders
    # Sides slope inward
    # Bottom comes to a rounded point

    hw = w / 2
    hh = h / 2

    # Use a Bezier-approximated shield via many polygon points
    pts = []
    steps = 64  # segments for smooth curves

    def lerp(a, b, t):
        return a + (b - a) * t

    # Shield outline (clockwise from top-left corner going right along top):
    # Top-left arc, top edge, top-right arc, right side slope,
    # bottom-right curve, bottom point, bottom-left curve, left side slope back up

    # Parameters (fractions of half-width/half-height)
    top_y       = cy - hh          # top of shield
    bottom_y    = cy + hh          # tip of shield
    left_x      = cx - hw
    right_x     = cx + hw
    shoulder_h  = cy - hh + h * 0.25   # where sides start to slope

    # We build the shield as a series of Bezier-curve segments
    # Segment 1: top edge (left to right), slightly curved upward
    # Segment 2: right slope from shoulder to bottom point
    # Segment 3: bottom point (mirror of left)
    # Segment 4: left slope

    def bezier3(p0, p1, p2, t):
        return (
            (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1],
        )

    def bezier4(p0, p1, p2, p3, t):
        mt = 1 - t
        return (
            mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0],
            mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1],
        )

    # Top-left rounded corner
    tl_corner_x = left_x + hw * 0.18
    tr_corner_x = right_x - hw * 0.18

    # Segment: top-left arc (from top-left inward to top edge)
    for i in range(steps // 4 + 1):
        t = i / (steps // 4)
        p = bezier3(
            (left_x, top_y + hh * 0.15),   # start: left side near top
            (left_x, top_y),                 # control: top-left corner
            (tl_corner_x, top_y),            # end: top edge left
            t
        )
        pts.append(p)

    # Segment: top edge (left to right, slight upward bow)
    for i in range(1, steps // 4 + 1):
        t = i / (steps // 4)
        p = bezier3(
            (tl_corner_x, top_y),
            (cx, top_y - hh * 0.04),   # slight upward bow in center
            (tr_corner_x, top_y),
            t
        )
        pts.append(p)

    # Segment: top-right arc
    for i in range(1, steps // 4 + 1):
        t = i / (steps // 4)
        p = bezier3(
            (tr_corner_x, top_y),
            (right_x, top_y),
            (right_x, top_y + hh * 0.15),
            t
        )
        pts.append(p)

    # Segment: right side tapering to bottom point
    for i in range(1, steps // 4 + 1):
        t = i / (steps // 4)
        p = bezier4(
            (right_x, top_y + hh * 0.15),
            (right_x, cy + hh * 0.4),
            (cx + hw * 0.25, bottom_y - hh * 0.1),
            (cx, bottom_y),
            t
        )
        pts.append(p)

    # Segment: bottom point back up left side
    for i in range(1, steps // 4 + 1):
        t = i / (steps // 4)
        p = bezier4(
            (cx, bottom_y),
            (cx - hw * 0.25, bottom_y - hh * 0.1),
            (left_x, cy + hh * 0.4),
            (left_x, top_y + hh * 0.15),
            t
        )
        pts.append(p)

    return pts


def draw_checkmark(draw, cx, cy, size):
    """Draw a bold white checkmark centered at (cx, cy)."""
    # Checkmark: two lines forming a tick
    # Scale to about 40% of shield width
    arm = size * 0.18  # half the checkmark width
    thick = max(2, int(size * 0.055))

    # Checkmark points (relative to center)
    # Left bottom of tick, the "valley", then up-right long arm
    # Valley is at center-left, shifted slightly down
    vx = cx - arm * 0.15
    vy = cy + arm * 0.45

    # Short left arm: from (vx - arm*0.7, vy - arm*0.5) to valley
    x0 = vx - arm * 0.7
    y0 = vy - arm * 0.5
    # Long right arm: from valley to (vx + arm*1.4, vy - arm*1.4)
    x2 = vx + arm * 1.45
    y2 = vy - arm * 1.45

    draw.line([(x0, y0), (vx, vy)], fill=WHITE, width=thick)
    draw.line([(vx, vy), (x2, y2)], fill=WHITE, width=thick)


def generate_icon(size, output_path):
    # Create RGBA canvas
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw gradient background, get mask for rounded corners
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    mask = draw_rounded_rect_background(bg_draw, size)

    # Apply mask to background
    bg.putalpha(mask)
    img.paste(bg, (0, 0), bg)

    # Recalculate draw on composited image
    draw = ImageDraw.Draw(img)

    # Shield dimensions: ~78% of canvas
    shield_w = size * 0.62
    shield_h = size * 0.72
    cx = size / 2
    cy = size / 2 - size * 0.02  # slightly above center

    # Draw white shield (outer)
    pts_outer = shield_points(cx, cy, shield_w, shield_h)
    draw.polygon(pts_outer, fill=WHITE)

    # Draw blue inner shield (to create outline effect)
    inner_scale = 0.82
    pts_inner = shield_points(cx, cy, shield_w * inner_scale, shield_h * inner_scale)
    # Inner shield color matches background gradient at center
    inner_color = (
        int(BLUE_TOP[0] + (BLUE_BOTTOM[0] - BLUE_TOP[0]) * 0.45),
        int(BLUE_TOP[1] + (BLUE_BOTTOM[1] - BLUE_TOP[1]) * 0.45),
        int(BLUE_TOP[2] + (BLUE_BOTTOM[2] - BLUE_TOP[2]) * 0.45),
        255,
    )
    draw.polygon(pts_inner, fill=inner_color)

    # Draw white checkmark
    # Center the checkmark in the inner shield, slightly lower
    check_cx = cx
    check_cy = cy + size * 0.03
    draw_checkmark(draw, check_cx, check_cy, size)

    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG")
    print(f"  Saved {output_path} ({size}x{size})")


def main():
    print("Generating Shield launcher icons...")
    for mipmap, size in SIZES.items():
        path = os.path.join(BASE_DIR, mipmap, "ic_launcher.png")
        generate_icon(size, path)

    print("\nAll icons generated successfully.")


if __name__ == "__main__":
    main()
