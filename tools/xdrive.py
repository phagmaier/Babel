"""Minimal XTest input driver (ctypes, no extra packages) for agent pilots.

Drives the packaged app on an Xvfb display when WebKitWebDriver is absent.
Needs libX11/libXtst and ImageMagick `import` for screenshots. See
docs/development.md#agent-pilot-without-webdriver.

Usage: DISPLAY=:99 python3 -I tools/xdrive.py <steps.json>
Steps: ["click", x, y] | ["type", "text"] | ["key", "Return"] |
["keys", ["Control_L", "s"]] | ["wheel", -3] | ["resize", w, h] | ["sleep", s] |
["shot", "out.png"]
"""
import ctypes
import json
import subprocess
import sys
import time

x11 = ctypes.CDLL('libX11.so.6')
xtst = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XStringToKeysym.restype = ctypes.c_ulong
x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
x11.XKeysymToKeycode.restype = ctypes.c_ubyte
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XkbKeycodeToKeysym.restype = ctypes.c_ulong
x11.XkbKeycodeToKeysym.argtypes = [ctypes.c_void_p, ctypes.c_ubyte, ctypes.c_int, ctypes.c_int]
x11.XFlush.argtypes = [ctypes.c_void_p]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
xtst.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]

display = x11.XOpenDisplay(None)
if not display:
    sys.exit('cannot open display')

NAMES = {' ': 'space', '.': 'period', '-': 'minus', '(': 'parenleft', ')': 'parenright',
         ',': 'comma', "'": 'apostrophe', '!': 'exclam', '?': 'question', ':': 'colon',
         '\n': 'Return', '/': 'slash', '_': 'underscore', '0': '0'}
SHIFT = x11.XKeysymToKeycode(display, x11.XStringToKeysym(b'Shift_L'))


def keycode(name):
    sym = x11.XStringToKeysym(name.encode())
    if not sym:
        raise ValueError(name)
    code = x11.XKeysymToKeycode(display, sym)
    shifted = x11.XkbKeycodeToKeysym(display, code, 0, 0) != sym
    return code, shifted


def press(code, shifted=False):
    if shifted:
        xtst.XTestFakeKeyEvent(display, SHIFT, True, 0)
    xtst.XTestFakeKeyEvent(display, code, True, 0)
    xtst.XTestFakeKeyEvent(display, code, False, 0)
    if shifted:
        xtst.XTestFakeKeyEvent(display, SHIFT, False, 0)
    x11.XFlush(display)
    time.sleep(0.04)


def chord(names):
    codes = [keycode(n)[0] for n in names]
    for c in codes:
        xtst.XTestFakeKeyEvent(display, c, True, 0)
    for c in reversed(codes):
        xtst.XTestFakeKeyEvent(display, c, False, 0)
    x11.XFlush(display)
    time.sleep(0.1)


class Attrs(ctypes.Structure):
    _fields_ = [('x', ctypes.c_int), ('y', ctypes.c_int), ('width', ctypes.c_int),
                ('height', ctypes.c_int), ('border_width', ctypes.c_int), ('depth', ctypes.c_int),
                ('visual', ctypes.c_void_p), ('root', ctypes.c_ulong), ('class_', ctypes.c_int),
                ('bit_gravity', ctypes.c_int), ('win_gravity', ctypes.c_int),
                ('backing_store', ctypes.c_int), ('backing_planes', ctypes.c_ulong),
                ('backing_pixel', ctypes.c_ulong), ('save_under', ctypes.c_int),
                ('colormap', ctypes.c_ulong), ('map_installed', ctypes.c_int),
                ('map_state', ctypes.c_int), ('all_event_masks', ctypes.c_long),
                ('your_event_mask', ctypes.c_long), ('do_not_propagate_mask', ctypes.c_long),
                ('override_redirect', ctypes.c_int), ('screen', ctypes.c_void_p)]


def resize(width, height):
    x11.XDefaultRootWindow.restype = ctypes.c_ulong
    x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
    root = x11.XDefaultRootWindow(display)
    r, parent = ctypes.c_ulong(), ctypes.c_ulong()
    children, count = ctypes.POINTER(ctypes.c_ulong)(), ctypes.c_uint()
    x11.XQueryTree.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(ctypes.c_ulong),
                               ctypes.POINTER(ctypes.c_ulong),
                               ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong)), ctypes.POINTER(ctypes.c_uint)]
    x11.XQueryTree(display, root, ctypes.byref(r), ctypes.byref(parent), ctypes.byref(children), ctypes.byref(count))
    x11.XGetWindowAttributes.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(Attrs)]
    x11.XMoveResizeWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_uint, ctypes.c_uint]
    best, area = None, 0
    for i in range(count.value):
        a = Attrs()
        x11.XGetWindowAttributes(display, children[i], ctypes.byref(a))
        if a.map_state == 2 and a.width * a.height > area:
            best, area = children[i], a.width * a.height
    if best:
        x11.XMoveResizeWindow(display, best, 0, 0, width, height)
        x11.XFlush(display)
    time.sleep(1)


for step in json.load(open(sys.argv[1])):
    op = step[0]
    if op == 'click':
        xtst.XTestFakeMotionEvent(display, -1, step[1], step[2], 0)
        xtst.XTestFakeButtonEvent(display, 1, True, 0)
        xtst.XTestFakeButtonEvent(display, 1, False, 0)
        x11.XFlush(display)
        time.sleep(0.3)
    elif op == 'type':
        for ch in step[1]:
            press(*keycode(NAMES.get(ch, ch)))
    elif op == 'key':
        press(*keycode(step[1]))
    elif op == 'keys':
        chord(step[1])
    elif op == 'wheel':
        button = 4 if step[1] < 0 else 5
        for _ in range(abs(step[1])):
            xtst.XTestFakeButtonEvent(display, button, True, 0)
            xtst.XTestFakeButtonEvent(display, button, False, 0)
            x11.XFlush(display)
            time.sleep(0.05)
    elif op == 'resize':
        resize(step[1], step[2])
    elif op == 'sleep':
        time.sleep(step[1])
    elif op == 'shot':
        subprocess.run(['import', '-window', 'root', step[1]], check=False)
    print('done', step, flush=True)
