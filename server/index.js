const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const alarms = new Map();
const devices = new Map(); // deviceId -> { name, pushToken, lastSeen }

// Send Expo push notification
async function sendPushNotification(pushToken, title, body) {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: 'default',
        priority: 'high',
        channelId: 'alarms',
        data: { type: 'alarm' },
      }),
    });
    const data = await res.json();
    console.log('Push sent:', data);
    return data;
  } catch (e) {
    console.error('Push failed:', e.message);
  }
}

// Check alarms every 10 seconds and fire push notifications
setInterval(() => {
  const now = new Date();
  for (const [id, alarm] of alarms) {
    if (alarm.dismissed || alarm.pushSent) continue;
    const alarmTime = new Date(alarm.time);
    if (alarmTime <= now) {
      alarm.fired = true;
      // Send push to the device
      const device = devices.get(alarm.deviceId) || devices.get('default');
      if (device && device.pushToken) {
        alarm.pushSent = true;
        sendPushNotification(device.pushToken, `🔔 ${alarm.label}`, `Alarm: ${alarm.label}`);
        console.log(`Push fired for alarm: ${alarm.label}`);
      }
      // Also try all devices if deviceId is 'default'
      if (alarm.deviceId === 'default') {
        for (const [did, dev] of devices) {
          if (dev.pushToken && !alarm.pushSent) {
            alarm.pushSent = true;
            sendPushNotification(dev.pushToken, `🔔 ${alarm.label}`, `Alarm: ${alarm.label}`);
          }
        }
      }
    }
  }
}, 10000);

// Register device with push token
app.post('/api/device/register', (req, res) => {
  const { deviceId, name, pushToken } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  devices.set(deviceId, {
    name: name || 'My Phone',
    pushToken: pushToken || null,
    registeredAt: new Date(),
    lastSeen: new Date(),
  });

  console.log(`Device registered: ${deviceId} (${name || 'My Phone'}) token: ${pushToken ? 'yes' : 'no'}`);
  res.json({ ok: true, deviceId, hasPushToken: !!pushToken });
});

// Set an alarm
app.post('/api/alarm', (req, res) => {
  const { time, label, deviceId } = req.body;
  if (!time || !label) return res.status(400).json({ error: 'time and label required' });

  const id = uuidv4();
  const alarm = {
    id,
    time,
    label,
    deviceId: deviceId || 'default',
    createdAt: new Date(),
    fired: false,
    dismissed: false,
    pushSent: false,
  };

  alarms.set(id, alarm);
  console.log(`Alarm set: ${label} at ${time}`);
  res.json({ ok: true, alarm });
});

// Get pending alarms
app.get('/api/alarms', (req, res) => {
  const { deviceId } = req.query;
  const now = new Date();
  const pending = [];

  for (const [id, alarm] of alarms) {
    if (alarm.dismissed) continue;
    if (deviceId && alarm.deviceId !== deviceId && alarm.deviceId !== 'default') continue;
    const alarmTime = new Date(alarm.time);
    if (alarmTime <= now && !alarm.fired) alarm.fired = true;
    pending.push(alarm);
  }

  if (deviceId && devices.has(deviceId)) {
    devices.get(deviceId).lastSeen = new Date();
  }

  res.json({ alarms: pending });
});

// Get ringing alarms
app.get('/api/alarms/ring', (req, res) => {
  const { deviceId } = req.query;
  const now = new Date();
  const ringing = [];

  for (const [id, alarm] of alarms) {
    if (alarm.dismissed) continue;
    if (deviceId && alarm.deviceId !== deviceId && alarm.deviceId !== 'default') continue;
    const alarmTime = new Date(alarm.time);
    if (alarmTime <= now) {
      alarm.fired = true;
      ringing.push(alarm);
    }
  }

  res.json({ alarms: ringing });
});

// Dismiss alarm
app.post('/api/alarm/:id/dismiss', (req, res) => {
  const alarm = alarms.get(req.params.id);
  if (!alarm) return res.status(404).json({ error: 'alarm not found' });
  alarm.dismissed = true;
  console.log(`Alarm dismissed: ${alarm.label}`);
  res.json({ ok: true });
});

// Delete alarm
app.delete('/api/alarm/:id', (req, res) => {
  const deleted = alarms.delete(req.params.id);
  res.json({ ok: true, deleted });
});

// Health check
app.get('/api/health', (req, res) => {
  const devList = {};
  for (const [id, d] of devices) {
    devList[id] = { name: d.name, hasPushToken: !!d.pushToken, lastSeen: d.lastSeen };
  }
  res.json({ ok: true, alarms: alarms.size, devices: devices.size, deviceList: devList, uptime: process.uptime() });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔔 RingMe API running on port ${PORT}`);
});
