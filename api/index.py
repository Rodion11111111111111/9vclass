import hmac, json, os, secrets, time
from http.server import BaseHTTPRequestHandler
import psycopg

SESSIONS, TTL = {}, 43200
def reply(h, status, payload):
    body=json.dumps(payload,ensure_ascii=False).encode(); h.send_response(status); h.send_header('Content-Type','application/json; charset=utf-8'); h.send_header('Content-Length',str(len(body))); h.end_headers(); h.wfile.write(body)
def db(): return psycopg.connect(os.environ['DATABASE_URL'])
def setup(c): c.execute('CREATE TABLE IF NOT EXISTS portal_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
def valid(h): return SESSIONS.get(h.headers.get('Authorization','').removeprefix('Bearer '),0)>time.time()
class handler(BaseHTTPRequestHandler):
 def read(self): return json.loads(self.rfile.read(int(self.headers.get('Content-Length',0)) or 0))
 def do_GET(self):
  if self.path!='/api/schedule': return reply(self,404,{'error':'Not found'})
  try:
   with db() as c: setup(c); row=c.execute("SELECT value FROM portal_settings WHERE key='schedule'").fetchone()
   reply(self,200,{'schedule':json.loads(row[0]) if row else {}})
  except Exception: reply(self,500,{'error':'Database is not configured'})
 def do_POST(self):
  if self.path!='/api/login': return reply(self,404,{'error':'Not found'})
  try: data=self.read()
  except Exception: return reply(self,400,{'error':'Invalid request'})
  if not hmac.compare_digest(str(data.get('login','')),os.environ.get('ADMIN_LOGIN','')) or not hmac.compare_digest(str(data.get('password','')),os.environ.get('ADMIN_PASSWORD','')): return reply(self,401,{'error':'Неверный логин или пароль.'})
  token=secrets.token_urlsafe(32); SESSIONS[token]=time.time()+TTL; reply(self,200,{'token':token})
 def do_PUT(self):
  if self.path!='/api/schedule': return reply(self,404,{'error':'Not found'})
  if not valid(self): return reply(self,401,{'error':'Требуется вход администратора.'})
  try:
   schedule=self.read().get('schedule'); encoded=json.dumps(schedule,ensure_ascii=False)
   if not isinstance(schedule,dict) or len(encoded)>90000: raise ValueError()
   with db() as c: setup(c); c.execute("INSERT INTO portal_settings (key,value) VALUES ('schedule',%s) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",(encoded,))
   reply(self,200,{'ok':True})
  except Exception: reply(self,400,{'error':'Не удалось сохранить расписание.'})
