package com.fasiurrehman.ringme

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat

class AlarmService : Service() {
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val TAG = "AlarmService"
        var isRinging = false
        var currentAlarmId: String? = null
        var currentLabel: String? = null
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val alarmId = intent?.getStringExtra("alarm_id") ?: return START_NOT_STICKY
        val label = intent.getStringExtra("alarm_label") ?: "Alarm!"
        currentAlarmId = alarmId
        currentLabel = label
        isRinging = true

        Log.d(TAG, "Starting alarm service for: $alarmId")

        // Acquire wake lock
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "ringme:alarm"
        )
        wakeLock?.acquire(10 * 60 * 1000L)

        // Start foreground notification
        val fullScreenIntent = Intent(this, AlarmRingActivity::class.java).apply {
            putExtra("alarm_id", alarmId)
            putExtra("alarm_label", label)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val fullScreenPending = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, RingMeApp.CHANNEL_ID)
            .setContentTitle("⏰ $label")
            .setContentText("Alarm is ringing!")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPending, true)
            .setOngoing(true)
            .build()

        startForeground(1, notification)

        // Launch ringing activity
        startActivity(fullScreenIntent)

        // Play alarm sound
        startAlarmSound()

        // Start vibration
        startVibration()

        return START_NOT_STICKY
    }

    private fun startAlarmSound() {
        try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.setStreamVolume(
                AudioManager.STREAM_ALARM,
                audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM),
                0
            )

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@AlarmService, Uri.parse("android.resource://${packageName}/${R.raw.alarm}"))
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing alarm", e)
        }
    }

    private fun startVibration() {
        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        val pattern = longArrayOf(0, 1000, 500, 1000, 500, 1000)
        vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
    }

    fun stopAlarm() {
        isRinging = false
        currentAlarmId = null
        currentLabel = null
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        vibrator?.cancel()
        vibrator = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopAlarm()
        super.onDestroy()
    }
}
