/* ═══════════════════════════════════════════════════════════════════════════
   Chaos to Beauty - 혼돈에서 아름다움으로
   Interactive 3D Digital Art with Three.js + Light Painter Effect
   
   어둠 속에서 키보드를 통해 빛으로 크리스마스를 그려나갑니다.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ═══════════════════════════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
    TYPING_TIMEOUT: 2000,
    FADE_IN_SPEED: 0.03,
    FADE_OUT_SPEED: 0.01,
    MAX_PAINTERS: 30,
    ROTATION_SPEED: 0.1,
    COLORS: {
        xmas: [0xffd700, 0xff6b6b, 0x228b22, 0xfffacd, 0xff4757, 0x2ed573]
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// 전역 변수
// ═══════════════════════════════════════════════════════════════════════════

let scene, camera, renderer, composer;
let painters = [];
let snowParticles;
let starGroup;

let state = {
    beautyLevel: 0,
    isTyping: false,
    lastTypingTime: 0,
    keyPressCount: 0,
    targetBeautyLevel: 0,
    paintersCreated: 0
};

// DOM 요소
let messageOverlay, typingIndicator, progressFill, quoteContainer;

// ═══════════════════════════════════════════════════════════════════════════
// Light Painter 클래스 - 빛으로 그리는 화가
// ═══════════════════════════════════════════════════════════════════════════

class LightPainter {
    constructor(scene, colorPalette, delay = 0) {
        this.scene = scene;
        this.numPoints = 80;
        this.points = [];
        this.delay = delay;
        this.active = false;
        this.opacity = 0;

        // 초기화: 모든 점을 바닥 중앙에 배치
        for (let i = 0; i < this.numPoints; i++) {
            this.points.push(new THREE.Vector3(0, 0, 0));
        }

        this.geometry = new THREE.BufferGeometry().setFromPoints(this.points);

        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        this.color = color;
        this.material = new THREE.LineBasicMaterial({
            color: color,
            linewidth: 2,
            opacity: 0,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        this.line = new THREE.Line(this.geometry, this.material);
        this.line.frustumCulled = false;
        scene.add(this.line);

        // 트리 형태 설정
        this.targetRadiusBase = Math.random() * 25 + 8;
        this.targetHeight = Math.random() * 70 + 35;
        this.angleOffset = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 0.015 + 0.008;
        this.progress = 0;

        // 반짝이 파티클
        this.setupParticles(color);
    }

    setupParticles(color) {
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = 25;
        const positions = new Float32Array(particleCount * 3);
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleMaterial = new THREE.PointsMaterial({
            color: color,
            size: 1.2,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0,
            map: this.createParticleTexture()
        });
        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(this.particles);
    }

    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    activate() {
        this.active = true;
    }

    update(time, globalOpacity) {
        // 딜레이 체크
        if (!this.active) return;

        // 불투명도 조절
        const targetOpacity = globalOpacity * 0.8;
        this.opacity = THREE.MathUtils.lerp(this.opacity, targetOpacity, 0.05);
        this.material.opacity = this.opacity;
        this.particles.material.opacity = this.opacity * 0.6;

        if (this.opacity < 0.01) return;

        // 진행도 업데이트
        this.progress = (time * this.speed) % 1;

        // 원뿔형 나선 경로 계산
        let currentRadius = this.targetRadiusBase * (1 - this.progress);
        let currentAngle = this.angleOffset + this.progress * Math.PI * 8;
        let targetX = Math.cos(currentAngle) * currentRadius;
        let targetY = this.progress * this.targetHeight;
        let targetZ = Math.sin(currentAngle) * currentRadius;

        // 유기적인 노이즈
        targetX += Math.sin(time * 2 + this.angleOffset) * 1.5;
        targetY += Math.cos(time * 1.5) * 0.8;
        targetZ += Math.cos(time * 2 + this.angleOffset) * 1.5;

        // 선두 점 이동
        this.points[0].set(targetX, targetY, targetZ);

        // 꼬리 효과 - 부드럽게 따라감
        for (let i = 1; i < this.numPoints; i++) {
            let lerpFactor = 0.18 - (i / this.numPoints) * 0.12;
            this.points[i].lerp(this.points[i - 1], lerpFactor);
        }

        this.geometry.setFromPoints(this.points);
        this.geometry.attributes.position.needsUpdate = true;

        // 파티클 업데이트
        const particlePositions = this.particles.geometry.attributes.position.array;
        for (let i = 0; i < particlePositions.length / 3; i++) {
            let index = Math.floor(Math.random() * 15);
            particlePositions[i * 3] = this.points[index].x + (Math.random() - 0.5) * 3;
            particlePositions[i * 3 + 1] = this.points[index].y + (Math.random() - 0.5) * 3;
            particlePositions[i * 3 + 2] = this.points[index].z + (Math.random() - 0.5) * 3;
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 눈 파티클
// ═══════════════════════════════════════════════════════════════════════════

function createSnowParticles() {
    const geometry = new THREE.BufferGeometry();
    const count = 800;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 150;
        positions[i3 + 1] = Math.random() * 120;
        positions[i3 + 2] = (Math.random() - 0.5) * 150;
        velocities[i] = 0.03 + Math.random() * 0.05;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.userData.velocities = velocities;

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
    });

    snowParticles = new THREE.Points(geometry, material);
    scene.add(snowParticles);
}

function updateSnowParticles() {
    if (!snowParticles) return;

    const positions = snowParticles.geometry.attributes.position.array;
    const velocities = snowParticles.geometry.userData.velocities;

    snowParticles.material.opacity = state.beautyLevel * 0.5;

    if (state.beautyLevel > 0.1) {
        for (let i = 0; i < 800; i++) {
            const i3 = i * 3;
            positions[i3 + 1] -= velocities[i];
            positions[i3] += Math.sin(positions[i3 + 1] * 0.05) * 0.02;

            if (positions[i3 + 1] < -5) {
                positions[i3 + 1] = 120;
                positions[i3] = (Math.random() - 0.5) * 150;
                positions[i3 + 2] = (Math.random() - 0.5) * 150;
            }
        }
        snowParticles.geometry.attributes.position.needsUpdate = true;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 트리 꼭대기 별
// ═══════════════════════════════════════════════════════════════════════════

function createStar() {
    starGroup = new THREE.Group();

    // 별 광채
    const glowGeometry = new THREE.SphereGeometry(4, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    starGroup.add(glow);

    // 별빛 광선
    for (let i = 0; i < 8; i++) {
        const rayGeometry = new THREE.BoxGeometry(0.3, 8, 0.3);
        const rayMaterial = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        const ray = new THREE.Mesh(rayGeometry, rayMaterial);
        ray.rotation.z = (i / 8) * Math.PI;
        starGroup.add(ray);
    }

    starGroup.position.set(0, 85, 0);
    scene.add(starGroup);
}

function updateStar(time) {
    if (!starGroup) return;

    starGroup.rotation.y = time * 0.5;
    starGroup.rotation.z = Math.sin(time * 2) * 0.1;

    starGroup.children.forEach((child, i) => {
        if (child.material) {
            const flicker = 0.7 + 0.3 * Math.sin(time * 4 + i);
            const baseOpacity = i === 0 ? 0.6 : 0.4;
            child.material.opacity = baseOpacity * state.beautyLevel * flicker;
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// 바닥 반사판
// ═══════════════════════════════════════════════════════════════════════════

function createGround() {
    const geometry = new THREE.CircleGeometry(80, 64);
    const material = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        roughness: 0.7,
        metalness: 0.3,
        transparent: true,
        opacity: 0
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -2;
    scene.add(plane);
    return plane;
}

// ═══════════════════════════════════════════════════════════════════════════
// 씬 설정
// ═══════════════════════════════════════════════════════════════════════════

function setupScene() {
    // 씬
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.004);

    // 카메라
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 35, 110);
    camera.lookAt(0, 35, 0);

    // 렌더러
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050505, 1);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // 후처리 - Bloom 효과
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        2.0,  // strength
        0.6,  // radius
        0.1   // threshold
    );

    composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // 조명
    const ambientLight = new THREE.AmbientLight(0x222222, 0.3);
    scene.add(ambientLight);
}

// ═══════════════════════════════════════════════════════════════════════════
// 이벤트 리스너
// ═══════════════════════════════════════════════════════════════════════════

function setupEventListeners() {
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('keyup', handleKeyRelease);
    window.addEventListener('resize', handleResize);
}

function handleKeyPress(event) {
    if (event.key === 'F5' || event.key === 'F12' || event.ctrlKey || event.metaKey) {
        return;
    }

    state.isTyping = true;
    state.lastTypingTime = Date.now();
    state.keyPressCount++;

    // 아름다움 레벨 증가
    state.targetBeautyLevel = Math.min(1, state.targetBeautyLevel + 0.02);

    // UI 업데이트
    messageOverlay.classList.add('hidden');
    typingIndicator.classList.add('active');

    // 새로운 화가 생성 (최대 개수까지)
    if (state.paintersCreated < CONFIG.MAX_PAINTERS && Math.random() < 0.3) {
        const painter = new LightPainter(scene, CONFIG.COLORS.xmas, state.paintersCreated * 100);
        painter.activate();
        painters.push(painter);
        state.paintersCreated++;
    }

    // 기존 화가들 활성화
    painters.forEach((painter, i) => {
        if (!painter.active && Math.random() < 0.5) {
            painter.activate();
        }
    });

    // 인용구 표시
    if (state.beautyLevel > 0.5) {
        quoteContainer.classList.add('visible');
    }
}

function handleKeyRelease() {
    state.lastTypingTime = Date.now();
}

function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// ═══════════════════════════════════════════════════════════════════════════
// 상태 업데이트
// ═══════════════════════════════════════════════════════════════════════════

function updateState() {
    const now = Date.now();

    // 타이핑 중단 감지
    if (state.isTyping && now - state.lastTypingTime > CONFIG.TYPING_TIMEOUT) {
        state.isTyping = false;
        typingIndicator.classList.remove('active');
    }

    // 아름다움 레벨 조정
    if (state.isTyping) {
        state.beautyLevel = THREE.MathUtils.lerp(
            state.beautyLevel,
            state.targetBeautyLevel,
            CONFIG.FADE_IN_SPEED
        );
    } else {
        // 타이핑 중단 - 어둠으로 회귀
        state.targetBeautyLevel = Math.max(0, state.targetBeautyLevel - 0.008);
        state.beautyLevel = THREE.MathUtils.lerp(
            state.beautyLevel,
            state.targetBeautyLevel,
            CONFIG.FADE_OUT_SPEED
        );

        if (state.beautyLevel < 0.3) {
            quoteContainer.classList.remove('visible');
        }
    }

    // 프로그레스 바 업데이트
    progressFill.style.width = `${state.beautyLevel * 100}%`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 애니메이션 루프
// ═══════════════════════════════════════════════════════════════════════════

function animate(timestamp) {
    requestAnimationFrame(animate);

    const time = timestamp * 0.001;

    // 상태 업데이트
    updateState();

    // 씬 회전 (오르골 효과)
    scene.rotation.y = time * CONFIG.ROTATION_SPEED;

    // 카메라 위치 조정 (아름다움 레벨에 따라)
    const cameraY = 35 + state.beautyLevel * 10;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraY, 0.02);
    camera.lookAt(0, 35, 0);

    // 각 요소 업데이트
    painters.forEach(painter => painter.update(time, state.beautyLevel));
    updateSnowParticles();
    updateStar(time);

    // 배경 밝기 조정
    const bgIntensity = 0.02 + state.beautyLevel * 0.03;
    const bgColor = new THREE.Color(bgIntensity, bgIntensity * 0.9, bgIntensity * 1.1);
    renderer.setClearColor(bgColor);

    // 안개 밀도 조정
    scene.fog.density = 0.004 - state.beautyLevel * 0.002;

    // 렌더링
    composer.render();
}

// ═══════════════════════════════════════════════════════════════════════════
// 초기화
// ═══════════════════════════════════════════════════════════════════════════

function init() {
    // DOM 요소 참조
    messageOverlay = document.getElementById('message-overlay');
    typingIndicator = document.getElementById('typing-indicator');
    progressFill = document.querySelector('.progress-fill');
    quoteContainer = document.getElementById('quote-container');

    // 씬 설정
    setupScene();

    // 오브젝트 생성
    createGround();
    createSnowParticles();
    createStar();

    // 이벤트 리스너
    setupEventListeners();

    // 애니메이션 시작
    requestAnimationFrame(animate);
}

// 시작
window.addEventListener('DOMContentLoaded', init);
