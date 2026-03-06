/*
 * Arduino LCD Display for Library Management System
 * 
 * This code receives messages from ESP8266 via SoftwareSerial
 * and displays them on a 16x2 LCD screen.
 * 
 * Hardware:
 * - Arduino Uno
 * - 16x2 LCD Display
 * - ESP8266 connected via SoftwareSerial
 * 
 * Wiring:
 * - LCD RS -> Arduino Pin 7
 * - LCD EN -> Arduino Pin 5
 * - LCD D4 -> Arduino Pin 4
 * - LCD D5 -> Arduino Pin 3
 * - LCD D6 -> Arduino Pin 2
 * - LCD D7 -> Arduino Pin A0
 * - LCD Contrast -> Arduino Pin 6 (PWM)
 * - ESP8266 TX -> Arduino Pin 9 (RX)
 * 
 * Message Format from ESP8266:
 * RFID|registered|name|booksBorrowed|event|message
 * Example: 03D4DB26|true|Gloria|0|borrow|Welcome Gloria
 */

#include <SoftwareSerial.h>
#include <LiquidCrystal.h>

// ==================== PIN CONFIGURATION ====================
#define LCD_CONTRAST 6
#define LCD_RS 7
#define LCD_EN 5
#define LCD_D4 4
#define LCD_D5 3
#define LCD_D6 2
#define LCD_D7 A0

// SoftwareSerial Pins (connect to ESP8266)
#define SOFT_RX 9
#define SOFT_TX 8

// LED indicators
#define LED_SUCCESS 14   // A1 - Green LED
#define LED_ERROR 15    // A2 - Red LED
#define LED_WAIT 16     // A3 - Yellow LED

// ==================== INITIALIZE COMPONENTS ====================
LiquidCrystal lcd(LCD_RS, LCD_EN, LCD_D4, LCD_D5, LCD_D6, LCD_D7);
SoftwareSerial serialIn(SOFT_RX, SOFT_TX);

// ==================== VARIABLES ====================
String inputString = "";
boolean stringComplete = false;
boolean wifiConnected = false;

// ==================== SCHOOL NAME ====================
const String SCHOOL_NAME = "Shikondi Sec";

void setup() {
    // Set LCD contrast using PWM
    analogWrite(LCD_CONTRAST, 100);
    
    // Initialize LCD
    lcd.begin(16, 2);
    lcd.print(SCHOOL_NAME);
    lcd.setCursor(0, 1);
    lcd.print("Initializing...");
    
    // Initialize SoftwareSerial
    serialIn.begin(9600);
    
    // Initialize LED pins
    pinMode(LED_SUCCESS, OUTPUT);
    pinMode(LED_ERROR, OUTPUT);
    pinMode(LED_WAIT, OUTPUT);
    
    // Initialize LEDs
    digitalWrite(LED_SUCCESS, LOW);
    digitalWrite(LED_ERROR, LOW);
    digitalWrite(LED_WAIT, HIGH);  // Start with wait LED on
    
    // Reserve buffer
    inputString.reserve(200);
    
    delay(2000);
    showIdleScreen();
    
    Serial.begin(9600);
    Serial.println("LCD Display Ready!");
}

void loop() {
    // Read from SoftwareSerial
    while (serialIn.available()) {
        char inChar = (char)serialIn.read();
        inputString += inChar;
        
        if (inChar == '\n' || inChar == '\r') {
            stringComplete = true;
        }
    }
    
    if (stringComplete) {
        inputString.trim();
        Serial.println("Received: " + inputString);
        processMessage(inputString);
        inputString = "";
        stringComplete = false;
    }
    
    delay(10);
}

// ==================== PROCESS MESSAGE ====================
void processMessage(String message) {
    // Format: RFID|registered|name|booksBorrowed|event|message
    // Example: 03D4DB26|true|Gloria|0|borrow|Welcome Gloria
    
    Serial.println("Processing: " + message);
    
    // Split by pipe character
    String parts[7];
    int partIndex = 0;
    int lastIndex = 0;
    
    for (int i = 0; i < message.length(); i++) {
        if (message.charAt(i) == '|') {
            parts[partIndex] = message.substring(lastIndex, i);
            lastIndex = i + 1;
            partIndex++;
            if (partIndex >= 7) break;
        }
    }
    if (lastIndex < message.length()) {
        parts[partIndex] = message.substring(lastIndex);
    }
    
    // Extract values (handle potential duplicate RFID at start)
    String rfid = "";
    String registered = "false";
    String name = "";
    String booksBorrowed = "0";
    String event = "";
    
    // Find the actual data
    for (int i = 0; i <= partIndex; i++) {
        if (parts[i] == "true" || parts[i] == "false") {
            // This is the registered field
            registered = parts[i];
            // Name should be next
            if (i + 1 <= partIndex && parts[i+1] != "") {
                name = parts[i+1];
            }
            // booksBorrowed after name
            if (i + 2 <= partIndex && parts[i+2] != "") {
                booksBorrowed = parts[i+2];
            }
            // event after booksBorrowed
            if (i + 3 <= partIndex && parts[i+3] != "") {
                event = parts[i+3];
            }
            break;
        } else if (parts[i].length() == 8 && parts[i] != "true" && parts[i] != "false") {
            // This is likely the RFID
            rfid = parts[i];
        }
    }
    
    // Also check for wifi status messages
    if (message.indexOf("Connecting") != -1 || message.indexOf("Connecting") != -1) {
        showWifiConnecting();
        return;
    }
    
    if (message.indexOf("WIFI Connected") != -1 || message.indexOf("Connected!") != -1 || message.indexOf("WiFi Connected") != -1) {
        wifiConnected = true;
        showWifiConnected();
        delay(5000);
        showIdleScreen();
        return;
    }
    
    if (message.indexOf("WIFI Failed") != -1 || message.indexOf("Failed") != -1 || message.indexOf("error") != -1 || message.indexOf("disconnected") != -1 || message.indexOf("WiFi") != -1) {
        wifiConnected = false;
        showWifiError();
        delay(2000);
        showIdleScreen();
        return;
    }
    
    // Display based on registration status
    if (registered == "true") {
        // Registered student
        digitalWrite(LED_WAIT, LOW);
        digitalWrite(LED_SUCCESS, HIGH);
        
        if (name != "") {
            if (event == "borrow") {
                showBorrowScreen(name, booksBorrowed);
            } else if (event == "return") {
                showReturnScreen(name, booksBorrowed);
            } else {
                showWelcomeScreen(name, booksBorrowed);
            }
        } else {
            showErrorScreen("Invalid Data");
        }
        
        delay(4000);
        digitalWrite(LED_SUCCESS, LOW);
        digitalWrite(LED_WAIT, HIGH);
        
    } else {
        // Not registered
        digitalWrite(LED_WAIT, LOW);
        digitalWrite(LED_ERROR, HIGH);
        
        showNotRegisteredScreen(rfid);
        
        delay(10000);
        digitalWrite(LED_ERROR, LOW);
        digitalWrite(LED_WAIT, HIGH);
    }
    
    showIdleScreen();
}

// ==================== LCD DISPLAY FUNCTIONS ====================

// Idle screen - School name on line 1, Swipe card on line 2
void showIdleScreen() {
    lcd.clear();
    lcd.print(SCHOOL_NAME);
    lcd.setCursor(0, 1);
    lcd.print(" Swipe Card   ");
}

// WiFi connecting
void showWifiConnecting() {
    lcd.clear();
    lcd.print("WiFi");
    lcd.setCursor(0, 1);
    lcd.print("Connecting...");
}

// WiFi connected
void showWifiConnected() {
    lcd.clear();
    lcd.print("WiFi");
    lcd.setCursor(0, 1);
    lcd.print("Connected!");
}

// WiFi error
void showWifiError() {
    lcd.clear();
    lcd.print("WiFi Error!");
    lcd.setCursor(0, 1);
    lcd.print("Check Connection");
}

// Registered student - Welcome + name
void showWelcomeScreen(String name, String books) {
    lcd.clear();
    lcd.print("Welcome");
    
    // Line 2: Truncate name if needed
    lcd.setCursor(0, 1);
    if (name.length() > 16) {
        name = name.substring(0, 16);
    }
    lcd.print(name);
}

// Borrow screen
void showBorrowScreen(String name, String books) {
    
    lcd.clear();
    lcd.setCursor(0, 1);
    if (name.length() > 10) {
        name = name.substring(0, 10);
    }
    lcd.print(name);

    lcd.setCursor(0, 0);
    lcd.print("Books: ");
     lcd.setCursor(8, 0);
     lcd.print(books);
     delay(5000);

    lcd.clear();
    lcd.print("Borrowing...");
    
    lcd.setCursor(0, 1);
    if (name.length() > 10) {
        name = name.substring(0, 10);
    }
    lcd.print(name);
    delay(5000);
    



}

// Return screen  
void showReturnScreen(String name, String books) {
    lcd.clear();
    lcd.print("Returning...");
    
    lcd.setCursor(0, 1);
    if (name.length() > 10) {
        name = name.substring(0, 10);
    }
    lcd.print(name);
}

// Not registered screen
void showNotRegisteredScreen(String rfid) {
    lcd.clear();
    lcd.print("NOT REGISTERED");
    
    lcd.setCursor(0, 1);
    // Show truncated RFID
    if (rfid.length() > 12) {
        rfid = rfid.substring(0, 12);
    }
    lcd.print(rfid);
}

// Error screen
void showErrorScreen(String error) {
    lcd.clear();
    lcd.print("Error");
    
    lcd.setCursor(0, 1);
    if (error.length() > 16) {
        error = error.substring(0, 16);
    }
    lcd.print(error);
}

// Scanning message
void showScanningScreen() {
    lcd.clear();
    lcd.print("Scanning...");
    
    lcd.setCursor(0, 1);
    lcd.print("Please wait...");
}
