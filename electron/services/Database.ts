import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'chunkchop.db');
let db: Database.Database;

export function initDB() {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS process_analysis (
      process_name TEXT PRIMARY KEY,
      risk_level TEXT CHECK( risk_level IN ('SystemCritical', 'Safe', 'Bloat', 'Unknown', 'Critical') ),
      description TEXT,
      recommendation TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Database initialized at:', dbPath);
}

export interface AnalysisResult {
  process_name: string;
  risk_level: 'SystemCritical' | 'Safe' | 'Bloat' | 'Unknown' | 'Critical';
  description: string;
  recommendation: string;
  last_updated?: string;
}

export function getAnalysis(processName: string): AnalysisResult | undefined {
  const stmt = db.prepare('SELECT * FROM process_analysis WHERE process_name = ?');
  return stmt.get(processName) as AnalysisResult | undefined;
}

export function saveAnalysis(data: AnalysisResult) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO process_analysis (process_name, risk_level, description, recommendation, last_updated)
    VALUES (@process_name, @risk_level, @description, @recommendation, CURRENT_TIMESTAMP)
  `);
  stmt.run(data);
}
