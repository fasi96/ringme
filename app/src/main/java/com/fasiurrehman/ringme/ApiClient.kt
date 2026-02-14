package com.fasiurrehman.ringme

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

object ApiClient {
    private const val BASE_URL = "http://65.109.8.35:3333"
    const val DEVICE_ID = "fasi-phone"
    private val client = OkHttpClient()
    private val gson = Gson()
    private val JSON = "application/json".toMediaType()

    fun registerDevice(callback: (Boolean) -> Unit) {
        val body = """{"deviceId":"$DEVICE_ID","name":"Fasi Phone"}""".toRequestBody(JSON)
        val request = Request.Builder().url("$BASE_URL/api/device/register").post(body).build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { callback(false) }
            override fun onResponse(call: Call, response: Response) {
                response.close()
                callback(response.isSuccessful)
            }
        })
    }

    fun getAlarms(callback: (List<Alarm>?) -> Unit) {
        val request = Request.Builder().url("$BASE_URL/api/alarms?deviceId=$DEVICE_ID").build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { callback(null) }
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!it.isSuccessful) { callback(null); return }
                    val json = it.body?.string() ?: "[]"
                    try {
                        val type = object : TypeToken<List<Alarm>>() {}.type
                        callback(gson.fromJson(json, type))
                    } catch (e: Exception) { callback(null) }
                }
            }
        })
    }

    fun getRingingAlarms(callback: (List<Alarm>?) -> Unit) {
        val request = Request.Builder().url("$BASE_URL/api/alarms/ring?deviceId=$DEVICE_ID").build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { callback(null) }
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!it.isSuccessful) { callback(null); return }
                    val json = it.body?.string() ?: "[]"
                    try {
                        val type = object : TypeToken<List<Alarm>>() {}.type
                        callback(gson.fromJson(json, type))
                    } catch (e: Exception) { callback(null) }
                }
            }
        })
    }

    fun dismissAlarm(id: String, callback: (Boolean) -> Unit) {
        val body = "".toRequestBody(JSON)
        val request = Request.Builder().url("$BASE_URL/api/alarm/$id/dismiss").post(body).build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { callback(false) }
            override fun onResponse(call: Call, response: Response) {
                response.close()
                callback(response.isSuccessful)
            }
        })
    }
}
