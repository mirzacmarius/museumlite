# Environmental readings come only from registered, credentialed devices

Anonymous environmental writes are not accepted. Each reading must arrive through an authenticated HTTPS receiver using a credential bound to a registered device, its Organization and its Location, with a stable reading identity for safe retries. A vendor-specific adapter (such as Tuya) is deferred and must not be advertised as a built-in connector until it exists and is tested.
