#!/usr/bin/env python3
import argparse
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT.parent / 'school-portal-data'
DB_PATH = DATA_DIR / 'portal.sqlite3'
SESSIONS = {}
SESSION_TTL = 12 * 60 * 60


def database():
    DATA_DIR.mkdir(mode=0o700, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute('CREATE TABLE IF NOT EXISTS admin (login TEXT PRIMARY KEY, salt BLOB NOT NULL, password_hash BLOB NOT NULL)')
    connection.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    connection.commit()
    return connection


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 310000)


def set_admin(login, password):
    if not login or not password:
        raise ValueError('Admin login and password are required.')
    salt = secrets.token_bytes(16)
    with database() as connection:
        connection.execute('DELETE FROM admin')
        connection.execute('INSERT INTO admin (login, salt, password_hash) VALUES (?, ?, ?)', (login, salt, hash_password(password, salt)))


def valid_session(header):
    if not header.startswith('Bearer '):
        return False
    token = header[7:]
    expires_at = SESSIONS.get(token, 0)
    if expires_at < time.time():
        SESSIONS.pop(token, None)
        return False
    return True


class PortalHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get('Content-Length', '0'))
        if length <= 0 or length > 100_000:
            raise ValueError('Invalid request size.')
        return json.loads(self.rfile.read(length).decode('utf-8'))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/schedule':
            with database() as connection:
                row = connection.execute("SELECT value FROM settings WHERE key = 'schedule'").fetchone()
            return self.send_json(HTTPStatus.OK, {'schedule': json.loads(row['value']) if row else {}})
        if path == '/api/auth/status':
            return self.send_json(HTTPStatus.OK, {'admin': valid_session(self.headers.get('Authorization', ''))})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == '/api/login':
            try:
                payload = self.read_json()
                login = str(payload.get('login', ''))
                password = str(payload.get('password', ''))
            except (ValueError, json.JSONDecodeError):
                return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Invalid request.'})
            with database() as connection:
                admin = connection.execute('SELECT * FROM admin WHERE login = ?', (login,)).fetchone()
            if not admin or not hmac.compare_digest(hash_password(password, admin['salt']), admin['password_hash']):
                return self.send_json(HTTPStatus.UNAUTHORIZED, {'error': 'Неверный логин или пароль.'})
            token = secrets.token_urlsafe(32)
            SESSIONS[token] = time.time() + SESSION_TTL
            return self.send_json(HTTPStatus.OK, {'token': token})
        if path == '/api/logout':
            SESSIONS.pop(self.headers.get('Authorization', '')[7:], None)
            return self.send_json(HTTPStatus.OK, {'ok': True})
        return self.send_json(HTTPStatus.NOT_FOUND, {'error': 'Not found.'})

    def do_PUT(self):
        if urlparse(self.path).path != '/api/schedule':
            return self.send_json(HTTPStatus.NOT_FOUND, {'error': 'Not found.'})
        if not valid_session(self.headers.get('Authorization', '')):
            return self.send_json(HTTPStatus.UNAUTHORIZED, {'error': 'Требуется вход администратора.'})
        try:
            schedule = self.read_json().get('schedule')
            encoded = json.dumps(schedule, ensure_ascii=False)
            if not isinstance(schedule, dict) or len(encoded) > 90_000:
                raise ValueError('Invalid schedule.')
        except (ValueError, json.JSONDecodeError):
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Invalid schedule.'})
        with database() as connection:
            connection.execute("INSERT INTO settings (key, value) VALUES ('schedule', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (encoded,))
        return self.send_json(HTTPStatus.OK, {'ok': True})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--init-admin', action='store_true')
    parser.add_argument('--port', type=int, default=8082)
    args = parser.parse_args()
    if args.init_admin:
        set_admin(os.environ.get('PORTAL_ADMIN_LOGIN', ''), os.environ.get('PORTAL_ADMIN_PASSWORD', ''))
        return
    database().close()
    ThreadingHTTPServer(('127.0.0.1', args.port), PortalHandler).serve_forever()


if __name__ == '__main__':
    main()
