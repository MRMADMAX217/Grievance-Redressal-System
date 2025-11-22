# How to Run the Grievance Redressal System

## ✅ Current Status

**Backend:** ✅ Running on port 5001  
**Frontend:** ✅ Open in browser  
**Database:** ✅ Connected  

---

## 🚀 Quick Start Guide

### Backend is Already Running!
The backend is currently running on `http://localhost:5001`

To check if it's running:
```powershell
# You should see the Python process
Get-Process python
```

To view logs in real-time:
```powershell
Get-Content app.log -Wait -Tail 50
```

---

## 🌐 Frontend Access

### User Interface (Complaint Submission)
**Already Open!** Or manually open:
- **File:** `f:\MAIN\Greviance Redressal system\user\index.html`
- **URL:** `file:///f:/MAIN/Greviance%20Redressal%20system/user/index.html`

**Features:**
- 💬 Chat with GrieveBuddy AI
- 📝 Submit complaints with images
- 🔍 Track complaint status
- 📍 Automatic GPS location extraction from images

### Admin Panel (Complaint Management)
**To Open:**
- **File:** `f:\MAIN\Greviance Redressal system\admin\index.html`
- **URL:** `file:///f:/MAIN/Greviance%20Redressal%20system/admin/index.html`

**Default Admin Credentials:**
You'll need to create an admin user in the database first. See below.

---

## 📋 Step-by-Step Usage

### For Users (Complaint Submission):

1. **Open User Interface** (Already done!)
   - The page should show "GrieveBuddy" chatbot

2. **Chat with the Bot**
   - Type a message like "Hello" or "I have a complaint"
   - The bot will guide you

3. **Submit a Complaint**
   - Click "File a Complaint" button
   - Fill in your details:
     - Name
     - Email
     - Phone
     - Complaint description
     - Address
     - Upload image (optional, but needed for GPS)

4. **Track Your Complaint**
   - Click "Track Complaint"
   - Enter your ticket number (e.g., TKT-ABC12345)
   - View status and details

### For Admins (Complaint Management):

1. **Create Admin User First**
   ```sql
   -- Connect to MySQL and run:
   USE grievance_db;
   
   -- Create an admin user
   INSERT INTO admins (username, password, department_id) 
   VALUES ('admin', 'admin123', NULL);
   
   -- Or create department-specific admin
   INSERT INTO admins (username, password, department_id) 
   VALUES ('electrical_admin', 'password123', 4);
   ```

2. **Open Admin Panel**
   - Navigate to `admin/index.html`
   - Login with your credentials

3. **Manage Complaints**
   - View all complaints
   - Filter by department/status
   - Update complaint status
   - View detailed complaint information

---

## 🔧 Configuration

### Backend Port
Currently running on: **5001**

To change the port:
1. Edit `backendflask.py` line 895:
   ```python
   app.run(debug=True, host='0.0.0.0', port=5001)  # Change 5001 to your port
   ```

2. Update frontend files:
   ```powershell
   # Update user frontend
   (Get-Content "user\script.js") -replace '5001', 'YOUR_NEW_PORT' | Set-Content "user\script.js"
   
   # Update admin frontend
   (Get-Content "admin\script.js") -replace '5001', 'YOUR_NEW_PORT' | Set-Content "admin\script.js"
   ```

3. Restart the backend

### Database Configuration
Edit `backendflask.py` lines 66-71:
```python
db_config = {
    "host": "localhost",
    "user": "root",
    "password": "root",
    "database": "grievance_db"
}
```

---

## 🛠️ Common Tasks

### Start Backend (if not running)
```powershell
cd "f:\MAIN\Greviance Redressal system"
python backendflask.py
```

### Stop Backend
Press `Ctrl+C` in the terminal running the backend

### Restart Backend
1. Stop it (Ctrl+C)
2. Start it again:
   ```powershell
   python backendflask.py
   ```

### View Logs
```powershell
# Real-time logs
Get-Content app.log -Wait -Tail 50

# Last 100 lines
Get-Content app.log -Tail 100

# Search for errors
Select-String -Path app.log -Pattern "ERROR"
```

### Open User Frontend
```powershell
# Open in default browser
Start-Process "user\index.html"
```

### Open Admin Frontend
```powershell
# Open in default browser
Start-Process "admin\index.html"
```

---

## 📊 Testing the System

### Test 1: Chat Functionality
1. Open user frontend
2. Type "Hello" in the chat
3. Should get a response from GrieveBuddy

### Test 2: Submit Complaint
1. Click "File a Complaint"
2. Fill in all fields
3. Upload an image with GPS data (optional)
4. Submit
5. Note the ticket number (e.g., TKT-ABC12345)

### Test 3: Track Complaint
1. Click "Track Complaint"
2. Enter the ticket number from Test 2
3. View complaint details

### Test 4: Admin Login
1. Open admin panel
2. Login with admin credentials
3. View complaints dashboard

---

## ⚠️ Known Issues

### Issue 1: API Quota Exceeded
**Symptom:** Chat returns "API Quota Exceeded" message

**Cause:** Google Gemini API rate limit reached

**Solution:**
- Wait for quota to reset (hourly/daily)
- Or use a different API key
- Fallback responses will still work

### Issue 2: Image Upload Fails
**Symptom:** "No GPS data found in image"

**Cause:** Image doesn't have GPS EXIF data

**Solution:**
- Use an image taken with a smartphone with location enabled
- Or manually enter address in the form

### Issue 3: Database Connection Error
**Symptom:** "Database connection failed"

**Cause:** MySQL not running or wrong credentials

**Solution:**
1. Start MySQL service
2. Verify credentials in `backendflask.py`

---

## 🎯 Quick Commands Cheat Sheet

```powershell
# Start backend
python backendflask.py

# View logs
Get-Content app.log -Wait -Tail 50

# Open user frontend
Start-Process "user\index.html"

# Open admin frontend
Start-Process "admin\index.html"

# Check if backend is running
Get-Process python

# Stop backend (in the terminal running it)
# Press Ctrl+C

# Update port in frontend files
(Get-Content "user\script.js") -replace '5001', 'NEW_PORT' | Set-Content "user\script.js"
(Get-Content "admin\script.js") -replace '5001', 'NEW_PORT' | Set-Content "admin\script.js"
```

---

## 📞 API Endpoints

All endpoints are available at `http://localhost:5001/api/`

### User Endpoints:
- `POST /api/chat` - Chat with AI
- `POST /api/submit_complaint` - Submit complaint
- `POST /api/track_complaint` - Track complaint

### Admin Endpoints:
- `POST /api/admin/login` - Admin login
- `GET /api/admin/complaints` - Get all complaints
- `POST /api/admin/update_status` - Update complaint status
- `GET /api/admin/departments` - Get departments
- `GET /api/admin/complaints/<id>` - Get complaint details
- `GET /api/admin/reports` - Get statistics
- `GET /api/admin/session` - Validate session
- `POST /api/admin/logout` - Logout

---

## ✅ Everything is Ready!

**Backend:** Running on port 5001 ✅  
**User Frontend:** Open in browser ✅  
**Admin Frontend:** Ready to open ✅  
**Logging:** Active and working ✅  

**You can now:**
1. Chat with GrieveBuddy in the open browser window
2. Submit complaints
3. Track complaints
4. Open admin panel to manage complaints

**Enjoy using the Grievance Redressal System!** 🎉
