#define _POSIX_C_SOURCE 200809L
#include <fcntl.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#include <wayland-client.h>
#include "babel-m3-08-virtual-keyboard.h"
static struct zwp_virtual_keyboard_manager_v1 *manager;
static struct wl_seat *seat;
static void global(void *data, struct wl_registry *registry, uint32_t name, const char *interface, uint32_t version) {
  (void)data; (void)version;
  if (!strcmp(interface,"zwp_virtual_keyboard_manager_v1")) manager=wl_registry_bind(registry,name,&zwp_virtual_keyboard_manager_v1_interface,1);
  if (!strcmp(interface,"wl_seat")) seat=wl_registry_bind(registry,name,&wl_seat_interface,1);
}
static void removed(void *data, struct wl_registry *registry, uint32_t name) {(void)data;(void)registry;(void)name;}
static const struct wl_registry_listener listener={global,removed};
static void settle(struct wl_display *display){struct timespec pause={0,80000000};wl_display_roundtrip(display);nanosleep(&pause,NULL);}
static uint32_t stamp(void){struct timespec ts;clock_gettime(CLOCK_MONOTONIC,&ts);return (uint32_t)(ts.tv_sec*1000+ts.tv_nsec/1000000);}
int main(int argc,char **argv){
  if(argc!=2)return 2;
  int control=!strcmp(argv[1],"v")||!strcmp(argv[1],"c")||!strcmp(argv[1],"x")||!strcmp(argv[1],"l")||!strcmp(argv[1],"a");
  uint32_t code=!strcmp(argv[1],"v")?47:!strcmp(argv[1],"c")?46:!strcmp(argv[1],"x")?45:!strcmp(argv[1],"l")?38:!strcmp(argv[1],"a")?30:!strcmp(argv[1],"alt-home")?102:!strcmp(argv[1],"f6")?64:!strcmp(argv[1],"backspace")?14:!strcmp(argv[1],"escape")?1:!strcmp(argv[1],"return")?28:!strcmp(argv[1],"shift-home")?102:0;
  int unicode=!strcmp(argv[1],"unicode-start");
  if(unicode)code=22;
  if(!strcmp(argv[1],"hex-4"))code=5;
  if(!strcmp(argv[1],"hex-f"))code=33;
  if(!strcmp(argv[1],"hex-6"))code=7;
  if(!strcmp(argv[1],"hex-0"))code=11;
  if(!code)return 2;
  int shift=!strcmp(argv[1],"shift-home");
  int alt=!strcmp(argv[1],"alt-home");
  uint32_t modifier=unicode?5:control?4:shift?1:alt?8:0;
  uint32_t modifier_key=(control||unicode)?29:alt?56:42;
  int fd=open("/tmp/babel-m3-08-us.xkb",O_RDONLY);struct stat st;
  if(fd<0||fstat(fd,&st)<0||st.st_size<1)return 3;
  struct wl_display *display=wl_display_connect(NULL);if(!display)return 4;
  struct wl_registry *registry=wl_display_get_registry(display);wl_registry_add_listener(registry,&listener,NULL);
  if(wl_display_roundtrip(display)<0||!manager||!seat)return 5;
  struct zwp_virtual_keyboard_v1 *keyboard=zwp_virtual_keyboard_manager_v1_create_virtual_keyboard(manager,seat);
  zwp_virtual_keyboard_v1_keymap(keyboard,WL_KEYBOARD_KEYMAP_FORMAT_XKB_V1,fd,(uint32_t)st.st_size);settle(display);close(fd);
  if(modifier)zwp_virtual_keyboard_v1_key(keyboard,stamp(),modifier_key,WL_KEYBOARD_KEY_STATE_PRESSED);
  zwp_virtual_keyboard_v1_modifiers(keyboard,modifier,0,0,0);settle(display);
  zwp_virtual_keyboard_v1_key(keyboard,stamp(),code,WL_KEYBOARD_KEY_STATE_PRESSED);settle(display);
  zwp_virtual_keyboard_v1_key(keyboard,stamp(),code,WL_KEYBOARD_KEY_STATE_RELEASED);settle(display);
  if(modifier)zwp_virtual_keyboard_v1_key(keyboard,stamp(),modifier_key,WL_KEYBOARD_KEY_STATE_RELEASED);
  zwp_virtual_keyboard_v1_modifiers(keyboard,0,0,0,0);settle(display);
  zwp_virtual_keyboard_v1_destroy(keyboard);wl_seat_destroy(seat);zwp_virtual_keyboard_manager_v1_destroy(manager);wl_registry_destroy(registry);wl_display_flush(display);wl_display_disconnect(display);return 0;
}
