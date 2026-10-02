"""Babel PDF helper stub: any image use is refused."""


def __getattr__(name):
    raise ImportError(f'image support is not bundled in the Babel PDF helper (PIL.Image.{name})')
