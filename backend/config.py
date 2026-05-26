# Flask Configuration File
# Matches file: backend/config.py

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
    SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")
    
    # Gmail SMTP Configurations
    GMAIL_USER = os.environ.get("GMAIL_USER")
    GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
    
    # Flask settings
    PORT = int(os.environ.get("PORT", 5000))
    DEBUG = os.environ.get("FLASK_ENV") == "development"

    @classmethod
    def validate(cls):
        required_vars = [
            "SUPABASE_URL",
            "SUPABASE_SERVICE_KEY",
            "SUPABASE_JWT_SECRET",
            "GMAIL_USER",
            "GMAIL_APP_PASSWORD"
        ]
        missing = [var for var in required_vars if not getattr(cls, var)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
