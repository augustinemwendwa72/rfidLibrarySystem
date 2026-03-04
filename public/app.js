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

// Borrow/Return Form
borrowForm.addEventListener('submit', async (e) => {
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
});

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
    notificationPanel.classList.add('show');
    
    // Show a quick notification
    showResponseNotification(`RFID Card Scanned: ${data.rfid}`, 'success');
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
