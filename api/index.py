import hashlib, hmac, json, os, time
from http.server import BaseHTTPRequestHandler
import psycopg

TTL = 43200
def reply(h, status, payload):
    body=json.dumps(payload,ensure_ascii=False).encode(); h.send_response(status); h.send_header('Content-Type','application/json; charset=utf-8'); h.send_header('Content-Length',str(len(body))); h.end_headers(); h.wfile.write(body)
def db(): return psycopg.connect(os.environ.get('DATABASE_URL') or os.environ.get('STORAGE_URL') or os.environ['DOTABASE_DATABASE_URL'])
def setup(c): c.execute('CREATE TABLE IF NOT EXISTS portal_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
def valid(h):
 token=h.headers.get('Authorization','').removeprefix('Bearer ')
 try:
  expires,signature=token.split(':',1); expected=hmac.new(os.environ.get('ADMIN_PASSWORD','').encode(),expires.encode(),hashlib.sha256).hexdigest()
  return float(expires)>time.time() and hmac.compare_digest(signature,expected)
 except Exception: return False
class handler(BaseHTTPRequestHandler):
 def read(self): return json.loads(self.rfile.read(int(self.headers.get('Content-Length',0)) or 0))
 def do_GET(self):
  if self.path not in ['/api/schedule','/api/teachers']: return reply(self,404,{'error':'Not found'})
  try:
   key='schedule' if self.path=='/api/schedule' else 'teachers'
   with db() as c: setup(c); row=c.execute("SELECT value FROM portal_settings WHERE key=%s",(key,)).fetchone()
   reply(self,200,{key:json.loads(row[0]) if row else ({ } if key=='schedule' else [])})
  except Exception: reply(self,500,{'error':'Database is not configured'})
 def do_POST(self):
  if self.path=='/api/site-access':
   try: data=self.read()
   except Exception: return reply(self,400,{'error':'Invalid request'})
   if hmac.compare_digest(str(data.get('password','')),os.environ.get('SITE_PASSWORD','')): return reply(self,200,{'ok':True})
   return reply(self,401,{'error':'Неверный пароль.'})
  if self.path!='/api/login': return reply(self,404,{'error':'Not found'})
  try: data=self.read()
  except Exception: return reply(self,400,{'error':'Invalid request'})
  if not hmac.compare_digest(str(data.get('login','')),os.environ.get('ADMIN_LOGIN','')) or not hmac.compare_digest(str(data.get('password','')),os.environ.get('ADMIN_PASSWORD','')): return reply(self,401,{'error':'Неверный логин или пароль.'})
  expires=str(time.time()+TTL); token=expires+':'+hmac.new(os.environ.get('ADMIN_PASSWORD','').encode(),expires.encode(),hashlib.sha256).hexdigest(); reply(self,200,{'token':token})
 def do_PUT(self):
  if self.path not in ['/api/schedule','/api/teachers']: return reply(self,404,{'error':'Not found'})
  if not valid(self): return reply(self,401,{'error':'Требуется вход администратора.'})
  try:
   key='schedule' if self.path=='/api/schedule' else 'teachers'; value=self.read().get(key); encoded=json.dumps(value,ensure_ascii=False)
   if (key=='schedule' and not isinstance(value,dict)) or (key=='teachers' and not isinstance(value,list)) or len(encoded)>90000: raise ValueError()
   with db() as c: setup(c); c.execute("INSERT INTO portal_settings (key,value) VALUES (%s,%s) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",(key,encoded))
   reply(self,200,{'ok':True})
  except Exception: reply(self,400,{'error':'Не удалось сохранить расписание.'})
