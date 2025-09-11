/**
 * Jest Test Setup
 * テスト実行前に必要な設定を行います
 */

// Socket.IO のモック
global.io = jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
}));

// Web APIs のモック
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    }
});

Object.defineProperty(window, 'sessionStorage', {
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

// MediaRecorder のモック
global.MediaRecorder = jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    ondataavailable: null,
    onstop: null,
    onerror: null,
    stream: {
        getTracks: jest.fn(() => [{ stop: jest.fn() }])
    }
}));

// Audio のモック
global.Audio = jest.fn().mockImplementation(() => ({
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    load: jest.fn(),
    volume: 1,
    playbackRate: 1,
    currentTime: 0,
    duration: 0,
    onended: null,
    onerror: null
}));

// URL のモック
global.URL = {
    createObjectURL: jest.fn(() => 'mock-url'),
    revokeObjectURL: jest.fn()
};

// Blob のモック
global.Blob = jest.fn().mockImplementation((data, options) => ({
    size: data ? data.length : 0,
    type: options ? options.type : '',
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    text: jest.fn().mockResolvedValue('mock text'),
    stream: jest.fn()
}));

// FileReader のモック
global.FileReader = jest.fn().mockImplementation(() => ({
    readAsArrayBuffer: jest.fn(),
    readAsDataURL: jest.fn(),
    readAsText: jest.fn(),
    onload: null,
    onerror: null,
    result: null
}));

// ResizeObserver のモック
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}));

// IntersectionObserver のモック
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}));

// requestAnimationFrame のモック
global.requestAnimationFrame = jest.fn((callback) => {
    setTimeout(callback, 16);
    return 1;
});

global.cancelAnimationFrame = jest.fn();

// performance のモック
Object.defineProperty(window, 'performance', {
    value: {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn(),
        getEntriesByType: jest.fn(() => []),
        getEntriesByName: jest.fn(() => [])
    }
});

// WebGL のモック
const mockWebGLContext = {
    getExtension: jest.fn(),
    getParameter: jest.fn(),
    createShader: jest.fn(),
    shaderSource: jest.fn(),
    compileShader: jest.fn(),
    createProgram: jest.fn(),
    attachShader: jest.fn(),
    linkProgram: jest.fn(),
    useProgram: jest.fn(),
    createBuffer: jest.fn(),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),
    createTexture: jest.fn(),
    bindTexture: jest.fn(),
    texImage2D: jest.fn(),
    texParameteri: jest.fn(),
    generateMipmap: jest.fn(),
    clearColor: jest.fn(),
    clear: jest.fn(),
    drawArrays: jest.fn(),
    drawElements: jest.fn(),
    viewport: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    blendFunc: jest.fn(),
    getUniformLocation: jest.fn(),
    getAttribLocation: jest.fn(),
    uniform1f: jest.fn(),
    uniform2f: jest.fn(),
    uniform3f: jest.fn(),
    uniform4f: jest.fn(),
    uniformMatrix4fv: jest.fn(),
    vertexAttribPointer: jest.fn(),
    enableVertexAttribArray: jest.fn()
};

HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
    if (contextType === 'webgl' || contextType === 'webgl2') {
        return mockWebGLContext;
    }
    return null;
});

// console のエラーを抑制（開発時のログは残す）
const originalError = console.error;
console.error = (...args) => {
    if (
        typeof args[0] === 'string' &&
        (args[0].includes('Warning: ReactDOM.render') ||
         args[0].includes('Warning: componentWillReceiveProps'))
    ) {
        return;
    }
    originalError.call(console, ...args);
};

// テスト後のクリーンアップ
afterEach(() => {
    jest.clearAllMocks();
    // DOM のクリーンアップ
    document.body.innerHTML = '';
    document.head.innerHTML = '';
});

// グローバルなテストヘルパー関数
global.waitFor = (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            if (condition()) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Timeout waiting for condition'));
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
};

global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// カスタムマッチャー
expect.extend({
    toBeInDOM(received) {
        const pass = document.body.contains(received) || document.head.contains(received);
        
        if (pass) {
            return {
                message: () => `expected element not to be in the DOM`,
                pass: true
            };
        } else {
            return {
                message: () => `expected element to be in the DOM`,
                pass: false
            };
        }
    },
    
    toHaveBeenCalledWithSocketEvent(received, eventName, data) {
        const pass = received.mock.calls.some(call => 
            call[0] === eventName && 
            (data === undefined || JSON.stringify(call[1]) === JSON.stringify(data))
        );
        
        if (pass) {
            return {
                message: () => `expected socket.emit not to have been called with ${eventName}`,
                pass: true
            };
        } else {
            return {
                message: () => `expected socket.emit to have been called with ${eventName}`,
                pass: false
            };
        }
    }
});

console.log('Jest setup completed successfully');
