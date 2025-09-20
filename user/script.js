document.addEventListener('DOMContentLoaded', function () {
    // Tab Functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabBtns.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to current button and content
            btn.classList.add('active');
            document.getElementById(`${tabId}-section`).classList.add('active');
        });
    });

    // Chat Functionality
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const complaintForm = document.getElementById('complaint-form');

    // Enhanced addMessage function with bot logo support
    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', isUser ? 'user' : 'bot');
        
        if (!isUser) {
            // Add bot logo for bot messages
            const logoDiv = document.createElement('div');
            logoDiv.classList.add('bot-logo');
            const icon = document.createElement('i');
            icon.classList.add('fas', 'fa-robot');
            logoDiv.appendChild(icon);
            messageDiv.appendChild(logoDiv);
        }
        
        const textDiv = document.createElement('div');
        textDiv.textContent = message;
        messageDiv.appendChild(textDiv);
        
        // Add typing animation for bot messages
        if (!isUser) {
            messageDiv.style.opacity = '0';
            setTimeout(() => {
                messageDiv.style.opacity = '1';
            }, 0);
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageDiv;
    }

    // Add initial bot message
    addMessage("Hello! I'm Grieve Buddy, here to help you submit your grievance. Please tell me about your issue, and I'll make sure it gets to the right department.");

    async function handleUserInput() {
        const message = userInput.value.trim();
        if (!message) return;

        // Hide complaint form if visible
        const complaintForm = document.getElementById('complaint-form');
        if (complaintForm.style.display === 'block') {
            complaintForm.style.display = 'none';
            complaintForm.classList.remove('show');
        }

        // Add user message to chat
        addMessage(message, true);
        
        // Disable input and button while processing
        userInput.disabled = true;
        sendBtn.disabled = true;
        
        // Add loading indicator
        const loadingMessage = addMessage("Typing", false);
        loadingMessage.classList.add('bot-typing');
        
        try {
            // Clear input field
            userInput.value = '';
            
            const response = await fetch('http://127.0.0.1:5000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            const result = await response.json();

            // Remove loading message
            loadingMessage.remove();

            if (result.success) {
                // Always show the bot's reply first
                addMessage(result.reply);

                if (result.type === 'complaint') {
                    // Add a small delay before showing follow-up messages
                    setTimeout(() => {                        
                        // Show form with smooth animation
                        complaintForm.style.display = 'block';
                        requestAnimationFrame(() => {
                            complaintForm.classList.add('show');
                        });
                        
                        // Pre-fill complaint field
                        document.getElementById('complaint').value = message;
                        
                        // Smooth scroll to form
                        complaintForm.scrollIntoView({ 
                            behavior: 'smooth',
                            block: 'start' 
                        });
                    }, 800);
                }
            } else {
                addMessage("I apologize, but I couldn't process your request. Could you please rephrase that?");
            }
        } catch (error) {
            console.error('Error:', error);
            loadingMessage.remove();
            addMessage("I apologize for the inconvenience. There seems to be a connection issue. Please try again.");
        } finally {
            // Re-enable input and button
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    }

    sendBtn.addEventListener('click', handleUserInput);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserInput();
        }
    });

    // Voice Input Functionality
    const voiceInputBtn = document.createElement('button');
    voiceInputBtn.id = 'voice-input-btn';
    voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    voiceInputBtn.classList.add('btn'); // Add the same class as the send button for consistent styling
    voiceInputBtn.style.marginRight = '10px'; // Add spacing between the voice button and the send button

    const chatInputContainer = document.querySelector('.chat-input');
    chatInputContainer.insertBefore(voiceInputBtn, document.getElementById('send-btn'));

    let recognition;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onstart = () => {
            console.log('Voice recognition started...');
            voiceInputBtn.classList.add('recording'); // Add a class to indicate recording
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('Voice input:', transcript);
            userInput.value = transcript; // Place the text in the chat input field
            userInput.focus();
            userInput.select(); // Select the text so the user can edit or delete it
        };

        recognition.onend = () => {
            console.log('Voice recognition ended.');
            voiceInputBtn.classList.remove('recording'); // Remove the recording indicator
        };

        recognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            alert('An error occurred during voice recognition. Please try again.');
            voiceInputBtn.classList.remove('recording');
        };
    } else {
        console.warn('SpeechRecognition is not supported in this browser.');
        voiceInputBtn.style.display = 'none'; // Hide the button if not supported
    }

    voiceInputBtn.addEventListener('click', () => {
        if (recognition) {
            recognition.start();
        } else {
            alert('Voice input is not supported in this browser.');
        }
    });

    // Image Upload Preview
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');

    imageUpload.addEventListener('change', () => {
        const file = imageUpload.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                imagePreview.innerHTML = '';
                imagePreview.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });

    // Submit Complaint
    async function submitComplaint() {
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const complaint = document.getElementById('complaint').value.trim();
        const address = document.getElementById('address').value.trim();
        const imageUpload = document.getElementById('image-upload');

        if (!name || !email || !phone || !complaint || !address) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }

        let imageData = null;
        if (imageUpload.files[0]) {
            const reader = new FileReader();
            imageData = await new Promise(resolve => {
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(imageUpload.files[0]);
            });
        }

        const data = { name, email, phone, complaint, address, image: imageData };

        try {
            const response = await fetch("http://127.0.0.1:5000/api/submit_complaint", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (!response.ok) {
                // Handle specific error messages from backend
                if (result.message.includes('GPS')) {
                    showNotification('Please submit an image with GPS data. Use photos taken directly from camera.', 'error');
                } else if (result.message.includes('Irrelevant image')) {
                    showNotification(result.message, 'error');
                } else {
                    showNotification(result.message || 'Failed to submit complaint', 'error');
                }
                return;
            }

            if (result.success) {
                // Update the ticket number and department in the UI
                document.getElementById('ticket-number').textContent = result.ticket_number;
                document.getElementById('assigned-department').textContent = result.department;
                
                // Hide the complaint form and show the success message
                document.getElementById('complaint-form').style.display = 'none';
                document.getElementById('submission-result').style.display = 'block';
                
                // Clear the form but keep the submission result visible
                document.getElementById('name').value = '';
                document.getElementById('email').value = '';
                document.getElementById('phone').value = '';
                document.getElementById('complaint').value = '';
                document.getElementById('address').value = '';
                imageUpload.value = '';
                document.getElementById('image-preview').innerHTML = '';
            } else {
                showNotification(result.message || 'Failed to submit complaint', 'error');
            }
        } catch (error) {
            console.error('Error submitting complaint:', error);
            showNotification('An error occurred while submitting the complaint.', 'error');
        }
    }

    document.getElementById('submit-complaint').addEventListener('click', submitComplaint);

    // Submit Another Complaint
    document.getElementById('new-complaint').addEventListener('click', () => {
        // Hide the submission result
        document.getElementById('submission-result').style.display = 'none';
        
        // Clear the form
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('complaint').value = '';
        document.getElementById('address').value = '';
        document.getElementById('image-upload').value = '';
        document.getElementById('image-preview').innerHTML = '';
        
        // Show the chat interface
        document.getElementById('complaint-form').style.display = 'none';
        
        // Reset the chat with an informative message
        const previousTicket = document.getElementById('ticket-number').textContent;
        const previousDepartment = document.getElementById('assigned-department').textContent;
        
        addMessage(`Great! Your previous grievance (Ticket: ${previousTicket}) has been successfully submitted and classified under ${previousDepartment} department. We'll keep you updated on its progress.
        
        How else can I assist you today? Feel free to share any other grievance you have, and I'll help direct it to the appropriate department.`);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Track Complaint
    const trackBtn = document.getElementById('track-btn');
    const complaintDetails = document.getElementById('complaint-details');
    const trackError = document.getElementById('track-error');

    trackBtn.addEventListener('click', async () => {
        const ticketNumber = document.getElementById('track-ticket').value.trim();

        if (!ticketNumber) {
            alert('Please enter a ticket number');
            return;
        }

        trackBtn.disabled = true;
        trackBtn.textContent = 'Tracking...';

        try {
            const response = await fetch("http://127.0.0.1:5000/api/track_complaint", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                mode: "cors",
                body: JSON.stringify({ ticket_number: ticketNumber })
            });

            const result = await response.json();

            if (result.success && result.complaint) {
                trackError.style.display = 'none';

                const complaint = result.complaint;
                const elements = {
                    'detail-ticket': complaint.ticket_number,
                    'detail-department': complaint.department,
                    'detail-description': complaint.description,
                    'detail-address': complaint.address,
                    'detail-status': complaint.status
                };

                // Update all elements safely
                Object.entries(elements).forEach(([id, value]) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = value || 'N/A';
                    }
                });

                // Update status element with class
                const statusElem = document.getElementById('detail-status');
                if (statusElem) {
                    statusElem.className = `detail-value status ${(complaint.status || '').replace(' ', '')}`;
                }

                // Update dates
                const createdDate = new Date(complaint.created_at);
                const updatedDate = new Date(complaint.updated_at);
                const dateElements = {
                    'detail-date': createdDate,
                    'detail-updated': updatedDate
                };

                Object.entries(dateElements).forEach(([id, date]) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = formatDate(date);
                    }
                });

                if (complaintDetails) {
                    complaintDetails.style.display = 'block';
                }
            } else {
                const errorMessage = document.getElementById('error-message');
                if (errorMessage) {
                    errorMessage.textContent = result.message || 'Ticket not found';
                }
                if (trackError) {
                    trackError.style.display = 'block';
                }
                if (complaintDetails) {
                    complaintDetails.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error tracking complaint:', error);
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = 'An error occurred while tracking your complaint';
            }
            if (trackError) {
                trackError.style.display = 'block';
            }
            if (complaintDetails) {
                complaintDetails.style.display = 'none';
            }
        } finally {
            if (trackBtn) {
                trackBtn.disabled = false;
                trackBtn.textContent = 'Track';
            }
        }
    });

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function formatDate(date) {
        return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function showNotification(message, type = 'info') {
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements with animation classes
    document.querySelectorAll('.message, .form-group, .detail-row').forEach(el => {
        observer.observe(el);
    });

    // Add smooth scroll behavior
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Add loading state to buttons
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function() {
            if (!this.disabled) {
                this.classList.add('loading');
                setTimeout(() => {
                    this.classList.remove('loading');
                }, 2000);
            }
        });
    });

    // Add enter key listener for tracking
    const trackTicketInput = document.getElementById('track-ticket');
    if (trackTicketInput) {
        trackTicketInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('track-btn').click();
            }
        });
    }
});



