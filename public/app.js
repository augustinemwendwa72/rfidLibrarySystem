// RFID Library Management System - Frontend JavaScript

// Initialize Socket.io
const socket = io();

// Global variables
let currentScannedRFID = null;
let students = [];
let books = [];
let borrowings = [];

// DOM Elements
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');
const notificationPanel = document.getElementById('notification-panel');
const notificationBtn = document.getElementById('notification-btn');
const closeNotification = document.getElementById('close-notification');
const borrowForm = document.getElementById('borrow-form');
const studentModal = document.getElementById('student-modal');
const addStudentBtn = document.getElementById('add-student-btn');
const closeModal = document.querySelector('.close-modal');
const addStudentForm = document.getElementById('add-student-form');
const addBookForm = document.getElementById('add-book-form');
const responseNotification = document.getElementById('response-notification');
const rfidStatus = document.getElementById('rfid-status');
const notificationBadge = document.getElementById('notification-badge');

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        showPage(page);
    });
});

function showPage(pageName) {
    // Update nav links
    navLinks.forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    // Update pages
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    // Update title
    const titles = {
        'dashboard': 'Dashboard',
        'books': 'Library Books',
        'add-book': 'Add Books',
        'students': 'Students',
        'borrowings': 'Borrowings',
        'overdue': 'Overdue Books'
    };
    document.getElementById('page-title').textContent = titles[pageName];
    
    // Load data for the page
    if (pageName === 'books') renderBooks();
    if (pageName === 'students') renderStudents();
    if (pageName === 'borrowings') renderBorrowings();
    if (pageName === 'overdue') renderOverdue();
    if (pageName === 'dashboard') loadDashboard();
}

// Load all data
async function loadData() {
    try {
        const [studentsRes, booksRes, borrowingsRes] = await Promise.all([
            fetch('/api/students'),
            fetch('/api/books'),
            fetch('/api/borrowings')
        ]);
        
        students = await studentsRes.json();
        books = await booksRes.json();
        borrowings = await borrowingsRes.json();
        
        loadDashboard();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Dashboard
function loadDashboard() {
    // Update stats
    document.getElementById('total-books').textContent = books.reduce((sum, b) => sum + parseInt(b.quantity), 0);
    document.getElementById('books-borrowed').textContent = borrowings.filter(b => b.status === 'active').length;
    document.getElementById('total-students').textContent = students.length;
    
    // Calculate overdue
    const now = new Date();
    const overdue = borrowings.filter(b => {
        if (b.status !== 'active') return false;
        return new Date(b.return_time) < now;
    });
    document.getElementById('overdue-count').textContent = overdue.length;
    
    // Render categories
    const categories = [
        { name: 'Mathematics', icon: 'fa-calculator' },
        { name: 'Science', icon: 'fa-flask' },
        { name: 'English', icon: 'fa-book-open' },
        { name: 'Kiswahili', icon: 'fa-language' },
        { name: 'Social Studies', icon: 'fa-globe' },
        { name: 'Religious Education', icon: 'fa-pray' }
    ];
    
    const categoriesGrid = document.getElementById('categories-grid');
    categoriesGrid.innerHTML = categories.map(cat => {
        const catBooks = books.filter(b => b.category === cat.name);
        const available = catBooks.reduce((sum, b) => sum + parseInt(b.available), 0);
        const total = catBooks.reduce((sum, b) => sum + parseInt(b.quantity), 0);
        
        return `
            <div class="category-card">
                <i class="fas ${cat.icon}"></i>
                <h3>${cat.name}</h3>
                <p>${available} / ${total} available</p>
            </div>
        `;
    }).join('');
}

// Render Books
function renderBooks() {
    const categoryFilter = document.getElementById('filter-category').value;
    const classFilter = document.getElementById('filter-class').value;
    
    let filteredBooks = books;
    if (categoryFilter) {
        filteredBooks = filteredBooks.filter(b => b.category === categoryFilter);
    }
    if (classFilter) {
        filteredBooks = filteredBooks.filter(b => b.class === classFilter);
    }
    
    const booksList = document.getElementById('books-list');
    if (filteredBooks.length === 0) {
        booksList.innerHTML = '<p class="no-data">No books found</p>';
        return;
    }
    
    booksList.innerHTML = filteredBooks.map(book => {
        const isAvailable = parseInt(book.available) > 0;
        return `
            <div class="book-card">
                <h3>${book.title}</h3>
                <p class="category">${book.category}</p>
                <p class="class-info">Class: ${book.class}</p>
                <div class="availability">
                    <span class="${isAvailable ? 'available' : 'unavailable'}">
                        ${book.available} / ${book.quantity} available
                    </span>
                    <span>Lease: ${book.lease_period} hours</span>
                </div>
            </div>
        `;
    }).join('');
}

// Render Students
function renderStudents() {
    const tbody = document.querySelector('#students-list tbody');
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No students registered</td></tr>';
        return;
    }
    
    tbody.innerHTML = students.map(student => `
        <tr>
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>${student.class}</td>
            <td>${student.rfid}</td>
            <td>
                ${student.blacklisted === 'true' 
                    ? '<span class="blacklisted">Blacklisted</span>' 
                    : '<span class="active-status">Active</span>'}
            </td>
            <td>
                ${student.blacklisted === 'true' 
                    ? `<button class="btn-success" onclick="unblacklistStudent('${student.rfid}')">Unblacklist</button>`
                    : `<button class="btn-danger" onclick="blacklistStudent('${student.rfid}')">Blacklist</button>`}
                <button class="btn-danger" style="background: #e74c3c; margin-left: 5px;" onclick="deleteStudent('${student.rfid}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// Render Borrowings
function renderBorrowings() {
    const tbody = document.querySelector('#borrowings-list tbody');
    if (borrowings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No borrowings found</td></tr>';
        return;
    }
    
    const now = new Date();
    tbody.innerHTML = borrowings.map(borrow => {
        const isOverdue = borrow.status === 'active' && new Date(borrow.return_time) < now;
        let statusClass = borrow.status === 'active' ? 'status-active' : 'status-returned';
        if (isOverdue) statusClass = 'status-overdue';
        
        return `
            <tr>
                <td>${borrow.student_rfid}</td>
                <td>${borrow.book_category}</td>
                <td>${borrow.book_class}</td>
                <td>${borrow.quantity}</td>
                <td>${new Date(borrow.borrow_time).toLocaleString()}</td>
                <td>${new Date(borrow.return_time).toLocaleString()}</td>
                <td><span class="${statusClass}">${isOverdue ? 'Overdue' : borrow.status}</span></td>
            </tr>
        `;
    }).join('');
}

// Render Overdue
async function renderOverdue() {
    try {
        const response = await fetch('/api/overdue');
        const overdue = await response.json();
        
        const tbody = document.querySelector('#overdue-list tbody');
        if (overdue.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No overdue books</td></tr>';
            return;
        }
        
        tbody.innerHTML = overdue.map(borrow => `
            <tr>
                <td>${borrow.student_rfid}</td>
                <td>${borrow.book_category}</td>
                <td>${borrow.book_class}</td>
                <td>${borrow.quantity}</td>
                <td>${new Date(borrow.borrow_time).toLocaleString()}</td>
                <td>${new Date(borrow.return_time).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading overdue:', error);
    }
}

// Blacklist Student
async function blacklistStudent(rfid) {
    if (!confirm('Are you sure you want to blacklist this student?')) return;
    
    try {
        const response = await fetch(`/api/blacklist/${rfid}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blacklist: true })
        });
        
        if (response.ok) {
            showResponseNotification('Student blacklisted successfully', 'success');
            loadData();
        } else {
            const data = await response.json();
            showResponseNotification(data.error, 'error');
        }
    } catch (error) {
        showResponseNotification('Error blacklisting student', 'error');
    }
}

// Unblacklist Student
async function unblacklistStudent(rfid) {
    try {
        const response = await fetch(`/api/blacklist/${rfid}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blacklist: false })
        });
        
        if (response.ok) {
            showResponseNotification('Student unblacklisted successfully', 'success');
            loadData();
        } else {
            const data = await response.json();
            showResponseNotification(data.error, 'error');
        }
    } catch (error) {
        showResponseNotification('Error unblacklisting student', 'error');
    }
}

// Delete Student
async function deleteStudent(rfid) {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`/api/students/${rfid}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showResponseNotification('Student deleted successfully', 'success');
            loadData();
        } else {
            const data = await response.json();
            showResponseNotification(data.error, 'error');
        }
    } catch (error) {
        showResponseNotification('Error deleting student', 'error');
    }
}

// Add Book Form
addBookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const bookData = {
        title: document.getElementById('book-title').value,
        category: document.getElementById('book-category').value,
        class: document.getElementById('book-class').value,
        quantity: document.getElementById('book-quantity').value
    };
    
    try {
        const response = await fetch('/api/books', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });
        
        if (response.ok) {
            showResponseNotification('Book added successfully', 'success');
            addBookForm.reset();
            loadData();
        } else {
            const data = await response.json();
            showResponseNotification(data.error, 'error');
        }
    } catch (error) {
        showResponseNotification('Error adding book', 'error');
    }
});

// Update Book Form
const updateBookForm = document.getElementById('update-book-form');

updateBookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const bookData = {
        category: document.getElementById('update-book-category').value,
        class: document.getElementById('update-book-class').value,
        quantity: document.getElementById('update-quantity').value
    };
    
    try {
        const response = await fetch('/api/books', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });
        
        if (response.ok) {
            showResponseNotification('Book quantity updated successfully', 'success');
            updateBookForm.reset();
            loadData();
        } else {
            const data = await response.json();
            showResponseNotification(data.error, 'error');
        }
    } catch (error) {
        showResponseNotification('Error updating book quantity', 'error');
    }
});

// Add Student Modal
addStudentBtn.addEventListener('click', () => {
    studentModal.classList.add('show');
});

closeModal.addEventListener('click', () => {
    studentModal.classList.remove('show');
});

studentModal.addEventListener('click', (e) => {
    if (e.target === studentModal) {
        studentModal.classList.remove('show');
    }
});

// Add Student Form
addStudentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const studentData = {
        name: document.getElementById('student-name').value,
        class: document.getElementById('student-class').value,
        rfid: document.getElementById('student-rfid').value
    };
    
    try {
        const response = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(studentData)
        });
        
        if (response.ok) {
            showResponseNotification('Student added successfully', 'success');
            addStudentForm.reset();
            studentModal.classList.remove('show');
            loadData();
        } else {
            const data = await response.json();
            showResponseNotification(data.error, 'error');
        }
    } catch (error) {
        showResponseNotification('Error adding student', 'error');
    }
});

// Notification Panel
notificationBtn.addEventListener('click', () => {
    notificationPanel.classList.add('show');
});

closeNotification.addEventListener('click', () => {
    notificationPanel.classList.remove('show');
});

notificationPanel.addEventListener('click', (e) => {
    if (e.target === notificationPanel) {
        notificationPanel.classList.remove('show');
    }
});

// Borrow/Return Form Handler
async function handleBorrowSubmit(e) {
    e.preventDefault();
    
    const actionType = document.getElementById('action-type').value;
    const bookData = {
        student_rfid: currentScannedRFID,
        book_category: document.getElementById('borrow-category').value,
        book_class: document.getElementById('borrow-class').value,
        quantity: document.getElementById('borrow-quantity').value
    };
    
    try {
        const endpoint = actionType === 'borrow' ? '/api/borrow' : '/api/return';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (actionType === 'borrow') {
                showResponseNotification(
                    `Book borrowed successfully!<br>
                    Book: ${data.book}<br>
                    Quantity: ${data.quantity}<br>
                    Return by: ${new Date(data.return_time).toLocaleString()}`,
                    'success'
                );
            } else {
                showResponseNotification('Book returned successfully!', 'success');
            }
            
            notificationPanel.classList.remove('show');
            borrowForm.reset();
            loadData();
        } else {
            showResponseNotification(data.error, 'error');
        }
    } catch (error) {
        showResponseNotification('Error processing request', 'error');
    }
}

// Attach form submit handler
borrowForm.addEventListener('submit', handleBorrowSubmit);

// Show Response Notification
function showResponseNotification(message, type) {
    const notification = document.getElementById('response-notification');
    const details = document.getElementById('response-details');
    
    details.innerHTML = message;
    notification.style.background = type === 'success' ? '#27ae60' : '#e74c3c';
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Filter Events
document.getElementById('filter-category').addEventListener('change', renderBooks);
document.getElementById('filter-class').addEventListener('change', renderBooks);

// Socket.io Events
socket.on('connect', () => {
    rfidStatus.innerHTML = `
        <span class="status-dot online"></span>
        <span>Connected - Waiting for RFID scan...</span>
    `;
});

socket.on('disconnect', () => {
    rfidStatus.innerHTML = `
        <span class="status-dot offline"></span>
        <span>Disconnected - Waiting for connection...</span>
    `;
});

socket.on('rfidScanned', (data) => {
    currentScannedRFID = data.rfid;
    
    // Update notification badge
    let badge = parseInt(notificationBadge.textContent);
    notificationBadge.textContent = badge + 1;
    
    // Show notification panel
    document.getElementById('scanned-rfid').textContent = data.rfid;
    
    // Update the notification content based on student data
    const notificationContent = document.getElementById('notification-content');
    
    if (data.registered) {
        // Student is registered
        const statusColor = data.blacklisted ? 'red' : 'green';
        const statusText = data.blacklisted ? 'BLACKLISTED' : 'Active';
        const eventText = data.event === 'return' ? 'Return Books' : 'Borrow Books';
        const booksText = data.booksBorrowed > 0 ? 
            `${data.booksBorrowed} book(s) currently borrowed` : 
            'No books currently borrowed';
        
        // Update the form with student info
        document.getElementById('action-type').value = data.event;
        
        // Show student info in notification
        notificationContent.innerHTML = `
            <div class="student-info" style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #2c3e50;">
                    <i class="fas fa-user"></i> ${data.name}
                </h4>
                <p style="margin: 5px 0;"><strong>Class:</strong> ${data.class || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>RFID:</strong> ${data.rfid}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
                <p style="margin: 5px 0;"><strong>${booksText}</strong></p>
                <p style="margin: 10px 0 0 0; padding: 8px; background: #e3f2fd; border-radius: 3px;">
                    <strong>Suggested Action:</strong> ${eventText}
                </p>
            </div>
            <form id="borrow-form">
                <div class="form-group">
                    <label>Action Type</label>
                    <select id="action-type" required>
                        <option value="borrow" ${data.event === 'borrow' ? 'selected' : ''}>Borrow Book</option>
                        <option value="return" ${data.event === 'return' ? 'selected' : ''}>Return Book</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Book Category</label>
                    <select id="borrow-category" required>
                        <option value="">Select Category</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Science">Science</option>
                        <option value="English">English</option>
                        <option value="Kiswahili">Kiswahili</option>
                        <option value="Social Studies">Social Studies</option>
                        <option value="Religious Education">Religious Education</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Class</label>
                    <select id="borrow-class" required>
                        <option value="">Select Class</option>
                        <option value="Form 1">Form 1</option>
                        <option value="Form 2">Form 2</option>
                        <option value="Form 3">Form 3</option>
                        <option value="Form 4">Form 4</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Number of Books</label>
                    <input type="number" id="borrow-quantity" min="1" value="1" required>
                </div>
                <button type="submit" class="btn-primary">Submit</button>
            </form>
        `;
        
        // Re-attach form submit handler
        document.getElementById('borrow-form').addEventListener('submit', handleBorrowSubmit);
        
        showResponseNotification(
            `${data.name} - ${eventText} (${data.booksBorrowed} books)`, 
            data.blacklisted ? 'error' : 'success'
        );
    } else {
        // New/unregistered card
        notificationContent.innerHTML = `
            <div class="new-card-info" style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">
                    <i class="fas fa-exclamation-triangle"></i> New RFID Card
                </h4>
                <p style="margin: 5px 0;"><strong>RFID:</strong> ${data.rfid}</p>
                <p style="margin: 10px 0 0 0;">This card is not registered in the system.</p>
            </div>
            <p style="text-align: center; color: #6c757d;">Please register this student first.</p>
            <button id="register-student-btn" class="btn-primary" style="width: 100%;">
                <i class="fas fa-user-plus"></i> Register Student
            </button>
        `;
        
        // Attach register button handler
        document.getElementById('register-student-btn').addEventListener('click', () => {
            notificationPanel.classList.remove('show');
            showPage('students');
            document.getElementById('student-rfid').value = data.rfid;
            document.getElementById('student-modal').classList.add('show');
        });
        
        showResponseNotification(`New RFID Card: ${data.rfid} - Not registered`, 'error');
    }
    
    notificationPanel.classList.add('show');
});

// Real-time updates
socket.on('booksUpdated', (data) => {
    books = data;
    if (document.getElementById('books-page').classList.contains('active')) {
        renderBooks();
    }
    loadDashboard();
});

socket.on('studentsUpdated', (data) => {
    students = data;
    if (document.getElementById('students-page').classList.contains('active')) {
        renderStudents();
    }
    loadDashboard();
});

socket.on('borrowingsUpdated', (data) => {
    borrowings = data;
    if (document.getElementById('borrowings-page').classList.contains('active')) {
        renderBorrowings();
    }
    loadDashboard();
});

// Initialize
loadData();
