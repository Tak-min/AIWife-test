/**
 * Three.js Mock
 * Three.js の主要クラスとメソッドをモック化
 */

export const WebGLRenderer = jest.fn().mockImplementation(() => ({
    setSize: jest.fn(),
    setPixelRatio: jest.fn(),
    domElement: document.createElement('canvas'),
    shadowMap: {
        enabled: false,
        type: null
    },
    render: jest.fn(),
    dispose: jest.fn()
}));

export const PerspectiveCamera = jest.fn().mockImplementation(() => ({
    position: {
        set: jest.fn(),
        x: 0,
        y: 0,
        z: 0
    },
    aspect: 1,
    updateProjectionMatrix: jest.fn(),
    lookAt: jest.fn()
}));

export const Scene = jest.fn().mockImplementation(() => ({
    background: null,
    add: jest.fn(),
    remove: jest.fn(),
    traverse: jest.fn(),
    children: []
}));

export const Clock = jest.fn().mockImplementation(() => ({
    getDelta: jest.fn(() => 0.016),
    start: jest.fn(),
    stop: jest.fn(),
    getElapsedTime: jest.fn(() => 1.0)
}));

export const AnimationMixer = jest.fn().mockImplementation(() => ({
    update: jest.fn(),
    clipAction: jest.fn(() => ({
        play: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
        setLoop: jest.fn(),
        setEffectiveWeight: jest.fn()
    })),
    stopAllAction: jest.fn(),
    setTime: jest.fn()
}));

export const AmbientLight = jest.fn().mockImplementation(() => ({
    intensity: 1,
    color: { set: jest.fn() }
}));

export const DirectionalLight = jest.fn().mockImplementation(() => ({
    position: {
        set: jest.fn(),
        x: 0,
        y: 0,
        z: 0
    },
    castShadow: false,
    shadow: {
        mapSize: {
            width: 2048,
            height: 2048
        }
    },
    intensity: 1,
    color: { set: jest.fn() }
}));

export const Vector3 = jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    set: jest.fn(),
    copy: jest.fn(),
    add: jest.fn(),
    sub: jest.fn(),
    multiply: jest.fn(),
    normalize: jest.fn(),
    length: jest.fn(() => 1),
    distanceTo: jest.fn(() => 1)
}));

export const Quaternion = jest.fn().mockImplementation(() => ({
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    set: jest.fn(),
    copy: jest.fn(),
    multiply: jest.fn(),
    normalize: jest.fn(),
    slerp: jest.fn()
}));

export const Matrix4 = jest.fn().mockImplementation(() => ({
    elements: new Array(16).fill(0),
    set: jest.fn(),
    copy: jest.fn(),
    multiply: jest.fn(),
    makeRotationFromQuaternion: jest.fn(),
    makeTranslation: jest.fn(),
    decompose: jest.fn()
}));

export const Mesh = jest.fn().mockImplementation(() => ({
    geometry: null,
    material: null,
    position: new Vector3(),
    rotation: { x: 0, y: 0, z: 0 },
    scale: new Vector3(1, 1, 1),
    visible: true,
    castShadow: false,
    receiveShadow: false,
    frustumCulled: true,
    traverse: jest.fn(),
    add: jest.fn(),
    remove: jest.fn()
}));

export const Group = jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    children: [],
    position: new Vector3(),
    rotation: { x: 0, y: 0, z: 0 },
    scale: new Vector3(1, 1, 1),
    traverse: jest.fn()
}));

export const Object3D = jest.fn().mockImplementation(() => ({
    position: new Vector3(),
    rotation: { x: 0, y: 0, z: 0 },
    scale: new Vector3(1, 1, 1),
    visible: true,
    add: jest.fn(),
    remove: jest.fn(),
    traverse: jest.fn(),
    getWorldPosition: jest.fn(),
    lookAt: jest.fn()
}));

// アニメーション関連
export const AnimationClip = jest.fn().mockImplementation(() => ({
    name: 'mockClip',
    duration: 1.0,
    tracks: []
}));

export const LoopOnce = 2200;
export const LoopRepeat = 2201;
export const LoopPingPong = 2202;

// 定数
export const PCFSoftShadowMap = 1;
export const sRGBEncoding = 3001;
export const ACESFilmicToneMapping = 5;

// カラー
export class Color {
    constructor(r = 1, g = 1, b = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
    
    set(value) {
        return this;
    }
    
    setHex(hex) {
        return this;
    }
    
    copy(color) {
        return this;
    }
}

// テクスチャ
export const Texture = jest.fn().mockImplementation(() => ({
    image: null,
    wrapS: 1001,
    wrapT: 1001,
    magFilter: 1006,
    minFilter: 1008,
    needsUpdate: false
}));

// マテリアル
export const MeshBasicMaterial = jest.fn().mockImplementation(() => ({
    color: new Color(),
    map: null,
    transparent: false,
    opacity: 1,
    side: 0
}));

export const MeshStandardMaterial = jest.fn().mockImplementation(() => ({
    color: new Color(),
    map: null,
    normalMap: null,
    roughness: 1,
    metalness: 0,
    transparent: false,
    opacity: 1
}));

// ジオメトリ
export const BoxGeometry = jest.fn().mockImplementation(() => ({
    attributes: {},
    index: null,
    dispose: jest.fn()
}));

export const PlaneGeometry = jest.fn().mockImplementation(() => ({
    attributes: {},
    index: null,
    dispose: jest.fn()
}));

// レイキャスト
export const Raycaster = jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    intersectObjects: jest.fn(() => []),
    intersectObject: jest.fn(() => [])
}));

// ヘルパー
export const GridHelper = jest.fn().mockImplementation(() => new Object3D());
export const AxesHelper = jest.fn().mockImplementation(() => new Object3D());

// Math utilities
export const MathUtils = {
    degToRad: jest.fn((degrees) => degrees * Math.PI / 180),
    radToDeg: jest.fn((radians) => radians * 180 / Math.PI),
    lerp: jest.fn((x, y, t) => x * (1 - t) + y * t),
    clamp: jest.fn((value, min, max) => Math.max(min, Math.min(max, value)))
};

// デフォルトエクスポート
export default {
    WebGLRenderer,
    PerspectiveCamera,
    Scene,
    Clock,
    AnimationMixer,
    AmbientLight,
    DirectionalLight,
    Vector3,
    Quaternion,
    Matrix4,
    Mesh,
    Group,
    Object3D,
    AnimationClip,
    Color,
    Texture,
    MeshBasicMaterial,
    MeshStandardMaterial,
    BoxGeometry,
    PlaneGeometry,
    Raycaster,
    GridHelper,
    AxesHelper,
    MathUtils,
    LoopOnce,
    LoopRepeat,
    LoopPingPong,
    PCFSoftShadowMap,
    sRGBEncoding,
    ACESFilmicToneMapping
};
