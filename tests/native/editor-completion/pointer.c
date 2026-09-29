#include <stdlib.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <wayland-client.h>
#include "babel-m3-07-virtual-pointer.h"
static struct zwlr_virtual_pointer_manager_v1 *manager;
static void global(void *data, struct wl_registry *registry, uint32_t name, const char *interface, uint32_t version) {
  (void)data;
  if (!strcmp(interface, "zwlr_virtual_pointer_manager_v1")) manager = wl_registry_bind(registry, name, &zwlr_virtual_pointer_manager_v1_interface, version > 2 ? 2 : version);
}
static void removed(void *data, struct wl_registry *registry, uint32_t name) { (void)data; (void)registry; (void)name; }
static const struct wl_registry_listener listener = {global, removed};
int main(int argc, char **argv) {
  if (argc != 5) return 2;
  struct wl_display *display = wl_display_connect(NULL);
  if (!display) return 3;
  struct wl_registry *registry = wl_display_get_registry(display);
  wl_registry_add_listener(registry, &listener, NULL);
  if (wl_display_roundtrip(display) < 0 || !manager) return 4;
  struct zwlr_virtual_pointer_v1 *pointer = zwlr_virtual_pointer_manager_v1_create_virtual_pointer(manager, NULL);
  wl_display_roundtrip(display);
  struct timespec setup_delay = {0, 200000000}; nanosleep(&setup_delay, NULL);
  struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
  uint32_t time = (uint32_t)(ts.tv_sec * 1000 + ts.tv_nsec / 1000000);
  zwlr_virtual_pointer_v1_motion_absolute(pointer, time, atoi(argv[1]), atoi(argv[2]), atoi(argv[3]), atoi(argv[4]));
  /* A repeated absolute coordinate can leave stale surface focus after view recreation. */
  zwlr_virtual_pointer_v1_motion(pointer, time + 1, wl_fixed_from_double(1), wl_fixed_from_double(0));
  zwlr_virtual_pointer_v1_frame(pointer);
  wl_display_roundtrip(display);
  struct timespec delay = {0, 100000000}; nanosleep(&delay, NULL);
  zwlr_virtual_pointer_v1_button(pointer, time + 100, 0x110, WL_POINTER_BUTTON_STATE_PRESSED);
  zwlr_virtual_pointer_v1_frame(pointer);
  wl_display_roundtrip(display);
  nanosleep(&delay, NULL);
  zwlr_virtual_pointer_v1_button(pointer, time + 200, 0x110, WL_POINTER_BUTTON_STATE_RELEASED);
  zwlr_virtual_pointer_v1_frame(pointer);
  wl_display_roundtrip(display);
  zwlr_virtual_pointer_v1_destroy(pointer);
  zwlr_virtual_pointer_manager_v1_destroy(manager);
  wl_registry_destroy(registry);
  wl_display_flush(display);
  wl_display_disconnect(display);
  return 0;
}
