import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { createVRMAnimationClip, VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';

/**
 * AI Wife - 3D Character Interaction App
 * メインアプリケーションクラス
 */
class AIWifeApp {
    constructor() {
        this.socket = null;
        this.sessionId = this.generateSessionId();
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        
        // Three.js関連
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.vrm = null;
        this.mixer = null;
        this.clock = new THREE.Clock();
        this.animations = new Map();
        this.currentEmotion = 'neutral';
        
        // UI要素
        this.elements = {
            hamburgerMenu: document.getElementById('hamburgerMenu'),
            sidebar: document.getElementById('sidebar'),
            closeSidebar: document.getElementById('closeSidebar'),
            mainContent: document.getElementById('mainContent'),
            characterContainer: document.getElementById('characterContainer'),
            chatMessages: document.getElementById('chatMessages'),
            textInput: document.getElementById('textInput'),
            sendButton: document.getElementById('sendButton'),
            voiceButton: document.getElementById('voiceButton'),
            voiceRecording: document.getElementById('voiceRecording'),
            stopRecording: document.getElementById('stopRecording'),
            connectionStatus: document.getElementById('connectionStatus'),
            characterMood: document.getElementById('characterMood'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            errorToast: document.getElementById('errorToast'),
            errorMessage: document.getElementById('errorMessage')
        };
        
        // 設定
        this.settings = {
            character: 'avatar.vrm',
            animation: 'animation.vrma',
            voiceActorId: null, // ★ 初期値をnullに変更
            volume: 0.7,
            voiceSpeed: 1.0,
            personality: 'friendly',
            memoryEnabled: true
        };
        
        this.init();
    }
    
    /**
     * アプリケーションの初期化
     */
    async init() {
        try {
            this.setupEventListeners();
            this.initWebSocket();
            await this.init3DScene();
            await this.loadCharacter();
            this.loadSettings();
            this.populateVoiceActors(); // ボイス選択肢を生成
            this.startRenderLoop();
            
            console.log('AI Wife App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('アプリケーションの初期化に失敗しました');
        }
    }
    
    /**
     * セッションIDの生成
     */
    generateSessionId() {
        return 'session_' + Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }
    
    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // サイドバー制御
        this.elements.hamburgerMenu.addEventListener('click', () => this.toggleSidebar());
        this.elements.closeSidebar.addEventListener('click', () => this.closeSidebar());
        
        // チャット機能
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        this.elements.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 音声機能
        this.elements.voiceButton.addEventListener('click', () => this.toggleVoiceRecording());
        this.elements.stopRecording.addEventListener('click', () => this.stopVoiceRecording());
        
        // 設定変更
        document.getElementById('characterSelect').addEventListener('change', (e) => {
            this.settings.character = e.target.value;
            this.loadCharacter();
        });
        
        document.getElementById('animationSelect').addEventListener('change', (e) => {
            this.settings.animation = e.target.value;
            this.loadAnimation();
        });

        document.getElementById('voiceActorSelect').addEventListener('change', (e) => {
            this.settings.voiceActorId = e.target.value;
        });
        
        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            this.settings.volume = e.target.value / 100;
            document.getElementById('volumeValue').textContent = e.target.value + '%';
        });
        
        document.getElementById('voiceSpeed').addEventListener('input', (e) => {
            this.settings.voiceSpeed = parseFloat(e.target.value);
            document.getElementById('voiceSpeedValue').textContent = e.target.value + 'x';
        });
        
        document.getElementById('personalitySelect').addEventListener('change', (e) => {
            this.settings.personality = e.target.value;
        });
        
        document.getElementById('memoryToggle').addEventListener('change', (e) => {
            this.settings.memoryEnabled = e.target.checked;
        });
        
        document.getElementById('resetMemory').addEventListener('click', () => {
            this.resetMemory();
        });
        
        // ウィンドウリサイズ
        window.addEventListener('resize', () => this.onWindowResize());
        
        // サイドバー外クリック
        document.addEventListener('click', (e) => {
            if (!this.elements.sidebar.contains(e.target) && 
                !this.elements.hamburgerMenu.contains(e.target) &&
                this.elements.sidebar.classList.contains('open')) {
                this.closeSidebar();
            }
        });
    }
    
    /**
     * WebSocket接続の初期化
     */
    initWebSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus('connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus('disconnected');
        });
        
        this.socket.on('message_response', (data) => {
            this.handleMessageResponse(data);
        });
        
        this.socket.on('audio_response', (data) => {
            this.handleAudioResponse(data);
        });
        
        this.socket.on('error', (data) => {
            this.showError(data.message);
            this.hideLoading();
        });
        
        this.socket.on('connected', (data) => {
            console.log('Server connected:', data.status);
        });
    }
    
    /**
     * 3Dシーンの初期化
     */
    async init3DScene() {
        // レンダラー
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.elements.characterContainer.appendChild(this.renderer.domElement);
        
        // カメラ
        this.camera = new THREE.PerspectiveCamera(30.0, window.innerWidth / window.innerHeight, 0.1, 20.0);
        this.camera.position.set(0.0, 1.0, -5.0);
        
        // カメラコントロール
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.screenSpacePanning = true;
        this.controls.target.set(0.0, 1.0, 0.0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.update();
        
        // シーン
        this.scene = new THREE.Scene();
        this.scene.background = null; // 透明背景
        
        // ライティング
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1.0, 1.0, 1.0);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // 追加のライト
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-1.0, 0.5, -1.0);
        this.scene.add(fillLight);
    }
    
    /**
     * キャラクターの読み込み
     */
    async loadCharacter() {
        try {
            this.showLoading();
            
            // 既存のVRMを削除
            if (this.vrm) {
                this.scene.remove(this.vrm.scene);
                this.vrm = null;
            }
            
            if (this.mixer) {
                this.mixer = null;
            }
            
            // GLTFローダーの設定
            const loader = new GLTFLoader();
            loader.crossOrigin = 'anonymous';
            
            loader.register((parser) => new VRMLoaderPlugin(parser));
            loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
            
            // VRMファイルの読み込み
            const gltfVrm = await loader.loadAsync(`./models/${this.settings.character}`);
            this.vrm = gltfVrm.userData.vrm;
            
            // パフォーマンス最適化
            VRMUtils.removeUnnecessaryVertices(this.vrm.scene);
            VRMUtils.removeUnnecessaryJoints(this.vrm.scene);
            
            // フラスタムカリングを無効化
            this.vrm.scene.traverse((obj) => {
                obj.frustumCulled = false;
                obj.castShadow = true;
                obj.receiveShadow = true;
            });
            
            // LookAtクォータニオンプロキシを追加
            const lookAtQuatProxy = new VRMLookAtQuaternionProxy(this.vrm.lookAt);
            lookAtQuatProxy.name = 'lookAtQuaternionProxy';
            this.vrm.scene.add(lookAtQuatProxy);
            
            // シーンに追加
            this.scene.add(this.vrm.scene);
            
            // アニメーションミキサーを作成
            this.mixer = new THREE.AnimationMixer(this.vrm.scene);
            
            // デフォルトアニメーションの読み込み
            await this.loadAnimation();
            
            this.hideLoading();
            console.log('Character loaded successfully:', this.vrm);
            
        } catch (error) {
            console.error('Failed to load character:', error);
            this.showError('キャラクターの読み込みに失敗しました');
            this.hideLoading();
        }
    }
    
    /**
     * アニメーションの読み込み
     */
    async loadAnimation() {
        try {
            if (!this.vrm || !this.mixer) return;
            
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
            
            // VRMAファイルの読み込み
            const gltfVrma = await loader.loadAsync(`./models/${this.settings.animation}`);
            const vrmAnimation = gltfVrma.userData.vrmAnimations[0];
            
            // アニメーションクリップを作成
            const clip = createVRMAnimationClip(vrmAnimation, this.vrm);
            
            // 既存のアニメーションを停止
            this.mixer.stopAllAction();
            
            // 新しいアニメーションを再生
            const action = this.mixer.clipAction(clip);
            action.play();
            
            console.log('Animation loaded:', this.settings.animation);
            
        } catch (error) {
            console.error('Failed to load animation:', error);
        }
    }
    
    /**
     * 感情に基づくアニメーション再生
     */
    playEmotionAnimation(emotion) {
        if (!this.vrm || !this.mixer) return;
        
        const emotionAnimations = {
            happy: 'taisou.vrma',
            sad: 'utu.vrma',
            surprised: 'zenshinwomiseru.vrma',
            neutral: 'animation.vrma'
        };
        
        const animationFile = emotionAnimations[emotion] || emotionAnimations.neutral;
        
        if (animationFile !== this.settings.animation) {
            this.settings.animation = animationFile;
            this.loadAnimation();
        }
        
        this.currentEmotion = emotion;
        this.updateCharacterMood(emotion);
    }
    
    /**
     * レンダリングループ
     */
    startRenderLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            
            const deltaTime = this.clock.getDelta();
            
            if (this.mixer) {
                this.mixer.update(deltaTime);
            }
            
            if (this.vrm) {
                this.vrm.update(deltaTime);
            }
            
            if (this.controls) {
                this.controls.update();
            }
            
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        
        animate();
    }
    
    /**
     * メッセージ送信
     */
    sendMessage() {
        const message = this.elements.textInput.value.trim();
        if (!message) return;
        
        this.addMessageToChat('user', message);
        this.elements.textInput.value = '';
        this.showLoading();
        
        this.socket.emit('send_message', {
            session_id: this.sessionId,
            message: message,
            voice_actor_id: this.settings.voiceActorId
        });
    }
    
    /**
     * メッセージレスポンス処理
     */
    handleMessageResponse(data) {
        console.log('[Debug] Received message response:', data); // ★ デバッグログ追加
        this.hideLoading();
        
        this.addMessageToChat('assistant', data.text);
        
        // 感情に基づくアニメーション
        if (data.emotion) {
            this.playEmotionAnimation(data.emotion);
        }
        
        // 音声再生
        if (data.audio_url) {
            this.playAudio(data.audio_url);
        }
    }
    
    /**
     * 音声レスポンス処理
     */
    handleAudioResponse(data) {
        console.log('[Debug] Received audio response:', data); // ★ デバッグログ追加
        this.hideLoading();
        
        // 認識されたテキストを表示
        if (data.transcribed_text) {
            this.addMessageToChat('user', data.transcribed_text);
        }
        
        // AI応答を表示
        this.addMessageToChat('assistant', data.response_text);
        
        // 感情に基づくアニメーション
        if (data.emotion) {
            this.playEmotionAnimation(data.emotion);
        }
        
        // 音声再生
        if (data.audio_url) {
            this.playAudio(data.audio_url);
        }
    }
    
    /**
     * チャットにメッセージを追加
     */
    addMessageToChat(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text;
        
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'message-timestamp';
        timestampDiv.textContent = new Date().toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        contentDiv.appendChild(textDiv);
        contentDiv.appendChild(timestampDiv);
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
    
    /**
     * 音声録音の開始/停止
     */
    async toggleVoiceRecording() {
        if (this.isRecording) {
            this.stopVoiceRecording();
        } else {
            await this.startVoiceRecording();
        }
    }
    
    /**
     * 音声録音開始
     */
    async startVoiceRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.sendAudioMessage(audioBlob);
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            
            this.elements.voiceButton.classList.add('recording');
            this.elements.voiceRecording.style.display = 'flex';
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showError('音声録音の開始に失敗しました');
        }
    }
    
    /**
     * 音声録音停止
     */
    stopVoiceRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            this.isRecording = false;
            this.elements.voiceButton.classList.remove('recording');
            this.elements.voiceRecording.style.display = 'none';
            
            this.showLoading();
        }
    }
    
    /**
     * 音声メッセージ送信
     */
    async sendAudioMessage(audioBlob) {
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioData = Array.from(new Uint8Array(arrayBuffer));
            
            this.socket.emit('send_audio', {
                session_id: this.sessionId,
                audio_data: audioData.map(b => b.toString(16).padStart(2, '0')).join(''),
                voice_actor_id: this.settings.voiceActorId
            });
            
        } catch (error) {
            console.error('Failed to send audio:', error);
            this.showError('音声の送信に失敗しました');
            this.hideLoading();
        }
    }
    
    /**
     * 音声再生
     */
    playAudio(audioUrl) {
        console.log('[Debug] playAudio called with URL:', audioUrl); // ★ デバッグログ追加
        try {
            if (!audioUrl) {
                console.log('[Debug] No audio URL provided. Skipping playback.'); // ★ デバッグログ追加
                return;
            }

            const audio = new Audio(audioUrl);
            console.log('[Debug] Created Audio object:', audio); // ★ デバッグログ追加

            audio.volume = this.settings.volume;
            audio.playbackRate = this.settings.voiceSpeed;
            
            console.log('[Debug] Attempting to play audio...'); // ★ デバッグログ追加
            audio.play().catch(error => {
                console.error('Failed to play audio:', error);
                this.showError('音声の再生に失敗しました。');
            });
            
        } catch (error) {
            console.error('Failed to play audio:', error);
            this.showError('音声の再生中にエラーが発生しました。');
        }
    }
    
    /**
     * にじボイスのキャラクター一覧を読み込んでUIに反映
     */
    async populateVoiceActors() {
        try {
            const response = await fetch('/api/voice-actors');
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data = await response.json();
            const selectElement = document.getElementById('voiceActorSelect');
            
            selectElement.innerHTML = '';

            if (data.voiceActors && data.voiceActors.length > 0) {
                // ★★★★★ ここからが重要 ★★★★★
                // 1. デフォルトのボイスIDを、リストの最初の有効なIDに設定する
                if (!this.settings.voiceActorId) {
                    this.settings.voiceActorId = data.voiceActors[0].id;
                    console.log(`[Debug] Default voice actor ID set to: ${this.settings.voiceActorId}`);
                }
                // ★★★★★ ここまで ★★★★★

                // Populate new options
                data.voiceActors.forEach(actor => {
                    const option = document.createElement('option');
                    option.value = actor.id;
                    option.textContent = `${actor.name} (${actor.gender}, ${actor.age}歳)`;
                    if (actor.id === this.settings.voiceActorId) {
                        option.selected = true;
                    }
                    selectElement.appendChild(option);
                });
            } else {
                 this.showError('利用可能なボイスが見つかりませんでした。');
            }
        } catch (error) {
            console.error('Failed to populate voice actors:', error);
            this.showError('ボイス一覧の取得に失敗しました');
        }
    }
    
    /**
     * サイドバーの開閉
     */
    toggleSidebar() {
        this.elements.sidebar.classList.toggle('open');
    }
    
    closeSidebar() {
        this.elements.sidebar.classList.remove('open');
    }
    
    /**
     * 接続ステータス更新
     */
    updateConnectionStatus(status) {
        const statusElement = this.elements.connectionStatus;
        const icon = statusElement.querySelector('i');
        const text = statusElement.querySelector('span');
        
        switch (status) {
            case 'connected':
                icon.className = 'fas fa-circle text-green';
                text.textContent = '接続済み';
                break;
            case 'disconnected':
                icon.className = 'fas fa-circle text-red';
                text.textContent = '切断';
                break;
            default:
                icon.className = 'fas fa-circle text-gray';
                text.textContent = '接続中...';
        }
    }
    
    /**
     * キャラクター気分更新
     */
    updateCharacterMood(emotion) {
        const moodElement = this.elements.characterMood;
        const icon = moodElement.querySelector('i');
        const text = moodElement.querySelector('span');
        
        const moods = {
            happy: { icon: 'fas fa-smile', text: '嬉しい' },
            sad: { icon: 'fas fa-frown', text: '悲しい' },
            surprised: { icon: 'fas fa-surprise', text: 'びっくり' },
            neutral: { icon: 'fas fa-meh', text: '普通' }
        };
        
        const mood = moods[emotion] || moods.neutral;
        icon.className = mood.icon;
        text.textContent = mood.text;
    }
    
    /**
     * ローディング表示
     */
    showLoading() {
        this.elements.loadingOverlay.style.display = 'flex';
    }
    
    hideLoading() {
        this.elements.loadingOverlay.style.display = 'none';
    }
    
    /**
     * エラー表示
     */
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorToast.style.display = 'flex';
        
        setTimeout(() => {
            this.hideErrorToast();
        }, 5000);
    }
    
    hideErrorToast() {
        this.elements.errorToast.style.display = 'none';
    }
    
    /**
     * ウィンドウリサイズ処理
     */
    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    /**
     * 記憶リセット
     */
    resetMemory() {
        if (confirm('記憶をリセットしますか？この操作は元に戻せません。')) {
            // IndexedDBからデータを削除
            if ('indexedDB' in window) {
                const deleteReq = indexedDB.deleteDatabase('AIWifeMemory');
                deleteReq.onsuccess = () => {
                    console.log('Memory reset successfully');
                    this.showError('記憶をリセットしました');
                };
            }
            
            // 新しいセッションIDを生成
            this.sessionId = this.generateSessionId();
            
            // チャット履歴をクリア
            this.elements.chatMessages.innerHTML = `
                <div class="message assistant-message">
                    <div class="message-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-content">
                        <div class="message-text">こんにちは！私はあなたのAI Wifeです。何かお話ししましょう！</div>
                        <div class="message-timestamp">今</div>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * 設定の読み込み
     */
    loadSettings() {
        const savedSettings = localStorage.getItem('aiWifeSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            Object.assign(this.settings, settings);
            
            // UI要素に反映
            document.getElementById('characterSelect').value = this.settings.character;
            document.getElementById('animationSelect').value = this.settings.animation;
            document.getElementById('volumeSlider').value = Math.round(this.settings.volume * 100);
            document.getElementById('volumeValue').textContent = Math.round(this.settings.volume * 100) + '%';
            document.getElementById('voiceSpeed').value = this.settings.voiceSpeed;
            document.getElementById('voiceSpeedValue').textContent = this.settings.voiceSpeed + 'x';
            document.getElementById('personalitySelect').value = this.settings.personality;
            document.getElementById('memoryToggle').checked = this.settings.memoryEnabled;
        }
    }
    
    /**
     * 設定の保存
     */
    saveSettings() {
        localStorage.setItem('aiWifeSettings', JSON.stringify(this.settings));
    }
}

// グローバル関数
window.hideErrorToast = () => {
    document.getElementById('errorToast').style.display = 'none';
};

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    window.aiWifeApp = new AIWifeApp();
});
