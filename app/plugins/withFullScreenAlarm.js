const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withFullScreenAlarm(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    // Add USE_FULL_SCREEN_INTENT permission
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const hasPermission = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.USE_FULL_SCREEN_INTENT'
    );
    if (!hasPermission) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.USE_FULL_SCREEN_INTENT' },
      });
    }

    // Add USE_EXACT_ALARM for precise alarm scheduling
    const hasExactAlarm = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.USE_EXACT_ALARM'
    );
    if (!hasExactAlarm) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.USE_EXACT_ALARM' },
      });
    }

    // Add SCHEDULE_EXACT_ALARM
    const hasScheduleExact = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.SCHEDULE_EXACT_ALARM'
    );
    if (!hasScheduleExact) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.SCHEDULE_EXACT_ALARM' },
      });
    }

    // Set showWhenLocked and turnScreenOn on the main activity
    const application = manifest.application?.[0];
    if (application?.activity) {
      for (const activity of application.activity) {
        if (activity.$?.['android:name'] === '.MainActivity') {
          activity.$['android:showWhenLocked'] = 'true';
          activity.$['android:turnScreenOn'] = 'true';
        }
      }
    }

    return config;
  });
};
