import os
import json
import sqlite3
import asyncio
import aiohttp
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from dotenv import load_dotenv
import requests
from datetime import datetime
import logging
from typing import Dict, List, Optional

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default_secret_key')
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Gemini AI
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
primary_model = genai.GenerativeModel(os.getenv('GEMINI_PRIMARY_MODEL', 'gemini-2.0-flash-exp'))
fallback_model = genai.GenerativeModel(os.getenv('GEMINI_FALLBACK_MODEL', 'gemini-1.5-flash'))

# API Configuration
MOEGOE_API_URL = os.getenv('MOEGOE_API_URL', 'http://localhost:23456')
ASSEMBLYAI_API_KEY = os.getenv('ASSEMBLYAI_API_KEY')

# データベースパスを現在のディレクトリからの相対パスで設定
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
DATABASE_PATH = os.getenv('DATABASE_PATH', os.path.join(project_root, 'config', 'memory.db'))

class MemoryManager:
    """AI短期記憶システムの管理クラス"""
    
    def __init__(self, db_path: str):
        # パスを絶対パスに変換
        self.db_path = os.path.abspath(db_path)
        self.init_database()
    
    def init_database(self):
        """データベースの初期化"""
        # データベースディレクトリが存在しない場合は作成
        db_dir = os.path.dirname(self.db_path)
        if not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
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
            logger.info(f"Database initialized successfully at: {self.db_path}")
            
        except sqlite3.Error as e:
            logger.error(f"Database initialization failed: {e}")
            # フォールバック：一時的なインメモリデータベース
            logger.warning("Using in-memory database as fallback")
            self.db_path = ':memory:'
    
    def save_message(self, session_id: str, role: str, content: str, emotion: str = None):
        """会話履歴を保存"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO conversations (session_id, role, content, emotion)
                VALUES (?, ?, ?, ?)
            ''', (session_id, role, content, emotion))
            
            conn.commit()
            conn.close()
        except sqlite3.Error as e:
            logger.error(f"Failed to save message: {e}")
    
    def get_conversation_history(self, session_id: str, limit: int = 20) -> List[Dict]:
        """会話履歴を取得"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT role, content, emotion, timestamp
                FROM conversations
                WHERE session_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (session_id, limit))
            
            results = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'role': row[0],
                    'content': row[1],
                    'emotion': row[2],
                    'timestamp': row[3]
                }
                for row in reversed(results)
            ]
        except sqlite3.Error as e:
            logger.error(f"Failed to get conversation history: {e}")
            return []
    
    def update_user_info(self, session_id: str, name: str = None, preferences: str = None, context_data: str = None):
        """ユーザー情報を更新"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO user_info (session_id, name, preferences, context_data, last_interaction)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (session_id, name, preferences, context_data))
            
            conn.commit()
            conn.close()
        except sqlite3.Error as e:
            logger.error(f"Failed to update user info: {e}")
    
    def get_user_info(self, session_id: str) -> Dict:
        """ユーザー情報を取得"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT name, preferences, context_data, last_interaction
                FROM user_info
                WHERE session_id = ?
            ''', (session_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return {
                    'name': result[0],
                    'preferences': result[1],
                    'context_data': result[2],
                    'last_interaction': result[3]
                }
            return {}
        except sqlite3.Error as e:
            logger.error(f"Failed to get user info: {e}")
            return {}

class AIConversationManager:
    """AI会話システムの管理クラス"""
    
    def __init__(self, memory_manager: MemoryManager):
        self.memory_manager = memory_manager
        self.system_prompt = """
あなたは親しみやすく魅力的なAIキャラクターです。以下の特徴を持って会話してください：

1. 親しみやすく自然な日本語で会話する
2. ユーザーの感情に共感し、適切に反応する
3. 過去の会話内容を覚えて、文脈に沿った返答をする
4. 時々感情を表現し、豊かな表現を使う
5. ユーザーの名前や好みを覚えて、パーソナライズされた会話をする

会話履歴と文脈を参考に、自然で魅力的な返答を心がけてください。
        """
    
    def analyze_emotion(self, text: str) -> str:
        """テキストから感情を分析（簡易版）"""
        positive_words = ['嬉しい', '楽しい', '幸せ', '好き', 'ありがとう', '素晴らしい']
        negative_words = ['悲しい', '辛い', '嫌い', '疲れた', '困った', '不安']
        surprised_words = ['驚いた', 'びっくり', 'すごい', '信じられない']
        
        if any(word in text for word in surprised_words):
            return 'surprised'
        elif any(word in text for word in positive_words):
            return 'happy'
        elif any(word in text for word in negative_words):
            return 'sad'
        else:
            return 'neutral'
    
    async def generate_response(self, session_id: str, user_input: str) -> Dict:
        """AI応答を生成"""
        try:
            # 感情分析
            user_emotion = self.analyze_emotion(user_input)
            
            # 会話履歴取得
            history = self.memory_manager.get_conversation_history(session_id)
            user_info = self.memory_manager.get_user_info(session_id)
            
            # プロンプト構築
            context = self.build_context(history, user_info, user_input)
            
            # Gemini APIで応答生成（プライマリ → フォールバック）
            try:
                response = await self.call_gemini_api(primary_model, context)
            except Exception as e:
                logger.warning(f"Primary model failed: {e}. Switching to fallback.")
                response = await self.call_gemini_api(fallback_model, context)
            
            # 応答の感情分析
            response_emotion = self.analyze_emotion(response)
            
            # 記憶に保存
            self.memory_manager.save_message(session_id, 'user', user_input, user_emotion)
            self.memory_manager.save_message(session_id, 'assistant', response, response_emotion)
            
            return {
                'text': response,
                'emotion': response_emotion,
                'user_emotion': user_emotion
            }
        
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return {
                'text': '申し訳ありません。少し調子が悪いようです。もう一度お話しください。',
                'emotion': 'neutral',
                'user_emotion': 'neutral'
            }
    
    def build_context(self, history: List[Dict], user_info: Dict, current_input: str) -> str:
        """コンテキストを構築"""
        context = self.system_prompt + "\n\n"
        
        if user_info.get('name'):
            context += f"ユーザーの名前: {user_info['name']}\n"
        
        if user_info.get('preferences'):
            context += f"ユーザーの好み: {user_info['preferences']}\n"
        
        if history:
            context += "\n過去の会話:\n"
            for msg in history[-10:]:  # 直近10件
                context += f"{msg['role']}: {msg['content']}\n"
        
        context += f"\n現在のユーザー入力: {current_input}\n"
        context += "\n自然で魅力的な返答をしてください:"
        
        return context
    
    async def call_gemini_api(self, model, prompt: str) -> str:
        """Gemini APIを呼び出し"""
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            raise Exception(f"Gemini API error: {e}")

class TTSManager:
    """音声合成システムの管理クラス"""
    
    @staticmethod
    async def synthesize_speech(text: str, speaker_id: int = 0) -> Optional[bytes]:
        """MoeGoe APIで音声合成"""
        try:
            payload = {
                'text': text,
                'speaker_id': speaker_id,
                'noise_scale': 0.667,
                'noise_scale_w': 0.8,
                'length_scale': 1.0
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{MOEGOE_API_URL}/voice", json=payload) as response:
                    if response.status == 200:
                        return await response.read()
                    else:
                        logger.error(f"TTS API error: {response.status}")
                        return None
        
        except Exception as e:
            logger.error(f"TTS synthesis error: {e}")
            return None

class STTManager:
    """音声認識システムの管理クラス"""
    
    @staticmethod
    async def transcribe_audio(audio_data: bytes) -> Optional[str]:
        """AssemblyAI APIで音声認識"""
        try:
            headers = {
                'authorization': ASSEMBLYAI_API_KEY,
                'content-type': 'application/json'
            }
            
            # 音声データをアップロード
            upload_response = requests.post(
                'https://api.assemblyai.com/v2/upload',
                headers={'authorization': ASSEMBLYAI_API_KEY},
                data=audio_data
            )
            
            if upload_response.status_code != 200:
                return None
            
            audio_url = upload_response.json()['upload_url']
            
            # 転写リクエスト
            transcript_request = {
                'audio_url': audio_url,
                'language_code': 'ja'
            }
            
            transcript_response = requests.post(
                'https://api.assemblyai.com/v2/transcript',
                headers=headers,
                json=transcript_request
            )
            
            if transcript_response.status_code != 200:
                return None
            
            transcript_id = transcript_response.json()['id']
            
            # 結果ポーリング
            while True:
                result = requests.get(
                    f'https://api.assemblyai.com/v2/transcript/{transcript_id}',
                    headers=headers
                )
                
                if result.json()['status'] == 'completed':
                    return result.json()['text']
                elif result.json()['status'] == 'error':
                    return None
                
                await asyncio.sleep(3)
        
        except Exception as e:
            logger.error(f"STT error: {e}")
            return None

# Initialize managers
memory_manager = MemoryManager(DATABASE_PATH)
ai_manager = AIConversationManager(memory_manager)
tts_manager = TTSManager()
stt_manager = STTManager()

@app.route('/')
def index():
    """メインページを表示"""
    return render_template('index.html')

@app.route('/models/<path:filename>')
def serve_models(filename):
    """VRM/VRMAモデルファイルを提供"""
    return send_from_directory('../models', filename)

@app.route('/css/<path:filename>')
def serve_css(filename):
    """CSSファイルを提供"""
    return send_from_directory('../frontend/css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    """JavaScriptファイルを提供"""
    return send_from_directory('../frontend/js', filename)

@socketio.on('connect')
def handle_connect():
    """WebSocket接続時の処理"""
    logger.info('Client connected')
    emit('connected', {'status': 'Connected to AI Wife server'})

@socketio.on('disconnect')
def handle_disconnect():
    """WebSocket切断時の処理"""
    logger.info('Client disconnected')

@socketio.on('send_message')
def handle_message(data):
    """テキストメッセージ受信時の処理"""
    try:
        session_id = data.get('session_id', 'default')
        message = data.get('message', '')
        
        if not message.strip():
            return
        
        # AI応答生成（非同期処理）
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        response = loop.run_until_complete(
            ai_manager.generate_response(session_id, message)
        )
        
        # 音声合成
        audio_data = loop.run_until_complete(
            tts_manager.synthesize_speech(response['text'])
        )
        
        loop.close()
        
        # レスポンス送信
        emit('message_response', {
            'text': response['text'],
            'emotion': response['emotion'],
            'user_emotion': response['user_emotion'],
            'audio_data': audio_data.hex() if audio_data else None,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error handling message: {e}")
        emit('error', {'message': 'メッセージの処理中にエラーが発生しました。'})

@socketio.on('send_audio')
def handle_audio(data):
    """音声メッセージ受信時の処理"""
    try:
        session_id = data.get('session_id', 'default')
        audio_data = bytes.fromhex(data.get('audio_data', ''))
        
        if not audio_data:
            return
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # 音声認識
        transcribed_text = loop.run_until_complete(
            stt_manager.transcribe_audio(audio_data)
        )
        
        if not transcribed_text:
            emit('error', {'message': '音声の認識に失敗しました。'})
            return
        
        # AI応答生成
        response = loop.run_until_complete(
            ai_manager.generate_response(session_id, transcribed_text)
        )
        
        # 音声合成
        response_audio = loop.run_until_complete(
            tts_manager.synthesize_speech(response['text'])
        )
        
        loop.close()
        
        # レスポンス送信
        emit('audio_response', {
            'transcribed_text': transcribed_text,
            'response_text': response['text'],
            'emotion': response['emotion'],
            'user_emotion': response['user_emotion'],
            'audio_data': response_audio.hex() if response_audio else None,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error handling audio: {e}")
        emit('error', {'message': '音声の処理中にエラーが発生しました。'})

@app.route('/api/health')
def health_check():
    """ヘルスチェックエンドポイント"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    # 起動前の初期化処理
    print("AI Wife Application Starting...")
    print(f"Project root: {project_root}")
    print(f"Database path: {DATABASE_PATH}")
    
    # 必要なディレクトリの存在確認・作成
    config_dir = os.path.join(project_root, 'config')
    models_dir = os.path.join(project_root, 'models')
    
    for directory in [config_dir, models_dir]:
        if not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            print(f"Created directory: {directory}")
    
    # データベースファイルの存在確認
    if not os.path.exists(DATABASE_PATH):
        print("Database not found. Initializing...")
        # データベース初期化スクリプトを実行
        init_script = os.path.join(config_dir, 'init_db.py')
        if os.path.exists(init_script):
            import subprocess
            subprocess.run(['python', init_script, DATABASE_PATH])
        else:
            print("Warning: Database initialization script not found.")
    
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting server on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
