/* Standalone diagnostic host: no Babel, Tauri, manuscript or persistence code.
 * WebDriver creates one view; ordinary GTK window destroy drains the main loop
 * for two seconds before process exit. This is not Babel's event-loop lifetime.
 * --exit-order=tao instead follows pinned Tao 0.37.1/Tauri 2.12 on Linux: the
 * close request is inhibited, the window is destroyed outside GTK dispatch, two
 * non-blocking iterations run, then exit(0) with the context still referenced.
 * --view-owner=app follows Wry 0.57.0: the host creates and loads its view at
 * startup, and every create-web-view request returns that existing view.
 */
#include <gtk/gtk.h>
#include <stdlib.h>
#include <webkit2/webkit2.h>

static gboolean tao_exit_order;
static gboolean close_requested;
static gboolean window_destroyed;
static GtkWidget *owned_window;
static gboolean app_view_owner;
static GtkWidget *app_view;

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
    window_destroyed = TRUE;
    if (!tao_exit_order)
        g_timeout_add(2000, quit_loop, NULL);
}

/* Tao connects delete-event, returns TRUE and queues CloseRequested. */
static gboolean delete_requested(GtkWidget *widget, GdkEvent *event, gpointer data)
{
    (void)widget;
    (void)event;
    (void)data;
    g_printerr("MINIMAL close-requested %" G_GINT64_FORMAT "\n", g_get_real_time());
    close_requested = TRUE;
    return TRUE;
}

static void close_view(WebKitWebView *view, gpointer window)
{
    (void)view;
    gtk_widget_destroy(GTK_WIDGET(window));
}

static GtkWidget *make_window(gpointer context)
{
    GtkWidget *window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    GtkWidget *view = g_object_new(WEBKIT_TYPE_WEB_VIEW,
        "web-context", context, "is-controlled-by-automation", TRUE, NULL);
    gtk_window_set_default_size(GTK_WINDOW(window), 1100, 780);
    gtk_window_set_title(GTK_WINDOW(window), "WebKit minimal shutdown probe");
    gtk_container_add(GTK_CONTAINER(window), view);
    g_signal_connect(window, "destroy", G_CALLBACK(destroyed), NULL);
    if (tao_exit_order) {
        g_signal_connect(window, "delete-event", G_CALLBACK(delete_requested), NULL);
        owned_window = window;
    }
    g_signal_connect(view, "close", G_CALLBACK(close_view), window);
    gtk_widget_show_all(window);
    return view;
}

static WebKitWebView *create_view(WebKitAutomationSession *session, gpointer context)
{
    (void)session;
    if (app_view_owner) {
        /* Wry: "we just pass the first created webview" (transfer none). */
        g_printerr("MINIMAL create-web-view existing %" G_GINT64_FORMAT "\n", g_get_real_time());
        return WEBKIT_WEB_VIEW(app_view);
    }
    return WEBKIT_WEB_VIEW(make_window(context));
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
    for (int i = 1; i < argc; i++)
    {
        tao_exit_order |= g_strcmp0(argv[i], "--exit-order=tao") == 0;
        app_view_owner |= g_strcmp0(argv[i], "--view-owner=app") == 0;
    }
    WebKitWebContext *context = webkit_web_context_new_ephemeral();
    webkit_web_context_set_automation_allowed(context, TRUE);
    if (app_view_owner) {
        /* Wry builds and loads the view before registering automation. */
        g_printerr("MINIMAL view-owner app\n");
        app_view = make_window(context);
        webkit_web_view_load_uri(WEBKIT_WEB_VIEW(app_view), "about:blank");
    }
    g_signal_connect(context, "automation-started", G_CALLBACK(automation_started), NULL);
    if (tao_exit_order) {
        g_printerr("MINIMAL exit-order tao\n");
        while (!close_requested && !window_destroyed)
            gtk_main_iteration_do(TRUE);
        /* Tauri drops the Tao window (gtk destroy) while handling the queued
         * request; Destroyed for the last window then sets ControlFlow::Exit.
         * Each handled event is followed by gtk_main_iteration_do(FALSE). */
        if (!window_destroyed)
            gtk_widget_destroy(owned_window);
        gtk_main_iteration_do(FALSE);
        gtk_main_iteration_do(FALSE);
        /* Rust process::exit is libc exit; WebContextStore is never released. */
        g_printerr("MINIMAL tao-process-exit %" G_GINT64_FORMAT "\n", g_get_real_time());
        exit(0);
    }
    gtk_main();
    g_object_unref(context);
    return 0;
}
