/*
 * RFID Library Management System - ESP8266 (NodeMCU) Code
 * 
 * This code reads RFID cards using MFRC522 module and sends
 * the RFID data to the server via HTTP GET request.
 * 
 * Hardware Connections:
 * - NodeMCU D1 (GPIO5) -> MFRC522 RST
 * - NodeMCU D2 (GPIO4) -> MFRC522 SDA (SS)
 * - NodeMCU D5 (GPIO14) -> MFRC522 SCK
 * - NodeMCU D6 (GPIO12) -> MFRC522 MISO
 * - NodeMCU D7 (GPIO13) -> MFRC522 MOSI
 * 
 * Note: MFRC522 uses 3.3V - make sure to use level shifter or
 * connect directly to 3.3V pin on NodeMCU
 */

#include <ESP8266WiFi.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP8266HTTPClient.h>
#include <SoftwareSerial.h>

// WiFi Credentials - UPDATE THESE
const char* ssid = "shikondi";
const char* password = "shikondi2026!";
String myRfid = "";

// Server URL - UPDATE THIS TO YOUR SERVER IP
// The server will return student data in JSON format
const char* serverUrl = "http://b254systems.work.gd:3200/api/rfid-scan?rfid=";

// MFRC522 Pin Configuration
#define RST_PIN 5  // D1
#define SDA_PIN 4  // D2

MFRC522 rfid(SDA_PIN, RST_PIN);  // Create MFRC522 instance

// LED Pin
#define LED_PIN 16  // D0

// SoftwareSerial for LCD Arduino (TX only - we send to Arduino Uno)
// Connect ESP8266 TX (D4/GPIO2) to Arduino Uno RX (Pin 10)
#define SERIAL_TX D4  // D4

SoftwareSerial serialOut(D4,D3);  // TX only, -1 means no RX

// Variables
String lastCardUID = "";
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 3000;  // 3 seconds cooldown between scans

void setup() {
    Serial.begin(9600);
    serialOut.begin(9600);  // SoftwareSerial for LCD Arduino
    delay(10);
    
    // Initialize LED
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    
    // Initialize SPI bus
    SPI.begin();
    
    // Initialize MFRC522
    rfid.PCD_Init();
    Serial.println("RFID Reader Initialized");
    rfid.PCD_DumpVersionToSerial();  // Print firmware version
    
    // Connect to WiFi
    Serial.println();
    Serial.print("Connecting to WiFi...");
    serialOut.println("Connecting to WiFi");
    WiFi.begin(ssid, password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("");
        Serial.println("WiFi Connected");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());
        digitalWrite(LED_PIN, HIGH);  // LED on when connected
        serialOut.println("WIFI Connected");
    } else {
        Serial.println("");
        Serial.println("WiFi Connection Failed!");
        serialOut.println("WIFI Failed");
    }
}

void loop() {
    // Check for new RFID cards
    if (!rfid.PICC_IsNewCardPresent()) {
        return;
    }
    
    // Read the card
    if (!rfid.PICC_ReadCardSerial()) {
        return;
    }
    
    // Get card UID
    String cardUID = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) {
            cardUID += "0";
        }
        cardUID += String(rfid.uid.uidByte[i], HEX);
    }
    
    // Convert to uppercase
    cardUID.toUpperCase();
    
    // Check cooldown to prevent duplicate scans
    unsigned long currentTime = millis();
    if (cardUID == lastCardUID && (currentTime - lastScanTime) < SCAN_COOLDOWN) {
        Serial.println("Duplicate scan ignored");
        rfid.PICC_HaltA();
        return;
    }
    
    lastCardUID = cardUID;
    lastScanTime = currentTime;
    
    // Print card info
    Serial.println("");
    Serial.println("Card Detected!");
    Serial.print("Card UID: ");
    Serial.println(cardUID);
    
    // Send GET request to server and process response
    String response = sendToServer(cardUID);
    
    // Process the server response
    processResponse(response);
    
    // Halt PICC
    rfid.PICC_HaltA();
    
    // Stop encryption on PCD
    rfid.PCD_StopCrypto1();
    
    delay(100);
}

String sendToServer(String rfid) {
    myRfid = rfid;
    // Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected, attempting to reconnect...");
        serialOut.println("Connecting to WiFi");
        WiFi.begin(ssid, password);
        delay(5000);
        
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("Failed to reconnect to WiFi");
            return "{\"error\":\"WiFi disconnected\"}";
        }
    }
    
    WiFiClient client;
    HTTPClient http;
    
    // Build the GET URL with RFID parameter
    String url = String(serverUrl) + rfid;
    
    Serial.print("Sending GET request to: ");
    Serial.println(url);
    
    // Begin HTTP request
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");
    
    // Send GET request
    int httpResponseCode = http.GET();
    
    String response = "";
    
    // Get response
    if (httpResponseCode > 0) {
        response = http.getString();
        Serial.println("HTTP Response Code: " + String(httpResponseCode));
        Serial.println("Response: " + response);
    } else {
        Serial.println("Error on sending GET: " + String(httpResponseCode));
        response = "{\"error\":\"HTTP request failed\"}";
    }
    
    http.end();
    return response;
}

void processResponse(String response) {
    // Parse JSON response from server
    // Expected format:
    // {
    //   "registered": true/false,
    //   "name": "Student Name" or null,
    //   "rfid": "ABCD1234",
    //   "blacklisted": true/false,
    //   "booksBorrowed": 2,
    //   "event": "borrow" or "return" or "new"
    // }
    
    Serial.println("Processing response...");
    
    // Extract values for sending to LCD
    String rfidValue = "";
    String registeredValue = "false";
    String nameValue = "Unknown";
    String eventValue = "";
    String messageValue = "";
    
    // Extract RFID
    rfidValue = extractValue(response, "rfid");
    
    // Extract registered status
    if (response.indexOf("\"registered\":true") != -1) {
        registeredValue = "true";
    }
    
    // Extract name
    nameValue = extractValue(response, "name");
    if (nameValue == "null" || nameValue == "") {
        nameValue = "Unknown";
    }
    
    // Extract event
    eventValue = extractValue(response, "event");
    
    // Extract booksBorrowed
    String booksBorrowedValue = extractValue(response, "booksBorrowed");
    if (booksBorrowedValue == "") {
        booksBorrowedValue = "0";
    }
    
    // Check for error
    if (response.indexOf("error") != -1) {
        Serial.println("Error in response");
        indicateError();
        // Send error to LCD
        serialOut.println(rfidValue + "|false|Error|0||");
        return;
    }
    
    // Check if student is registered
    if (registeredValue == "true") {
        // Student is registered
        Serial.println("Student is registered");
        indicateSuccess();
        messageValue = "Welcome " + nameValue;
    } else {
        // Student is not registered
        Serial.println("Student NOT registered");
        indicateNewCard();
        messageValue = "Not Registered";
    }
    
    // Send data to LCD Arduino
    // Format: rfid|registered|name|booksBorrowed|event|message
    String lcdMessage = rfidValue + "|" + registeredValue + "|" + nameValue + "|" + booksBorrowedValue + "|" + eventValue + "|" + messageValue;
    serialOut.println(lcdMessage);
    Serial.println("Sent to LCD: " + lcdMessage);
    
    // Extract and display key information
    extractJsonValue(response, "name", "Name");
    extractJsonValue(response, "booksBorrowed", "Books Borrowed");
    extractJsonValue(response, "event", "Event");
    extractJsonValue(response, "blacklisted", "Blacklisted");
}

String extractValue(String json, String key) {
    int keyIndex = json.indexOf("\"" + key + "\"");
    if (keyIndex != -1) {
        int colonIndex = json.indexOf(":", keyIndex);
        int valueStart = colonIndex + 1;
        
        // Skip whitespace
        while (valueStart < json.length() && json.charAt(valueStart) == ' ') {
            valueStart++;
        }
        
        int valueEnd;
        String value;
        
        if (json.charAt(valueStart) == '\"') {
            // String value
            valueStart++; // Skip opening quote
            valueEnd = json.indexOf('\"', valueStart);
            value = json.substring(valueStart, valueEnd);
        } else {
            // Boolean or number
            valueEnd = json.indexOf(',', valueStart);
            if (valueEnd == -1) valueEnd = json.indexOf('}', valueStart);
            value = json.substring(valueStart, valueEnd);
            value.trim();
        }
        
        return value;
    }
    return "";
}

void extractJsonValue(String response, String key, String label) {
    int keyIndex = response.indexOf("\"" + key + "\"");
    if (keyIndex != -1) {
        int colonIndex = response.indexOf(":", keyIndex);
        int valueStart = colonIndex + 1;
        
        // Skip whitespace
        while (valueStart < response.length() && response.charAt(valueStart) == ' ') {
            valueStart++;
        }
        
        int valueEnd;
        String value;
        
        if (response.charAt(valueStart) == '"') {
            // String value
            valueStart++; // Skip opening quote
            valueEnd = response.indexOf('"', valueStart);
            value = response.substring(valueStart, valueEnd);
        } else {
            // Boolean or number
            valueEnd = response.indexOf(',', valueStart);
            if (valueEnd == -1) valueEnd = response.indexOf('}', valueStart);
            value = response.substring(valueStart, valueEnd);
            value.trim();
        }
        
        Serial.print(label + ": ");
        Serial.println(value);
    }
}

void indicateSuccess() {
    // Quick double blink for registered student
    for (int i = 0; i < 2; i++) {
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
        delay(100);
    }
    // Keep LED on if WiFi is connected
    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(LED_PIN, HIGH);
    }
}

void indicateNewCard() {
    // Long slow blink for new/unregistered card
    digitalWrite(LED_PIN, LOW);
    delay(500);
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
    delay(500);
    digitalWrite(LED_PIN, HIGH);
    
    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(LED_PIN, HIGH);
    }
}

void indicateError() {
    // Series of quick blinks for error
    for (int i = 0; i < 5; i++) {
        digitalWrite(LED_PIN, LOW);
        delay(50);
        digitalWrite(LED_PIN, HIGH);
        delay(50);
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(LED_PIN, HIGH);
    }
}
