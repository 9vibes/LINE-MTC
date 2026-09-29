import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function passwordMatches(password,stored){const [salt,hash]=stored.split(':');return timingSafeEqual(Buffer.from(hash,'hex'),scryptSync(password,salt,64));}
export function openStore(path,bootstrapPassword){
 mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, aircraft TEXT NOT NULL, updated_at TEXT, updated_by TEXT);
 INSERT OR IGNORE INTO state(id,revision,aircraft) VALUES(1,0,'[]');
 CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY,password TEXT NOT NULL,role TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,username TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,revision INTEGER,username TEXT,at TEXT,action TEXT);
 `);
 if(!db.prepare('SELECT username FROM users LIMIT 1').get()){
  if(!bootstrapPassword||bootstrapPassword.length<16)throw Error('Set LINE_MTC_ADMIN_PASSWORD_FILE to a file containing an initial password of at least 16 characters.');
  db.prepare('INSERT INTO users VALUES(?,?,?)').run('operator',passwordHash(bootstrapPassword),'operator');
 }
 return db;
}
