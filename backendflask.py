from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import mysql.connector
import base64
import os
import uuid
import json
from datetime import datetime
import requests
from PIL import Image
import io
import clip
import torch
from geopy.geocoders import Nominatim
import warnings
import traceback
import logging
import google.generativeai as genai
from PIL.ExifTags import TAGS, GPSTAGS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    filename='app.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s [%(funcName)s]: %(message)s'
)

# Also log to console
console = logging.StreamHandler()
console.setLevel(logging.INFO)
formatter = logging.Formatter('%(levelname)s: %(message)s')
console.setFormatter(formatter)
logging.getLogger('').addHandler(console)

logging.info("="*60)
logging.info("STARTING GRIEVANCE REDRESSAL BACKEND")
logging.info("="*60)

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev_secret_key')

# Configure session
# Configure session
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 3600
# app.config['SESSION_COOKIE_DOMAIN'] = None # Let Flask handle this automatically

# Configure CORS
CORS(app,
    supports_credentials=True,
    resources={
        r"/*": {
            "origins": ["http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5501", "http://localhost:5501", "null"], # Add null for file:// access
            "allow_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "supports_credentials": True,
            "expose_headers": ["Content-Type", "Set-Cookie"]
        }
    }
)

# Database Configuration
db_config = {
    "host": os.getenv('DB_HOST', 'localhost'),
    "user": os.getenv('DB_USER', 'root'),
    "password": os.getenv('DB_PASSWORD', 'root'),
    "database": os.getenv('DB_NAME', 'grievance_db')
}

# Gemini API Configuration
logging.info("Configuring Gemini API...")
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# Load CLIP model
logging.info("Loading CLIP model...")
try:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logging.info(f"Using device: {device}")
    model, preprocess = clip.load("ViT-B/32", device=device)
    logging.info("CLIP model loaded successfully")
except Exception as e:
    logging.error(f"Failed to load CLIP model: {str(e)}")
    logging.error(traceback.format_exc())

# Initialize database
def init_db():
    logging.info("Initializing database...")
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        logging.info("Database connection established")
        
        # Create departments table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS departments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE
        )
        """)
        
        # Create complaints table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_number VARCHAR(20) NOT NULL UNIQUE,
            user_id INT NOT NULL,
            department_id INT NOT NULL,
            description TEXT NOT NULL,
            address TEXT NOT NULL,
            status ENUM('Pending', 'In Progress', 'Resolved') DEFAULT 'Pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            image_path VARCHAR(255),
            FOREIGN KEY (department_id) REFERENCES departments(id)
        )
        """)
        
        # Create users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL UNIQUE,
            phone VARCHAR(20)
        )
        """)
        
        # Create admins table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            department_id INT,
            FOREIGN KEY (department_id) REFERENCES departments(id)
        )
        """)
        
        # Insert default departments
        departments = [
            "Administration", "Civil", "Education", "Electrical", "Finance",
            "Health & Sanitation", "HR", "IT", "Maintenance", "Public Safety",
            "Road & Transport", "Security", "Waste Management", "Water"
        ]
        
        for dept in departments:
            try:
                cursor.execute("INSERT INTO departments (name) VALUES (%s)", (dept,))
                logging.debug(f"Inserted department: {dept}")
            except mysql.connector.errors.IntegrityError:
                logging.debug(f"Department already exists: {dept}")
                pass
        
        conn.commit()
        cursor.close()
        conn.close()
        logging.info("Database initialized successfully")
    except Exception as e:
        logging.error(f"Database initialization failed: {str(e)}")
        logging.error(traceback.format_exc())
        raise

# Initialize database on startup
init_db()

def extract_location_from_image(image_data):
    """Extract GPS location from image EXIF data"""
    logging.debug("Extracting location from image...")
    
    def extract_gps_data(image):
        try:
            exif_data = image._getexif()
            if not exif_data:
                logging.debug("No EXIF data found in image")
                return None, None

            gps_info = {}
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag == "GPSInfo":
                    for key in value:
                        sub_tag = GPSTAGS.get(key, key)
                        gps_info[sub_tag] = value[key]

            if not gps_info:
                logging.debug("No GPS info found in EXIF data")
                return None, None

            if 'GPSLatitude' in gps_info and 'GPSLongitude' in gps_info:
                lat = convert_to_decimal(gps_info['GPSLatitude'], gps_info.get('GPSLatitudeRef'))
                lon = convert_to_decimal(gps_info['GPSLongitude'], gps_info.get('GPSLongitudeRef'))
                return lat, lon
            return None, None
        except Exception as e:
            logging.error(f"Error extracting GPS data: {str(e)}")
            return None, None

    def convert_to_decimal(dms, ref):
        try:
            def to_float(val):
                try:
                    return val[0] / val[1]
                except TypeError:
                    return float(val)

            degrees = to_float(dms[0])
            minutes = to_float(dms[1])
            seconds = to_float(dms[2])

            decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)

            if ref in ['S', 'W']:
                decimal = -decimal
            return decimal
        except Exception as e:
            logging.error(f"Error converting coordinates: {str(e)}")
            return None

    def reverse_geocode(lat, lon):
        try:
            geolocator = Nominatim(user_agent="geoapi")
            location = geolocator.reverse((lat, lon), exactly_one=True, timeout=10)
            return location.address if location else "Address not found."
        except Exception as e:
            logging.error(f"Error in reverse geocoding: {str(e)}")
            return None

    try:
        if not image_data:
            return {'error': 'Image is required with GPS data'}

        image_bytes = base64.b64decode(image_data.split(',')[1])
        img = Image.open(io.BytesIO(image_bytes))

        latitude, longitude = extract_gps_data(img)
        
        if latitude is not None and longitude is not None:
            logging.info(f"GPS coordinates found: {latitude}, {longitude}")
            address = reverse_geocode(latitude, longitude)
            if not address:
                return {'error': 'Could not extract address from GPS coordinates'}
            return {
                'latitude': latitude,
                'longitude': longitude,
                'address': address
            }
        else:
            return {'error': 'No GPS data found in image. Please submit an image with GPS location data.'}

    except Exception as e:
        logging.error(f"Error in extract_location_from_image: {str(e)}")
        return {'error': 'Invalid image format or corrupted image data'}

def verify_image_relevance(image_data, complaint_text):
    """Verify image relevance using CLIP"""
    logging.debug("Verifying image relevance...")
    try:
        if not image_data:
            return True, 1.0
            
        image_bytes = base64.b64decode(image_data.split(',')[1])
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        image_input = preprocess(image).unsqueeze(0).to(device)
        text = clip.tokenize([complaint_text]).to(device)
        
        with torch.no_grad():
            image_features = model.encode_image(image_input)
            text_features = model.encode_text(text)
            
            image_features /= image_features.norm(dim=-1, keepdim=True)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            
            similarity = (100.0 * image_features @ text_features.T).item()
            
            logging.info(f"Image similarity score: {similarity:.2f}%")
            
            if similarity <= 25.0:
                return False, f"Irrelevant image attached. Similarity score: {similarity:.2f}%. Please upload a relevant image."
            return True, similarity

    except Exception as e:
        logging.error(f"Error in image verification: {str(e)}")
        return False, "Error processing image relevance"

def classify_complaint(complaint_text):
    """Classify complaint using Gemini API"""
    logging.info(f"Classifying complaint: {complaint_text[:100]}...")
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")

        analysis_prompt = f"""As an AI complaint classifier, analyze this message and determine if it's a valid government service complaint:

    Message: {complaint_text}

    First determine if this is a valid complaint about government services/infrastructure with a confidence threshold of 0.7.
    If not confident or not a clear government service complaint, respond with "out_of_scope".
    
    If it is a valid complaint, which are related to one of these departments below, classify it into one of the following departments:
    Administration, Civil, Education, Electrical, Finance, Health & Sanitation,
    HR, IT, Maintenance, Public Safety, Road & Transport, Security, Waste Management, Water

    Consider:
    1. Is this specifically about government/public services?
    2. Does it mention concrete infrastructure/service problems?
    3. Is there enough context to confidently classify it?
    4. Which department would be most appropriate to handle this issue?

    Respond with ONLY ONE WORD: either "out_of_scope" or the department name."""

        response = model.generate_content(analysis_prompt)
        classified_dept = response.text.strip()
        logging.info(f"AI classified complaint as: {classified_dept}")

        if classified_dept.lower() == "out_of_scope" or not classified_dept:
            logging.info("Complaint classified as out of scope")
            return "out_of_scope"

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM departments WHERE name = %s", (classified_dept,))
        dept = cursor.fetchone()
        cursor.close()
        conn.close()

        if not dept:
            logging.warning(f"Classified department '{classified_dept}' not found in database")
            return "out_of_scope"

        logging.info(f"Complaint successfully classified to department: {classified_dept}")
        return classified_dept
    except Exception as e:
        logging.error(f"Error in classify_complaint: {str(e)}")
        logging.error(traceback.format_exc())
        return "out_of_scope"

@app.route('/api/submit_complaint', methods=['POST'])
def submit_complaint():
    logging.info("="*60)
    logging.info("SUBMIT COMPLAINT REQUEST")
    logging.info("="*60)
    try:
        data = request.json
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        description = data.get('complaint')
        form_address = data.get('address')
        image_data = data.get('image')
        
        logging.info(f"Complaint from: {name} ({email})")
        logging.info(f"Description: {description[:100]}...")

        ticket_number = f"TKT-{uuid.uuid4().hex[:8].upper()}"
        logging.info(f"Generated ticket number: {ticket_number}")

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        
        if not user:
            cursor.execute("""
                INSERT INTO users (name, email, phone)
                VALUES (%s, %s, %s)
            """, (name, email, phone))
            user_id = cursor.lastrowid
            logging.info(f"Created new user with ID: {user_id}")
        else:
            user_id = user[0]
            logging.info(f"Found existing user with ID: {user_id}")

        image_path = None
        final_address = form_address

        if image_data:
            logging.info("Processing image data...")
            location_data = extract_location_from_image(image_data)
            if location_data.get('error'):
                logging.warning(f"GPS extraction error: {location_data.get('error')}")
                return jsonify({
                    "success": False,
                    "message": location_data.get('error')
                }), 400
            
            final_address = location_data['address']
            logging.info(f"Extracted address from image: {final_address}")

            is_relevant, result = verify_image_relevance(image_data, description)
            if not is_relevant:
                logging.warning(f"Image relevance check failed: {result}")
                return jsonify({
                    "success": False,
                    "message": result
                }), 400
            logging.info(f"Image relevance verified. Score: {result}")

            try:
                image_bytes = base64.b64decode(image_data.split(',')[1])
                os.makedirs("uploads", exist_ok=True)
                image_path = f"uploads/{ticket_number}.jpg"
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                logging.info(f"Image saved to: {image_path}")
            except Exception as e:
                logging.error(f"Image save error: {str(e)}")
                image_path = None

        logging.info("Classifying complaint...")
        department_name = classify_complaint(description)
        
        if department_name == "out_of_scope":
            logging.warning("Complaint rejected: out of scope")
            cursor.close()
            conn.close()
            return jsonify({
                "success": False,
                "message": "The complaint topic is outside the scope of supported government services."
            }), 400

        # BUG FIX: Don't create new connection - reuse existing one where user was created
        # conn = mysql.connector.connect(**db_config)
        # cursor = conn.cursor()

        cursor.execute("SELECT id FROM departments WHERE name = %s", (department_name,))
        dept_result = cursor.fetchone()
        
        if not dept_result:
            logging.error(f"Department '{department_name}' not found in database")
            cursor.close()
            conn.close()
            return jsonify({
                "success": False,
                "message": f"Classification error: Department '{department_name}' not found."
            }), 500

        department_id = dept_result[0]
        
        logging.info(f"Inserting complaint into database for department: {department_name}")
        cursor.execute("""
            INSERT INTO complaints (ticket_number, user_id, department_id, description, address, image_path)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (ticket_number, user_id, department_id, description, final_address, image_path))

        conn.commit()
        logging.info(f"Complaint successfully saved with ticket: {ticket_number}")
        cursor.close()
        conn.close()

        logging.info("Complaint submission completed successfully")
        logging.info("="*60)
        return jsonify({
            "success": True,
            "message": "Complaint submitted successfully.",
            "ticket_number": ticket_number,
            "department": department_name
        }), 200

    except Exception as e:
        logging.error("="*60)
        logging.error(f"CRITICAL ERROR in submit_complaint: {str(e)}")
        logging.error(traceback.format_exc())
        logging.error("="*60)
        return jsonify({"success": False, "message": "An error occurred while submitting the complaint."}), 500

@app.route('/api/track_complaint', methods=['POST', 'OPTIONS'])
def track_complaint():
    logging.info("Track complaint request received")
    try:
        if request.method == "OPTIONS":
            logging.debug("Handling CORS preflight request")
            response = jsonify({"message": "CORS Preflight OK"})
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return response, 200

        if not request.is_json:
            return jsonify({"success": False, "message": "Invalid request format"}), 400

        data = request.json
        ticket_number = data.get('ticket_number')
        logging.info(f"Tracking ticket: {ticket_number}")

        if not ticket_number:
            logging.warning("Track request missing ticket number")
            return jsonify({"success": False, "message": "Ticket number is required"}), 400

        try:
            conn = mysql.connector.connect(**db_config)
            cursor = conn.cursor(dictionary=True)
        except mysql.connector.Error as db_error:
            logging.error(f"Database connection error: {db_error}")
            return jsonify({"success": False, "message": "Database connection failed"}), 500

        cursor.execute("""
            SELECT c.ticket_number, c.description, c.status, c.created_at, c.address,
                   c.updated_at, COALESCE(d.name, 'Unknown') as department
            FROM complaints c
            LEFT JOIN departments d ON c.department_id = d.id
            WHERE c.ticket_number = %s
        """, (ticket_number,))

        complaint = cursor.fetchone()
        cursor.close()
        conn.close()

        if complaint:
            logging.info(f"Found complaint for ticket: {ticket_number}")
            complaint['created_at'] = complaint['created_at'].isoformat()
            complaint['updated_at'] = complaint['updated_at'].isoformat()
            return jsonify({"success": True, "complaint": complaint})

        logging.warning(f"Ticket not found: {ticket_number}")
        return jsonify({"success": False, "message": "Ticket number not found. Please check and try again."}), 404

    except Exception as e:
        logging.error(f"Error in track_complaint: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    logging.info("Admin login attempt")
    data = request.json
    username = data.get('username')
    password = data.get('password')
    logging.info(f"Login attempt for username: {username}")

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT a.id, a.username, a.department_id, d.name AS department_name
            FROM admins a
            LEFT JOIN departments d ON a.department_id = d.id
            WHERE a.username = %s AND a.password = %s
        """, (username, password))
        
        admin = cursor.fetchone()

        if admin:
            logging.info(f"Admin login successful for: {username}")
            session['admin_id'] = admin['id']
            session['admin_username'] = admin['username']
            session['department_id'] = admin['department_id']
            session['department_name'] = admin['department_name']
            session.permanent = True
            logging.info(f"Session set: {dict(session)}")
            
            return jsonify({
                "success": True,
                "message": "Login successful",
                "username": admin['username'],
                "department_name": admin['department_name']
            })
        else:
            logging.warning(f"Failed login attempt for username: {username}")
            return jsonify({"success": False, "message": "Invalid credentials"}), 401
            
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/session', methods=['GET'])
def validate_admin_session():
    logging.info(f"Validating session. Contents: {dict(session)}")
    if 'admin_id' not in session:
        logging.warning("Session validation failed: admin_id not found")
        return jsonify({"success": False, "message": "No active session"})
        
    return jsonify({
        "success": True,
        "admin_username": session['admin_username'],
        "department_name": session['department_name']
    })

@app.route('/api/admin/complaints', methods=['GET'])
def get_all_complaints():
    logging.info("Fetching all complaints")
    logging.info(f"Request Headers: {request.headers}")
    logging.info(f"Session contents: {dict(session)}")
    if 'admin_id' not in session:
        logging.warning("Session check failed: admin_id not found in session")
        return jsonify({"success": False, "message": "Please login first"})
    
    department = request.args.get('department')
    status = request.args.get('status')
    search = request.args.get('search')
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    query = """
        SELECT c.id, c.ticket_number, c.description, c.status,
               c.created_at, c.updated_at, d.name as department,
               u.name as user_name, u.email as user_email
        FROM complaints c
        JOIN departments d ON c.department_id = d.id
        JOIN users u ON c.user_id = u.id
        WHERE 1=1
    """
    params = []
    
    if department:
        query += " AND d.name = %s"
        params.append(department)
    
    if status:
        query += " AND c.status = %s"
        params.append(status)
    
    if search:
        query += " AND (c.ticket_number LIKE %s OR u.name LIKE %s OR c.description LIKE %s)"
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern, search_pattern])
    
    query += " ORDER BY c.created_at DESC"
    
    try:
        logging.info(f"Executing query with params: {params}")
        logging.info(f"Query: {query}")
        cursor.execute(query, params)
        complaints = cursor.fetchall()
        
        logging.info(f"Raw query returned {len(complaints)} complaints")
        
        for complaint in complaints:
            complaint['created_at'] = complaint['created_at'].isoformat()
            complaint['updated_at'] = complaint['updated_at'].isoformat()
        
        logging.info(f"Found {len(complaints)} complaints (after processing)")
        logging.info(f"Returning complaints: {[c['ticket_number'] for c in complaints]}")
        return jsonify({"success": True, "complaints": complaints})
    except Exception as e:
        logging.error(f"Error fetching complaints: {str(e)}")
        return jsonify({"success": False, "message": "Error fetching complaints"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/update_status', methods=['POST'])
def update_complaint_status():
    logging.info("Update complaint status request")
    if 'admin_id' not in session:
        return jsonify({"success": False, "message": "Please login first"})
    
    data = request.json
    complaint_id = data.get('complaint_id')
    new_status = data.get('status')
    
    logging.info(f"Updating complaint {complaint_id} to status: {new_status}")
    
    if new_status not in ['Pending', 'In Progress', 'Resolved']:
        return jsonify({
            "success": False,
            "message": "Invalid status. Status must be Pending, In Progress, or Resolved."
        })
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE complaints SET status = %s WHERE id = %s",
        (new_status, complaint_id)
    )
    
    conn.commit()
    
    cursor.execute("""
        SELECT u.email, c.ticket_number
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = %s
    """, (complaint_id,))
    
    result = cursor.fetchone()
    user_email = result[0]
    ticket_number = result[1]
    
    cursor.close()
    conn.close()
    
    logging.info(f"Status updated for ticket {ticket_number}")
    
    return jsonify({
        "success": True,
        "message": f"Complaint status updated to {new_status}"
    })

@app.route('/api/admin/departments', methods=['GET'])
def get_departments():
    logging.info("Fetching departments")
    logging.info(f"Session in get_departments: {dict(session)}")
    if 'admin_id' not in session:
        logging.warning("Session check failed in get_departments")
        return jsonify({"success": False, "message": "Please login first"})

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id, name FROM departments")
        departments = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({"success": True, "departments": departments})
    except Exception as e:
        logging.error(f"Error fetching departments: {str(e)}")
        return jsonify({"success": False, "message": "Internal Server Error"})

@app.route('/api/admin/complaints/<int:complaint_id>', methods=['GET'])
def get_complaint_details(complaint_id):
    logging.info(f"Fetching complaint details for ID: {complaint_id}")
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT c.id, c.ticket_number, c.description, c.status,
                   c.created_at, c.updated_at, c.image_path,
                   c.address,
                   d.name AS department, u.name AS user_name,
                   u.email AS user_email
            FROM complaints c
            JOIN departments d ON c.department_id = d.id
            JOIN users u ON c.user_id = u.id
            WHERE c.id = %s
        """, (complaint_id,))
        complaint = cursor.fetchone()

        cursor.close()
        conn.close()

        if not complaint:
            logging.warning(f"Complaint not found: {complaint_id}")
            return jsonify({"success": False, "message": "Complaint not found"}), 404

        complaint['created_at'] = complaint['created_at'].isoformat()
        complaint['updated_at'] = complaint['updated_at'].isoformat()

        return jsonify({"success": True, "complaint": complaint})

    except Exception as e:
        logging.error(f"Error fetching complaint details: {str(e)}")
        return jsonify({"success": False, "message": "An error occurred while fetching complaint details"}), 500

@app.route('/api/chat', methods=['POST'])
def chat_with_llm():
    logging.info("="*60)
    logging.info("CHAT REQUEST")
    logging.info("="*60)
    try:
        data = request.json
        user_message = data.get('message')
        logging.info(f"User message: {user_message}")

        if not user_message:
            logging.warning("Chat request missing message")
            return jsonify({
                "success": False,
                "message": "Message is required"
            }), 400

        model = genai.GenerativeModel("gemini-2.0-flash")
        
        analysis_prompt = f"""You are GrieveBuddy, a friendly and helpful government grievance chatbot assistant.
        Analyze this user message: "{user_message}"
        
        If this appears to be a complaint about government services, respond with:
        {{
            "type": "complaint",
            "department": "[appropriate department]",
            "reply": "[your response asking for filling the form given below by the UI,
            just state him to fill it in the description]"
        }}
        
        If this is not a complaint in the scope of government services, respond with:
        {{
            "type": "out_of_scope",
            "reply": "[your response indicating it's out of scope]"
        }}

        For general queries or chat that are only greetings, farewell messages, respond with:
        {{
            "type": "casual",
            "reply": "[your helpful response]"
        }}
        
        For queries other than these, respond with:
        {{
            "type": "casual",
            "reply": "[your response indicating to ask only related to complaints/queries of government services]"
        }}
        Ensure your response is always in valid JSON format."""

        logging.info("Sending request to Gemini API...")
        response = model.generate_content(analysis_prompt)
        logging.info("Received response from Gemini API")
        
        try:
            clean_response = response.text.strip()
            if clean_response.startswith('```json'):
                clean_response = clean_response[7:-3]
            elif clean_response.startswith('```'):
                clean_response = clean_response[3:-3]
            
            try:
                result = json.loads(clean_response)
                return jsonify({
                    "success": True,
                    "type": result.get("type", "casual"),
                    "department": result.get("department", ""),
                    "reply": result.get("reply", "I apologize, but I'm having trouble understanding. Could you please rephrase that?")
                })
            except json.JSONDecodeError:
                return jsonify({
                    "success": True,
                    "type": "casual",
                    "reply": clean_response
                })
                
        except Exception as e:
            logging.error(f"Response processing error: {e}")
            return jsonify({
                "success": True,
                "type": "casual",
                "reply": "I apologize, but I'm having trouble understanding. Could you please rephrase that?"
            })

    except Exception as e:
        logging.error("="*60)
        logging.error(f"ERROR in chat_with_llm: {str(e)}")
        logging.error(traceback.format_exc())
        logging.error("="*60)
        
        return jsonify({
            "success": True,
            "type": "casual",
            "reply": "I am currently experiencing high traffic (API Quota Exceeded). Please try again later. (Fallback Mode)"
        })

@app.route('/api/admin/reports', methods=['GET'])
def get_reports():
    logging.info("Fetching reports")
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT COUNT(*) AS total_complaints,
                   SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_complaints,
                   SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_complaints,
                   SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_complaints
            FROM complaints
        """)
        statistics = cursor.fetchone()

        cursor.execute("""
            SELECT d.name AS department, COUNT(*) AS total
            FROM complaints c
            JOIN departments d ON c.department_id = d.id
            GROUP BY d.name
        """)
        chart_data = cursor.fetchall()

        cursor.execute("""
            SELECT status, COUNT(*) AS count
            FROM complaints
            GROUP BY status
        """)
        status_data = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "statistics": statistics,
            "chartData": chart_data,
            "statusData": status_data
        })

    except Exception as e:
        logging.error(f"Error fetching reports: {str(e)}")
        return jsonify({"success": False, "message": "An error occurred while fetching reports"}), 500



@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    username = session.get('admin_username', 'Unknown')
    session.clear()
    logging.info(f"Admin logout: {username}")
    return jsonify({"success": True, "message": "Logged out successfully"})

@app.route('/uploads/<path:filename>')
def serve_image(filename):
    return send_from_directory('uploads', filename)

# Serve Admin Frontend
@app.route('/admin/')
@app.route('/admin/index.html')
def serve_admin_index():
    return send_from_directory('admin', 'index.html')

@app.route('/admin/<path:filename>')
def serve_admin_static(filename):
    return send_from_directory('admin', filename)

if __name__ == '__main__':
    logging.info("="*60)
    logging.info("STARTING FLASK APPLICATION")
    logging.info("="*60)
    try:
        app.run(debug=True, host='0.0.0.0', port=5001)
    except Exception as e:
        logging.critical(f"Flask server failed to start: {str(e)}")
        logging.critical(traceback.format_exc())
