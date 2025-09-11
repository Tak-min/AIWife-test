/**
 * @pixiv/three-vrm Mock
 * VRM関連のクラスとメソッドをモック化
 */

// VRMLoaderPlugin
export const VRMLoaderPlugin = jest.fn().mockImplementation(() => ({
    name: 'VRMLoaderPlugin',
    parse: jest.fn()
}));

// VRMUtils
export const VRMUtils = {
    removeUnnecessaryVertices: jest.fn(),
    removeUnnecessaryJoints: jest.fn(),
    rotateVRM0: jest.fn()
};

// VRM Core Mock
export const VRM = jest.fn().mockImplementation(() => ({
    scene: {
        add: jest.fn(),
        remove: jest.fn(),
        traverse: jest.fn(),
        children: [],
        position: { set: jest.fn() },
        rotation: { set: jest.fn() },
        scale: { set: jest.fn() }
    },
    humanoid: {
        humanBones: new Map(),
        getRawBone: jest.fn(),
        getBone: jest.fn()
    },
    lookAt: {
        target: { set: jest.fn() },
        update: jest.fn(),
        reset: jest.fn()
    },
    firstPerson: {
        setup: jest.fn(),
        getFirstPersonWorldDirection: jest.fn()
    },
    blendShape: {
        getBlendShapeGroup: jest.fn(),
        setValue: jest.fn(),
        getValue: jest.fn()
    },
    springBone: {
        reset: jest.fn(),
        update: jest.fn()
    },
    materials: [],
    meta: {
        title: 'Mock VRM',
        version: '1.0',
        author: 'Test Author'
    },
    userData: {},
    update: jest.fn(),
    dispose: jest.fn()
}));

// VRM Look At
export const VRMLookAt = jest.fn().mockImplementation(() => ({
    target: { set: jest.fn() },
    update: jest.fn(),
    reset: jest.fn(),
    applier: {
        lookAt: jest.fn()
    }
}));

// VRM Expression Manager (旧 BlendShape)
export const VRMExpressionManager = jest.fn().mockImplementation(() => ({
    getExpression: jest.fn(),
    setValue: jest.fn(),
    getValue: jest.fn(),
    update: jest.fn(),
    expressions: new Map()
}));

// VRM Humanoid
export const VRMHumanoid = jest.fn().mockImplementation(() => ({
    humanBones: new Map(),
    restPose: new Map(),
    getRawBone: jest.fn(),
    getBone: jest.fn(),
    getBoneNode: jest.fn(),
    setRawBone: jest.fn(),
    update: jest.fn()
}));

// VRM First Person
export const VRMFirstPerson = jest.fn().mockImplementation(() => ({
    setup: jest.fn(),
    getFirstPersonWorldDirection: jest.fn(),
    meshAnnotations: []
}));

// VRM Spring Bone
export const VRMSpringBoneManager = jest.fn().mockImplementation(() => ({
    springs: [],
    colliderGroups: [],
    reset: jest.fn(),
    update: jest.fn(),
    setCenter: jest.fn()
}));

// VRM NodeConstraint Manager
export const VRMNodeConstraintManager = jest.fn().mockImplementation(() => ({
    constraints: [],
    update: jest.fn()
}));

// VRM Materials
export const VRMMaterialsManager = jest.fn().mockImplementation(() => ({
    materials: new Map(),
    getMaterial: jest.fn()
}));

// VRM Meta
export const VRMMeta = jest.fn().mockImplementation(() => ({
    title: 'Mock VRM',
    version: '1.0',
    author: 'Test Author',
    contactInformation: '',
    reference: '',
    thumbnailImage: null,
    allowedUserName: 'OnlyAuthor',
    violentUssageName: 'Disallow',
    sexualUssageName: 'Disallow',
    commercialUssageName: 'Disallow',
    otherPermissionUrl: '',
    licenseName: 'Other',
    otherLicenseUrl: ''
}));

// VRM Human Bone Name Enum
export const VRMHumanBoneName = {
    Hips: 'hips',
    Spine: 'spine',
    Chest: 'chest',
    UpperChest: 'upperChest',
    Neck: 'neck',
    Head: 'head',
    LeftShoulder: 'leftShoulder',
    LeftUpperArm: 'leftUpperArm',
    LeftLowerArm: 'leftLowerArm',
    LeftHand: 'leftHand',
    RightShoulder: 'rightShoulder',
    RightUpperArm: 'rightUpperArm',
    RightLowerArm: 'rightLowerArm',
    RightHand: 'rightHand',
    LeftUpperLeg: 'leftUpperLeg',
    LeftLowerLeg: 'leftLowerLeg',
    LeftFoot: 'leftFoot',
    RightUpperLeg: 'rightUpperLeg',
    RightLowerLeg: 'rightLowerLeg',
    RightFoot: 'rightFoot'
};

// VRM Expression Preset Name
export const VRMExpressionPresetName = {
    Aa: 'aa',
    Ih: 'ih',
    Ou: 'ou',
    Ee: 'ee',
    Oh: 'oh',
    Blink: 'blink',
    Joy: 'joy',
    Angry: 'angry',
    Sorrow: 'sorrow',
    Fun: 'fun',
    LookUp: 'lookUp',
    LookDown: 'lookDown',
    LookLeft: 'lookLeft',
    LookRight: 'lookRight',
    BlinkLeft: 'blinkLeft',
    BlinkRight: 'blinkRight'
};

// GLTFLoader用のuserDataモック
export const createMockVRMGLTF = () => ({
    scene: {
        add: jest.fn(),
        remove: jest.fn(),
        traverse: jest.fn(),
        children: []
    },
    userData: {
        vrm: new VRM()
    }
});

// デフォルトエクスポート
export default {
    VRMLoaderPlugin,
    VRMUtils,
    VRM,
    VRMLookAt,
    VRMExpressionManager,
    VRMHumanoid,
    VRMFirstPerson,
    VRMSpringBoneManager,
    VRMNodeConstraintManager,
    VRMMaterialsManager,
    VRMMeta,
    VRMHumanBoneName,
    VRMExpressionPresetName,
    createMockVRMGLTF
};
