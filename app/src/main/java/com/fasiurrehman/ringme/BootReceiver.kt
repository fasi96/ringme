package com.fasiurrehman.ringme

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d("BootReceiver", "Boot completed, re-fetching alarms")
            ApiClient.getAlarms { alarms ->
                alarms?.filter { it.status == "pending" }?.forEach { alarm ->
                    AlarmScheduler.scheduleAlarm(context, alarm)
                }
            }
        }
    }
}
