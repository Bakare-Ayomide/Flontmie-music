#!/usr/bin/env python3
"""
Flontmie Automated Production Deployment Script for cPanel / LiteSpeed
Deploys frontend build, PHP backend, configures .htaccess, and triggers database migrations.
"""

import os
import sys
import ftplib
import urllib.request
import urllib.parse
import json
import time

FTP_HOST = "ftp.ticketplaster.com"
FTP_PORT = 21
FTP_USER = "flontmie@ticketplaster.com"
FTP_PASS = "@f33rinimi"

TARGET_URL = "https://flontmie.ticketplaster.com"
MIGRATION_KEY = "flontmie_deploy_2026"

def ftp_connect():
    print(f"[*] Connecting to FTP server {FTP_HOST}:{FTP_PORT}...")
    ftp = ftplib.FTP()
    ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.set_pasv(True)
    print(f"[+] Connected & authenticated successfully! Current directory: {ftp.pwd()}")
    return ftp

def ensure_remote_dir(ftp, remote_dir):
    """Ensure remote directory path exists, creating parts if needed."""
    if not remote_dir or remote_dir == '.':
        return
    parts = [p for p in remote_dir.replace('\\', '/').split('/') if p]
    current = ""
    for part in parts:
        current += "/" + part
        try:
            ftp.cwd(current)
        except ftplib.error_perm:
            try:
                ftp.mkd(current)
                print(f"[+] Created remote directory: {current}")
                ftp.cwd(current)
            except Exception as e:
                print(f"[-] Could not create/enter {current}: {e}")
    ftp.cwd('/')

def upload_file(ftp, local_path, remote_path):
    remote_dir = os.path.dirname(remote_path)
    if remote_dir:
        ensure_remote_dir(ftp, remote_dir)
        ftp.cwd('/' + remote_dir.lstrip('/'))
    else:
        ftp.cwd('/')
    
    filename = os.path.basename(remote_path)
    with open(local_path, 'rb') as f:
        ftp.storbinary(f'STOR {filename}', f)
    print(f"    Uploaded: {remote_path} ({os.path.getsize(local_path)} bytes)")

def upload_dir_recursive(ftp, local_dir, remote_prefix=''):
    print(f"[*] Uploading directory: {local_dir} -> /{remote_prefix}")
    for root, dirs, files in os.walk(local_dir):
        rel_root = os.path.relpath(root, local_dir)
        if rel_root == '.':
            rem_dir = remote_prefix
        else:
            rem_dir = os.path.join(remote_prefix, rel_root).replace('\\', '/')
        
        for file in files:
            local_file = os.path.join(root, file)
            rem_file = os.path.join(rem_dir, file).replace('\\', '/') if rem_dir else file
            upload_file(ftp, local_file, rem_file)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def prepare_root_htaccess():
    content = """# BEGIN cPanel-generated php ini directives, do not edit
<IfModule php8_module>
   php_value error_log "/home/aixdqvdz/logs/php.error.log"
   php_flag log_errors On
</IfModule>
<IfModule lsapi_module>
   php_value error_log "/home/aixdqvdz/logs/php.error.log"
   php_flag log_errors On
</IfModule>
# END cPanel-generated php ini directives, do not edit

# php -- BEGIN cPanel-generated handler, do not edit
<IfModule mime_module>
  AddHandler application/x-httpd-ea-php83 .php .php8 .phtml
</IfModule>
# php -- END cPanel-generated handler, do not edit

# Flontmie Production SPA & API Routing
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Forward Authorization Header to PHP scripts
  RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

  # Never rewrite phpbackend API requests or uploads
  RewriteRule ^phpbackend/ - [L]

  # Serve existing static files and directories directly
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Fallback all client-side routes to index.html for React SPA
  RewriteRule ^ index.html [L]
</IfModule>

# Caching for static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType image/jpeg "access plus 1 month"
  ExpiresByType image/png "access plus 1 month"
  ExpiresByType image/webp "access plus 1 month"
</IfModule>
"""
    htaccess_path = os.path.join(BASE_DIR, 'dist', '.htaccess')
    with open(htaccess_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"[+] Prepared production {htaccess_path}")

def main():
    print("=== Flontmie cPanel Automated Production Deployment ===")
    prepare_root_htaccess()

    ftp = ftp_connect()

    # 1. Upload phpbackend directory
    print("\n--- Step 1: Uploading PHP Backend & APIs ---")
    upload_dir_recursive(ftp, os.path.join(BASE_DIR, 'phpbackend'), 'phpbackend')

    # 2. Upload dist frontend build
    print("\n--- Step 2: Uploading Frontend Build ---")
    upload_dir_recursive(ftp, os.path.join(BASE_DIR, 'dist'), '')

    ftp.quit()
    print("[+] All files uploaded to cPanel successfully!")

    # 3. Trigger database migrations
    print("\n--- Step 3: Triggering Live MySQL Database Migration ---")
    mig_url = f"{TARGET_URL}/phpbackend/migrate.php?key={MIGRATION_KEY}"
    print(f"[*] Calling: {mig_url}")
    try:
        req = urllib.request.Request(mig_url, headers={'User-Agent': 'FlontmieDeployer/1.0'})
        with urllib.request.urlopen(req, timeout=30) as res:
            res_data = res.read().decode('utf-8')
            print("[+] Migration response HTTP", res.getcode())
            print(res_data)
    except Exception as e:
        print(f"[-] Migration HTTP error: {e}")

    # 4. Health Check
    print("\n--- Step 4: Verifying Live Health & Database Connectivity ---")
    health_url = f"{TARGET_URL}/phpbackend/api/health.php"
    try:
        req = urllib.request.Request(health_url, headers={'User-Agent': 'FlontmieDeployer/1.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            health_data = json.loads(res.read().decode('utf-8'))
            print("[+] Health check response:")
            print(json.dumps(health_data, indent=2))
    except Exception as e:
        print(f"[-] Health check error: {e}")

    # 5. Frontend Check
    print("\n--- Step 5: Verifying Frontend Homepage ---")
    try:
        req = urllib.request.Request(TARGET_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            html = res.read().decode('utf-8')
            print(f"[+] Frontend response HTTP {res.getcode()}, length: {len(html)} bytes")
            if 'FLONTMIE' in html or '<div id="root">' in html:
                print("[+] Verified Flontmie SPA container present in HTML!")
    except Exception as e:
        print(f"[-] Frontend check error: {e}")

if __name__ == '__main__':
    main()
