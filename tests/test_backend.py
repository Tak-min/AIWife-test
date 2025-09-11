import pytest
import asyncio
import json
import tempfile
import os
from unittest.mock import Mock, patch, AsyncMock
from backend.app import MemoryManager, AIConversationManager, TTSManager, STTManager

class TestMemoryManager:
    """メモリ管理システムのテスト"""
    
    def setup_method(self):
        """テスト前の準備"""
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_db.close()
        self.memory_manager = MemoryManager(self.temp_db.name)
    
    def teardown_method(self):
        """テスト後のクリーンアップ"""
        os.unlink(self.temp_db.name)
    
    def test_save_and_get_conversation_history(self):
        """会話履歴の保存と取得をテスト"""
        session_id = "test_session"
        
        # メッセージを保存
        self.memory_manager.save_message(session_id, "user", "こんにちは", "neutral")
        self.memory_manager.save_message(session_id, "assistant", "こんにちは！", "happy")
        
        # 履歴を取得
        history = self.memory_manager.get_conversation_history(session_id)
        
        assert len(history) == 2
        assert history[0]['role'] == 'user'
        assert history[0]['content'] == 'こんにちは'
        assert history[0]['emotion'] == 'neutral'
        assert history[1]['role'] == 'assistant'
        assert history[1]['content'] == 'こんにちは！'
        assert history[1]['emotion'] == 'happy'
    
    def test_update_and_get_user_info(self):
        """ユーザー情報の更新と取得をテスト"""
        session_id = "test_session"
        
        # ユーザー情報を更新
        self.memory_manager.update_user_info(
            session_id, 
            name="テストユーザー", 
            preferences="アニメ", 
            context_data="初回訪問"
        )
        
        # ユーザー情報を取得
        user_info = self.memory_manager.get_user_info(session_id)
        
        assert user_info['name'] == 'テストユーザー'
        assert user_info['preferences'] == 'アニメ'
        assert user_info['context_data'] == '初回訪問'
    
    def test_conversation_history_limit(self):
        """会話履歴の制限をテスト"""
        session_id = "test_session"
        
        # 25件のメッセージを保存
        for i in range(25):
            self.memory_manager.save_message(session_id, "user", f"メッセージ{i}", "neutral")
        
        # 制限（20件）を指定して取得
        history = self.memory_manager.get_conversation_history(session_id, limit=20)
        
        assert len(history) == 20
        # 最新の20件が取得されることを確認
        assert history[-1]['content'] == 'メッセージ24'

class TestAIConversationManager:
    """AI会話システムのテスト"""
    
    def setup_method(self):
        """テスト前の準備"""
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_db.close()
        self.memory_manager = MemoryManager(self.temp_db.name)
        self.ai_manager = AIConversationManager(self.memory_manager)
    
    def teardown_method(self):
        """テスト後のクリーンアップ"""
        os.unlink(self.temp_db.name)
    
    def test_analyze_emotion(self):
        """感情分析のテスト"""
        # ポジティブな感情
        assert self.ai_manager.analyze_emotion("嬉しいです") == "happy"
        assert self.ai_manager.analyze_emotion("楽しい時間でした") == "happy"
        
        # ネガティブな感情
        assert self.ai_manager.analyze_emotion("悲しいです") == "sad"
        assert self.ai_manager.analyze_emotion("疲れました") == "sad"
        
        # 驚きの感情
        assert self.ai_manager.analyze_emotion("びっくりしました") == "surprised"
        assert self.ai_manager.analyze_emotion("すごいですね") == "surprised"
        
        # ニュートラル
        assert self.ai_manager.analyze_emotion("今日は晴れです") == "neutral"
    
    def test_build_context(self):
        """コンテキスト構築のテスト"""
        history = [
            {'role': 'user', 'content': 'こんにちは', 'emotion': 'neutral'},
            {'role': 'assistant', 'content': 'こんにちは！', 'emotion': 'happy'}
        ]
        
        user_info = {
            'name': 'テストユーザー',
            'preferences': 'アニメ'
        }
        
        context = self.ai_manager.build_context(history, user_info, "元気ですか？")
        
        assert 'テストユーザー' in context
        assert 'アニメ' in context
        assert 'こんにちは' in context
        assert '元気ですか？' in context
    
    @patch('backend.app.genai')
    async def test_generate_response_success(self, mock_genai):
        """正常な応答生成のテスト"""
        # Gemini APIのモック
        mock_model = Mock()
        mock_model.generate_content.return_value.text = "元気です！"
        mock_genai.GenerativeModel.return_value = mock_model
        
        session_id = "test_session"
        user_input = "元気ですか？"
        
        response = await self.ai_manager.generate_response(session_id, user_input)
        
        assert response['text'] == "元気です！"
        assert 'emotion' in response
        assert 'user_emotion' in response
    
    @patch('backend.app.genai')
    async def test_generate_response_with_fallback(self, mock_genai):
        """フォールバック機能のテスト"""
        # プライマリモデルは失敗、フォールバックは成功
        primary_model = Mock()
        primary_model.generate_content.side_effect = Exception("API Error")
        
        fallback_model = Mock()
        fallback_model.generate_content.return_value.text = "フォールバック応答"
        
        mock_genai.GenerativeModel.side_effect = [primary_model, fallback_model]
        
        session_id = "test_session"
        user_input = "テスト"
        
        response = await self.ai_manager.generate_response(session_id, user_input)
        
        assert response['text'] == "フォールバック応答"

class TestTTSManager:
    """音声合成システムのテスト"""
    
    @patch('aiohttp.ClientSession.post')
    async def test_synthesize_speech_success(self, mock_post):
        """正常な音声合成のテスト"""
        # レスポンスのモック
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.read.return_value = b'fake_audio_data'
        mock_post.return_value.__aenter__.return_value = mock_response
        
        result = await TTSManager.synthesize_speech("こんにちは")
        
        assert result == b'fake_audio_data'
    
    @patch('aiohttp.ClientSession.post')
    async def test_synthesize_speech_error(self, mock_post):
        """音声合成エラーのテスト"""
        # エラーレスポンスのモック
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_post.return_value.__aenter__.return_value = mock_response
        
        result = await TTSManager.synthesize_speech("こんにちは")
        
        assert result is None

class TestSTTManager:
    """音声認識システムのテスト"""
    
    @patch('requests.post')
    @patch('requests.get')
    async def test_transcribe_audio_success(self, mock_get, mock_post):
        """正常な音声認識のテスト"""
        # アップロードレスポンス
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {'upload_url': 'http://example.com/audio'}
        
        # 転写リクエストレスポンス
        transcript_response = Mock()
        transcript_response.status_code = 200
        transcript_response.json.return_value = {'id': 'transcript_123'}
        
        # 結果取得レスポンス
        result_response = Mock()
        result_response.json.return_value = {'status': 'completed', 'text': '音声認識結果'}
        
        mock_post.side_effect = [mock_post.return_value, transcript_response]
        mock_get.return_value = result_response
        
        result = await STTManager.transcribe_audio(b'fake_audio_data')
        
        assert result == '音声認識結果'
    
    @patch('requests.post')
    async def test_transcribe_audio_upload_error(self, mock_post):
        """音声アップロードエラーのテスト"""
        mock_post.return_value.status_code = 400
        
        result = await STTManager.transcribe_audio(b'fake_audio_data')
        
        assert result is None

# 統合テスト
class TestIntegration:
    """統合テストクラス"""
    
    def setup_method(self):
        """テスト前の準備"""
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_db.close()
    
    def teardown_method(self):
        """テスト後のクリーンアップ"""
        os.unlink(self.temp_db.name)
    
    @patch('backend.app.genai')
    async def test_full_conversation_flow(self, mock_genai):
        """完全な会話フローのテスト"""
        # AIレスポンスのモック
        mock_model = Mock()
        mock_model.generate_content.return_value.text = "こんにちは！お会いできて嬉しいです。"
        mock_genai.GenerativeModel.return_value = mock_model
        
        # システム初期化
        memory_manager = MemoryManager(self.temp_db.name)
        ai_manager = AIConversationManager(memory_manager)
        
        session_id = "integration_test_session"
        
        # 最初の会話
        response1 = await ai_manager.generate_response(session_id, "こんにちは")
        assert response1['text'] == "こんにちは！お会いできて嬉しいです。"
        
        # 履歴確認
        history = memory_manager.get_conversation_history(session_id)
        assert len(history) == 2  # ユーザーメッセージ + アシスタントメッセージ
        
        # 2回目の会話（履歴を含む）
        mock_model.generate_content.return_value.text = "はい、覚えています！"
        response2 = await ai_manager.generate_response(session_id, "さっきの話覚えてる？")
        
        # 履歴が更新されていることを確認
        history = memory_manager.get_conversation_history(session_id)
        assert len(history) == 4  # 2往復の会話

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
