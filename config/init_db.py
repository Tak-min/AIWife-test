import sqlite3
import os
from datetime import datetime

def init_database(db_path):
    """
    SQLiteデータベースを初期化し、必要なテーブルを作成します
    現在のAI Wife アプリケーションで実際に使用されるテーブルのみを定義
    """
    # ディレクトリが存在しない場合は作成
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 会話履歴テーブル（実際に使用中）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            emotion TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # インデックスを作成
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_session_timestamp 
        ON conversations (session_id, timestamp)
    ''')
    
    # ユーザー情報テーブル（実際に使用中）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_info (
            session_id TEXT PRIMARY KEY,
            name TEXT,
            preferences TEXT,
            context_data TEXT,
            last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    
    print(f"Database initialized successfully at: {db_path}")

def create_sample_data(db_path):
    """
    サンプルデータを作成（開発用）
    現在のアプリ構造に合わせて修正
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # サンプル会話データ
    sample_session = "sample_session_001"
    
    conversations = [
        (sample_session, 'user', 'こんにちは', 'neutral'),
        (sample_session, 'assistant', 'こんにちは！お会いできて嬉しいです！', 'happy'),
        (sample_session, 'user', 'あなたの名前は何ですか？', 'curious'),
        (sample_session, 'assistant', '私はユイです。よろしくお願いします♪', 'friendly')
    ]
    
    for conv in conversations:
        cursor.execute('''
            INSERT INTO conversations (session_id, role, content, emotion)
            VALUES (?, ?, ?, ?)
        ''', conv)
    
    # サンプルユーザー情報
    cursor.execute('''
        INSERT OR REPLACE INTO user_info (session_id, name, preferences, context_data)
        VALUES (?, ?, ?, ?)
    ''', (sample_session, 'サンプルユーザー', 'アニメ、ゲーム、AI技術', '初回ユーザー'))
    
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
