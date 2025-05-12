package com.example.login_ui // Or your actual package name

import io.flutter.embedding.android.FlutterFragmentActivity // Import this
// You might also need these if you had a configureFlutterEngine method:
// import io.flutter.embedding.engine.FlutterEngine
// import io.flutter.plugins.GeneratedPluginRegistrant

class MainActivity: FlutterFragmentActivity() { // Change this line to extend FlutterFragmentActivity
    // If you had custom code in configureFlutterEngine or onCreate,
    // make sure to bring it over or adapt it as needed.
    // For a simple case, this is often enough.
    // Example of keeping configureFlutterEngine if it was there:
    // override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
    //     GeneratedPluginRegistrant.registerWith(flutterEngine);
    // }
}