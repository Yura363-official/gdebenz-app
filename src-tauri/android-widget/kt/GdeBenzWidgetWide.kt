package ru.gdebenz.client

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

class GdeBenzWidgetWide : AppWidgetProvider() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            mgr.updateAppWidget(id, WidgetCommon.build(context, R.layout.gdebenz_widget_wide, R.id.widget_root))
        }
    }
}
