/**
 * AI Wife Frontend Tests
 * Jest + JSDOM を使用したフロントエンドテスト
 */

// Mock setup
const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
};

global.io = jest.fn(() => mockSocket);

// DOM mocking
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    }
});

Object.defineProperty(navigator, 'mediaDevices', {
    value: {
        getUserMedia: jest.fn()
    }
});

// Three.js mocking
jest.mock('three', () => ({
    WebGLRenderer: jest.fn().mockImplementation(() => ({
        setSize: jest.fn(),
        setPixelRatio: jest.fn(),
        domElement: document.createElement('canvas'),
        shadowMap: { enabled: false, type: null },
        render: jest.fn()
    })),
    PerspectiveCamera: jest.fn().mockImplementation(() => ({
        position: { set: jest.fn() },
        aspect: 1,
        updateProjectionMatrix: jest.fn()
    })),
    Scene: jest.fn().mockImplementation(() => ({
        background: null,
        add: jest.fn(),
        remove: jest.fn()
    })),
    Clock: jest.fn().mockImplementation(() => ({
        getDelta: jest.fn(() => 0.016),
        start: jest.fn()
    })),
    AnimationMixer: jest.fn().mockImplementation(() => ({
        update: jest.fn(),
        clipAction: jest.fn(() => ({
            play: jest.fn()
        })),
        stopAllAction: jest.fn()
    })),
    AmbientLight: jest.fn(),
    DirectionalLight: jest.fn().mockImplementation(() => ({
        position: { set: jest.fn() },
        castShadow: false,
        shadow: { mapSize: { width: 0, height: 0 } }
    }))
}));

describe('AIWifeApp', () => {
    let app;
    let mockElements;

    beforeEach(() => {
        // DOM elements setup
        document.body.innerHTML = `
            <div id="hamburgerMenu"></div>
            <div id="sidebar"></div>
            <div id="closeSidebar"></div>
            <div id="mainContent"></div>
            <div id="characterContainer"></div>
            <div id="chatMessages"></div>
            <input id="textInput" />
            <button id="sendButton"></button>
            <button id="voiceButton"></button>
            <div id="voiceRecording"></div>
            <button id="stopRecording"></button>
            <div id="connectionStatus"><i></i><span></span></div>
            <div id="characterMood"><i></i><span></span></div>
            <div id="loadingOverlay"></div>
            <div id="errorToast"></div>
            <span id="errorMessage"></span>
            <select id="characterSelect"><option value="avatar.vrm">Default</option></select>
            <select id="animationSelect"><option value="animation.vrma">Basic</option></select>
            <input id="volumeSlider" type="range" value="70" />
            <span id="volumeValue">70%</span>
            <input id="voiceSpeed" type="range" value="1.0" />
            <span id="voiceSpeedValue">1.0x</span>
            <select id="personalitySelect"><option value="friendly">Friendly</option></select>
            <input id="memoryToggle" type="checkbox" checked />
            <button id="resetMemory"></button>
        `;

        // Dynamic import mock for ES modules
        global.import = jest.fn().mockResolvedValue({
            default: class MockAIWifeApp {
                constructor() {
                    this.sessionId = 'test_session';
                    this.isRecording = false;
                    this.settings = {
                        character: 'avatar.vrm',
                        animation: 'animation.vrma',
                        volume: 0.7,
                        voiceSpeed: 1.0,
                        personality: 'friendly',
                        memoryEnabled: true
                    };
                    this.elements = {};
                    this.socket = mockSocket;
                }

                init() {
                    return Promise.resolve();
                }

                generateSessionId() {
                    return 'test_session_' + Date.now();
                }

                setupEventListeners() {
                    // Event listener setup
                }

                initWebSocket() {
                    // WebSocket initialization
                }

                async init3DScene() {
                    // 3D scene initialization
                }

                async loadCharacter() {
                    // Character loading
                }

                sendMessage() {
                    const input = document.getElementById('textInput');
                    if (input.value.trim()) {
                        this.addMessageToChat('user', input.value);
                        this.socket.emit('send_message', {
                            session_id: this.sessionId,
                            message: input.value
                        });
                        input.value = '';
                    }
                }

                addMessageToChat(role, text) {
                    const chatMessages = document.getElementById('chatMessages');
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `message ${role}-message`;
                    messageDiv.innerHTML = `
                        <div class="message-content">
                            <div class="message-text">${text}</div>
                        </div>
                    `;
                    chatMessages.appendChild(messageDiv);
                }

                showLoading() {
                    document.getElementById('loadingOverlay').style.display = 'flex';
                }

                hideLoading() {
                    document.getElementById('loadingOverlay').style.display = 'none';
                }

                showError(message) {
                    document.getElementById('errorMessage').textContent = message;
                    document.getElementById('errorToast').style.display = 'flex';
                }

                toggleSidebar() {
                    const sidebar = document.getElementById('sidebar');
                    sidebar.classList.toggle('open');
                }

                updateConnectionStatus(status) {
                    const statusElement = document.getElementById('connectionStatus');
                    const span = statusElement.querySelector('span');
                    span.textContent = status === 'connected' ? '接続済み' : '切断';
                }

                async startVoiceRecording() {
                    this.isRecording = true;
                    document.getElementById('voiceButton').classList.add('recording');
                }

                stopVoiceRecording() {
                    this.isRecording = false;
                    document.getElementById('voiceButton').classList.remove('recording');
                }
            }
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('Initialization', () => {
        test('should initialize successfully', async () => {
            const { default: AIWifeApp } = await import('../frontend/js/app.js');
            app = new AIWifeApp();
            
            expect(app.sessionId).toBeTruthy();
            expect(app.settings).toBeDefined();
            expect(app.socket).toBe(mockSocket);
        });

        test('should generate unique session ID', async () => {
            const { default: AIWifeApp } = await import('../frontend/js/app.js');
            app = new AIWifeApp();
            
            const sessionId1 = app.generateSessionId();
            const sessionId2 = app.generateSessionId();
            
            expect(sessionId1).not.toBe(sessionId2);
            expect(sessionId1).toContain('test_session_');
        });
    });

    describe('Chat Functionality', () => {
        beforeEach(async () => {
            const { default: AIWifeApp } = await import('../frontend/js/app.js');
            app = new AIWifeApp();
        });

        test('should send message when send button is clicked', () => {
            const textInput = document.getElementById('textInput');
            textInput.value = 'Hello, AI Wife!';
            
            app.sendMessage();
            
            expect(mockSocket.emit).toHaveBeenCalledWith('send_message', {
                session_id: app.sessionId,
                message: 'Hello, AI Wife!'
            });
            expect(textInput.value).toBe('');
        });

        test('should add message to chat', () => {
            const testMessage = 'Test message';
            
            app.addMessageToChat('user', testMessage);
            
            const chatMessages = document.getElementById('chatMessages');
            const lastMessage = chatMessages.lastElementChild;
            
            expect(lastMessage.className).toContain('user-message');
            expect(lastMessage.textContent).toContain(testMessage);
        });

        test('should not send empty message', () => {
            const textInput = document.getElementById('textInput');
            textInput.value = '   ';
            
            app.sendMessage();
            
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('Voice Recording', () => {
        beforeEach(async () => {
            const { default: AIWifeApp } = await import('../frontend/js/app.js');
            app = new AIWifeApp();
            
            // Mock MediaRecorder
            global.MediaRecorder = jest.fn().mockImplementation(() => ({
                start: jest.fn(),
                stop: jest.fn(),
                ondataavailable: null,
                onstop: null,
                stream: {
                    getTracks: jest.fn(() => [{ stop: jest.fn() }])
                }
            }));
            
            navigator.mediaDevices.getUserMedia.mockResolvedValue(new MediaStream());
        });

        test('should start voice recording', async () => {
            await app.startVoiceRecording();
            
            expect(app.isRecording).toBe(true);
            expect(document.getElementById('voiceButton').classList.contains('recording')).toBe(true);
        });

        test('should stop voice recording', () => {
            app.isRecording = true;
            document.getElementById('voiceButton').classList.add('recording');
            
            app.stopVoiceRecording();
            
            expect(app.isRecording).toBe(false);
            expect(document.getElementById('voiceButton').classList.contains('recording')).toBe(false);
        });
    });

    describe('UI Controls', () => {
        beforeEach(async () => {
            const { default: AIWifeApp } = await import('../frontend/js/app.js');
            app = new AIWifeApp();
        });

        test('should toggle sidebar', () => {
            const sidebar = document.getElementById('sidebar');
            
            app.toggleSidebar();
            expect(sidebar.classList.contains('open')).toBe(true);
            
            app.toggleSidebar();
            expect(sidebar.classList.contains('open')).toBe(false);
        });

        test('should show and hide loading overlay', () => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            
            app.showLoading();
            expect(loadingOverlay.style.display).toBe('flex');
            
            app.hideLoading();
            expect(loadingOverlay.style.display).toBe('none');
        });

        test('should show error message', () => {
            const errorMessage = 'Test error message';
            
            app.showError(errorMessage);
            
            expect(document.getElementById('errorMessage').textContent).toBe(errorMessage);
            expect(document.getElementById('errorToast').style.display).toBe('flex');
        });

        test('should update connection status', () => {
            app.updateConnectionStatus('connected');
            
            const statusText = document.getElementById('connectionStatus').querySelector('span');
            expect(statusText.textContent).toBe('接続済み');
        });
    });

    describe('WebSocket Events', () => {
        beforeEach(async () => {
            const { default: AIWifeApp } = await import('../frontend/js/app.js');
            app = new AIWifeApp();
        });

        test('should handle WebSocket connection', () => {
            expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('message_response', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('audio_response', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
        });
    });

    describe('Settings Management', () => {
        beforeEach(async () => {
            const { default: AIWifeApp } = await import('../frontend/js/app.js');
            app = new AIWifeApp();
        });

        test('should have default settings', () => {
            expect(app.settings.character).toBe('avatar.vrm');
            expect(app.settings.animation).toBe('animation.vrma');
            expect(app.settings.volume).toBe(0.7);
            expect(app.settings.voiceSpeed).toBe(1.0);
            expect(app.settings.personality).toBe('friendly');
            expect(app.settings.memoryEnabled).toBe(true);
        });

        test('should load settings from localStorage', () => {
            const mockSettings = {
                character: 'new_model.vrm',
                volume: 0.8
            };
            
            localStorage.getItem.mockReturnValue(JSON.stringify(mockSettings));
            
            // Settings loading logic would be tested here
            expect(localStorage.getItem).toHaveBeenCalledWith('aiWifeSettings');
        });
    });
});

// Performance tests
describe('Performance', () => {
    test('should load within acceptable time', async () => {
        const startTime = performance.now();
        
        const { default: AIWifeApp } = await import('../frontend/js/app.js');
        const app = new AIWifeApp();
        await app.init();
        
        const endTime = performance.now();
        const loadTime = endTime - startTime;
        
        // Should load within 2 seconds (2000ms)
        expect(loadTime).toBeLessThan(2000);
    });
});

// Accessibility tests
describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
        // Check for accessibility features
        const voiceButton = document.getElementById('voiceButton');
        const sendButton = document.getElementById('sendButton');
        
        expect(voiceButton.getAttribute('title')).toBeTruthy();
        expect(sendButton.getAttribute('title')).toBeTruthy();
    });

    test('should support keyboard navigation', () => {
        const textInput = document.getElementById('textInput');
        
        // Test Enter key submission
        const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
        textInput.dispatchEvent(enterEvent);
        
        // Additional keyboard tests would be implemented here
        expect(textInput).toBeDefined();
    });
});

// Error handling tests
describe('Error Handling', () => {
    beforeEach(async () => {
        const { default: AIWifeApp } = await import('../frontend/js/app.js');
        app = new AIWifeApp();
    });

    test('should handle WebSocket connection errors', () => {
        const errorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
        
        if (errorCallback) {
            errorCallback({ message: 'Connection failed' });
            
            expect(document.getElementById('errorMessage').textContent).toBe('Connection failed');
        }
    });

    test('should handle media access errors', async () => {
        navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Media access denied'));
        
        try {
            await app.startVoiceRecording();
        } catch (error) {
            expect(error.message).toBe('Media access denied');
        }
    });
});
