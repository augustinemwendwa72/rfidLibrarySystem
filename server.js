const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CSV File paths
const DATA_DIR = path.join(__dirname, 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.csv');
const BOOKS_FILE = path.join(DATA_DIR, 'books.csv');
const BORROWINGS_FILE = path.join(DATA_DIR, 'borrowings.csv');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Initialize CSV files if they don't exist
function initializeCSVFile(filePath, headers) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, headers.join(',') + '\n');
    }
}

// Initialize all CSV files
initializeCSVFile(STUDENTS_FILE, ['id', 'name', 'class', 'rfid', 'blacklisted', 'created_at']);
initializeCSVFile(BOOKS_FILE, ['id', 'title', 'category', 'class', 'quantity', 'available', 'lease_period']);
initializeCSVFile(BORROWINGS_FILE, ['id', 'student_rfid', 'book_category', 'book_class', 'quantity', 'borrow_time', 'return_time', 'status']);

// Supported classes for Shikondi Secondary School
const SUPPORTED_CLASSES = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];

// Read CSV helper function
function readCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

// Write CSV helper function
function writeCSV(filePath, data, headers) {
    return new Promise((resolve, reject) => {
        // Convert data to CSV string manually to ensure proper formatting
        let csvContent = headers.join(',') + '\n';
        data.forEach(row => {
            const rowValues = headers.map(header => {
                const value = row[header] || '';
                // Escape values that contain commas or quotes
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
            });
            csvContent += rowValues.join(',') + '\n';
        });
        
        fs.writeFile(filePath, csvContent, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Get all students
app.get('/api/students', async (req, res) => {
    try {
        const students = await readCSV(STUDENTS_FILE);
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all books
app.get('/api/books', async (req, res) => {
    try {
        const books = await readCSV(BOOKS_FILE);
        res.json(books);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all borrowings
app.get('/api/borrowings', async (req, res) => {
    try {
        const borrowings = await readCSV(BORROWINGS_FILE);
        res.json(borrowings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get student by RFID
app.get('/api/student/:rfid', async (req, res) => {
    try {
        const students = await readCSV(STUDENTS_FILE);
        const student = students.find(s => s.rfid === req.params.rfid);
        if (student) {
            res.json(student);
        } else {
            res.status(404).json({ error: 'Student not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new student
app.post('/api/students', async (req, res) => {
    try {
        const students = await readCSV(STUDENTS_FILE);
        const newStudent = {
            id: Date.now().toString(),
            name: req.body.name,
            class: req.body.class,
            rfid: req.body.rfid,
            blacklisted: 'false',
            created_at: new Date().toISOString()
        };
        students.push(newStudent);
        
        const headers = ['id', 'name', 'class', 'rfid', 'blacklisted', 'created_at'];
        await writeCSV(STUDENTS_FILE, students, headers);
        
        io.emit('studentsUpdated', students);
        res.json(newStudent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new book
app.post('/api/books', async (req, res) => {
    try {
        const books = await readCSV(BOOKS_FILE);
        const newBook = {
            id: Date.now().toString(),
            title: req.body.title,
            category: req.body.category,
            class: req.body.class,
            quantity: req.body.quantity,
            available: req.body.quantity,
            lease_period: '5'
        };
        books.push(newBook);
        
        const headers = ['id', 'title', 'category', 'class', 'quantity', 'available', 'lease_period'];
        await writeCSV(BOOKS_FILE, books, headers);
        
        io.emit('booksUpdated', books);
        res.json(newBook);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update book quantity
app.put('/api/books', async (req, res) => {
    try {
        const books = await readCSV(BOOKS_FILE);
        const book = books.find(b => b.category === req.body.category && b.class === req.body.class);
        
        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }
        
        const quantityChange = parseInt(req.body.quantity);
        book.quantity = (parseInt(book.quantity) + quantityChange).toString();
        book.available = (parseInt(book.available) + quantityChange).toString();
        
        if (parseInt(book.quantity) < 0 || parseInt(book.available) < 0) {
            return res.status(400).json({ error: 'Invalid quantity' });
        }
        
        const headers = ['id', 'title', 'category', 'class', 'quantity', 'available', 'lease_period'];
        await writeCSV(BOOKS_FILE, books, headers);
        
        io.emit('booksUpdated', books);
        res.json(book);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Borrow books
app.post('/api/borrow', async (req, res) => {
    try {
        const { student_rfid, book_category, book_class, quantity } = req.body;
        
        // Check if student exists and is not blacklisted
        const students = await readCSV(STUDENTS_FILE);
        const student = students.find(s => s.rfid === student_rfid);
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        if (student.blacklisted === 'true') {
            return res.status(403).json({ error: 'Student is blacklisted' });
        }
        
        // Check book availability
        const books = await readCSV(BOOKS_FILE);
        const book = books.find(b => b.category === book_category && b.class === book_class);
        
        if (!book || parseInt(book.available) < parseInt(quantity)) {
            return res.status(400).json({ error: 'Books not available' });
        }
        
        // Update book availability
        book.available = (parseInt(book.available) - parseInt(quantity)).toString();
        
        const headers = ['id', 'title', 'category', 'class', 'quantity', 'available', 'lease_period'];
        await writeCSV(BOOKS_FILE, books, headers);
        
        // Record borrowing
        const borrowings = await readCSV(BORROWINGS_FILE);
        const borrowTime = new Date();
        const returnTime = new Date(borrowTime.getTime() + 5 * 60 * 60 * 1000); // 5 hours
        
        const newBorrowing = {
            id: Date.now().toString(),
            student_rfid,
            book_category,
            book_class,
            quantity,
            borrow_time: borrowTime.toISOString(),
            return_time: returnTime.toISOString(),
            status: 'active'
        };
        borrowings.push(newBorrowing);
        
        const borrowHeaders = ['id', 'student_rfid', 'book_category', 'book_class', 'quantity', 'borrow_time', 'return_time', 'status'];
        await writeCSV(BORROWINGS_FILE, borrowings, borrowHeaders);
        
        // Emit updates
        io.emit('booksUpdated', books);
        io.emit('borrowingsUpdated', borrowings);
        
        res.json({
            success: true,
            message: 'Book borrowed successfully',
            return_time: returnTime.toISOString(),
            book: book.title,
            quantity
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Return books
app.post('/api/return', async (req, res) => {
    try {
        const { student_rfid, book_category, book_class, quantity } = req.body;
        
        // Find active borrowing
        const borrowings = await readCSV(BORROWINGS_FILE);
        const borrowing = borrowings.find(b => 
            b.student_rfid === student_rfid && 
            b.book_category === book_category && 
            b.book_class === book_class &&
            b.status === 'active'
        );
        
        if (!borrowing) {
            return res.status(404).json({ error: 'No active borrowing found' });
        }
        
        // Update borrowing status
        borrowing.status = 'returned';
        borrowing.return_time = new Date().toISOString();
        
        const borrowHeaders = ['id', 'student_rfid', 'book_category', 'book_class', 'quantity', 'borrow_time', 'return_time', 'status'];
        await writeCSV(BORROWINGS_FILE, borrowings, borrowHeaders);
        
        // Update book availability
        const books = await readCSV(BOOKS_FILE);
        const book = books.find(b => b.category === book_category && b.class === book_class);
        
        if (book) {
            book.available = (parseInt(book.available) + parseInt(quantity)).toString();
            const headers = ['id', 'title', 'category', 'class', 'quantity', 'available', 'lease_period'];
            await writeCSV(BOOKS_FILE, books, headers);
            io.emit('booksUpdated', books);
        }
        
        io.emit('borrowingsUpdated', borrowings);
        
        res.json({ success: true, message: 'Book returned successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Blacklist student
app.post('/api/blacklist/:rfid', async (req, res) => {
    try {
        const students = await readCSV(STUDENTS_FILE);
        const student = students.find(s => s.rfid === req.params.rfid);
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        student.blacklisted = req.body.blacklist ? 'true' : 'false';
        
        const headers = ['id', 'name', 'class', 'rfid', 'blacklisted', 'created_at'];
        await writeCSV(STUDENTS_FILE, students, headers);
        
        io.emit('studentsUpdated', students);
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete student
app.delete('/api/students/:rfid', async (req, res) => {
    try {
        const students = await readCSV(STUDENTS_FILE);
        const studentIndex = students.findIndex(s => s.rfid === req.params.rfid);
        
        if (studentIndex === -1) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        students.splice(studentIndex, 1);
        
        const headers = ['id', 'name', 'class', 'rfid', 'blacklisted', 'created_at'];
        await writeCSV(STUDENTS_FILE, students, headers);
        
        io.emit('studentsUpdated', students);
        res.json({ success: true, message: 'Student deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get overdue books
app.get('/api/overdue', async (req, res) => {
    try {
        const borrowings = await readCSV(BORROWINGS_FILE);
        const now = new Date();
        
        const overdue = borrowings.filter(b => {
            if (b.status !== 'active') return false;
            const returnTime = new Date(b.return_time);
            return returnTime < now;
        });
        
        res.json(overdue);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Handle RFID scan from ESP8266 (GET request)
app.get('/api/rfid-scan', async (req, res) => {
    const rfid = req.query.rfid;
    
    if (!rfid) {
        return res.json({ 
            error: 'RFID parameter is required',
            registered: false 
        });
    }
    
    try {
        // Read students data
        const students = await readCSV(STUDENTS_FILE);
        const student = students.find(s => s.rfid === rfid);
        
        // Read borrowings data to count active loans
        const borrowings = await readCSV(BORROWINGS_FILE);
        const activeBorrowings = borrowings.filter(b => 
            b.student_rfid === rfid && b.status === 'active'
        );
        const booksBorrowed = activeBorrowings.reduce((sum, b) => sum + parseInt(b.quantity), 0);
        
        // Determine event type (borrow or return)
        // If student has books borrowed, suggest return, otherwise suggest borrow
        const event = booksBorrowed > 0 ? 'return' : 'borrow';
        
        if (student) {
            // Student is registered
            const response = {
                registered: true,
                name: student.name,
                rfid: student.rfid,
                class: student.class,
                blacklisted: student.blacklisted === 'true',
                booksBorrowed: booksBorrowed,
                event: event,
                message: student.blacklisted === 'true' ? 'Student is blacklisted' : 
                        (booksBorrowed > 0 ? 'Return books' : 'Borrow books')
            };
            
            // Emit to all connected clients
            io.emit('rfidScanned', { 
                ...response, 
                timestamp: new Date().toISOString() 
            });
            
            res.json(response);
        } else {
            // Student is not registered - new card
            const response = {
                registered: false,
                name: null,
                rfid: rfid,
                class: null,
                blacklisted: false,
                booksBorrowed: 0,
                event: 'new',
                message: 'New RFID card - register student'
            };
            
            // Emit to all connected clients
            io.emit('rfidScanned', { 
                ...response, 
                timestamp: new Date().toISOString() 
            });
            
            res.json(response);
        }
    } catch (error) {
        console.error('Error processing RFID scan:', error);
        res.json({ 
            error: error.message,
            registered: false 
        });
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3200;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
