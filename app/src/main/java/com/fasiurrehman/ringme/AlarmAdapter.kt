package com.fasiurrehman.ringme

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.*

class AlarmAdapter(private val alarms: List<Alarm>) :
    RecyclerView.Adapter<AlarmAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val timeText: TextView = view.findViewById(R.id.alarmTime)
        val labelText: TextView = view.findViewById(R.id.alarmLabel)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_alarm, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val alarm = alarms[position]
        holder.labelText.text = alarm.label

        // Parse and format time
        try {
            val formats = arrayOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'"
            )
            var date: Date? = null
            for (format in formats) {
                try {
                    val sdf = SimpleDateFormat(format, Locale.US)
                    sdf.timeZone = TimeZone.getTimeZone("UTC")
                    date = sdf.parse(alarm.time)
                    if (date != null) break
                } catch (_: Exception) {}
            }
            if (date != null) {
                val displayFormat = SimpleDateFormat("hh:mm a, MMM dd", Locale.US)
                holder.timeText.text = displayFormat.format(date)
            } else {
                holder.timeText.text = alarm.time
            }
        } catch (_: Exception) {
            holder.timeText.text = alarm.time
        }
    }

    override fun getItemCount() = alarms.size
}
