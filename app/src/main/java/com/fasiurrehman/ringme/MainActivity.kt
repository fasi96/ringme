package com.fasiurrehman.ringme

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class MainActivity : AppCompatActivity() {
    private lateinit var recyclerView: RecyclerView
    private lateinit var statusText: TextView
    private lateinit var emptyText: TextView
    private lateinit var adapter: AlarmAdapter
    private val handler = Handler(Looper.getMainLooper())
    private val alarms = mutableListOf<Alarm>()
    private val scheduledAlarmIds = mutableSetOf<String>()
    private var polling = false

    companion object {
        private const val TAG = "MainActivity"
        private const val POLL_INTERVAL = 15_000L
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        recyclerView = findViewById(R.id.alarmsRecycler)
        statusText = findViewById(R.id.statusText)
        emptyText = findViewById(R.id.emptyText)

        adapter = AlarmAdapter(alarms)
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        requestPermissions()
        registerDevice()
    }

    private fun requestPermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1
                )
            }
        }
    }

    private fun registerDevice() {
        ApiClient.registerDevice { success ->
            runOnUiThread {
                if (success) {
                    statusText.text = "✅ Connected to server"
                    startPolling()
                } else {
                    statusText.text = "❌ Cannot reach server"
                    // Retry in 5s
                    handler.postDelayed({ registerDevice() }, 5000)
                }
            }
        }
    }

    private fun startPolling() {
        if (polling) return
        polling = true
        pollAlarms()
    }

    private fun pollAlarms() {
        if (!polling) return

        ApiClient.getAlarms { fetchedAlarms ->
            runOnUiThread {
                if (fetchedAlarms != null) {
                    statusText.text = "✅ Connected • ${fetchedAlarms.size} alarm(s)"
                    alarms.clear()
                    alarms.addAll(fetchedAlarms.filter { it.status == "pending" })
                    adapter.notifyDataSetChanged()

                    emptyText.visibility = if (alarms.isEmpty()) View.VISIBLE else View.GONE
                    recyclerView.visibility = if (alarms.isEmpty()) View.GONE else View.VISIBLE

                    // Schedule new alarms
                    for (alarm in alarms) {
                        if (alarm.id !in scheduledAlarmIds) {
                            AlarmScheduler.scheduleAlarm(this, alarm)
                            scheduledAlarmIds.add(alarm.id)
                        }
                    }
                } else {
                    statusText.text = "⚠️ Connection issue, retrying..."
                }
            }
        }

        // Also check for ringing alarms
        ApiClient.getRingingAlarms { ringing ->
            if (ringing != null && ringing.isNotEmpty() && !AlarmService.isRinging) {
                val alarm = ringing.first()
                runOnUiThread {
                    val intent = android.content.Intent(this, AlarmService::class.java).apply {
                        putExtra("alarm_id", alarm.id)
                        putExtra("alarm_label", alarm.label)
                    }
                    startForegroundService(intent)
                }
            }
        }

        handler.postDelayed({ pollAlarms() }, POLL_INTERVAL)
    }

    override fun onResume() {
        super.onResume()
        if (!polling) startPolling()
    }

    override fun onPause() {
        super.onPause()
        // Keep polling in background briefly, but stop after a while
    }

    override fun onDestroy() {
        polling = false
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
