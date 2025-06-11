package com.example.devices_test

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.hardware.usb.UsbConstants
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel.Result
import android.os.Bundle
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.IntentFilter
import android.content.Intent
import android.content.BroadcastReceiver
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.bluetooth.BluetoothSocket
import java.util.UUID
import java.io.OutputStream
import java.io.IOException
import android.app.PendingIntent
import android.graphics.BitmapFactory
import android.graphics.Bitmap
import android.graphics.Color
import java.io.ByteArrayOutputStream
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbEndpoint

class MainActivity : FlutterActivity() {
    private val CHANNEL = "usb_device_channel"
    private val TAG = "DeviceScanner"
    private var bluetoothAdapter: BluetoothAdapter? = null
    private val discoveredDevices = mutableListOf<BluetoothDevice>()
    private var channelResult: MethodChannel.Result? = null
    private val REQUEST_BLUETOOTH_SCAN_PERMISSION = 1
    private var pendingPrintRequest: Map<String, Any>? = null
    private var pendingResult: MethodChannel.Result? = null

    private val bluetoothReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            Log.d(TAG, "BluetoothReceiver: Action received: ${intent.action}")
            when(intent.action) {
                BluetoothDevice.ACTION_FOUND -> {
                    val device: BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    device?.let { 
                        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                             Log.d(TAG, "BluetoothReceiver: Found device: ${it.name ?: it.address}")
                             discoveredDevices.add(it)
                        } else {
                             Log.d(TAG, "BluetoothReceiver: Found device (name inaccessible): ${it.address}")
                             discoveredDevices.add(it)
                        }
                    }
                }
                BluetoothAdapter.ACTION_DISCOVERY_STARTED -> {
                     Log.d(TAG, "BluetoothReceiver: Discovery started.")
                }
                BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                    Log.d(TAG, "BluetoothReceiver: Discovery finished. Found ${discoveredDevices.size} devices.")
                    val deviceNames = discoveredDevices.map { it.name ?: it.address }
                    channelResult?.success(deviceNames)
                }
            }
        }
    }

    private val usbPermissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (ACTION_USB_PERMISSION == intent.action) {
                synchronized(this) {
                    val device: UsbDevice? = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        device?.let {
                            pendingPrintRequest?.let { request ->
                                pendingResult?.let { result ->
                                    try {
                                        val bytes = request["bytes"] as ByteArray
                                        val usbManager = getSystemService(Context.USB_SERVICE) as UsbManager
                                        val connection = usbManager.openDevice(it)
                                        if (connection != null) {
                                            val usbInterface = it.getInterface(0)
                                            val endpoint = usbInterface.getEndpoint(0)
                                            connection.claimInterface(usbInterface, true)
                                            connection.bulkTransfer(endpoint, bytes, bytes.size, 5000)
                                            connection.releaseInterface(usbInterface)
                                            connection.close()
                                            result.success(true)
                                        } else {
                                            result.error("CONNECTION_ERROR", "Failed to open USB connection", null)
                                        }
                                    } catch (e: Exception) {
                                        result.error("PRINT_ERROR", e.message, null)
                                    }
                                }
                            }
                        }
                    } else {
                        pendingResult?.error("PERMISSION_DENIED", "USB permission denied", null)
                    }
                    pendingPrintRequest = null
                    pendingResult = null
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            Log.d(TAG, "onCreate: Starting...")
            super.onCreate(savedInstanceState)
            Log.d(TAG, "onCreate: Super called successfully")
        } catch (e: Exception) {
            Log.e(TAG, "onCreate: Error during initialization", e)
            throw e
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        try {
            Log.d(TAG, "configureFlutterEngine: Starting...")
        super.configureFlutterEngine(flutterEngine)
            Log.d(TAG, "configureFlutterEngine: Super called successfully")
            try {
                val usbPermissionFilter = IntentFilter(ACTION_USB_PERMISSION)
                registerReceiver(usbPermissionReceiver, usbPermissionFilter)
                Log.d(TAG, "configureFlutterEngine: USB permission receiver registered")
            } catch (e: Exception) {
                Log.e(TAG, "configureFlutterEngine: Error registering USB receiver", e)
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
                try {
                    Log.d(TAG, "MethodChannel: Received method call: ${call.method}")
                    channelResult = result
                    when (call.method) {
                        "listUsbDevices" -> listUsbDevices(result)
                        "scanBluetoothDevices" -> {
                            if (bluetoothAdapter == null) {
                                result.error("BLUETOOTH_NOT_SUPPORTED", "Bluetooth is not supported on this device", null)
                            } else {
                                scanBluetoothDevices(result)
                            }
                        }
                        "printTest" -> {
                            pendingPrintRequest = call.arguments as? Map<String, Any>
                            pendingResult = result
                            printTest(call, result)
                        }
                        "printBluetoothTest" -> {
                            if (bluetoothAdapter == null) {
                                result.error("BLUETOOTH_NOT_SUPPORTED", "Bluetooth is not supported on this device", null)
                            } else {
                                printBluetoothTest(call, result)
                            }
                        }
                        else -> result.notImplemented()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "MethodChannel: Error handling method call", e)
                    result.error("UNKNOWN_ERROR", e.message, null)
                }
            }
            Log.d(TAG, "configureFlutterEngine: MethodChannel handler set")

            try {
                bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
                if (bluetoothAdapter == null) {
                    Log.e(TAG, "configureFlutterEngine: Bluetooth not supported on this device")
                } else {
                    Log.d(TAG, "configureFlutterEngine: Bluetooth adapter initialized")
                    try {
                        val bluetoothFoundFilter = IntentFilter(BluetoothDevice.ACTION_FOUND)
                        registerReceiver(bluetoothReceiver, bluetoothFoundFilter)
                        val discoveryFinishedFilter = IntentFilter(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
                        registerReceiver(bluetoothReceiver, discoveryFinishedFilter)
                        val discoveryStartedFilter = IntentFilter(BluetoothAdapter.ACTION_DISCOVERY_STARTED)
                        registerReceiver(bluetoothReceiver, discoveryStartedFilter)
                        Log.d(TAG, "configureFlutterEngine: Bluetooth receivers registered")
                    } catch (e: Exception) {
                        Log.e(TAG, "configureFlutterEngine: Error registering Bluetooth receivers", e)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "configureFlutterEngine: Error initializing Bluetooth", e)
                bluetoothAdapter = null
            }
        } catch (e: Exception) {
            Log.e(TAG, "configureFlutterEngine: Error during configuration", e)
            throw e
        }
    }

    override fun onDestroy() {
        try {
            Log.d(TAG, "onDestroy: Starting cleanup...")
            if (bluetoothAdapter != null) {
                try {
                    Log.d(TAG, "onDestroy: Unregistering Bluetooth receiver.")
                    unregisterReceiver(bluetoothReceiver)
                    bluetoothAdapter?.cancelDiscovery()
                } catch (e: Exception) {
                    Log.e(TAG, "onDestroy: Error unregistering Bluetooth receiver", e)
                }
            }
            try {
                unregisterReceiver(usbPermissionReceiver)
            } catch (e: Exception) {
                Log.e(TAG, "onDestroy: Error unregistering USB receiver", e)
            }
            Log.d(TAG, "onDestroy: Cleanup completed.")
        } catch (e: Exception) {
            Log.e(TAG, "onDestroy: Error during cleanup", e)
        } finally {
            super.onDestroy()
        }
    }

    private fun listUsbDevices(result: MethodChannel.Result) {
                val usbManager = getSystemService(Context.USB_SERVICE) as UsbManager
                val deviceList: HashMap<String, UsbDevice> = usbManager.deviceList
                val devices = deviceList.values.map { device ->
            val interfaces = (0 until device.interfaceCount).map { i ->
                val iface = device.getInterface(i)
                "Interface $i: Class=${iface.interfaceClass}, Subclass=${iface.interfaceSubclass}, Protocol=${iface.interfaceProtocol}"
            }.joinToString("; ")
            "Name: ${device.deviceName}, VID: ${device.vendorId}, PID: ${device.productId}, Manufacturer: ${device.manufacturerName ?: "N/A"}, Product: ${device.productName ?: "N/A"}, Interfaces: [$interfaces]"
        }
        Log.d(TAG, "Detected USB devices: ${devices.joinToString()}")
                result.success(devices)
    }

    private fun hasBluetoothScanPermissions(): Boolean {
        Log.d(TAG, "Checking Bluetooth scan permissions.")
        val fineLocationGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
             ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        val bluetoothScanGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
             ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        val bluetoothConnectGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
             ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        Log.d(TAG, "Permissions check: Fine Location: $fineLocationGranted, Bluetooth Scan: $bluetoothScanGranted, Bluetooth Connect: $bluetoothConnectGranted")
        return fineLocationGranted && bluetoothScanGranted && bluetoothConnectGranted
    }

    private fun requestBluetoothScanPermissions() {
        Log.d(TAG, "Requesting Bluetooth scan permissions.")
        val permissionsToRequest = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                 permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
        }
        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsToRequest.toTypedArray(), REQUEST_BLUETOOTH_SCAN_PERMISSION)
            Log.d(TAG, "Requested permissions: ${permissionsToRequest.joinToString()}")
        } else {
            Log.d(TAG, "No permissions to request, they seem to be already granted.")
        }
    }

    private fun scanBluetoothDevices(result: MethodChannel.Result) {
        Log.d(TAG, "scanBluetoothDevices called.")
        if (bluetoothAdapter == null) {
            Log.e(TAG, "scanBluetoothDevices: Bluetooth not supported.")
            result.error("UNAVAILABLE", "Bluetooth not available on this device", null)
            return
        }
        if (bluetoothAdapter?.isEnabled == false) {
            Log.e(TAG, "scanBluetoothDevices: Bluetooth is not enabled.")
             result.error("NOT_ENABLED", "Bluetooth is not enabled", null)
             return
        }
        if (!hasBluetoothScanPermissions()) {
             Log.d(TAG, "scanBluetoothDevices: Permissions not granted, requesting permissions.")
             requestBluetoothScanPermissions()
             return
        }
        Log.d(TAG, "scanBluetoothDevices: Bluetooth adapter available and permissions granted. Proceeding with discovery.")
        startBluetoothDiscovery(result)
    }

    private fun startBluetoothDiscovery(result: MethodChannel.Result) {
        Log.d(TAG, "startBluetoothDiscovery called.")
        if (bluetoothAdapter?.isDiscovering == true) {
            Log.d(TAG, "startBluetoothDiscovery: Discovery already in progress, canceling.")
            bluetoothAdapter?.cancelDiscovery()
        }
        discoveredDevices.clear()
        val started = bluetoothAdapter?.startDiscovery()
        if (started == true) {
             Log.d(TAG, "startBluetoothDiscovery: Bluetooth discovery started successfully.")
                    } else {
             Log.e(TAG, "startBluetoothDiscovery: Failed to start Bluetooth discovery.")
             result.error("DISCOVERY_FAILED", "Failed to start Bluetooth discovery", null)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        when (requestCode) {
            REQUEST_BLUETOOTH_SCAN_PERMISSION -> {
                Log.d(TAG, "onRequestPermissionsResult: Bluetooth scan permission request result.")
                if (hasBluetoothScanPermissions()) {
                    Log.d(TAG, "onRequestPermissionsResult: Permissions granted, starting discovery.")
                    channelResult?.let { result ->
                        startBluetoothDiscovery(result)
                    }
                } else {
                    Log.e(TAG, "onRequestPermissionsResult: Required Bluetooth scanning permissions denied.")
                    channelResult?.error("PERMISSION_DENIED", "Required Bluetooth scanning permissions denied", null)
                }
                return
            }
            else -> {
                super.onRequestPermissionsResult(requestCode, permissions, grantResults)
            }
        }
    }

    private fun printTest(call: MethodCall, result: MethodChannel.Result) {
        try {
            val deviceIndex = call.argument<Int>("deviceIndex") ?: 0
            val bytes = call.argument<ByteArray>("bytes")
            Log.d(TAG, "printTest: Received call. deviceIndex: $deviceIndex, bytes: ${bytes?.size} bytes")
            if (bytes == null) {
                result.error("INVALID_ARGUMENT", "Bytes parameter is required", null)
                return
            }
            val usbManager = getSystemService(Context.USB_SERVICE) as UsbManager
            val deviceList = usbManager.deviceList
            if (deviceList.isEmpty()) {
                result.error("NO_DEVICE", "No USB devices found", null)
                return
            }
            val device = deviceList.values.toList()[deviceIndex]
            if (!usbManager.hasPermission(device)) {
                val permissionIntent = PendingIntent.getBroadcast(
                    this,
                    0,
                    Intent(ACTION_USB_PERMISSION),
                    PendingIntent.FLAG_IMMUTABLE
                )
                usbManager.requestPermission(device, permissionIntent)
                result.error("PERMISSION_REQUIRED", "USB permission required", null)
                return
            }
            val usbInterface = device.getInterface(0)
            val endpoint = usbInterface.getEndpoint(0)
            val connection = usbManager.openDevice(device)
            if (connection == null) {
                result.error("CONNECTION_ERROR", "Failed to open USB connection", null)
                return
            }
            connection.claimInterface(usbInterface, true)
            connection.bulkTransfer(endpoint, bytes, bytes.size, 5000)
            connection.releaseInterface(usbInterface)
            connection.close()
            result.success(true)
        } catch (e: Exception) {
            Log.e(TAG, "Print error: ${e.message}", e)
            result.error("PRINT_ERROR", e.message, null)
        }
    }

    private fun printBluetoothTest(call: MethodCall, result: MethodChannel.Result) {
        try {
            val deviceIndex = call.argument<Int>("deviceIndex") ?: 0
            val bytes = call.argument<ByteArray>("bytes")
            Log.d(TAG, "printBluetoothTest: Received call. deviceIndex: $deviceIndex, bytes: ${bytes?.size} bytes")
            if (bytes == null) {
                result.error("INVALID_ARGUMENT", "Bytes parameter is required", null)
                return
            }
            if (deviceIndex >= discoveredDevices.size) {
                result.error("INVALID_DEVICE", "Device index out of range", null)
                return
            }
            val device = discoveredDevices[deviceIndex]
            val socket = device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"))
            try {
                socket.connect()
                val outputStream = socket.outputStream
                outputStream.write(bytes)
                outputStream.flush()
                result.success(true)
            } catch (e: Exception) {
                result.error("PRINT_ERROR", e.message, null)
            } finally {
                try {
                    socket.close()
                } catch (e: Exception) {
                    // Ignore close errors
                }
            }
        } catch (e: Exception) {
            result.error("PRINT_ERROR", e.message, null)
        }
    }

    private fun getImageBytes(context: Context, assetPath: String): ByteArray? {
        Log.d(TAG, "Attempting to get image bytes for asset: $assetPath")
        return try {
            val inputStream = context.assets.open(assetPath)
            if (inputStream == null) {
                Log.e(TAG, "Asset not found: $assetPath")
                return null
            }
            Log.d(TAG, "Asset input stream opened.")
            val originalBitmap = BitmapFactory.decodeStream(inputStream)
            Log.d(TAG, "Bitmap decoded: ${originalBitmap != null}")
            inputStream.close()

            if (originalBitmap == null) {
                Log.e(TAG, "Failed to decode bitmap from asset: $assetPath")
                return null
            }

            // Scale down the bitmap to half size
            val scaledWidth = originalBitmap.width / 2
            val scaledHeight = originalBitmap.height / 2
            val bitmap = Bitmap.createScaledBitmap(originalBitmap, scaledWidth, scaledHeight, true)
            originalBitmap.recycle() // Free up the original bitmap memory

            val width = (bitmap.width + 7) / 8 * 8
            val height = bitmap.height
            val byteWidth = width / 8
            val bitmapBytes = ByteArray(height * byteWidth)
            Log.d(TAG, "Converting bitmap to monochrome bytes. Dimensions: ${bitmap.width}x${bitmap.height}, Padded Width: $width, Byte Width: $byteWidth")
            for (y in 0 until height) {
                for (x in 0 until width) {
                    if (x < bitmap.width) {
                        val pixel = bitmap.getPixel(x, y)
                        val luminance = (0.299 * Color.red(pixel) + 0.587 * Color.green(pixel) + 0.114 * Color.blue(pixel)).toInt()
                        if (luminance < 128) {
                            val byteIndex = y * byteWidth + x / 8
                            val bitIndex = 7 - (x % 8)
                            bitmapBytes[byteIndex] = (bitmapBytes[byteIndex].toInt() or (1 shl bitIndex)).toByte()
                        }
                    }
                }
            }
            val escStarCommand = mutableListOf<Byte>()
            for (y in 0 until height) {
                escStarCommand.addAll(listOf(0x1B, 0x2A, 33,
                    byteWidth.toByte(), (byteWidth shr 8).toByte()
                ))
                val rowBytes = bitmapBytes.copyOfRange(y * byteWidth, (y + 1) * byteWidth)
                escStarCommand.addAll(rowBytes.toList())
                escStarCommand.add(0x0A)
            }
            bitmap.recycle() // Free up the scaled bitmap memory
            Log.d(TAG, "Image bytes generated successfully using ESC * command.")
            escStarCommand.toByteArray()
        } catch (e: IOException) {
            Log.e(TAG, "Error reading or processing image asset: $assetPath", e)
            null
        } catch (e: Exception) {
            Log.e(TAG, "Error processing image for printing: ${e.message}", e)
            null
        }
    }

    companion object {
        private const val ACTION_USB_PERMISSION = "com.example.devices_test.USB_PERMISSION"
    }
}
