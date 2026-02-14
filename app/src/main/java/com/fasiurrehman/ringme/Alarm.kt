package com.fasiurrehman.ringme

data class Alarm(
    val id: String,
    val time: String,
    val label: String,
    val deviceId: String,
    val status: String = "pending",
    val createdAt: String = ""
)
