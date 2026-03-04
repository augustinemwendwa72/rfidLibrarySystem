# RFID Library Management System

A complete RFID-based library management system for Shikondi Secondary School using ESP8266 (NodeMCU), Node.js, and HTML/CSS/JS.

## Features

- **RFID Card Integration**: Students use RFID cards to borrow/return books
- **Real-time Updates**: Socket.io provides instant UI updates
- **Book Categories**: Mathematics, Science, English, Kiswahili, Social Studies, Religious Education
- **Class Management**: Form 1, Form 2, Form 3, Form 4
- **Borrowing System**: 5-hour lease period
- **Overdue Tracking**: Automatic overdue book detection
- **Student Blacklist**: Librarians can blacklist students from borrowing
- **Add Books**: Librarian can add new books to the library
- **CSV Data Storage**: All data stored locally in CSV files
- **Smart Event Detection**: System automatically suggests borrow or return based on current loans

## Project Structure

```
Library Management System/
├── package.json           # Node.js dependencies
├── server.js              # Express server with Socket.io
├── README.md              # This file
├── arduino/
│   └── rfid_library.ino   # ESP8266 Arduino code
├── public/
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styles
│   └── app.js             # Frontend JavaScript
└── data/
    ├── students.csv       # Student records
    ├── books.csv          # Book inventory
    └── borrowings.csv     # Borrowing records
```

## Hardware Requirements

1. **ESP8266 (NodeMCU)** - WiFi-enabled microcontroller
2. **MFRC522 RFID Reader** - For reading RFID cards
3. **RFID Cards/Tags** - For students
4. **Jumper Wires** - For connections

## Circuit Connections

| NodeMCU Pin | MFRC522 Pin |
|-------------|-------------|
| D1 (GPIO5)  | RST         |
| D2 (GPIO4)  | SDA (SS)    |
| D5 (GPIO14) | SCK         |
| D6 (GPIO12) | MISO        |
| D7 (GPIO13) | MOSI        |
| 3.3V        | 3.3V        |
| GND         | GND         |

## Software Setup

### 1. Install Node.js Dependencies

```bash
npm install
```

### 2. Configure WiFi

Edit `arduino/rfid_library.ino` and update:
- `ssid` - Your WiFi network name
- `password` - Your WiFi password
- `serverUrl` - Your computer's IP address (e.g., `http://192.168.1.100:3000`)

### 3. Configure Server URL in Arduino Code

Find this line and update:
```cpp
const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/rfid-scan";
```

Replace `YOUR_SERVER_IP` with your computer's local IP address.

### 4. Upload Arduino Code

1. Open `arduino/rfid_library.ino` in Arduino IDE
2. Install required libraries:
   - ESP8266 board package
   - MFRC522 library
   - ESP8266WiFi
   - ESP8266HTTPClient
3. Select NodeMCU 1.0 as board
4. Upload the code

### 5. Start the Server

```bash
npm start
```

The server will run on `http://localhost:3200`

## Usage

### 1. Access the Library Management System

Open your browser and navigate to:
```
http://localhost:3200
```

### 2. Add Books

1. Click "Add Books" in the sidebar
2. Fill in the book details:
   - Book Title
   - Category (Mathematics, Science, etc.)
   - Class (Form 1, 2, 3, or 4)
   - Quantity
3. Click "Add Book"

### 3. Add Students

**Option A - Via Students Page:**
1. Click "Students" in the sidebar
2. Click "Add Student" button
3. Fill in student details:
   - Student Name
   - Class
   - RFID Card ID
4. Click "Add Student"

**Option B - Via RFID Scan (New Card):**
1. Student swipes their RFID card on the ESP8266 RFID reader
2. The system detects it's a new card and shows notification
3. Librarian clicks "Register Student" to add the student

### 4. Borrowing/Returning a Book

1. Student swipes their RFID card on the ESP8266 RFID reader
2. The system automatically checks:
   - If student is registered
   - Number of books currently borrowed
   - If blacklisted
3. The librarian sees a notification with student details:
   - Student name and class
   - Number of books currently borrowed
   - Suggested action (Borrow or Return)
4. Librarian fills in the form:
   - Action: Borrow or Return (pre-selected based on current status)
   - Book Category
   - Class
   - Number of books
5. Click "Submit"
6. System shows confirmation with return time (5 hours from now for borrowing)

### 5. Blacklist a Student

1. Student swipes their RFID card on the ESP8266 RFID reader
2. The librarian sees a notification popup
3. Librarian selects:
   - Action: Borrow
   - Book Category
   - Class
   - Number of books
4. Click "Submit"
5. System shows confirmation with return time (5 hours from now)

### 5. Returning a Book

1. Student swipes their RFID card
2. Librarian selects:
   - Action: Return
   - Book Category
   - Class
   - Number of books
3. Click "Submit"

### 6. Blacklist a Student

1. Go to Students page
2. Click "Blacklist" button next to the student
3. Student will not be able to borrow books

### 7. View Overdue Books

1. Click "Overdue" in the sidebar
2. See all books that are past their return time

## Finding Your Computer IP Address

### Windows
```cmd
ipconfig
```
Look for "IPv4 Address"

### macOS
```bash
ifconfig | grep "inet "
```

### Linux
```bash
hostname -I
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/students | Get all students |
| GET | /api/books | Get all books |
| GET | /api/borrowings | Get all borrowings |
| GET | /api/overdue | Get overdue books |
| GET | /api/student/:rfid | Get student by RFID |
| POST | /api/students | Add new student |
| POST | /api/books | Add new book |
| POST | /api/borrow | Borrow a book |
| POST | /api/return | Return a book |
| POST | /api/blacklist/:rfid | Blacklist/unblacklist student |
| POST | /api/rfid-scan | Handle RFID scan |

## Troubleshooting

### ESP8266 Not Connecting to WiFi
- Check WiFi credentials are correct
- Ensure WiFi is 2.4GHz (not 5GHz)
- Check power supply provides enough current

### Server Not Starting
- Ensure port 3000 is not in use
- Check all npm dependencies are installed

### RFID Reader Not Reading Cards
- Check wiring connections
- Ensure MFRC522 is getting 3.3V (not 5V!)
- Check antenna proximity to card

### Real-time Updates Not Working
- Ensure Socket.io is connecting (check browser console)
- Check firewall is not blocking WebSocket connections

## License

This project is for educational purposes.
# rfidLibrarySystem
