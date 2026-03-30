
these are the steps to implement that revenuecat have after sign up:

npm install --save react-native-purchases react-native-purchases-ui
............................
API key: test_IPSogRWQcZFquUwHTniRlvLoFvk
.............................
configure:

import { Platform } from 'react-native';
import { useEffect } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export default function App() {
  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    // Platform-specific API keys
    const iosApiKey = 'test_IPSogRWQcZFquUwHTniRlvLoFvk';
    const androidApiKey = 'test_IPSogRWQcZFquUwHTniRlvLoFvk';

    if (Platform.OS === 'ios') {
       Purchases.configure({apiKey: iosApiKey});
    } else if (Platform.OS === 'android') {
       Purchases.configure({apiKey: androidApiKey});
    }
  }, []);
}
.....................
check entitlement:

import Purchases from 'react-native-purchases';

try {
    const customerInfo = await Purchases.getCustomerInfo();

    if(typeof customerInfo.entitlements.active['RepAI Pro'] !== "undefined") {
      // Grant user access to entitlement
    }

} catch (e) {
  // Error fetching customer info
}

paywall:

import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

// Make sure to configure a Paywall in the Dashboard first.
async function presentPaywall(): Promise<boolean> {

    // Present paywall for current offering:
    const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

    switch (paywallResult) {
        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.ERROR:
        case PAYWALL_RESULT.CANCELLED:
            return false;
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
            return true;
        default:
            return false;
    }
}
