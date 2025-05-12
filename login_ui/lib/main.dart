import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:io';
import 'dart:ui';
import 'dart:async';
import 'package:image_picker/image_picker.dart';
import 'package:local_auth/local_auth.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart'; // Import geolocator

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Login App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        fontFamily: 'Roboto',
        primarySwatch: Colors.blue,
        textTheme: const TextTheme(
          bodyLarge: TextStyle(fontVariations: [FontVariation('wght', 400.0)]),
          bodyMedium: TextStyle(fontVariations: [FontVariation('wght', 400.0)]),
          titleLarge: TextStyle(fontVariations: [FontVariation('wght', 700.0)]),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            textStyle: const TextStyle(
              fontSize: 14,
              fontFamily: 'Roboto',
              fontVariations: [FontVariation('wght', 500.0)],
            ),
          ),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          elevation: 1,
          iconTheme: IconThemeData(color: Colors.black),
          titleTextStyle: TextStyle(
            fontFamily: 'Roboto',
            fontSize: 26,
            fontVariations: [FontVariation('wght', 700.0)],
            color: Colors.black,
          ),
        ),
      ),
      home: const LoginScreen(),
    );
  }
}

class CountdownSnackBarContent extends StatefulWidget {
  final String initialMessage;
  final int countdownFrom;
  final bool isSuccess;

  const CountdownSnackBarContent({
    super.key,
    required this.initialMessage,
    required this.countdownFrom,
    this.isSuccess = true,
  });

  @override
  State<CountdownSnackBarContent> createState() => _CountdownSnackBarContentState();
}

class _CountdownSnackBarContentState extends State<CountdownSnackBarContent> {
  late int _currentCountdown;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _currentCountdown = widget.countdownFrom;
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_currentCountdown > 1) {
        setState(() {
          _currentCountdown--;
        });
      } else {
        setState(() {
          _currentCountdown = 1;
        });
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text('${widget.initialMessage} $_currentCountdown')),
        const SizedBox(width: 8),
        Icon(
          widget.isSuccess ? Icons.check_circle : Icons.error,
          color: widget.isSuccess ? Colors.green : Colors.red,
        ),
      ],
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  File? _capturedImageFile;
  final ImagePicker _picker = ImagePicker();
  final LocalAuthentication _localAuth = LocalAuthentication();
  bool _biometricsSuccessful = false;
  Timer? _appCloseTimer;

  Position? _currentPosition;
  String _locationMessage = "";
  bool _isFetchingLocation = false;
  bool _showLocationAfterLogin = false;

  @override
  void initState() {
    super.initState();
    _requestInitialPermissions();
  }

  @override
  void dispose() {
    _appCloseTimer?.cancel();
    super.dispose();
  }

  Future<void> _requestInitialPermissions() async {
    List<Permission> permissionsToRequest = [
      Permission.camera,
      Permission.locationWhenInUse,
    ];

    Map<Permission, PermissionStatus> statuses = await permissionsToRequest.request();

    statuses.forEach((permission, status) {
      print('$permission: $status');
      if (status == PermissionStatus.permanentlyDenied) {
        _showPermissionPermanentlyDeniedDialog(permission, onStartup: true);
      } else if (status == PermissionStatus.denied) {
        _showStatusSnackBar('${permission.toString().split('.').last} permission denied on startup.', isSuccess: false);
      }
    });
  }

  void _showStatusSnackBar(String message, {bool isSuccess = true, int durationSeconds = 3, bool showCountdown = false}) {
    if (!mounted) return;
    Widget snackBarContent;
    if (showCountdown && durationSeconds > 0) {
      snackBarContent = CountdownSnackBarContent(
        initialMessage: message.replaceFirst(RegExp(r'\d+$'), ''),
        countdownFrom: durationSeconds,
        isSuccess: isSuccess,
      );
    } else {
      snackBarContent = Row(
        children: [
          Expanded(child: Text(message)),
          const SizedBox(width: 8),
          Icon(
            isSuccess ? Icons.check_circle : Icons.error,
            color: isSuccess ? Colors.green : Colors.red,
          ),
        ],
      );
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: snackBarContent,
        duration: Duration(seconds: durationSeconds),
      ),
    );
  }

  Future<bool> _requestPermission(Permission permission) async {
    final status = await permission.status;
    if (status == PermissionStatus.granted) {
      return true;
    } else {
      final result = await permission.request();
      if (result == PermissionStatus.granted) {
        return true;
      } else if (result == PermissionStatus.permanentlyDenied) {
        if (mounted) _showPermissionPermanentlyDeniedDialog(permission);
        return false;
      } else {
        if (mounted) _showStatusSnackBar('Permission denied for ${permission.toString().split('.').last}.', isSuccess: false);
        return false;
      }
    }
  }

  Future<void> _showPermissionPermanentlyDeniedDialog(Permission permission, {bool onStartup = false}) async {
    String permissionName = 'this feature';
    if (permission == Permission.camera) permissionName = 'the camera';
    else if (permission == Permission.location || permission == Permission.locationWhenInUse) permissionName = 'location access';

    if (!mounted) return;
    return showDialog<void>(
      context: context,
      barrierDismissible: !onStartup,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: Text('${permissionName.substring(0,1).toUpperCase()}${permissionName.substring(1)} Required'),
        content: Text('This app requires access to $permissionName to function properly. You have permanently denied this permission. Please go to app settings to enable it.'),
        actions: <Widget>[
          if(!onStartup)
            TextButton(
              child: const Text('Cancel'),
              onPressed: () => Navigator.of(dialogContext).pop(),
            ),
          TextButton(
            child: const Text('Open Settings'),
            onPressed: () {
              openAppSettings();
              Navigator.of(dialogContext).pop();
            },
          ),
        ],
      ),
    );
  }

  Future<void> _pickImageFromCamera() async {
    final bool cameraPermissionGranted = await _requestPermission(Permission.camera);
    if (!cameraPermissionGranted) {
      return;
    }

    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
        maxWidth: 800,
      );
      if (pickedFile != null) {
        final bool hadPreviousImage = _capturedImageFile != null;
        setState(() {
          _capturedImageFile = File(pickedFile.path);
        });
        if (mounted) {
          _showStatusSnackBar(
              hadPreviousImage ? 'Picture changed successfully!' : 'Picture captured successfully!',
              isSuccess: true);
        }
      } else {
        print('No image selected.');
      }
    } catch (e) {
      print('Error picking image: $e');
      if (mounted) {
        _showStatusSnackBar(
            'Error picking image: ${e.toString().substring(0, (e.toString().length > 50) ? 50 : e.toString().length)}...',
            isSuccess: false);
      }
    }
  }

  Future<void> _showBiometricFailureDialog() async {
    if (!mounted) return;
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: const Text('Authentication Failed'),
          content: const SingleChildScrollView(
            child: ListBody(
              children: <Widget>[
                Text('Biometric authentication was not successful.'),
                Text('Would you like to try again?'),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('Exit'),
              onPressed: () {
                Navigator.of(dialogContext).pop();
                SystemNavigator.pop();
              },
            ),
            TextButton(
              child: const Text('Retry'),
              onPressed: () {
                Navigator.of(dialogContext).pop();
                _authenticateWithBiometrics();
              },
            ),
          ],
        );
      },
    );
  }

  Future<void> _authenticateWithBiometrics() async {
    bool authenticated = false;
    try {
      final bool canAuthenticate = await _localAuth.canCheckBiometrics || await _localAuth.isDeviceSupported();
      if (!canAuthenticate) {
        if (mounted) _showStatusSnackBar('Biometrics not available on this device.', isSuccess: false);
        if (_biometricsSuccessful) {
          setState(() {
            _biometricsSuccessful = false;
          });
        }
        return;
      }

      authenticated = await _localAuth.authenticate(
        localizedReason: 'Please authenticate for app access',
        options: const AuthenticationOptions(stickyAuth: true, biometricOnly: true),
      );

      if (mounted) {
        setState(() {
          _biometricsSuccessful = authenticated;
        });
        if (authenticated) {
          _showStatusSnackBar('Biometric Authentication Successful!', isSuccess: true);
        } else {
          _showBiometricFailureDialog();
        }
      }
    } on PlatformException catch (e) {
      print('PlatformException during biometric authentication: $e');
      String errorMessage = 'Error: ${e.message ?? "Platform error"}';
      if (e.code == 'NotEnrolled') {
        errorMessage = 'No biometrics enrolled. Please set up fingerprint or Face ID.';
      } else if (e.code == 'LockedOut' || e.code == 'PermanentlyLockedOut') {
        errorMessage = 'Biometric authentication locked. Try again later or use device passcode.';
      }
      if (mounted) {
        setState(() {
          _biometricsSuccessful = false;
        });
        _showStatusSnackBar(errorMessage, isSuccess: false);
      }
    } catch (e) {
      print('Unexpected error during biometric authentication: $e');
      if (mounted) {
        setState(() {
          _biometricsSuccessful = false;
        });
        _showStatusSnackBar('An unexpected error occurred during biometrics.', isSuccess: false);
      }
    }
  }

  Future<void> _getCurrentLocation() async {
    if (!mounted) return;
    setState(() {
      _isFetchingLocation = true;
      _locationMessage = "Fetching location...";
    });

    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      setState(() {
        _locationMessage = 'Location services are disabled.';
        _isFetchingLocation = false;
      });
      if (mounted) _showStatusSnackBar(_locationMessage, isSuccess: false);
      return;
    }

    final bool locationPermissionGranted = await _requestPermission(Permission.locationWhenInUse);
    if (!locationPermissionGranted) {
      setState(() {
        _locationMessage = 'Location permission denied.';
        _isFetchingLocation = false;
      });
      return;
    }

    try {
      Position position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.medium);
      setState(() {
        _currentPosition = position;
        _locationMessage = 'Lat: ${position.latitude.toStringAsFixed(4)}, Lon: ${position.longitude.toStringAsFixed(4)}';
        _isFetchingLocation = false;
      });
    } catch (e) {
      print("Error getting location: $e");
      setState(() {
        _locationMessage = 'Error getting location.';
        _isFetchingLocation = false;
      });
      if (mounted) _showStatusSnackBar(_locationMessage, isSuccess: false);
    }
  }

  void _handleLogin() async {
    print('Login button pressed');
    setState(() {
      _showLocationAfterLogin = true;
    });
    await _getCurrentLocation();

    const int closeDelaySeconds = 10;
    _showStatusSnackBar(
      'Login Successful! App will close in $closeDelaySeconds',
      isSuccess: true,
      durationSeconds: closeDelaySeconds,
      showCountdown: true,
    );

    _appCloseTimer?.cancel();
    _appCloseTimer = Timer(const Duration(seconds: closeDelaySeconds), () {
      if (mounted) {
        print("Closing app via SystemNavigator.pop()");
        SystemNavigator.pop();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    const double iconContainerSize = 70.0;
    const double fingerprintIconSize = 40.0;
    const double placeholderProfileIconSize = 48.0;
    const double capturedImageCircleRadius = iconContainerSize / 2.2;
    final bool isPictureButtonEnabled = _biometricsSuccessful;
    final bool isLoginButtonEnabled = _biometricsSuccessful && _capturedImageFile != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Login App'),
        centerTitle: true,
      ),
      body: Container(
        color: Colors.white,
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Column(
              children: [
                const SizedBox(height: 30),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Container(
                            width: double.infinity,
                            height: iconContainerSize,
                            margin: const EdgeInsets.only(bottom: 8.0),
                            decoration: BoxDecoration(
                              color: Colors.grey[200],
                              borderRadius: BorderRadius.circular(8.0),
                              border: Border.all(color: Colors.grey[400]!)
                            ),
                            child: Icon(
                              Icons.fingerprint,
                              size: fingerprintIconSize,
                              color: _biometricsSuccessful ? Colors.green : Colors.red,
                            ),
                          ),
                          ElevatedButton(
                            onPressed: _authenticateWithBiometrics,
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size(double.infinity, 40),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: const Text('Capture Biometrics', textAlign: TextAlign.center),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Container(
                            width: double.infinity,
                            height: iconContainerSize,
                            margin: const EdgeInsets.only(bottom: 8.0),
                            decoration: BoxDecoration(
                              color: Colors.grey[200],
                              borderRadius: BorderRadius.circular(8.0),
                               border: Border.all(
                                color: isPictureButtonEnabled ? Theme.of(context).primaryColor.withOpacity(0.5) : Colors.grey[400]!
                              )
                            ),
                            child: Center(
                              child: _capturedImageFile == null
                                  ? Icon(
                                      Icons.account_circle_outlined,
                                      size: placeholderProfileIconSize,
                                      color: isPictureButtonEnabled ? Colors.grey[700] : Colors.grey[400],
                                    )
                                  : CircleAvatar(
                                      radius: capturedImageCircleRadius,
                                      backgroundImage: FileImage(_capturedImageFile!),
                                      backgroundColor: Colors.grey[300],
                                    ),
                            ),
                          ),
                          ElevatedButton(
                            onPressed: isPictureButtonEnabled ? _pickImageFromCamera : null,
                            style: ElevatedButton.styleFrom(
                               minimumSize: const Size(double.infinity, 40),
                               padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: Text(
                              _capturedImageFile == null ? 'Capture Picture' : 'Change Picture',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                 color: isPictureButtonEnabled ? null : Colors.grey[600],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (_showLocationAfterLogin)
                  Padding(
                    padding: const EdgeInsets.only(top: 20.0),
                    child: Column(
                      children: [
                        _isFetchingLocation
                            ? const CircularProgressIndicator()
                            : Text(
                                _locationMessage.isNotEmpty ? _locationMessage : 'Location not yet fetched.',
                                style: const TextStyle(fontSize: 16),
                                textAlign: TextAlign.center,
                              ),
                        if (_currentPosition != null && !_isFetchingLocation)
                          Text(
                            'Accuracy: ${(_currentPosition?.accuracy ?? 0).toStringAsFixed(2)}m',
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                            textAlign: TextAlign.center,
                          )
                      ],
                    ),
                  ),
              ],
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: isLoginButtonEnabled ? _handleLogin : null,
              child: Text(
                'Login',
                style: TextStyle(
                  fontVariations: const [FontVariation('wght', 700.0)],
                  fontSize: 18,
                  color: isLoginButtonEnabled ? null : Colors.grey[600],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}