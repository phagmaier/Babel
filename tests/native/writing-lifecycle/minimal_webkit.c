/* Standalone diagnostic host: no Babel, Tauri, manuscript or persistence code.
 * WebDriver creates one view; ordinary GTK window destroy drains the main loop
 * for two seconds before process exit. This is not Babel's event-loop lifetime.
 */
#include <gtk/gtk.h>
#include <webkit2/webkit2.h>

static gboolean quit_loop(gpointer data)
{
    (void)data;
    g_printerr("MINIMAL main-loop-exit %" G_GINT64_FORMAT "\n", g_get_real_time());
    gtk_main_quit();
    return G_SOURCE_REMOVE;
}

static void destroyed(GtkWidget *widget, gpointer data)
{
    (void)widget;
    (void)data;
    g_printerr("MINIMAL window-destroy %" G_GINT64_FORMAT "\n", g_get_real_time());
    g_timeout_add(2000, quit_loop, NULL);
}

static void close_view(WebKitWebView *view, gpointer window)
{
    (void)view;
    gtk_widget_destroy(GTK_WIDGET(window));
}

static WebKitWebView *create_view(WebKitAutomationSession *session, gpointer context)
{
    (void)session;
    GtkWidget *window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    GtkWidget *view = g_object_new(WEBKIT_TYPE_WEB_VIEW,
        "web-context", context, "is-controlled-by-automation", TRUE, NULL);
    gtk_window_set_default_size(GTK_WINDOW(window), 1100, 780);
    gtk_window_set_title(GTK_WINDOW(window), "WebKit minimal shutdown probe");
    gtk_container_add(GTK_CONTAINER(window), view);
    g_signal_connect(window, "destroy", G_CALLBACK(destroyed), NULL);
    g_signal_connect(view, "close", G_CALLBACK(close_view), window);
    gtk_widget_show_all(window);
    return WEBKIT_WEB_VIEW(view);
}

static void automation_started(WebKitWebContext *context,
                               WebKitAutomationSession *session, gpointer data)
{
    (void)data;
    WebKitApplicationInfo *info = webkit_application_info_new();
    webkit_application_info_set_name(info, "WebKitMiniHost");
    webkit_application_info_set_version(info, 1, 0, 0);
    webkit_automation_session_set_application_info(session, info);
    webkit_application_info_unref(info);
    g_signal_connect(session, "create-web-view", G_CALLBACK(create_view), context);
}

int main(int argc, char **argv)
{
    gtk_init(&argc, &argv);
    WebKitWebContext *context = webkit_web_context_new_ephemeral();
    webkit_web_context_set_automation_allowed(context, TRUE);
    g_signal_connect(context, "automation-started", G_CALLBACK(automation_started), NULL);
    gtk_main();
    g_object_unref(context);
    return 0;
}
