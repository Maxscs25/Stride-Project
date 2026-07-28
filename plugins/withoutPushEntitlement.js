const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Remove the `aps-environment` entitlement that expo-notifications' config
 * plugin adds unconditionally (it's auto-applied from the dependency, so it
 * can't be avoided by leaving it out of app.json's `plugins`).
 *
 * Stride only schedules LOCAL notifications — it never registers for push. The
 * entitlement would require the Push Notifications capability on the
 * provisioning profile (breaking signing), and would claim a capability the app
 * doesn't use. Local scheduling needs no entitlement at all.
 *
 * Must stay LAST in `plugins` so this mod runs after expo-notifications'.
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
