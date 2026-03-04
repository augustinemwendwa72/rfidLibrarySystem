/*
 * RFID Library Management System - ESP8266 (NodeMCU) Code
 * 
 * This code reads RFID cards using MFRC522 module and sends
 * the RFID data to the server via HTTP POST request.
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

// WiFi Credentials - UPDATE THESE
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server URL - UPDATE THIS TO YOUR SERVER IP
const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/rfid-scan";

// MFRC522 Pin Configuration
#define RST_PIN 5  // D1
#define SDA_PIN 4  // D2

MFRC522 rfid(SDA_PIN, RST_PIN);  // Create MFRC522 instance

// LED Pin
#define LED_PIN 16  // D0

// Variables
String lastCardUID = "";
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 3000;  // 3 seconds cooldown between scans

void setup() {
    Serial.begin(115200);
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
    } else {
        Serial.println("");
        Serial.println("WiFi Connection Failed!");
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
    
    // Send data to server
    sendToServer(cardUID);
    
    // Blink LED to indicate scan
    blinkLED(3);
    
    // Halt PICC
    rfid.PICC_HaltA();
    
    // Stop encryption on PCD
    rfid.PCD_StopCrypto1();
    
    delay(100);
}

void sendToServer(String rfid) {
    // Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected, attempting to reconnect...");
        WiFi.begin(ssid, password);
        delay(5000);
        
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("Failed to reconnect to WiFi");
            return;
        }
    }
    
    WiFiClient client;
    HTTPClient http;
    
    // Prepare request
    http.begin(client, serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    String jsonPayload = "{\"rfid\":\"" + rfid + "\"}";
    
    Serial.print("Sending data to server: ");
    Serial.println(jsonPayload);
    
    // Send POST request
    int httpResponseCode = http.POST(jsonPayload);
    
    // Get response
    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.println("HTTP Response Code: " + String(httpResponseCode));
        Serial.println("Response: " + response);
    } else {
        Serial.println("Error on sending POST: " + String(httpResponseCode));
    }
    
    http.end();
}

void blinkLED(int times) {
    for (int i = 0; i < times; i++) {
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

/*
 * Additional Functions for Status Indications
 */

void indicateSuccess() {
    // Quick double blink for success
    digitalWrite(LED_PIN, LOW);
    delay(100);
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    delay(100);
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    
    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(LED_PIN, HIGH);
    }
}

void indicateError() {
    // Long blink for error
    digitalWrite(LED_PIN, LOW);
    delay(500);
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    
    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(LED_PIN, HIGH);
    }
}

/*
 * Function to check server connection status
 */
void checkServerConnection() {
    if (WiFi.status() == WL_CONNECTED) {
        WiFiClient client;
        HTTPClient http;
        
        String statusUrl = String(serverUrl);
        statusUrl.replace("/api/rfid-scan", "/api/books");
        
        http.begin(client, statusUrl);
        int httpCode = http.GET();
        http.end();
        
        if (httpCode == 200) {
            digitalWrite(LED_PIN, HIGH);
        } else {
            digitalWrite(LED_PIN, LOW);
            delay(100);
            digitalWrite(LED_PIN, HIGH);
        }
    }
}
