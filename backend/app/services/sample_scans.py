"""Sample CT slice generator for testing and interactive browser demos."""

import io
from typing import Dict, List, Tuple
import numpy as np
from PIL import Image, ImageDraw


def generate_synthetic_ct_slice(
    slice_idx: int = 1,
    variation: str = "cancer",
    width: int = 512,
    height: int = 512
) -> bytes:
    """Generate a realistic synthetic grayscale thoracic CT slice in PNG format.
    
    Includes anatomical approximations: chest wall, ribs, lungs, trachea/bronchi,
    mediastinum, and simulated tissue attenuations.
    """
    img = Image.new("L", (width, height), color=0)
    draw = ImageDraw.Draw(img)

    center_x, center_y = width // 2, height // 2
    r_x, r_y = int(width * 0.42), int(height * 0.40)

    # 1. Outer body ellipse (soft tissue ~ 40-60 HU normalized to 70-90)
    draw.ellipse(
        [center_x - r_x, center_y - r_y, center_x + r_x, center_y + r_y],
        fill=75
    )

    # 2. Chest wall / subcutaneous fat ring
    draw.ellipse(
        [center_x - r_x + 12, center_y - r_y + 12, center_x + r_x - 12, center_y + r_y - 12],
        fill=45
    )

    # 3. Ribcage bone arcs (high attenuation ~ 200-240)
    for angle_deg in range(-150, 160, 35):
        rad = np.deg2rad(angle_deg)
        x = int(center_x + (r_x - 16) * np.cos(rad))
        y = int(center_y + (r_y - 16) * np.sin(rad))
        draw.ellipse([x - 7, y - 4, x + 7, y + 4], fill=220)

    # 4. Spine / Vertebral body posterior
    spine_y = center_y + int(r_y * 0.65)
    draw.ellipse([center_x - 22, spine_y - 18, center_x + 22, spine_y + 18], fill=210)
    draw.ellipse([center_x - 6, spine_y - 6, center_x + 6, spine_y + 6], fill=30)

    # 5. Right and Left lung fields (low attenuation air ~ 15-25)
    lung_r_x = int(r_x * 0.38)
    lung_r_y = int(r_y * 0.55)

    # Right lung (anatomical right = viewer left)
    right_cx = center_x - int(r_x * 0.44)
    draw.ellipse(
        [right_cx - lung_r_x, center_y - lung_r_y, right_cx + lung_r_x, center_y + lung_r_y],
        fill=20
    )

    # Left lung (anatomical left = viewer right)
    left_cx = center_x + int(r_x * 0.44)
    draw.ellipse(
        [left_cx - lung_r_x, center_y - lung_r_y, left_cx + lung_r_x, center_y + lung_r_y],
        fill=20
    )

    # 6. Mediastinum / Heart (center anterior)
    heart_y = center_y + int(r_y * 0.1)
    draw.ellipse([center_x - 45, heart_y - 35, center_x + 40, heart_y + 45], fill=80)

    # 7. Trachea / Bronchi bifurcation depending on slice level
    draw.ellipse([center_x - 7, center_y - int(r_y * 0.25), center_x + 7, center_y - int(r_y * 0.15)], fill=15)

    # 8. Add subtle slice-level variation (nodule or ground glass patch based on variation)
    if variation == "cancer":
        # Simulate a small pulmonary nodule in upper right lung
        nodule_x = right_cx + 15 + (slice_idx * 2)
        nodule_y = center_y - 20 + (slice_idx * 3)
        draw.ellipse([nodule_x - 8, nodule_y - 8, nodule_x + 8, nodule_y + 8], fill=140)
    elif variation == "covid":
        # Simulate peripheral ground-glass opacities in bilateral lower posterior zones
        for (gx, gy) in [(right_cx - 20, center_y + 30), (left_cx + 20, center_y + 35)]:
            draw.ellipse([gx - 18, gy - 14, gx + 18, gy + 14], fill=58)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def get_sample_scan_slices(dataset: str) -> List[Tuple[str, bytes]]:
    """Generate a multi-slice series (3 slices: apical, mid, basal) for sample testing."""
    variation = "cancer" if dataset == "cancer" else "covid"
    slices = []
    levels = ["apical", "mid_thoracic", "basal"]
    for i, level in enumerate(levels, start=1):
        filename = f"sample_{dataset}_slice_{i:02d}_{level}.png"
        payload = generate_synthetic_ct_slice(slice_idx=i, variation=variation)
        slices.append((filename, payload))
    return slices
