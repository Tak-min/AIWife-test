/**
 * @pixiv/three-vrm-animation Mock
 * VRMアニメーション関連のクラスとメソッドをモック化
 */

// VRM Animation Loader Plugin
export const VRMAnimationLoaderPlugin = jest.fn().mockImplementation(() => ({
    name: 'VRMAnimationLoaderPlugin',
    parse: jest.fn()
}));

// VRM Animation
export const VRMAnimation = jest.fn().mockImplementation(() => ({
    name: 'mockAnimation',
    duration: 2.0,
    humanoid: {
        tracks: []
    },
    expressions: {
        tracks: []
    },
    lookAt: {
        tracks: []
    }
}));

// Create VRM Animation Clip
export const createVRMAnimationClip = jest.fn().mockImplementation((vrmAnimation, vrm) => ({
    name: vrmAnimation.name || 'VRMAnimationClip',
    duration: vrmAnimation.duration || 1.0,
    tracks: [],
    optimize: jest.fn(),
    trim: jest.fn(),
    resetDuration: jest.fn()
}));

// VRM Look At Quaternion Proxy
export const VRMLookAtQuaternionProxy = jest.fn().mockImplementation((lookAt) => ({
    name: 'lookAtQuaternionProxy',
    parent: null,
    children: [],
    position: { set: jest.fn() },
    rotation: { set: jest.fn() },
    scale: { set: jest.fn() },
    quaternion: {
        set: jest.fn(),
        copy: jest.fn(),
        multiply: jest.fn()
    },
    lookAt: lookAt,
    update: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    traverse: jest.fn()
}));

// VRM Animation Mixer
export const VRMAnimationMixer = jest.fn().mockImplementation((root) => ({
    root: root,
    actions: [],
    time: 0,
    timeScale: 1,
    clipAction: jest.fn().mockImplementation((clip) => ({
        clip: clip,
        play: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
        setLoop: jest.fn(),
        setEffectiveWeight: jest.fn(),
        setEffectiveTimeScale: jest.fn(),
        fadeIn: jest.fn(),
        fadeOut: jest.fn(),
        crossFadeFrom: jest.fn(),
        crossFadeTo: jest.fn(),
        enabled: true,
        weight: 1,
        timeScale: 1,
        repetitions: Infinity,
        paused: false,
        time: 0
    })),
    stopAllAction: jest.fn(),
    update: jest.fn(),
    setTime: jest.fn(),
    getRoot: jest.fn(() => root)
}));

// VRM Humanoid Animation Track
export const VRMHumanoidAnimationTrack = jest.fn().mockImplementation(() => ({
    boneName: 'hips',
    keyframes: [],
    interpolation: 'LINEAR'
}));

// VRM Expression Animation Track
export const VRMExpressionAnimationTrack = jest.fn().mockImplementation(() => ({
    expressionName: 'happy',
    keyframes: [],
    interpolation: 'LINEAR'
}));

// VRM Look At Animation Track
export const VRMLookAtAnimationTrack = jest.fn().mockImplementation(() => ({
    keyframes: [],
    interpolation: 'LINEAR'
}));

// Animation Keyframe
export const VRMAnimationKeyframe = jest.fn().mockImplementation(() => ({
    time: 0,
    value: null,
    inTangent: null,
    outTangent: null
}));

// Animation Interpolation Types
export const VRMAnimationInterpolation = {
    STEP: 'STEP',
    LINEAR: 'LINEAR',
    CUBICSPLINE: 'CUBICSPLINE'
};

// Load VRM Animation from GLTF
export const loadVRMAnimation = jest.fn().mockImplementation((gltf) => {
    return Promise.resolve([new VRMAnimation()]);
});

// GLTF用のuserDataモック（アニメーション）
export const createMockVRMAnimationGLTF = () => ({
    scene: {
        add: jest.fn(),
        remove: jest.fn(),
        traverse: jest.fn()
    },
    userData: {
        vrmAnimations: [new VRMAnimation()]
    }
});

// VRM Animation Utilities
export const VRMAnimationUtils = {
    createAnimationClip: jest.fn(),
    retargetAnimation: jest.fn(),
    optimizeAnimation: jest.fn(),
    trimAnimation: jest.fn(),
    mergeAnimations: jest.fn(),
    extractHumanoidAnimation: jest.fn(),
    extractExpressionAnimation: jest.fn(),
    extractLookAtAnimation: jest.fn()
};

// デフォルトエクスポート
export default {
    VRMAnimationLoaderPlugin,
    VRMAnimation,
    createVRMAnimationClip,
    VRMLookAtQuaternionProxy,
    VRMAnimationMixer,
    VRMHumanoidAnimationTrack,
    VRMExpressionAnimationTrack,
    VRMLookAtAnimationTrack,
    VRMAnimationKeyframe,
    VRMAnimationInterpolation,
    loadVRMAnimation,
    createMockVRMAnimationGLTF,
    VRMAnimationUtils
};
