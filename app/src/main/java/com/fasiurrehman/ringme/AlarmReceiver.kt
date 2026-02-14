package com.fasiurrehman.ringme

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getStringExtra("alarm_id") ?: return
        val label = intent.getStringExtra("alarm_label") ?: "Alarm!"
        Log.d("AlarmReceiver", "Alarm fired: $alarmId - $label")

        val serviceIntent = Intent(context, AlarmService::class.java).apply {
            putExtra("alarm_id", alarmId)
            putExtra("alarm_label", label)
        }
        context.startForegroundService(serviceIntent)
    }
}
