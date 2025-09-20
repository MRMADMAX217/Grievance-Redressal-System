// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    validateAdminSession();
});

// Add this after document.addEventListener('DOMContentLoaded', ...)
document.getElementById('modal-image').addEventListener('click', function() {
    const fullscreenModal = document.getElementById('fullscreen-modal');
    const fullscreenImage = document.getElementById('fullscreen-image');
    fullscreenImage.src = this.src;
    fullscreenModal.style.display = 'block';
});

document.addEventListener('DOMContentLoaded', function() {
    // Add enter key listener for login
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    }
});

function initializeApp() {
    // Set up event listeners
    setupEventListeners();
    
    // Initialize animations
    initializeAnimations();
    
    // Set up Chart.js defaults
    setupChartDefaults();
}

function setupEventListeners() {
    // Login functionality
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Navigation
    const sidebarItems = document.querySelectorAll('.sidebar ul li');
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => handleSidebarClick(item.getAttribute('data-section')));
    });

    // Filters
    setupFilters();

    // Modal
    setupModal();
}

function initializeAnimations() {
    // Add animation classes to elements
    document.querySelectorAll('.fade-in').forEach(el => {
        observeElement(el, 'fade-in');
    });

    document.querySelectorAll('.slide-up').forEach(el => {
        observeElement(el, 'slide-up');
    });
}

function observeElement(element, animationClass) {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add(animationClass + '-active');
                }
            });
        },
        { threshold: 0.1 }
    );

    observer.observe(element);
}

function setupChartDefaults() {
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#4b5563';
        Chart.defaults.plugins.tooltip.backgroundColor = '#1f2937';
        Chart.defaults.plugins.legend.labels.padding = 20;
    }
}

// Login Handler
async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        showError('Please enter both username and password');
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (data.success) {
            // Update admin info with department name
            document.getElementById('admin-username').textContent = data.username;
            document.getElementById('admin-department').textContent = data.department_name || 'No Department';

            const loginSection = document.getElementById('login-section');
            const dashboardSection = document.getElementById('dashboard-section');

            loginSection.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                loginSection.style.display = 'none';
                dashboardSection.style.display = 'block';
                dashboardSection.classList.add('fade-in');
                loadDashboardData();
            }, 300);
        } else {
            showError(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Connection error. Please try again.');
    }
}

function showError(message) {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.classList.add('shake');
        
        // Remove shake animation after it completes
        setTimeout(() => {
            errorElement.classList.remove('shake');
        }, 500);
    }
}

async function handleLogout() {
    try {
        await fetch('http://localhost:5000/api/admin/logout', {
            method: 'POST',
            credentials: 'include',
        });

        // Redirect to login page
        document.getElementById('dashboard-section').style.display = 'none';
        document.getElementById('login-section').style.display = 'flex';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Function to load departments and populate the dropdown
function loadDepartments() {
    fetch('http://localhost:5000/api/admin/departments', {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const departmentsGrid = document.getElementById('departments-grid');
            departmentsGrid.innerHTML = ''; // Clear existing content

            // Populate departments dynamically
            data.departments.forEach(department => {
                const departmentCard = document.createElement('div');
                departmentCard.classList.add('department-card');
                departmentCard.innerHTML = `
                    <div class="department-header">
                        <h3>${department.name}</h3>
                    </div>
                `;
                
                // Add click event to the card
                departmentCard.addEventListener('click', () => {
                    loadDepartmentComplaints(department.id, department.name);
                });
                
                departmentsGrid.appendChild(departmentCard);
            });
        } else {
            console.error('Failed to load departments:', data.message);
        }
    })
    .catch(error => console.error('Error loading departments:', error));
}

function loadDepartmentComplaints(departmentId, departmentName) {
    // Hide departments grid and show complaints table
    document.getElementById('departments-grid').style.display = 'none';
    document.getElementById('department-complaints').style.display = 'block';
    document.getElementById('back-to-departments').style.display = 'block';

    // Update section header
    const sectionHeader = document.querySelector('#departments-section .section-header h2');
    sectionHeader.textContent = `${departmentName} Complaints`;

    // Fetch complaints for the department
    fetch(`http://localhost:5000/api/admin/complaints?department=${departmentName}`, {
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayDepartmentComplaints(data.complaints);
        }
    })
    .catch(error => console.error('Error:', error));
}

function displayDepartmentComplaints(complaints) {
    const tableBody = document.getElementById('department-complaints-list');
    const noComplaints = document.getElementById('no-department-complaints');

    if (!complaints || complaints.length === 0) {
        tableBody.innerHTML = '';
        noComplaints.style.display = 'flex';
        return;
    }

    noComplaints.style.display = 'none';
    tableBody.innerHTML = '';

    complaints.forEach((complaint, index) => {
        const row = document.createElement('tr');
        row.classList.add('fade-in');
        row.style.animationDelay = `${index * 0.1}s`;

        row.innerHTML = `
            <td>${complaint.ticket_number}</td>
            <td>${complaint.user_name}</td>
            <td>${new Date(complaint.created_at).toLocaleDateString()}</td>
            <td><span class="status status-${complaint.status.toLowerCase().replace(' ', '-')}">${complaint.status}</span></td>
            <td>
                <button class="btn secondary view-btn" onclick="viewComplaintDetails('${complaint.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// Add event listener for back button
document.addEventListener('DOMContentLoaded', function() {
    const backButton = document.getElementById('back-to-departments');
    backButton.addEventListener('click', function() {
        // Reset section header
        document.querySelector('#departments-section .section-header h2').textContent = 'Departments';
        
        // Show departments grid and hide complaints table
        const departmentsGrid = document.getElementById('departments-grid');
        departmentsGrid.style.display = 'grid'; // Explicitly set to grid
        document.getElementById('department-complaints').style.display = 'none';
        document.getElementById('back-to-departments').style.display = 'none';
        
        // Trigger a re-render of departments
        loadDepartments();
    });
});

function handleSidebarClick(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });

    // Show the selected section
    const selectedSection = document.getElementById(`${sectionId}-section`);
    if (selectedSection) {
        selectedSection.style.display = 'block';
    }

    // Update active state in sidebar
    const sidebarItems = document.querySelectorAll('.sidebar ul li');
    sidebarItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === sectionId) {
            item.classList.add('active');
        }
    });

    // Load section-specific data
    switch(sectionId) {
        case 'complaints':
            loadComplaints();
            break;
        case 'departments':
            loadDepartments();
            break;
        case 'reports':
            loadReports();
            // Add a small delay to ensure the canvas is visible
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
            break;
    }
}

function setupFilters() {
    const departmentFilter = document.getElementById('filter-department');
    const statusFilter = document.getElementById('filter-status');
    const searchInput = document.getElementById('search-ticket');
    const searchBtn = document.getElementById('search-btn');

    // Department filter change event
    if (departmentFilter) {
        departmentFilter.addEventListener('change', () => {
            filterComplaints();
        });
    }

    // Status filter change event
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            filterComplaints();
        });
    }

    // Search input keydown event
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterComplaints();
            }
        });
    }

    // Search button click event
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            filterComplaints();
        });
    }
}

async function filterComplaints() {
    const department = document.getElementById('filter-department')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    const search = document.getElementById('search-ticket')?.value.trim() || '';

    try {
        // Show loading state
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            searchBtn.disabled = true;
        }

        const response = await fetch(`http://localhost:5000/api/admin/complaints?department=${encodeURIComponent(department)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            displayComplaints(data.complaints);
        } else {
            showNotification('Error filtering complaints', 'error');
        }
    } catch (error) {
        console.error('Error filtering complaints:', error);
        showNotification('Error filtering complaints', 'error');
    } finally {
        // Reset search button state
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.innerHTML = '<i class="fas fa-search"></i>';
            searchBtn.disabled = false;
        }
    }
}

function setupModal() {
    const modal = document.getElementById('complaint-modal');
    const closeBtn = modal.querySelector('.close');

    closeBtn.addEventListener('click', () => {
        modal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    });

    // Status update handler
    const updateStatusBtn = document.getElementById('update-status-btn');
    if (updateStatusBtn) {
        updateStatusBtn.addEventListener('click', async () => {
            const complaintId = updateStatusBtn.getAttribute('data-complaint-id');
            const newStatus = document.getElementById('update-status-select').value;
            await updateComplaintStatus(complaintId, newStatus);
        });
    }
}

async function loadDashboardData() {
    try {
        // Load initial complaints
        await loadComplaints();
        
        // Load departments for filter
        await loadDepartments();
        
        // Initialize charts
        await loadReports();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

async function loadComplaints() {
    try {
        const response = await fetch('http://localhost:5000/api/admin/complaints', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            displayComplaints(data.complaints);
            populateDepartmentDropdown(data.complaints);
        }
    } catch (error) {
        console.error('Error loading complaints:', error);
        showNotification('Error loading complaints', 'error');
    }
}

function populateDepartmentDropdown(complaints) {
    const departmentDropdown = document.getElementById('filter-department');
    const departments = new Set();

    complaints.forEach(complaint => {
        if (complaint.department) {
            departments.add(complaint.department);
        }
    });

    departmentDropdown.innerHTML = '<option value="">All Departments</option>';

    departments.forEach(department => {
        const option = document.createElement('option');
        option.value = department;
        option.textContent = department;
        departmentDropdown.appendChild(option);
    });
}

function displayComplaints(complaints) {
    const tableBody = document.getElementById('complaints-list');
    const noComplaints = document.getElementById('no-complaints');

    if (!complaints || complaints.length === 0) {
        tableBody.innerHTML = '';
        noComplaints.style.display = 'flex';
        return;
    }

    noComplaints.style.display = 'none';
    tableBody.innerHTML = '';

    complaints.forEach((complaint, index) => {
        const row = document.createElement('tr');
        row.classList.add('fade-in');
        row.style.animationDelay = `${index * 0.1}s`;

        row.innerHTML = `
            <td>${complaint.ticket_number}</td>
            <td>${complaint.department}</td>
            <td>${complaint.user_name}</td>
            <td>${new Date(complaint.created_at).toLocaleDateString()}</td>
            <td><span class="status status-${complaint.status.toLowerCase().replace(' ', '-')}">${complaint.status}</span></td>
            <td>
                <button class="btn secondary view-btn" onclick="viewComplaintDetails('${complaint.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

async function viewComplaintDetails(complaintId) {
    try {
        const response = await fetch(`http://localhost:5000/api/admin/complaints/${complaintId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            const complaint = data.complaint;
            const modal = document.getElementById('complaint-modal');
            
            // Check if all required elements exist before setting their content
            const elements = {
                'modal-ticket': complaint.ticket_number,
                'modal-status': complaint.status,
                'modal-user': complaint.user_name,
                'modal-email': complaint.user_email,
                'modal-department': complaint.department,
                'modal-date': new Date(complaint.created_at).toLocaleDateString(),
                'modal-description': complaint.description,
                'modal-location-text': complaint.address || 'No address provided'
            };

            // Safely set content for each element
            for (const [id, value] of Object.entries(elements)) {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                } else {
                    console.warn(`Element with id '${id}' not found`);
                }
            }

            // Handle image display
            const imageContainer = document.getElementById('modal-image-container');
            const modalImage = document.getElementById('modal-image');
            
            if (imageContainer && modalImage) {
                if (complaint.image_path) {
                    modalImage.src = `http://localhost:5000/uploads/${complaint.ticket_number}.jpg`;
                    imageContainer.style.display = 'block';
                } else {
                    imageContainer.style.display = 'none';
                }
            }

            // Set status
            const statusSelect = document.getElementById('update-status-select');
            if (statusSelect) {
                statusSelect.value = complaint.status;
            }

            // Store complaint ID for updates
            const updateStatusBtn = document.getElementById('update-status-btn');
            if (updateStatusBtn) {
                updateStatusBtn.setAttribute('data-complaint-id', complaint.id);
            }

            // Show modal with animation
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('fade-in');
            } else {
                console.error('Modal element not found');
            }
        }
    } catch (error) {
        console.error('Error loading complaint details:', error);
        showNotification('Error loading complaint details', 'error');
    }
}

async function updateComplaintStatus(complaintId, newStatus) {
    try {
        const response = await fetch('http://localhost:5000/api/admin/update_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                complaint_id: complaintId,
                status: newStatus
            }),
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Status updated successfully', 'success');
            
            // Close modal
            document.getElementById('complaint-modal').style.display = 'none';
            
            // Refresh complaints list
            loadComplaints();
            
            // Refresh reports if visible
            if (document.getElementById('reports-section').style.display !== 'none') {
                loadReports();
            }
        } else {
            showNotification(data.message || 'Failed to update status', 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Error updating status', 'error');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} slide-in`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;

    // Add to document
    document.body.appendChild(notification);

    // Remove after animation
    setTimeout(() => {
        notification.classList.add('slide-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Counter animation for statistics
function animateCounter(element, target) {
    const duration = 1000;
    const steps = 50;
    const stepDuration = duration / steps;
    let current = 0;
    
    const increment = target / steps;
    
    const timer = setInterval(() => {
        current += increment;
        element.textContent = Math.round(current);
        
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        }
    }, stepDuration);
}

// Initialize counters when reports section becomes visible
function initializeCounters() {
    document.querySelectorAll('.counter').forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        animateCounter(counter, target);
    });
}

// Chart initialization and updates
async function loadReports() {
    try {
        const response = await fetch('http://localhost:5000/api/admin/reports', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            updateStatistics(data.statistics);
            updateCharts(data);
        } else {
            console.error('Error loading reports:', data.message);
            showNotification('Error loading reports', 'error');
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        showNotification('Error loading reports', 'error');
    }
}

function updateStatistics(statistics) {
    // Update counter elements with animation
    document.getElementById('stat-total').textContent = statistics.total_complaints || 0;
    document.getElementById('stat-pending').textContent = statistics.pending_complaints || 0;
    document.getElementById('stat-progress').textContent = statistics.in_progress_complaints || 0;
    document.getElementById('stat-resolved').textContent = statistics.resolved_complaints || 0;
}

// Update the updateCharts function
function updateCharts(data) {
    if (!data || !data.chartData) {
        console.error('Chart data is missing or undefined');
        return;
    }

    // Bar Chart
    const barCtx = document.getElementById('dept-chart');
    if (!barCtx) {
        console.error('Bar chart canvas element not found');
        return;
    }

    // Destroy existing bar chart if it exists
    if (window.departmentChart) {
        window.departmentChart.destroy();
    }

    const labels = data.chartData.map(item => item.department);
    const values = data.chartData.map(item => item.total);

    window.departmentChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Complaints By Department',
                data: values,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Pie Chart
    const pieCtx = document.getElementById('status-chart');
    if (!pieCtx) {
        console.error('Pie chart canvas element not found');
        return;
    }

    // Destroy existing pie chart if it exists
    if (window.statusChart) {
        window.statusChart.destroy();
    }

    if (data.statusData) {
        const statusLabels = data.statusData.map(item => item.status);
        const statusValues = data.statusData.map(item => item.count);

        window.statusChart = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusValues,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true, // Enable aspect ratio
                aspectRatio: 1.5, // Set aspect ratio to make chart more circular
                layout: {
                    padding: 20
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 10
                        }
                    },
                    title: {
                        display: true,
                        text: 'Complaints by Status',
                        padding: 10
                    }
                }
            }
        });
    }
}

async function validateAdminSession() {
    try {
        const response = await fetch('http://localhost:5000/api/admin/session', {
            method: 'GET',
            credentials: 'include',
        });

        const data = await response.json();

        if (data.success) {
            // Show dashboard and hide login
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('dashboard-section').style.display = 'block';

            // Display admin info
            document.getElementById('admin-username').textContent = data.admin_username;
            document.getElementById('admin-department').textContent = data.department_name || 'No Department';

            // Load initial data
            await loadDashboardData();

            // Set active section based on URL hash or default to complaints
            const hash = window.location.hash.slice(1) || 'complaints';
            handleSidebarClick(hash);
        } else {
            // Show login and hide dashboard
            document.getElementById('login-section').style.display = 'flex';
            document.getElementById('dashboard-section').style.display = 'none';
        }
    } catch (error) {
        console.error('Error validating session:', error);
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('dashboard-section').style.display = 'none';
    }
}

// Call the function on page load
document.addEventListener('DOMContentLoaded', validateAdminSession);