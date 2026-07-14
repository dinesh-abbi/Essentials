const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidQueries = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!Array.isArray(manifest.queries)) {
      manifest.queries = [];
    }

    // Check if the upi scheme intent already exists
    const hasUpiScheme = manifest.queries.some(q => 
      Array.isArray(q.intent) && q.intent.some(i => 
        Array.isArray(i.data) && i.data.some(d => d.$ && d.$['android:scheme'] === 'upi')
      )
    );

    if (!hasUpiScheme) {
      manifest.queries.push({
        intent: [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
            data: [{ $: { 'android:scheme': 'upi' } }]
          }
        ]
      });
    }

    // Packages to add
    const targetPackages = [
      'com.google.android.apps.nbu.paisa.user', // Google Pay
      'com.phonepe.app',                         // PhonePe
      'net.one97.paytm',                         // Paytm
      'in.org.npci.upiapp'                        // BHIM
    ];

    // Find any existing package queries to avoid duplicates
    const existingPackages = new Set();
    manifest.queries.forEach(q => {
      if (Array.isArray(q.package)) {
        q.package.forEach(p => {
          if (p.$ && p.$['android:name']) {
            existingPackages.add(p.$['android:name']);
          }
        });
      }
    });

    const packagesToAdd = targetPackages.filter(pkg => !existingPackages.has(pkg));

    if (packagesToAdd.length > 0) {
      manifest.queries.push({
        package: packagesToAdd.map(pkg => ({ $: { 'android:name': pkg } }))
      });
    }

    return config;
  });
};

module.exports = withAndroidQueries;
