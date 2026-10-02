"""Babel PDF helper stub for Pillow.

ReportLab imports `PIL.Image` at module load but uses it only for images. The
helper renders screenplay text only (M5-01 showed byte-identical corpus output
with and without real Pillow), so no imaging library is bundled.
"""
