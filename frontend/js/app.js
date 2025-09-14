import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
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
        this.css3dRenderer = null;
        this.css3dScene = null;
        this.controls = null;
        this.vrm = null;
        this.mixer = null;
        this.clock = new THREE.Clock();
        this.animations = new Map();
        this.currentEmotion = 'neutral';
        this.floor = null; // 足場
        this.backgroundMesh = null; // 背景メッシュ（180度）
        
        // 表情・ブリンク関連
        this.lastBlinkTime = 0;
        this.nextBlinkTime = 0;
        this.isBlinking = false;
        this.currentExpression = 'neutral';
        
        // リップシンク関連
        this.audioContext = null;
        this.audioAnalyser = null;
        this.audioSource = null;
        this.frequencyData = null;
        this.lipSyncWeight = 0.0;
        this.currentAudio = null;
        this.lipSyncSensitivity = 1.0; // 大きめの重みで視認性向上
        
        // 3D UI System
        this.glassPanel = null;
        this.speechBubble = null;
        this.isTyping = false;
        this.bubbleActive = false;
        
        // チャット履歴管理
        this.currentConversation = null;
        this.conversationMessages = [];
        
        // UI要素
        this.elements = {
            hamburgerMenu: document.getElementById('hamburgerMenu'),
            sidebar: document.getElementById('sidebar'),
            closeSidebar: document.getElementById('closeSidebar'),
            chatHistoryMenu: document.getElementById('chatHistoryMenu'),
            chatHistorySidebar: document.getElementById('chatHistorySidebar'),
            closeChatHistory: document.getElementById('closeChatHistory'),
            historyList: document.getElementById('historyList'),
            historySearch: document.getElementById('historySearch'),
            clearHistory: document.getElementById('clearHistory'),
            mainContent: document.getElementById('mainContent'),
            characterContainer: document.getElementById('characterContainer'),
            connectionStatus: document.getElementById('connectionStatus'),
            characterMood: document.getElementById('characterMood'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            errorToast: document.getElementById('errorToast'),
            errorMessage: document.getElementById('errorMessage')
        };
        
        // 設定
        this.settings = {
            character: 'yui.vrm', // デフォルトをユイのモデルに変更
            animation: 'animation.vrma',
            voiceId: null, // ★ voiceActorIdからvoiceIdに変更
            volume: 0.7,
            voiceSpeed: 1.0,
            personality: 'yui_natural', // デフォルトをユイに変更
            memoryEnabled: true,
            background: '', // 背景設定
            use3DUI: true // 3D UIモードを有効化
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
            await this.loadBackground();
            await this.loadCharacter();
            this.loadSettings();
            this.populateVoiceActors(); // ボイス選択肢を生成
            
            // キャラクター別のデフォルト音声を設定
            this.setCharacterDefaultVoice(this.settings.personality);
            
            this.initBlinkTimer(); // ブリンクタイマー初期化
            this.startRenderLoop();
            
            // 新しい会話セッションを開始
            this.startNewConversation();
            
            console.log('AI Wife App initialized successfully');
            
            // 初期化完了後にレイに挨拶
            setTimeout(() => {
                // this.send3DMessage('初めまして！');
            }, 2000); // 2秒後に挨拶
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('アプリケーションの初期化に失敗しました');
        }
    }
    
    /**
     * ブリンクタイマーの初期化
     */
    initBlinkTimer() {
        this.lastBlinkTime = Date.now();
        this.scheduleNextBlink();
    }
    
    /**
     * 次のブリンクをスケジュール
     */
    scheduleNextBlink() {
        // 2-6秒のランダムな間隔でブリンク
        const interval = 2000 + Math.random() * 4000;
        this.nextBlinkTime = Date.now() + interval;
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
        
        // チャット履歴関連のイベントリスナー
        this.elements.chatHistoryMenu.addEventListener('click', () => this.toggleChatHistory());
        this.elements.closeChatHistory.addEventListener('click', () => this.closeChatHistory());
        this.elements.clearHistory.addEventListener('click', () => this.clearChatHistory());
        this.elements.historySearch.addEventListener('input', (e) => this.searchChatHistory(e.target.value));
        
        // 設定変更
        document.getElementById('characterSelect').addEventListener('change', (e) => {
            this.settings.character = e.target.value;
            this.loadCharacter();
        });

        document.getElementById('voiceActorSelect').addEventListener('change', (e) => {
            this.settings.voiceId = e.target.value;
        });
        
        document.getElementById('backgroundSelect').addEventListener('change', (e) => {
            this.settings.background = e.target.value;
            this.loadBackground();
        });
        
        // ファイルアップロード機能
        document.getElementById('characterUpload').addEventListener('change', (e) => {
            this.handleCharacterUpload(e);
        });
        
        document.getElementById('backgroundUpload').addEventListener('change', (e) => {
            this.handleBackgroundUpload(e);
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
            
            // キャラクター別のデフォルト音声を設定
            this.setCharacterDefaultVoice(e.target.value);
            
            // キャラクター変更時に新しい会話セッションを開始
            this.startNewConversation();
        });
        
        document.getElementById('memoryToggle').addEventListener('change', (e) => {
            this.settings.memoryEnabled = e.target.checked;
        });
        
        document.getElementById('use3DUIToggle').addEventListener('change', (e) => {
            this.settings.use3DUI = e.target.checked;
            this.toggle3DUIMode(e.target.checked);
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
            
            // チャット履歴サイドバー外クリック
            if (!this.elements.chatHistorySidebar.contains(e.target) && 
                !this.elements.chatHistoryMenu.contains(e.target) &&
                this.elements.chatHistorySidebar.classList.contains('open')) {
                this.closeChatHistory();
            }
            
            // 最初のクリックでAudioContextを初期化
            this.initAudioContext();
        });
        
        // AudioContext初期化のための任意のインタラクション
        document.addEventListener('keydown', () => this.initAudioContext());
    }
    
    /**
     * AudioContextの初期化（ユーザーインタラクション後）
     */
    /**
     * AudioContextの初期化（ユーザーインタラクション後）
     */
    initAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext initialized for lip sync');
            } catch (error) {
                console.error('Failed to initialize AudioContext:', error);
            }
        }
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
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.zIndex = '0'; // 背景レイヤー
        this.elements.characterContainer.appendChild(this.renderer.domElement);
        
        // CSS3DRenderer for UI elements
        this.css3dRenderer = new CSS3DRenderer();
        this.css3dRenderer.setSize(window.innerWidth, window.innerHeight);
        this.css3dRenderer.domElement.style.position = 'absolute';
        this.css3dRenderer.domElement.style.top = '0';
        this.css3dRenderer.domElement.style.left = '0';
        this.css3dRenderer.domElement.style.pointerEvents = 'none';
        this.css3dRenderer.domElement.style.background = 'transparent'; // 透明背景に設定
        this.css3dRenderer.domElement.style.zIndex = '1'; // WebGLRendererより前面に
        this.css3dRenderer.domElement.className = 'css3d-container';
        this.elements.characterContainer.appendChild(this.css3dRenderer.domElement);
        
        // CSS3D Scene
        this.css3dScene = new THREE.Scene();
        
        // カメラ
        this.camera = new THREE.PerspectiveCamera(30.0, window.innerWidth / window.innerHeight, 0.1, 20.0);
        this.camera.position.set(0.0, 0.9, -3.5); // Y座標を下げて下から見上げる角度に
        
        // カメラコントロール
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.screenSpacePanning = true;
        this.controls.target.set(0.0, 0.9, 0.0); // ターゲットも少し下げて水平に近い角度に
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableRotate = false; // 回転を無効化
        this.controls.enableZoom = false; // ズームを無効化
        this.controls.enablePan = false; // パンを無効化
        this.controls.update();
        
        // シーン
        this.scene = new THREE.Scene();
        this.scene.background = null; // 透明背景
        
        // ライティング
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
        directionalLight.position.set(1.0, 1.0, 1.0);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // 追加のライト
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-1.0, 0.5, -1.0);
        this.scene.add(fillLight);
        
        // 足場（フロア）の作成
        this.createFloor();
        
        // 3D UI System 初期化
        if (this.settings.use3DUI) {
            this.init3DUISystem();
        }
    }
    
    /**
     * 足場（フロア）の作成
     */
    createFloor() {
        // 大きな平面ジオメトリを作成（x-z平面）
        const floorGeometry = new THREE.PlaneGeometry(100, 5); // 1000x1000の巨大なフロア
        
        // 半透明のマテリアル
        const floorMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        
        // フロアメッシュを作成
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        
        // 平面をx-z平面に配置（Y軸で-90度回転）
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = 0; // 地面の高さ
        
        // 影を受ける設定
        this.floor.receiveShadow = true;
        
        // シーンに追加
        this.scene.add(this.floor);
        
        console.log('Floor created');
    }

    /**
     * 3D UIシステムの初期化
     */
    init3DUISystem() {
        // ガラスパネルの作成
        this.createGlassPanel();
        
        // AR吹き出しの作成
        this.createARSpeechBubble();
        
        // 3D UIモードのスタイルを適用
        document.body.classList.add('ui-3d-mode');
        
        console.log('3D UI System initialized');
    }
    
    /**
     * ガラスパネルの作成
     */
    createGlassPanel() {
        // HTML要素の作成
        const panelElement = document.createElement('div');
        panelElement.className = 'glass-panel';
        panelElement.innerHTML = `
            <div class="glass-panel-icon">
                <i class="fas fa-comments"></i>
            </div>
            <div class="glass-panel-text">
                メッセージを送信
            </div>
            <div class="glass-panel-subtext">
                クリックして会話を始める
            </div>
        `;
        
        // CSS3Dオブジェクトとして3D空間に配置
        this.glassPanel = new CSS3DObject(panelElement);
        this.glassPanel.position.set(0.5, 1.0, -0.2); // ユーザーから見て左側に配置
        this.glassPanel.rotation.y = Math.PI + Math.PI * 0.08; // 左側なので回転を調整
        this.glassPanel.scale.set(0.002, 0.002, 0.002); // サイズを大幅に縮小
        this.css3dScene.add(this.glassPanel);
        
        // クリックイベントの設定
        panelElement.style.pointerEvents = 'auto';
        panelElement.addEventListener('click', (e) => {
            this.handleGlassPanelClick(e);
        });
        
        // ホバーアニメーション用のアイドル状態
        this.startGlassPanelAnimation();
    }
    
    /**
     * AR吹き出しの作成
     */
    createARSpeechBubble() {
        this.speechBubble = document.createElement('div');
        this.speechBubble.className = 'ar-speech-bubble';
        this.speechBubble.innerHTML = `
            <div class="ar-speech-bubble-text"></div>
        `;
        document.body.appendChild(this.speechBubble);
    }
    
    /**
     * ガラスパネルのアイドルアニメーション
     */
    startGlassPanelAnimation() {
        const animatePanel = () => {
            if (this.glassPanel) {
                const time = Date.now() * 0.001;
                this.glassPanel.position.y = 1.0 + Math.sin(time * 0.5) * 0.03; // ユーザーの設定Y=1.0を基準に
                this.glassPanel.rotation.y = Math.PI + Math.PI * 0.08 + Math.sin(time * 0.3) * 0.015; // ユーザーの回転設定に合わせる
            }
            requestAnimationFrame(animatePanel);
        };
        animatePanel();
    }
    
    /**
     * ガラスパネルクリック処理
     */
    async handleGlassPanelClick(event) {
        if (this.isTyping) return;
        
        // タッチフィードバック
        event.target.style.transform = 'scale(0.95)';
        setTimeout(() => {
            event.target.style.transform = '';
        }, 150);
        
        // テキスト入力ダイアログを表示
        const message = prompt('メッセージを入力してください:');
        if (message && message.trim()) {
            this.send3DMessage(message.trim());
        }
    }
    
    /**
     * 3D UIを使用したメッセージ送信
     */
    send3DMessage(message) {
        console.log('Sending 3D message:', message);
        console.log('Character personality:', this.settings.personality);
        this.showLoading();
        
        // ユーザーメッセージを会話履歴に追加
        this.addMessageToConversation('user', message);
        
        this.socket.emit('send_message', {
            session_id: this.sessionId,
            message: message,
            voice_id: this.settings.voiceId,
            personality: this.settings.personality // キャラクター情報を追加
        });
    }
    
    /**
     * キャラクターの頭部位置を取得
     */
    getCharacterHeadPosition() {
        if (!this.vrm) return null;
        
        // VRMキャラクターの頭部ボーンを取得
        const headBone = this.vrm.humanoid?.getBoneNode('head');
        if (!headBone) return null;
        
        const headPosition = new THREE.Vector3();
        headBone.getWorldPosition(headPosition);
        
        // 少し上に調整（吹き出し用）
        headPosition.y += 0.3;
        
        return headPosition;
    }
    
    /**
     * 3D座標をスクリーン座標に変換
     */
    worldToScreen(position) {
        if (!position || !this.camera) return { x: 0, y: 0 };
        
        const vector = position.clone();
        vector.project(this.camera);
        
        return {
            x: (vector.x * 0.5 + 0.5) * window.innerWidth,
            y: -(vector.y * 0.5 - 0.5) * window.innerHeight
        };
    }
    
    /**
     * AR吹き出しを表示
     */
    showARSpeechBubble(text) {
        if (!this.speechBubble) return;
        
        const headPosition = this.getCharacterHeadPosition();
        if (!headPosition) return;
        
        const screenPos = this.worldToScreen(headPosition);
        
        // 吹き出しの位置を設定
        this.speechBubble.style.left = `${screenPos.x}px`;
        this.speechBubble.style.top = `${screenPos.y - 60}px`;
        this.speechBubble.style.transform = 'translateX(-50%)';
        
        // テキストをタイピング効果で表示
        this.typeText(text);
    }
    
    /**
     * タイピング効果でテキストを表示
     */
    async typeText(text) {
        if (!this.speechBubble) return;
        
        this.isTyping = true;
        this.bubbleActive = true;
        
        const textElement = this.speechBubble.querySelector('.ar-speech-bubble-text');
        textElement.innerHTML = '<span class="typing-indicator"></span>';
        
        // 吹き出しを表示
        this.speechBubble.classList.add('show');
        
        // 少し待ってからタイピング開始
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // タイピング効果
        textElement.innerHTML = '';
        for (let i = 0; i <= text.length; i++) {
            textElement.textContent = text.substring(0, i);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.isTyping = false;
        
        // 5秒後に自動で非表示
        setTimeout(() => {
            this.hideARSpeechBubble();
        }, 5000);
    }
    
    /**
     * AR吹き出しを隠す
     */
    hideARSpeechBubble() {
        if (this.speechBubble) {
            this.speechBubble.classList.remove('show');
            this.bubbleActive = false;
        }
    }
    
    /**
     * 背景の読み込み
     */
    async loadBackground() {
        try {
            // 既存の背景オブジェクトを削除
            if (this.backgroundMesh) {
                this.scene.remove(this.backgroundMesh);
                this.backgroundMesh = null;
            }
            
            if (this.settings.background === 'none') {
                this.scene.background = null;
                return;
            }
            
            let textureUrl;
            
            // カスタムファイルかどうかを確認
            const backgroundSelect = document.getElementById('backgroundSelect');
            const selectedOption = backgroundSelect.querySelector(`option[value="${this.settings.background}"]`);
            
            if (selectedOption && selectedOption.dataset.localUrl) {
                // カスタムアップロードファイルの場合
                textureUrl = selectedOption.dataset.localUrl;
            } else {
                // デフォルトファイルの場合
                textureUrl = `/backgrounds/${this.settings.background}`;
            }
            
            const loader = new THREE.TextureLoader();
            const texture = await loader.loadAsync(textureUrl);
            
            // テクスチャの設定
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.encoding = THREE.sRGBEncoding;
            
            // 前方90度x90度の球体を作成（内側から見る）
            const geometry = new THREE.SphereGeometry(
                10, // 半径を大幅に拡大
                64,  // 横の分割数
                32,  // 縦の分割数
                Math.PI/4,   // 水平方向の開始角度（-45度から開始）
                Math.PI/2,   // 水平方向の角度範囲（90度）
                Math.PI/6,   // 垂直方向の開始角度（上45度から開始）
                Math.PI/2    // 垂直方向の角度範囲（90度）
            );
            
            const material = new THREE.MeshBasicMaterial({ 
                map: texture, 
                side: THREE.BackSide, // 内側から見えるように
                depthWrite: false, // 深度バッファへの書き込みを無効化
                depthTest: false   // 深度テストを無効化
            });
            
            this.backgroundMesh = new THREE.Mesh(geometry, material);
            this.backgroundMesh.position.set(0, 1.5, 0);
            this.backgroundMesh.renderOrder = -1; // 最背面に描画
            
            this.scene.add(this.backgroundMesh);
            
            // scene.backgroundはクリア
            this.scene.background = null;
            
            console.log('Background loaded (180-degree):', this.settings.background);
            
        } catch (error) {
            console.error('Failed to load background:', error);
            this.scene.background = null;
        }
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
            let modelUrl;
            
            // カスタムファイルかどうかを確認
            const characterSelect = document.getElementById('characterSelect');
            const selectedOption = characterSelect.querySelector(`option[value="${this.settings.character}"]`);
            
            if (selectedOption && selectedOption.dataset.localUrl) {
                // カスタムアップロードファイルの場合
                modelUrl = selectedOption.dataset.localUrl;
            } else {
                // デフォルトファイルの場合
                modelUrl = `./models/${this.settings.character}`;
            }
            
            const gltfVrm = await loader.loadAsync(modelUrl);
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
    playEmotionAnimation(emotion, personality = 'friendly', isTechExcited = false) {
        if (!this.vrm || !this.mixer) return;
        
        let selectedEmotion = emotion;
        
        // レイキャラクターの技術興奮時は強制的にhappyに
        if (personality === 'rei_engineer' && isTechExcited) {
            selectedEmotion = 'happy';
            console.log('[Debug] Rei tech excitement: forcing happy emotion');
        }
        
        const emotionAnimations = {
            happy: 'taisou.vrma',
            sad: 'utu.vrma',
            surprised: 'zenshinwomiseru.vrma',
            neutral: 'animation.vrma'
        };
        
        const animationFile = emotionAnimations[selectedEmotion] || emotionAnimations.neutral;
        
        if (animationFile !== this.settings.animation) {
            this.settings.animation = animationFile;
            this.loadAnimation();
        }
        
        // 表情も変更（キャラクター別強度調整）
        this.setExpression(selectedEmotion, personality, isTechExcited);
        
        this.currentEmotion = selectedEmotion;
        console.log(`[Debug] Playing emotion animation: ${selectedEmotion} for ${personality}${isTechExcited ? ' (tech excited)' : ''}`);
        
        // キャラクター情報を更新
        this.updateCharacterMood(selectedEmotion);
    }
    
    /**
     * 表情の設定 - キャラクター対応版
     */
    setExpression(emotion, personality = 'friendly', isTechExcited = false) {
        if (!this.vrm || !this.vrm.expressionManager) return;
        
        // 全ての表情をリセット（blinkも含む）
        const expressionManager = this.vrm.expressionManager;
        expressionManager.setValue('happy', 0);
        expressionManager.setValue('sad', 0);
        expressionManager.setValue('surprised', 0);
        expressionManager.setValue('angry', 0);
        expressionManager.setValue('relaxed', 0);
        expressionManager.setValue('blink', 0); // ★ blinkもリセット
        
        // ブリンク状態もリセット
        this.isBlinking = false;
        
        // 対応する表情を設定
        const expressionMap = {
            happy: 'happy',
            sad: 'sad', 
            surprised: 'surprised',
            neutral: 'relaxed'
        };
        
        const expression = expressionMap[emotion] || 'relaxed';
        
        // キャラクター別の表情強度調整
        let intensity = 1.0;
        if (expression === 'happy') {
            if (personality === 'rei_engineer' && isTechExcited) {
                // レイの技術興奮時は強めの表情
                intensity = 0.9;
            } else if (personality === 'yui_natural') {
                // ユイは優しい表情
                intensity = 0.7;
            } else {
                // 一般的には控えめ
                intensity = 0.6;
            }
        }
        
        expressionManager.setValue(expression, intensity);
        
        this.currentExpression = emotion;
        console.log(`[Debug] Expression set: ${expression} with intensity ${intensity} for ${personality}${isTechExcited ? ' (tech excited)' : ''}`);
        
        // 表情変更後、新しいブリンクをスケジュール
        this.scheduleNextBlink();
    }
    
    /**
     * ブリンクの実行
     */
    performBlink() {
        if (!this.vrm || !this.vrm.expressionManager || this.isBlinking) return;
        
        this.isBlinking = true;
        const expressionManager = this.vrm.expressionManager;
        
        // 現在の感情をチェック
        const isHappyExpression = this.currentExpression === 'happy';
        
        // ブリンクアニメーション（目を閉じる→開ける）
        const blinkDuration = 150; // ミリ秒
        const startTime = Date.now();
        
        const animateBlink = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / blinkDuration;
            
            if (progress < 0.5) {
                // 目を閉じる
                const blinkValue = progress * 2;
                // happy表情時はブリンクの強度を抑制
                const maxBlinkValue = isHappyExpression ? 0.6 : 1.0;
                expressionManager.setValue('blink', Math.min(blinkValue, maxBlinkValue));
            } else if (progress < 1.0) {
                // 目を開ける
                const blinkValue = 1.0 - (progress - 0.5) * 2;
                const maxBlinkValue = isHappyExpression ? 0.6 : 1.0;
                expressionManager.setValue('blink', Math.min(blinkValue, maxBlinkValue));
            } else {
                // ブリンク終了 - 必ず0にリセット
                expressionManager.setValue('blink', 0);
                this.isBlinking = false;
                this.scheduleNextBlink();
                console.log(`Blink completed. Current expression: ${this.currentExpression}`);
                return;
            }
            
            requestAnimationFrame(animateBlink);
        };
        
        animateBlink();
    }
    
    /**
     * ブリンクの更新（レンダリングループで呼び出し）
     */
    updateBlink() {
        if (!this.isBlinking && Date.now() >= this.nextBlinkTime) {
            this.performBlink();
        }
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
            
            // ブリンクの更新
            this.updateBlink();
            
            // リップシンクの更新
            this.updateLipSync();
            
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
            
            // CSS3D UIのレンダリング
            if (this.css3dRenderer && this.css3dScene && this.camera) {
                this.css3dRenderer.render(this.css3dScene, this.camera);
            }
            
            // AR吹き出しの位置更新
            if (this.settings.use3DUI && this.bubbleActive) {
                this.updateARSpeechBubblePosition();
            }
        };
        
        animate();
    }
    
    /**
     * AR吹き出しの位置更新
     */
    updateARSpeechBubblePosition() {
        if (!this.speechBubble || !this.bubbleActive) return;
        
        const headPosition = this.getCharacterHeadPosition();
        if (!headPosition) return;
        
        const screenPos = this.worldToScreen(headPosition);
        
        // 画面内に収まるように調整
        const bubbleWidth = 100;
        const bubbleHeight = 30;
        const padding = 10;
        
        let x = screenPos.x + 30; // 左側に少しオフセット
        let y = screenPos.y - 20;
        
        // 画面外にはみ出さないよう調整
        if (x - bubbleWidth/2 < padding) {
            x = bubbleWidth/2 + padding;
        } else if (x + bubbleWidth/2 > window.innerWidth - padding) {
            x = window.innerWidth - bubbleWidth/2 - padding;
        }
        
        if (y < padding) {
            y = padding;
        } else if (y > window.innerHeight - bubbleHeight - padding) {
            y = window.innerHeight - bubbleHeight - padding;
        }
        
        this.speechBubble.style.left = `${x}px`;
        this.speechBubble.style.top = `${y}px`;
    }
    
    /**
     * メッセージレスポンス処理（3D UI専用）- キャラクター対応版
     */
    handleMessageResponse(data) {
        console.log('[Debug] Received message response:', data);
        console.log('[Debug] Character personality:', data.personality);
        console.log('[Debug] Tech excited state:', data.is_tech_excited);
        this.hideLoading();
        
        // AIレスポンスを会話履歴に追加
        this.addMessageToConversation('assistant', data.text);
        
        // キャラクター別の音声設定を適用
        this.applyCharacterSettings(data.personality, data.is_tech_excited);
        
        // AR吹き出しで表示
        this.showARSpeechBubble(data.text);
        
        // 感情に基づくアニメーション（キャラクター別調整）
        if (data.emotion) {
            this.playEmotionAnimation(data.emotion, data.personality, data.is_tech_excited);
        }
        
        // 音声再生
        if (data.audio_data) {
            this.playAudioData(data.audio_data);
        }
    }
    
    /**
     * キャラクター別設定を適用
     */
    applyCharacterSettings(personality, isTechExcited = false) {
        const originalSpeed = this.settings.voiceSpeed;
        
        switch(personality) {
            case 'rei_engineer':
                if (isTechExcited) {
                    // 技術話題で興奮時は早口
                    this.settings.voiceSpeed = 1.3;
                    console.log('[Debug] Rei excited mode: speech speed increased to 1.3');
                } else {
                    // 普段はクールで標準速度
                    this.settings.voiceSpeed = 1.0;
                    console.log('[Debug] Rei cool mode: normal speech speed');
                }
                break;
                
            case 'yui_natural':
                // 天然女の子はゆっくり話す
                this.settings.voiceSpeed = 0.9;
                console.log('[Debug] Yui mode: slow speech speed 0.9');
                break;
                
            default:
                // デフォルト設定
                this.settings.voiceSpeed = 1.0;
                break;
        }
    }
    
    /**
     * 音声レスポンス処理
     */
    handleAudioResponse(data) {
        console.log('[Debug] Received audio response:', data); // ★ デバッグログ追加
        this.hideLoading();
        
        // 認識テキストを会話履歴に追加（ユーザーメッセージ）
        if (data.transcribed_text) {
            console.log('Transcribed:', data.transcribed_text);
            this.addMessageToConversation('user', data.transcribed_text);
        }
        
        // AIレスポンスを会話履歴に追加
        if (data.response_text) {
            this.addMessageToConversation('assistant', data.response_text);
        }
        
        // AR吹き出しで応答を表示
        this.showARSpeechBubble(data.response_text);
        
        // 感情に基づくアニメーション
        if (data.emotion) {
            this.playEmotionAnimation(data.emotion);
        }
        
        // 音声再生
        if (data.audio_data) {
            this.playAudioData(data.audio_data);
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
                voice_id: this.settings.voiceId
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
        console.log('[Debug] playAudio called with URL:', audioUrl);
        try {
            if (!audioUrl) {
                console.log('[Debug] No audio URL provided. Skipping playback.');
                return;
            }

            // プロキシURL経由で音声を取得（CORS回避）
            const proxyUrl = `http://localhost:5000/api/proxy-audio?url=${encodeURIComponent(audioUrl)}`;
            console.log('[Debug] Using proxy URL:', proxyUrl);

            const audio = new Audio(proxyUrl);
            console.log('[Debug] Created Audio object with proxy URL');

            audio.volume = this.settings.volume;
            audio.playbackRate = this.settings.voiceSpeed;

            // 音声ロード完了後にリップシンクセットアップ
            audio.addEventListener('loadeddata', () => {
                console.log('[Debug] Audio loaded successfully, setting up lip sync');
                try {
                    this.setupLipSync(audio);
                } catch (error) {
                    console.warn('Lip sync setup failed, using fallback:', error);
                    this.simulateBasicLipSync();
                }
            });

            // 音声再生開始
            audio.addEventListener('play', () => {
                console.log('[Debug] Audio playback started');
            });

            // 音声再生終了時のクリーンアップ
            audio.addEventListener('ended', () => {
                console.log('[Debug] Audio playback ended');
                this.lipSyncWeight = 0.0;
                if (this.vrm && this.vrm.expressionManager) {
                    // リップシンク関連の値をリセット
                    this.vrm.expressionManager.setValue('aa', 0);
                    this.vrm.expressionManager.setValue('ih', 0);
                    this.vrm.expressionManager.setValue('ou', 0);
                    
                    // 表情をneutralに戻す
                    setTimeout(() => {
                        this.setExpression('neutral');
                        console.log('[Debug] Expression reset to neutral after audio ended');
                    }, 500); // 0.5秒後にneutralに戻す
                }
            });

            // エラーハンドリング
            audio.addEventListener('error', (e) => {
                console.error('[Debug] Audio error:', e);
                console.log('[Debug] Falling back to basic lip sync animation');
                this.simulateBasicLipSync();
            });

            console.log('[Debug] Attempting to play audio...');
            audio.play().then(() => {
                console.log('[Debug] Audio play() promise resolved successfully');
            }).catch(error => {
                console.error('Failed to play audio:', error);
                console.log('[Debug] Using fallback lip sync animation');
                this.simulateBasicLipSync();
                this.showError('音声の再生に失敗しました。リップシンクのみ実行します。');
            });

        } catch (error) {
            console.error('Error in playAudio:', error);
            console.log('[Debug] Using fallback lip sync animation due to error');
            this.simulateBasicLipSync();
            this.showError('音声処理でエラーが発生しました。');
        }
    }
    
    /**
     * Base64エンコードされた音声データを再生
     */
    playAudioData(audioData) {
        console.log('[Debug] playAudioData called with data:', audioData ? 'Data received' : 'No data');
        try {
            if (!audioData) {
                console.log('[Debug] No audio data provided. Skipping playback.');
                return;
            }

            // Base64データから音声オブジェクトを作成
            const audio = new Audio(audioData);
            console.log('[Debug] Created Audio object from base64 data');

            audio.volume = this.settings.volume;
            audio.playbackRate = this.settings.voiceSpeed;

            // 音声ロード完了後にリップシンクセットアップ
            audio.addEventListener('loadeddata', () => {
                console.log('[Debug] Audio loaded successfully, setting up lip sync');
                try {
                    this.setupLipSync(audio);
                } catch (error) {
                    console.warn('Lip sync setup failed, using fallback:', error);
                    this.simulateBasicLipSync();
                }
            });

            // 音声再生開始
            audio.addEventListener('play', () => {
                console.log('[Debug] Audio playback started');
            });

            // 音声再生終了時のクリーンアップ
            audio.addEventListener('ended', () => {
                console.log('[Debug] Audio playback ended');
                this.lipSyncWeight = 0.0;
                if (this.vrm && this.vrm.expressionManager) {
                    // リップシンク関連の値をリセット
                    this.vrm.expressionManager.setValue('aa', 0);
                    this.vrm.expressionManager.setValue('ih', 0);
                    this.vrm.expressionManager.setValue('ou', 0);
                    
                    // 表情をneutralに戻す
                    setTimeout(() => {
                        this.setExpression('neutral');
                        console.log('[Debug] Expression reset to neutral after audio ended');
                    }, 500); // 0.5秒後にneutralに戻す
                }
            });

            // エラーハンドリング
            audio.addEventListener('error', (e) => {
                console.error('[Debug] Audio error:', e);
                console.log('[Debug] Falling back to basic lip sync animation');
                this.simulateBasicLipSync();
            });

            console.log('[Debug] Attempting to play audio...');
            audio.play().then(() => {
                console.log('[Debug] Audio play() promise resolved successfully');
            }).catch(error => {
                console.error('Failed to play audio:', error);
                console.log('[Debug] Using fallback lip sync animation');
                this.simulateBasicLipSync();
                this.showError('音声の再生に失敗しました。リップシンクのみ実行します。');
            });

        } catch (error) {
            console.error('Error in playAudioData:', error);
            console.log('[Debug] Using fallback lip sync animation due to error');
            this.simulateBasicLipSync();
            this.showError('音声処理でエラーが発生しました。');
        }
    }
    
    /**
     * リップシンクのセットアップ
     */
    setupLipSync(audio) {
        try {
            // AudioContextの初期化（ユーザーインタラクション後に実行される）
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // AudioContextの状態確認
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // 既存のaudioSourceがあれば切断
            if (this.audioSource) {
                try {
                    this.audioSource.disconnect();
                } catch (e) {
                    console.warn('Previous audio source disconnect failed:', e);
                }
            }
            
            // アナライザーの作成
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 256;
            this.audioAnalyser.smoothingTimeConstant = 0.8;
            
            // 周波数データ配列の初期化
            this.frequencyData = new Uint8Array(this.audioAnalyser.frequencyBinCount);
            
            // オーディオソースの作成（CORSエラー可能性あり）
            this.audioSource = this.audioContext.createMediaElementSource(audio);
            this.audioSource.connect(this.audioAnalyser);
            this.audioAnalyser.connect(this.audioContext.destination);
            
            this.currentAudio = audio;
            console.log('Lip sync setup completed successfully');
            
        } catch (error) {
            console.warn('Lip sync setup failed, likely due to CORS restrictions. Audio will play without lip sync:', error);
            
            // CORSエラーでリップシンクが失敗した場合のフォールバック
            this.audioSource = null;
            this.audioAnalyser = null;
            this.frequencyData = null;
            this.currentAudio = audio;
            
            // 簡易的な口の動きシミュレーション（オプション）
            this.simulateBasicLipSync(audio);
        }
    }
    
    /**
     * CORS制限時の簡易リップシンクシミュレーション
     */
    simulateBasicLipSync(audio) {
        if (!audio || !this.vrm || !this.vrm.expressionManager) return;
        
        let lipSyncInterval;
        
        const startSimulation = () => {
            lipSyncInterval = setInterval(() => {
                if (audio.paused || audio.ended) {
                    clearInterval(lipSyncInterval);
                    this.lipSyncWeight = 0.0;
                    this.updateMouthExpression();
                    return;
                }
                
                // ランダムな口の動きをシミュレート
                this.lipSyncWeight = Math.random() * 0.6 + 0.2; // 0.2-0.8の範囲
                this.updateMouthExpression();
            }, 150); // 150msごとに更新
        };
        
        const stopSimulation = () => {
            if (lipSyncInterval) {
                clearInterval(lipSyncInterval);
                this.lipSyncWeight = 0.0;
                this.updateMouthExpression();
                
                // 表情をneutralに戻す
                setTimeout(() => {
                    this.setExpression('neutral');
                    console.log('[Debug] Expression reset to neutral after lip sync simulation ended');
                }, 500); // 0.5秒後にneutralに戻す
            }
        };
        
        audio.addEventListener('play', startSimulation);
        audio.addEventListener('pause', stopSimulation);
        audio.addEventListener('ended', stopSimulation);
    }
    
    /**
     * 音声レベルを解析してリップシンクの重みを計算
     */
    updateLipSync() {
        try {
            if (!this.audioAnalyser || !this.frequencyData || !this.currentAudio || this.currentAudio.paused) {
                this.lipSyncWeight = 0.0;
                return;
            }
            
            // 周波数データを取得
            this.audioAnalyser.getByteFrequencyData(this.frequencyData);
            
            // 音声レベルを計算（低域〜中域を重視）
            let sum = 0;
            const relevantBins = Math.min(64, this.frequencyData.length); // 低域〜中域のみ
            for (let i = 0; i < relevantBins; i++) {
                sum += this.frequencyData[i];
            }
            
            const average = sum / relevantBins;
            
            // 正規化と感度調整（大きめの重みで視認性向上）
            this.lipSyncWeight = Math.min(1.0, (average / 255.0) * this.lipSyncSensitivity);
            
            // 口の表情を更新
            this.updateMouthExpression();
        } catch (error) {
            // リップシンク処理でエラーが発生した場合はスキップ
            console.warn('Lip sync update failed:', error);
            this.lipSyncWeight = 0.0;
        }
    }
    
    /**
     * 口の表情を更新（リップシンク + 感情表現）
     */
    updateMouthExpression() {
        if (!this.vrm || !this.vrm.expressionManager) return;
        
        try {
            // 基本の感情表現
            const expressions = {
                'aa': this.lipSyncWeight, // 口を開ける（あ音）
                'ih': this.lipSyncWeight * 0.7, // 口を少し開ける（い音）
                'ou': this.lipSyncWeight * 0.8, // 口を丸める（お音）
            };
            
            // 感情に応じた基本表情と組み合わせ
            if (this.currentExpression === 'happy') {
                this.vrm.expressionManager.setValue('happy', 0.8 - this.lipSyncWeight * 0.3);
            } else if (this.currentExpression === 'sad') {
                this.vrm.expressionManager.setValue('sad', 0.6 - this.lipSyncWeight * 0.2);
            }
            
            // リップシンクの適用
            Object.entries(expressions).forEach(([expression, weight]) => {
                this.vrm.expressionManager.setValue(expression, weight);
            });
            
        } catch (error) {
            console.error('Failed to update mouth expression:', error);
        }
    }
    
    /**
     * ElevenLabsの音声一覧を読み込んでUIに反映
     */
    async populateVoiceActors() {
        try {
            const response = await fetch('/api/voices');
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data = await response.json();
            const selectElement = document.getElementById('voiceActorSelect');
            
            selectElement.innerHTML = '';

            if (data.voices && data.voices.length > 0) {
                // キャラクター別のデフォルト音声がない場合のみ、APIのデフォルトを使用
                if (!this.settings.voiceId) {
                    // キャラクター別のデフォルト音声を先に試行
                    this.setCharacterDefaultVoice(this.settings.personality);
                    
                    // まだ設定されていない場合はAPIのデフォルトを使用
                    if (!this.settings.voiceId) {
                        this.settings.voiceId = data.default_voice_id || data.voices[0].id;
                        console.log(`[Debug] Fallback voice ID set to: ${this.settings.voiceId}`);
                    }
                }

                // Populate new options
                data.voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.id;
                    option.textContent = `${voice.name} (${voice.category})`;
                    if (voice.id === this.settings.voiceId) {
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
     * キャラクター別のデフォルト設定（音声・モデル）を適用
     */
    setCharacterDefaultVoice(personality) {
        const characterSettings = {
            'rei_engineer': {
                voiceId: 'cgSgspJ2msm6clMCkdW9', // Jessica
                model: 'avatar.vrm' // レイのモデル
            },
            'yui_natural': {
                voiceId: 'Xb7hH8MSUJpSbSDYk0k2', // 指定された音声ID
                model: 'yui.vrm' // ユイのモデル
            }
        };
        
        const characterConfig = characterSettings[personality];
        if (characterConfig) {
            // 音声ID設定
            this.settings.voiceId = characterConfig.voiceId;
            console.log(`[Debug] Character voice set to: ${this.settings.voiceId} for ${personality}`);
            
            // モデル設定
            const oldCharacter = this.settings.character;
            this.settings.character = characterConfig.model;
            console.log(`[Debug] Character model set to: ${this.settings.character} for ${personality}`);
            
            // 音声選択UIを更新
            const voiceSelect = document.getElementById('voiceActorSelect');
            if (voiceSelect) {
                voiceSelect.value = this.settings.voiceId;
            }
            
            // キャラクターモデル選択UIを更新
            const characterSelect = document.getElementById('characterSelect');
            if (characterSelect) {
                characterSelect.value = this.settings.character;
            }
            
            // モデルが変更された場合は再読み込み
            if (oldCharacter !== this.settings.character) {
                console.log(`[Debug] Reloading character model from ${oldCharacter} to ${this.settings.character}`);
                this.loadCharacter();
            }
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
    
    /**
     * エラートースト表示（showErrorToast関数の追加）
     */
    showErrorToast(message) {
        this.showError(message);
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
        
        // CSS3DRendererのリサイズ
        if (this.css3dRenderer) {
            this.css3dRenderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    /**
     * 3D UIモードの切り替え
     */
    toggle3DUIMode(enabled) {
        if (enabled) {
            document.body.classList.add('ui-3d-mode');
            if (!this.glassPanel) {
                this.init3DUISystem();
            }
        } else {
            document.body.classList.remove('ui-3d-mode');
            this.hideARSpeechBubble();
        }
        console.log('3D UI Mode:', enabled ? 'Enabled' : 'Disabled');
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
                    this.showErrorToast('記憶をリセットしました');
                };
                deleteReq.onerror = () => {
                    console.error('Failed to reset memory');
                    this.showErrorToast('記憶のリセットに失敗しました');
                };
            }
            
            // 会話履歴をクリア
            this.conversationMessages = [];
            
            // 新しいセッションIDを生成
            this.sessionId = this.generateSessionId();
            console.log('New session started after memory reset:', this.sessionId);
            
            // 成功メッセージ
            this.showErrorToast('記憶をリセットしました');
        }
    }

    /**
     * チャット履歴サイドバーを開閉
     */
    toggleChatHistory() {
        this.elements.chatHistorySidebar.classList.toggle('open');
        if (this.elements.chatHistorySidebar.classList.contains('open')) {
            this.loadChatHistory();
        }
    }

    /**
     * チャット履歴サイドバーを閉じる
     */
    closeChatHistory() {
        this.elements.chatHistorySidebar.classList.remove('open');
    }

    /**
     * IndexedDBからチャット履歴を読み込み
     */
    async loadChatHistory() {
        try {
            const history = await this.getChatHistoryFromDB();
            this.displayChatHistory(history);
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.showErrorToast('チャット履歴の読み込みに失敗しました');
        }
    }

    /**
     * IndexedDBからチャット履歴を取得
     */
    getChatHistoryFromDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AIWifeMemory', 2); // バージョンを2に統一
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                const db = request.result;
                
                if (!db.objectStoreNames.contains('conversations')) {
                    resolve([]);
                    return;
                }
                
                const transaction = db.transaction(['conversations'], 'readonly');
                const store = transaction.objectStore('conversations');
                const getAllRequest = store.getAll();
                
                getAllRequest.onsuccess = () => {
                    const conversations = getAllRequest.result || [];
                    // 日付順でソート（新しい順）
                    conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    resolve(conversations);
                };
                
                getAllRequest.onerror = () => reject(getAllRequest.error);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 既存のストアを削除して再作成
                if (db.objectStoreNames.contains('conversations')) {
                    db.deleteObjectStore('conversations');
                }
                
                // 新しいストアを作成
                const store = db.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('personality', 'personality', { unique: false });
                store.createIndex('sessionId', 'sessionId', { unique: false });
                
                console.log('IndexedDB schema updated for getChatHistoryFromDB');
            };
        });
    }

    /**
     * チャット履歴を表示
     */
    displayChatHistory(conversations) {
        const historyList = this.elements.historyList;
        historyList.innerHTML = '';

        if (conversations.length === 0) {
            historyList.innerHTML = `
                <div class="no-history">
                    <i class="fas fa-comments"></i>
                    <p>まだチャット履歴がありません</p>
                </div>
            `;
            return;
        }

        conversations.forEach(conversation => {
            const historyItem = this.createHistoryItem(conversation);
            historyList.appendChild(historyItem);
        });
    }

    /**
     * 履歴アイテムを作成
     */
    createHistoryItem(conversation) {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const characterName = this.getCharacterDisplayName(conversation.personality);
        const date = new Date(conversation.timestamp).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const messageCount = conversation.messages ? conversation.messages.length : 0;
        const preview = this.getConversationPreview(conversation);
        
        item.innerHTML = `
            <div class="history-item-header">
                <div class="character-name">${characterName}</div>
                <div class="chat-date">${date}</div>
            </div>
            <div class="chat-preview">${preview}</div>
            <div class="message-count">${messageCount}件</div>
        `;
        
        item.addEventListener('click', () => this.loadConversation(conversation));
        
        return item;
    }

    /**
     * キャラクター表示名を取得
     */
    getCharacterDisplayName(personality) {
        const names = {
            'rei_engineer': 'レイ (AIエンジニア)',
            'yui_natural': 'ユイ (天然な癒し系)',
            'friendly': '汎用 - 親しみやすい',
            'shy': '汎用 - 内気',
            'energetic': '汎用 - 元気',
            'calm': '汎用 - 落ち着いた'
        };
        return names[personality] || personality;
    }

    /**
     * 会話のプレビューを取得
     */
    getConversationPreview(conversation) {
        if (!conversation.messages || conversation.messages.length === 0) {
            return '会話が開始されていません';
        }
        
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        return lastMessage.text.length > 50 
            ? lastMessage.text.substring(0, 50) + '...'
            : lastMessage.text;
    }

    /**
     * 会話を読み込んで詳細表示
     */
    loadConversation(conversation) {
        console.log('Loading conversation:', conversation);
        
        // 会話詳細をモーダルで表示
        this.showConversationDetail(conversation);
    }

    /**
     * 会話詳細をモーダルで表示
     */
    showConversationDetail(conversation) {
        // 既存のモーダルがあれば削除
        const existingModal = document.getElementById('conversationModal');
        if (existingModal) {
            existingModal.remove();
        }

        // モーダルHTML作成
        const modal = document.createElement('div');
        modal.id = 'conversationModal';
        modal.className = 'conversation-modal';
        
        const characterName = this.getCharacterDisplayName(conversation.personality);
        const date = new Date(conversation.timestamp).toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let messagesHtml = '';
        if (conversation.messages && conversation.messages.length > 0) {
            messagesHtml = conversation.messages.map(msg => {
                const msgDate = new Date(msg.timestamp).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const roleClass = msg.role === 'user' ? 'user-message' : 'assistant-message';
                const roleIcon = msg.role === 'user' ? 'fas fa-user' : 'fas fa-robot';
                
                return `
                    <div class="conversation-message ${roleClass}">
                        <div class="message-avatar">
                            <i class="${roleIcon}"></i>
                        </div>
                        <div class="message-content">
                            <div class="message-text">${msg.text}</div>
                            <div class="message-timestamp">${msgDate}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            messagesHtml = '<div class="no-messages">メッセージがありません</div>';
        }

        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${characterName}との会話</h3>
                        <div class="modal-date">${date}</div>
                        <button class="modal-close" onclick="this.closest('.conversation-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="conversation-messages">
                            ${messagesHtml}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-button" onclick="this.closest('.conversation-modal').remove()">
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * チャット履歴を検索
     */
    searchChatHistory(searchTerm) {
        const historyItems = this.elements.historyList.querySelectorAll('.history-item');
        
        historyItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            const isVisible = text.includes(searchTerm.toLowerCase());
            item.style.display = isVisible ? 'block' : 'none';
        });
    }

    /**
     * チャット履歴をクリア
     */
    async clearChatHistory() {
        if (!confirm('すべてのチャット履歴を削除しますか？この操作は取り消せません。')) {
            return;
        }
        
        try {
            await this.clearChatHistoryFromDB();
            this.loadChatHistory();
            this.showErrorToast('チャット履歴をクリアしました');
        } catch (error) {
            console.error('Error clearing chat history:', error);
            this.showErrorToast('チャット履歴のクリアに失敗しました');
        }
    }

    /**
     * IndexedDBからチャット履歴を削除
     */
    clearChatHistoryFromDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AIWifeMemory', 2); // バージョンを2に統一
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                const db = request.result;
                
                if (!db.objectStoreNames.contains('conversations')) {
                    resolve();
                    return;
                }
                
                const transaction = db.transaction(['conversations'], 'readwrite');
                const store = transaction.objectStore('conversations');
                const clearRequest = store.clear();
                
                clearRequest.onsuccess = () => {
                    console.log('Chat history cleared from IndexedDB');
                    resolve();
                };
                clearRequest.onerror = () => reject(clearRequest.error);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 既存のストアを削除して再作成
                if (db.objectStoreNames.contains('conversations')) {
                    db.deleteObjectStore('conversations');
                }
                
                // 新しいストアを作成
                const store = db.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('personality', 'personality', { unique: false });
                store.createIndex('sessionId', 'sessionId', { unique: false });
                
                console.log('IndexedDB schema updated for clearChatHistoryFromDB');
            };
        });
    }

    /**
     * 会話にメッセージを追加してIndexedDBに保存
     */
    addMessageToConversation(role, text) {
        if (!this.settings.memoryEnabled) {
            return; // 記憶機能が無効の場合は保存しない
        }

        const message = {
            role: role,
            text: text,
            timestamp: new Date().toISOString()
        };

        this.conversationMessages.push(message);
        console.log('Added message to conversation:', message);

        // 定期的に会話をIndexedDBに保存（5メッセージごと、または1分間隔）
        this.scheduleConversationSave();
    }

    /**
     * 会話保存のスケジューリング
     */
    scheduleConversationSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // 1秒後に保存（連続する操作をバッチ処理）
        this.saveTimeout = setTimeout(() => {
            this.saveConversationToDB();
        }, 1000);
    }

    /**
     * 現在の会話をIndexedDBに保存
     */
    async saveConversationToDB() {
        if (this.conversationMessages.length === 0) {
            console.log('No messages to save');
            return;
        }

        try {
            const conversation = {
                personality: this.settings.personality,
                messages: [...this.conversationMessages],
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId
            };

            console.log('Saving conversation to IndexedDB:', conversation);
            await this.storeConversationInDB(conversation);
            console.log('Conversation successfully saved to IndexedDB');
        } catch (error) {
            console.error('Failed to save conversation:', error);
        }
    }

    /**
     * 会話をIndexedDBに保存
     */
    storeConversationInDB(conversation) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AIWifeMemory', 2); // バージョンを2に上げる
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['conversations'], 'readwrite');
                const store = transaction.objectStore('conversations');
                
                // セッションIDで既存の会話を検索（インデックスを使わずに全件取得して検索）
                const getAllRequest = store.getAll();
                
                getAllRequest.onsuccess = () => {
                    const allConversations = getAllRequest.result;
                    const existingConversation = allConversations.find(conv => 
                        conv.sessionId === conversation.sessionId && 
                        conv.personality === conversation.personality
                    );
                    
                    if (existingConversation) {
                        // 既存の会話を更新（同一セッション・同一キャラクターのみ）
                        existingConversation.messages = conversation.messages;
                        existingConversation.timestamp = conversation.timestamp;
                        const updateRequest = store.put(existingConversation);
                        updateRequest.onsuccess = () => {
                            console.log('Conversation updated in IndexedDB');
                            resolve(updateRequest.result);
                        };
                        updateRequest.onerror = () => reject(updateRequest.error);
                    } else {
                        // 新しい会話を追加
                        const addRequest = store.add(conversation);
                        addRequest.onsuccess = () => {
                            console.log('New conversation added to IndexedDB');
                            resolve(addRequest.result);
                        };
                        addRequest.onerror = () => reject(addRequest.error);
                    }
                };
                
                getAllRequest.onerror = () => reject(getAllRequest.error);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 既存のストアを削除して再作成
                if (db.objectStoreNames.contains('conversations')) {
                    db.deleteObjectStore('conversations');
                }
                
                // 新しいストアを作成
                const store = db.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('personality', 'personality', { unique: false });
                store.createIndex('sessionId', 'sessionId', { unique: false });
                
                console.log('IndexedDB schema updated with sessionId index');
            };
        });
    }

    /**
     * 新しい会話セッションを開始
     */
    startNewConversation() {
        // 現在の会話を保存（まだ保存されていない場合）
        if (this.conversationMessages.length > 0) {
            this.saveConversationToDB();
        }

        // 新しいセッションを開始
        this.sessionId = this.generateSessionId();
        this.conversationMessages = [];
        
        // 保存タイムアウトをクリア
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        
        console.log('Started new conversation session:', this.sessionId);
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
            document.getElementById('backgroundSelect').value = this.settings.background;
            document.getElementById('volumeSlider').value = Math.round(this.settings.volume * 100);
            document.getElementById('volumeValue').textContent = Math.round(this.settings.volume * 100) + '%';
            document.getElementById('voiceSpeed').value = this.settings.voiceSpeed;
            document.getElementById('voiceSpeedValue').textContent = this.settings.voiceSpeed + 'x';
            document.getElementById('personalitySelect').value = this.settings.personality;
            document.getElementById('memoryToggle').checked = this.settings.memoryEnabled;
            document.getElementById('use3DUIToggle').checked = this.settings.use3DUI;
        }
    }
    
    /**
     * キャラクターファイルアップロード処理
     */
    async handleCharacterUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // ファイル形式チェック
        if (!file.name.toLowerCase().endsWith('.vrm')) {
            this.showError('VRMファイルのみアップロード可能です。');
            return;
        }
        
        try {
            const statusElement = document.getElementById('characterUploadStatus');
            statusElement.textContent = 'アップロード中...';
            statusElement.className = 'upload-status';
            
            // ファイルをmodelsフォルダに保存（実際の実装では、サーバーへのアップロード処理が必要）
            const fileName = `custom_${Date.now()}_${file.name}`;
            
            // URL.createObjectURLを使用してローカルファイルを読み込み
            const fileUrl = URL.createObjectURL(file);
            
            // キャラクター選択ドロップダウンにオプションを追加
            const characterSelect = document.getElementById('characterSelect');
            const option = document.createElement('option');
            option.value = fileName;
            option.textContent = `カスタム: ${file.name}`;
            option.dataset.localUrl = fileUrl;
            characterSelect.appendChild(option);
            
            // アップロードされたファイルを選択
            characterSelect.value = fileName;
            this.settings.character = fileName;
            
            // キャラクターを読み込み
            await this.loadCustomCharacter(fileUrl);
            
            statusElement.textContent = `${file.name} をアップロードしました`;
            statusElement.className = 'upload-status success';
            
        } catch (error) {
            console.error('Character upload failed:', error);
            const statusElement = document.getElementById('characterUploadStatus');
            statusElement.textContent = 'アップロードに失敗しました';
            statusElement.className = 'upload-status error';
            this.showError('キャラクターファイルのアップロードに失敗しました。');
        }
    }
    
    /**
     * 背景ファイルアップロード処理
     */
    async handleBackgroundUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // ファイル形式チェック
        if (!file.type.startsWith('image/jpeg') && !file.type.startsWith('image/jpg')) {
            this.showError('JPEGファイルのみアップロード可能です。');
            return;
        }
        
        try {
            const statusElement = document.getElementById('backgroundUploadStatus');
            statusElement.textContent = 'アップロード中...';
            statusElement.className = 'upload-status';
            
            const fileName = `custom_${Date.now()}_${file.name}`;
            const fileUrl = URL.createObjectURL(file);
            
            // 背景選択ドロップダウンにオプションを追加
            const backgroundSelect = document.getElementById('backgroundSelect');
            const option = document.createElement('option');
            option.value = fileName;
            option.textContent = `カスタム: ${file.name}`;
            option.dataset.localUrl = fileUrl;
            backgroundSelect.appendChild(option);
            
            // アップロードされたファイルを選択
            backgroundSelect.value = fileName;
            this.settings.background = fileName;
            
            // 背景を読み込み
            await this.loadCustomBackground(fileUrl);
            
            statusElement.textContent = `${file.name} をアップロードしました`;
            statusElement.className = 'upload-status success';
            
        } catch (error) {
            console.error('Background upload failed:', error);
            const statusElement = document.getElementById('backgroundUploadStatus');
            statusElement.textContent = 'アップロードに失敗しました';
            statusElement.className = 'upload-status error';
            this.showError('背景ファイルのアップロードに失敗しました。');
        }
    }
    
    /**
     * カスタムキャラクターの読み込み
     */
    async loadCustomCharacter(fileUrl) {
        if (!this.scene) return;
        
        try {
            this.showLoading();
            
            // 既存のキャラクターを削除
            if (this.vrm) {
                this.scene.remove(this.vrm.scene);
                this.vrm = null;
            }
            
            // GLTFローダーの設定
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));
            
            // VRMファイルの読み込み
            const gltfVrm = await loader.loadAsync(fileUrl);
            this.vrm = gltfVrm.userData.vrm;
            
            // パフォーマンス最適化
            VRMUtils.removeUnnecessaryVertices(this.vrm.scene);
            VRMUtils.removeUnnecessaryJoints(this.vrm.scene);
            
            // フラスタムカリングを無効化
            this.vrm.scene.traverse((obj) => {
                if (obj.isMesh) {
                    obj.frustumCulled = false;
                }
            });
            
            // LookAtクォータニオンプロキシを追加
            const lookAtQuatProxy = new VRMLookAtQuaternionProxy(this.vrm.lookAt);
            lookAtQuatProxy.name = 'lookAtQuaternionProxy';
            this.vrm.scene.add(lookAtQuatProxy);
            
            // シーンに追加
            this.scene.add(this.vrm.scene);
            
            // アニメーションミキサーを再作成
            if (this.mixer) {
                this.mixer.stopAllAction();
            }
            this.mixer = new THREE.AnimationMixer(this.vrm.scene);
            
            this.hideLoading();
            console.log('Custom character loaded successfully');
            
        } catch (error) {
            console.error('Failed to load custom character:', error);
            this.hideLoading();
            throw error;
        }
    }
    
    /**
     * カスタム背景の読み込み
     */
    async loadCustomBackground(fileUrl) {
        try {
            if (!this.scene) return;
            
            // 既存の背景を削除
            if (this.backgroundMesh) {
                this.scene.remove(this.backgroundMesh);
                this.backgroundMesh = null;
            }
            
            // テクスチャの読み込み
            const textureLoader = new THREE.TextureLoader();
            const texture = await new Promise((resolve, reject) => {
                textureLoader.load(fileUrl, resolve, undefined, reject);
            });
            
            // 180度のスフィア背景を作成
            const geometry = new THREE.SphereGeometry(50, 32, 16, Math.PI, Math.PI);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide
            });
            
            this.backgroundMesh = new THREE.Mesh(geometry, material);
            this.scene.add(this.backgroundMesh);
            
            console.log('Custom background loaded successfully');
            
        } catch (error) {
            console.error('Failed to load custom background:', error);
            throw error;
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
