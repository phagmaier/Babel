/* Isolated GTK/WebKit 4.1 host for the production editor adapter, never shipped. */
#include <webkit2/webkit2.h>
#include <enchant.h>
#include <json-glib/json-glib.h>
#include <stdio.h>
#include <string.h>

static WebKitWebView *view;
static WebKitWebContext *context;

static void emit(JsonBuilder *builder) {
    JsonNode *root = json_builder_get_root(builder);
    char *text = json_to_string(root, FALSE);
    puts(text);
    fflush(stdout);
    g_free(text);
    json_node_free(root);
    g_object_unref(builder);
}

static JsonBuilder *start(const char *kind) {
    JsonBuilder *builder = json_builder_new();
    json_builder_begin_object(builder);
    json_builder_set_member_name(builder, "kind");
    json_builder_add_string_value(builder, kind);
    return builder;
}

static void message(const char *kind, const char *text) {
    JsonBuilder *builder = start(kind);
    json_builder_set_member_name(builder, "value");
    json_builder_add_string_value(builder, text);
    json_builder_end_object(builder);
    emit(builder);
}

static void state(void) {
    JsonBuilder *builder = start("state");
    json_builder_set_member_name(builder, "enabled");
    json_builder_add_boolean_value(builder, webkit_web_context_get_spell_checking_enabled(context));
    json_builder_set_member_name(builder, "languages");
    json_builder_begin_array(builder);
    const char *const *languages = webkit_web_context_get_spell_checking_languages(context);
    if (languages) for (unsigned at = 0; languages[at]; at++) json_builder_add_string_value(builder, languages[at]);
    json_builder_end_array(builder);
    json_builder_end_object(builder);
    emit(builder);
}

static void dictionary(const char *tag, const char *provider, const char *description,
                       const char *file, void *data) {
    (void)description;
    JsonBuilder *builder = data;
    json_builder_begin_object(builder);
    json_builder_set_member_name(builder, "language"); json_builder_add_string_value(builder, tag);
    json_builder_set_member_name(builder, "provider"); json_builder_add_string_value(builder, provider);
    json_builder_set_member_name(builder, "module"); json_builder_add_string_value(builder, file);
    json_builder_end_object(builder);
}

static void inventory(void) {
    EnchantBroker *broker = enchant_broker_init();
    JsonBuilder *builder = start("inventory");
    json_builder_set_member_name(builder, "dictionaries");
    json_builder_begin_array(builder);
    enchant_broker_list_dicts(broker, dictionary, builder);
    json_builder_end_array(builder);
    json_builder_end_object(builder);
    emit(builder);
    enchant_broker_free(broker);
}

static void activated(GSimpleAction *action, GVariant *parameter, gpointer data) {
    (void)parameter; (void)data;
    message("action", g_action_get_name(G_ACTION(action)));
}

static void menu_items(JsonBuilder *builder, WebKitContextMenu *menu) {
    json_builder_begin_array(builder);
    for (GList *at = webkit_context_menu_get_items(menu); at; at = at->next) {
        WebKitContextMenuItem *item = at->data;
        json_builder_begin_object(builder);
        json_builder_set_member_name(builder, "stock");
        json_builder_add_int_value(builder, webkit_context_menu_item_get_stock_action(item));
        json_builder_set_member_name(builder, "title");
        const char *title = webkit_context_menu_item_get_title(item);
        json_builder_add_string_value(builder, title ? title : "");
        GAction *action = webkit_context_menu_item_get_gaction(item);
        if (G_IS_SIMPLE_ACTION(action)) g_signal_connect(action, "activate", G_CALLBACK(activated), NULL);
        json_builder_set_member_name(builder, "enabled");
        json_builder_add_boolean_value(builder, action && g_action_get_enabled(action));
        WebKitContextMenu *submenu = webkit_context_menu_item_get_submenu(item);
        if (submenu) {
            json_builder_set_member_name(builder, "children");
            menu_items(builder, submenu);
        }
        json_builder_end_object(builder);
    }
    json_builder_end_array(builder);
}

static gboolean menu(WebKitWebView *webview, WebKitContextMenu *menu,
                     GdkEvent *event, WebKitHitTestResult *hit, gpointer data) {
    (void)webview; (void)event; (void)hit; (void)data;
    JsonBuilder *builder = start("menu");
    json_builder_set_member_name(builder, "items");
    menu_items(builder, menu);
    json_builder_end_object(builder);
    emit(builder);
    return FALSE; /* The actual WebKit GTK menu is displayed without replacement. */
}

static void resource(WebKitWebView *webview, WebKitWebResource *resource,
                     WebKitURIRequest *request, gpointer data) {
    (void)webview; (void)resource; (void)data;
    message("request", webkit_uri_request_get_uri(request));
}

static void evaluated(GObject *object, GAsyncResult *result, gpointer data) {
    (void)data;
    GError *error = NULL;
    JSCValue *value = webkit_web_view_evaluate_javascript_finish(WEBKIT_WEB_VIEW(object), result, &error);
    if (error) {
        message("error", error->message);
        g_error_free(error);
        return;
    }
    char *json = jsc_value_to_json(value, 0);
    printf("{\"kind\":\"js\",\"value\":%s}\n", json ? json : "null");
    fflush(stdout);
    g_free(json);
    g_object_unref(value);
}

static void widgets(GtkWidget *widget, gpointer data) {
    JsonBuilder *builder = data;
    if (GTK_IS_MENU_ITEM(widget) && gtk_widget_get_mapped(widget)) {
        GtkAllocation bounds;
        gtk_widget_get_allocation(widget, &bounds);
        int x = 0, y = 0;
        gdk_window_get_origin(gtk_widget_get_window(widget), &x, &y);
        if (!gtk_widget_get_has_window(widget)) { x += bounds.x; y += bounds.y; }
        json_builder_begin_object(builder);
        json_builder_set_member_name(builder, "title");
        const char *label = gtk_menu_item_get_label(GTK_MENU_ITEM(widget));
        json_builder_add_string_value(builder, label ? label : "");
        json_builder_set_member_name(builder, "x"); json_builder_add_int_value(builder, x + bounds.width / 2);
        json_builder_set_member_name(builder, "y"); json_builder_add_int_value(builder, y + bounds.height / 2);
        json_builder_end_object(builder);
    }
    if (GTK_IS_CONTAINER(widget)) gtk_container_foreach(GTK_CONTAINER(widget), widgets, builder);
}

static void widget_positions(void) {
    JsonBuilder *builder = start("widgets");
    json_builder_set_member_name(builder, "items"); json_builder_begin_array(builder);
    GList *windows = gtk_window_list_toplevels();
    for (GList *at = windows; at; at = at->next) widgets(at->data, builder);
    g_list_free(windows);
    json_builder_end_array(builder);
    json_builder_end_object(builder);
    emit(builder);
}

static gboolean input(GIOChannel *channel, GIOCondition condition, gpointer data) {
    (void)data;
    if (condition & G_IO_HUP) { gtk_main_quit(); return FALSE; }
    char *line = NULL;
    if (g_io_channel_read_line(channel, &line, NULL, NULL, NULL) != G_IO_STATUS_NORMAL) return TRUE;
    g_strchomp(line);
    if (g_str_has_prefix(line, "JS "))
        webkit_web_view_evaluate_javascript(view, line + 3, -1, NULL, NULL, NULL, evaluated, NULL);
    else if (g_str_has_prefix(line, "LANG ")) {
        const char *languages[] = { line + 5, NULL };
        webkit_web_context_set_spell_checking_languages(context, languages);
        state();
    } else if (!strcmp(line, "OFF") || !strcmp(line, "ON")) {
        webkit_web_context_set_spell_checking_enabled(context, !strcmp(line, "ON"));
        state();
    } else if (!strcmp(line, "SCOPE")) {
        WebKitWebContext *other = webkit_web_context_new_ephemeral();
        const char *languages[] = { "fr_FR", NULL };
        webkit_web_context_set_spell_checking_languages(other, languages);
        state();
        g_object_unref(other);
    } else if (!strcmp(line, "WIDGETS")) widget_positions();
    else if (!strcmp(line, "QUIT")) gtk_main_quit();
    else message("error", "Unknown proof command");
    g_free(line);
    return TRUE;
}

static void loaded(WebKitWebView *webview, WebKitLoadEvent event, gpointer data) {
    (void)webview; (void)data;
    if (event == WEBKIT_LOAD_FINISHED) message("loaded", "Synthetic file assets loaded");
}

static void asset(WebKitURISchemeRequest *request, gpointer data) {
    (void)data;
    const char *path = webkit_uri_scheme_request_get_path(request);
    gboolean valid = !strcmp(path, "/index.html") ||
        (g_str_has_prefix(path, "/assets/") && !strchr(path + 8, '/') && !strstr(path, ".."));
    char *content = NULL;
    gsize length = 0;
    GError *error = NULL;
    char *file = g_strconcat("/tmp/babel-m4-11-assets", path, NULL);
    if (!valid) error = g_error_new_literal(G_IO_ERROR, G_IO_ERROR_PERMISSION_DENIED, "Not a probe asset");
    else g_file_get_contents(file, &content, &length, &error);
    g_free(file);
    if (error) {
        webkit_uri_scheme_request_finish_error(request, error);
        g_error_free(error);
        return;
    }
    const char *type = g_str_has_suffix(path, ".js") ? "text/javascript" :
        g_str_has_suffix(path, ".css") ? "text/css" : "text/html";
    GInputStream *stream = g_memory_input_stream_new_from_data(content, length, g_free);
    webkit_uri_scheme_request_finish(request, stream, length, type);
    g_object_unref(stream);
}

int main(int argc, char **argv) {
    const char *dictionary_dir = g_getenv("ENCHANT_CONFIG_DIR");
    const char *config_dir = g_getenv("XDG_CONFIG_HOME");
    if (argc != 2 || !dictionary_dir || !config_dir ||
        !g_str_has_prefix(dictionary_dir, "/tmp/babel-m4-11-") ||
        !g_str_has_suffix(dictionary_dir, "/dictionary") ||
        !g_str_has_prefix(config_dir, "/tmp/babel-m4-11-") ||
        !g_str_has_suffix(config_dir, "/config")) return 2;
    gtk_init(&argc, &argv);
    inventory();
    context = webkit_web_context_new_ephemeral();
    webkit_web_context_register_uri_scheme(context, "babel-spell", asset, NULL, NULL);
    WebKitSecurityManager *security = webkit_web_context_get_security_manager(context);
    webkit_security_manager_register_uri_scheme_as_secure(security, "babel-spell");
    webkit_security_manager_register_uri_scheme_as_cors_enabled(security, "babel-spell");
    state(); /* Record defaults before changing the proof context. */
    const char *languages[] = { "en_US", NULL };
    webkit_web_context_set_spell_checking_languages(context, languages);
    webkit_web_context_set_spell_checking_enabled(context, TRUE);
    state();
    view = WEBKIT_WEB_VIEW(webkit_web_view_new_with_context(context));
    g_object_set(webkit_web_view_get_settings(view), "enable-write-console-messages-to-stdout", TRUE, NULL);
    g_signal_connect(view, "context-menu", G_CALLBACK(menu), NULL);
    g_signal_connect(view, "resource-load-started", G_CALLBACK(resource), NULL);
    g_signal_connect(view, "load-changed", G_CALLBACK(loaded), NULL);
    GtkWidget *window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_window_set_title(GTK_WINDOW(window), "babel M4-11 synthetic spellcheck");
    gtk_window_set_default_size(GTK_WINDOW(window), 900, 700);
    gtk_container_add(GTK_CONTAINER(window), GTK_WIDGET(view));
    g_signal_connect(window, "destroy", G_CALLBACK(gtk_main_quit), NULL);
    gtk_widget_show_all(window);
    GIOChannel *channel = g_io_channel_unix_new(0);
    g_io_add_watch(channel, G_IO_IN | G_IO_HUP, input, NULL);
    webkit_web_view_load_uri(view, argv[1]);
    gtk_main();
    g_io_channel_unref(channel);
    g_object_unref(context);
    return 0;
}
