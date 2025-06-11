import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart'; // Import for debugPrint
import 'package:esc_pos_utils/esc_pos_utils.dart';
import 'package:image/image.dart' as img;
import 'dart:typed_data';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'USB Device Lister',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  static const platform = MethodChannel('usb_device_channel');
  List<String> _devices = [];
  String _statusMessage = "Press 'Get Devices' to scan.";
  bool _isLoading = false;
  bool _isPrinting = false;
  bool _isScanningBluetooth = false;
  bool _isBluetoothMode = false;

  @override
  void initState() {
    super.initState();
    debugPrint("initState: Initializing...");
  }

  @override
  void dispose() {
    debugPrint("dispose: Cleaning up...");
    super.dispose();
  }

  Future<void> _getUsbDevices() async {
    setState(() {
      _isLoading = true;
      _devices = [];
      _statusMessage = "Scanning for USB devices...";
      _isBluetoothMode = false;
    });
    try {
      final List<dynamic> devices = await platform.invokeMethod('listUsbDevices');
      setState(() {
        _devices = devices.cast<String>();
        _statusMessage = devices.isNotEmpty
            ? "${devices.length} device(s) found."
            : "No USB devices found.";
        debugPrint("USB Scan Finished: Devices count: ${devices.length}, Status: $_statusMessage");
      });
    } catch (e) {
      setState(() {
        _statusMessage = "Error fetching devices: $e";
        debugPrint("USB Scan Error: $_statusMessage");
      });
    } finally {
      setState(() {
        _isLoading = false;
        debugPrint("USB Scan Finally: isLoading: $_isLoading");
      });
    }
  }

  Future<void> _scanBluetoothDevices() async {
    setState(() {
      _isScanningBluetooth = true;
      _devices = [];
      _statusMessage = "Scanning for Bluetooth devices...";
      _isBluetoothMode = true;
      debugPrint("Starting Bluetooth Scan: Scanning: $_isScanningBluetooth, Mode: $_isBluetoothMode");
    });
    try {
      final List<dynamic> devices = await platform.invokeMethod('scanBluetoothDevices');
      setState(() {
        _devices = devices.cast<String>();
        _statusMessage = devices.isNotEmpty
            ? "${devices.length} Bluetooth device(s) found."
            : "No Bluetooth devices found.";
        debugPrint("Bluetooth Scan Finished: Devices count: ${devices.length}, Status: $_statusMessage");
      });
    } catch (e) {
      setState(() {
        if (e.toString().contains("BLUETOOTH_NOT_SUPPORTED")) {
          _statusMessage = "Bluetooth is not supported on this device.";
        } else {
          _statusMessage = "Error scanning Bluetooth devices: $e";
        }
        debugPrint("Bluetooth Scan Error: $_statusMessage");
      });
    } finally {
      setState(() {
        _isScanningBluetooth = false;
        debugPrint("Bluetooth Scan Finally: isScanningBluetooth: $_isScanningBluetooth");
      });
    }
  }

  Future<void> _printTest({required PaperSize paperSize}) async {
    if (_devices.isEmpty) {
      debugPrint("Print Test: No devices available to print.");
      setState(() {
        _statusMessage = "No devices available to print.";
      });
      return;
    }
    setState(() {
      _isPrinting = true;
      _statusMessage = "Printing test...";
      debugPrint("Starting Print Test: isPrinting: $_isPrinting, Status: $_statusMessage");
    });
    try {
      final bytes = await _generateReceiptBytes(paperSize: paperSize);
      debugPrint('Generated receipt bytes size: ${bytes.length}');
      debugPrint('Generated receipt bytes (first 20): ${bytes.take(20).toList()}');
      final result = await platform.invokeMethod(
        _isBluetoothMode ? 'printBluetoothTest' : 'printTest',
        {
          'deviceIndex': _isBluetoothMode ? _devices.indexOf(_devices[_devices.indexWhere((d) => d.contains("MPT-II"))]) : 0,
          'bytes': bytes,
        },
      );
      setState(() {
        _statusMessage = result == true ? "Print successful!" : "Print failed.";
        debugPrint("Print Test Finished: Result: $result, Status: $_statusMessage");
      });
    } catch (e) {
      setState(() {
        if (e.toString().contains("BLUETOOTH_NOT_SUPPORTED")) {
          _statusMessage = "Bluetooth is not supported on this device.";
        } else {
          _statusMessage = "Print error: $e";
        }
        debugPrint("Print Test Error: $_statusMessage");
      });
    } finally {
      setState(() {
        _isPrinting = false;
        debugPrint("Print Test Finally: isPrinting: $_isPrinting");
      });
    }
  }

  Future<Uint8List> _generateReceiptBytes({required PaperSize paperSize}) async {
    final profile = await CapabilityProfile.load();
    final generator = Generator(paperSize, profile);
    List<int> bytes = [];

    // Load and process logo
    try {
      final ByteData logoData = await rootBundle.load('assets/logo.png');
      final Uint8List logoBytes = logoData.buffer.asUint8List();
      final img.Image? logo = img.decodeImage(logoBytes);
      if (logo != null) {
        // Resize logo to specified dimensions
        final int size = paperSize == PaperSize.mm80 ? 240 : 174; // 30mm for 80mm paper, 21.75mm for 58mm paper
        final img.Image resized = img.copyResize(logo, width: size, height: size); // Resize to square
        final img.Image grayscale = img.grayscale(resized);
        bytes += generator.image(grayscale, align: PosAlign.center);
         // Keep one newline after logo
      }
    } catch (e) {
      debugPrint('Error processing logo: $e');
    }

    // Header (Centered)
    bytes += generator.text(
      'PARFUMHUB',
      styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size1, width: PosTextSize.size1),
    );
    bytes += generator.text('Hameem Mall, GFK02, Hameem Worker Village, Abu Dhabi\n+971505390802', styles: const PosStyles(align: PosAlign.center)); // Keep one newline after address block

    // Total Line (Centered for prominence, matching image)
    bytes += generator.text('----------------------------', styles: const PosStyles(align: PosAlign.center)); // Keep one newline after divider
     bytes += generator.text(
      'AED 170.00',
      styles: const PosStyles(align: PosAlign.center, bold: true), // Reduced size to default (size1)
    );
     bytes += generator.text('Total', styles: const PosStyles(align: PosAlign.center, bold: true)); // Keep one newline after Total label
    bytes += generator.text('----------------------------', styles: const PosStyles(align: PosAlign.center)); // Keep one newline after divider

    // Receipt Info (Left Aligned)
    bytes += generator.text('Receipt #: 2-1038\nDate: 29/01/2025 14:58\nEmployee: Admin\nPOS: Manager POS\n', styles: const PosStyles(align: PosAlign.left)); // Keep one newline after block

    // Customer Info (Left Aligned)
    bytes += generator.text('Customer: Francis Colimao\nDubai\n+97150709070', styles: const PosStyles(align: PosAlign.left)); // Keep one newline after block

    bytes += generator.text('----------------------------', styles: const PosStyles(align: PosAlign.center)); // Keep one newline after divider

    // Items using generator.row for alignment
    void addItemRow(String itemName, String quantityPrice, String itemTotal) {
      bytes += generator.row([
        PosColumn(text: itemName, width: 7, styles: const PosStyles(align: PosAlign.left)),
        PosColumn(text: itemTotal, width: 5, styles: const PosStyles(align: PosAlign.right)),
      ]);
      bytes += generator.text(quantityPrice, styles: const PosStyles(align: PosAlign.left));
      // Add a newline after each item block
    }

    // Add items
    addItemRow('Amir (50ml Super)', '1 x AED 50.00', 'AED 50.00');
    addItemRow('Fresh Spice (50ml Super)', '1 x AED 120.00', 'AED 120.00');

    // Discount using generator.row
     bytes += generator.row([
       PosColumn(text: 'Discount 200', width: 7, styles: const PosStyles(align: PosAlign.left)),
       PosColumn(text: '-AED 200.00', width: 5, styles: const PosStyles(align: PosAlign.right)),
     ]);
     // Add spacing after discount

    bytes += generator.text('----------------------------', styles: const PosStyles(align: PosAlign.center));

    // Totals using generator.row
     bytes += generator.row([
       PosColumn(text: 'Total', width: 7, styles: const PosStyles(align: PosAlign.left, bold: true)),
       PosColumn(text: 'AED 170.00', width: 5, styles: const PosStyles(align: PosAlign.right, bold: true)),
     ]);
     bytes += generator.row([
       PosColumn(text: 'Cash', width: 7, styles: const PosStyles(align: PosAlign.left, bold: true)),
       PosColumn(text: 'AED 170.00', width: 5, styles: const PosStyles(align: PosAlign.right, bold: true)),
     ]);

    bytes += generator.text('----------------------------', styles: const PosStyles(align: PosAlign.center));

    // Footer (Centered)
    bytes += generator.text(
      '100% Money Back Guaranteed\nThank you',
      styles: const PosStyles(align: PosAlign.center),
    );

    // Ensure space before cut
    bytes += generator.text('\n'); // Add a newline before feed

    // Add cut command
    bytes += generator.cut();

    return Uint8List.fromList(bytes);
  }

  @override
  Widget build(BuildContext context) {
    debugPrint("Building UI: Devices count: ${_devices.length}, Status: $_statusMessage, Bluetooth Mode: $_isBluetoothMode");
    return Scaffold(
      appBar: AppBar(
        title: const Text('Device Scanner'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  ElevatedButton(
                    onPressed: (_isLoading || _isScanningBluetooth) ? null : _getUsbDevices,
                    child: const Text('Get USB Devices'),
                  ),
                  ElevatedButton(
                    onPressed: (_isLoading || _isScanningBluetooth) ? null : _scanBluetoothDevices,
                    child: const Text('Scan Bluetooth'),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (_isLoading || _isScanningBluetooth)
                const CircularProgressIndicator()
              else
                Text(_statusMessage, textAlign: TextAlign.center),
              const SizedBox(height: 10),
              if (_devices.isNotEmpty)
                Expanded(
                  child: ListView.builder(
                    itemCount: _devices.length,
                    itemBuilder: (context, index) {
                      final device = _devices[index];
                      return Card(
                        margin: const EdgeInsets.symmetric(vertical: 8.0),
                        child: ListTile(
                          leading: Icon(_isBluetoothMode ? Icons.bluetooth : Icons.usb),
                          title: Text(device),
                          trailing: IconButton(
                            icon: const Icon(Icons.print),
                            onPressed: () async {
                              setState(() {
                                _isPrinting = true;
                                _statusMessage = "Printing to ${device}...";
                              });
                              try {
                                // Default to 58mm for individual device print
                                await _printTest(paperSize: PaperSize.mm58);
                              } catch (e) {
                                setState(() {
                                  _statusMessage = "Print error: $e";
                                });
                              } finally {
                                setState(() {
                                  _isPrinting = false;
                                });
                              }
                            },
                          ),
                        ),
                      );
                    },
                  ),
                ),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  ElevatedButton(
                    onPressed: (_devices.isNotEmpty && !_isPrinting) ? () => _printTest(paperSize: PaperSize.mm58) : null,
                    child: const Text('Print 58mm'),
                  ),
                  ElevatedButton(
                    onPressed: (_devices.isNotEmpty && !_isPrinting) ? () => _printTest(paperSize: PaperSize.mm80) : null,
                    child: const Text('Print 80mm'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}