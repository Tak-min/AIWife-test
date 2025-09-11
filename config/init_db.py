import sqlite3
import os
from datetime import datetime

def init_database(db_path):
    """
    SQLiteデータベースを初期化し、必要なテーブルを作成します
    """
    # ディレクトリが存在しない場合は作成
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 会話履歴テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            emotion TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # インデックスを別途作成
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_session_timestamp 
        ON conversations (session_id, timestamp)
    ''')
    
    # ユーザー情報テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_info (
            session_id TEXT PRIMARY KEY,
            name TEXT,
            preferences TEXT,
            context_data TEXT,
            personality TEXT DEFAULT 'friendly',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # キャラクター設定テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS character_settings (
            session_id TEXT PRIMARY KEY,
            character_model TEXT DEFAULT 'avatar.vrm',
            animation_set TEXT DEFAULT 'animation.vrma',
            voice_settings TEXT,
            volume REAL DEFAULT 0.7,
            voice_speed REAL DEFAULT 1.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 感情履歴テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS emotion_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            emotion TEXT NOT NULL,
            intensity REAL DEFAULT 1.0,
            trigger_message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # インデックスを別途作成
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_session_emotion 
        ON emotion_history (session_id, timestamp)
    ''')
    
    # システムログテーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            log_level TEXT NOT NULL CHECK (log_level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR')),
            message TEXT NOT NULL,
            component TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # インデックスを別途作成
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_timestamp 
        ON system_logs (timestamp)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_session 
        ON system_logs (session_id)
    ''')
    
    conn.commit()
    conn.close()
    
    print(f"Database initialized successfully at: {db_path}")

def create_sample_data(db_path):
    """
    サンプルデータを作成（開発用）
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # サンプル会話データ
    sample_session = "sample_session_001"
    
    conversations = [
        (sample_session, 'user', 'こんにちは', 'neutral'),
        (sample_session, 'assistant', 'こんにちは！お会いできて嬉しいです！', 'happy'),
        (sample_session, 'user', 'あなたの名前は何ですか？', 'curious'),
        (sample_session, 'assistant', '私はあなたのAI Wifeです。よろしくお願いします！', 'friendly')
    ]
    
    for conv in conversations:
        cursor.execute('''
            INSERT INTO conversations (session_id, role, content, emotion)
            VALUES (?, ?, ?, ?)
        ''', conv)
    
    # サンプルユーザー情報
    cursor.execute('''
        INSERT OR REPLACE INTO user_info (session_id, name, preferences, personality)
        VALUES (?, ?, ?, ?)
    ''', (sample_session, 'サンプルユーザー', 'アニメ、ゲーム', 'friendly'))
    
    # サンプルキャラクター設定
    cursor.execute('''
        INSERT OR REPLACE INTO character_settings (session_id, character_model, animation_set)
        VALUES (?, ?, ?)
    ''', (sample_session, 'avatar.vrm', 'animation.vrma'))
    
    conn.commit()
    conn.close()
    
    print("Sample data created successfully")

if __name__ == "__main__":
    import sys
    
    db_path = sys.argv[1] if len(sys.argv) > 1 else "./config/memory.db"
    
    print(f"Initializing database: {db_path}")
    init_database(db_path)
    
    if "--sample-data" in sys.argv:
        create_sample_data(db_path)
    
    print("Database setup complete!")
