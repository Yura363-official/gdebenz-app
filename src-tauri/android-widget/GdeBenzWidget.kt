package ru.gdebenz.client

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

class GdeBenzWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            val views = RemoteViews(context.packageName, R.layout.gdebenz_widget)
            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            val pi = PendingIntent.getActivity(context, 0, launch, flags)
            views.setOnClickPendingIntent(R.id.widget_root, pi)
            mgr.updateAppWidget(id, views)
        }
    }
}
