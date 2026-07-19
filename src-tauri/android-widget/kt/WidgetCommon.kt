package ru.gdebenz.client

import android.app.PendingIntent
import android.content.Context
import android.widget.RemoteViews

object WidgetCommon {
    fun build(context: Context, layout: Int, rootId: Int): RemoteViews {
        val views = RemoteViews(context.packageName, layout)
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pi = PendingIntent.getActivity(context, 0, launch, flags)
        views.setOnClickPendingIntent(rootId, pi)
        return views
    }
}
