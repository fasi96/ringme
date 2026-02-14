package com.fasiurrehman.ringme

import android.app.KeyguardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.*

class AlarmRingActivity : AppCompatActivity() {
    private var alarmId: String = ""
    private var alarmLabel: String = "Alarm!"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show over lock screen
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        km.requestDismissKeyguard(this, null)

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        )

        setContentView(R.layout.activity_alarm_ring)

        alarmId = intent.getStringExtra("alarm_id") ?: ""
        alarmLabel = intent.getStringExtra("alarm_label") ?: "Alarm!"

        findViewById<TextView>(R.id.alarmLabel).text = alarmLabel
        findViewById<TextView>(R.id.alarmTime).text =
            SimpleDateFormat("hh:mm a", Locale.US).format(Date())

        findViewById<Button>(R.id.dismissButton).setOnClickListener {
            dismissAlarm()
        }

        findViewById<Button>(R.id.snoozeButton).setOnClickListener {
            snoozeAlarm()
        }
    }

    private fun dismissAlarm() {
        ApiClient.dismissAlarm(alarmId) { _ -> }
        stopAlarmService()
        finish()
    }

    private fun snoozeAlarm() {
        AlarmScheduler.scheduleSnooze(this, alarmId, alarmLabel)
        stopAlarmService()
        finish()
    }

    private fun stopAlarmService() {
        val intent = Intent(this, AlarmService::class.java)
        // We need to call stopAlarm on the service
        val service = AlarmService()
        // Actually just stop the service
        stopService(intent)
    }

    override fun onBackPressed() {
        // Prevent dismissing with back button
    }
}
