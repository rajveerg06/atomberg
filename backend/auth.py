# JWT Authentication Middleware for Supabase Auth
# Matches file: backend/auth.py

from functools import wraps
from flask import request, jsonify, g
import jwt
from config import Config

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
        
        parts = auth_header.split()
        if parts[0].lower() != "bearer" or len(parts) != 2:
            return jsonify({"error": "Authorization header must be Bearer token"}), 401
        
        token = parts[1]
        try:
            # Supabase signs JWTs with the HS256 algorithm and the JWT Secret
            # The default audience is 'authenticated'
            payload = jwt.decode(
                token,
                Config.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
            
            # Store user details in Flask application context global 'g'
            g.user_id = payload.get("sub")
            g.user_email = payload.get("email")
            
            if not g.user_id:
                return jsonify({"error": "Invalid token payload: missing sub"}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401
            
        return f(*args, **kwargs)
    return decorated
