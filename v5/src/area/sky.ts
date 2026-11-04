import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { seoulSolarPosition, sunDirection } from "./solar";
import type { AreaMode } from "./buildings";

// [서울 시간의 하늘 / Sky synchronized to Seoul time]
// 태양 위치는 서울 시각과 계절을 따르며 기상 관측은 포함하지 않습니다.
// The sun follows Seoul time and season; observed weather is not represented.
export function createSeoulSky(scene: THREE.Scene, camera: THREE.Camera, mode: () => AreaMode, draw: () => void) {
    const sky = new Sky();
    sky.scale.setScalar(90000);
    sky.frustumCulled = false;
    sky.material.depthWrite = false;
    sky.renderOrder = -1000;
    sky.material.uniforms.turbidity.value = 2.5;
    sky.material.uniforms.rayleigh.value = 1.5;
    sky.material.uniforms.mieCoefficient.value = 0.005;
    sky.material.uniforms.mieDirectionalG.value = 0.8;
    scene.add(sky);
    const ambient = new THREE.HemisphereLight(0xdcecff, 0x77756e, 1);
    const sun = new THREE.DirectionalLight(0xffedcf, 1);
    scene.add(ambient, sun);
    const update = () => {
        const position = seoulSolarPosition(new Date());
        const direction = sunDirection(position, mode());
        const vector = new THREE.Vector3(direction.x, direction.y, direction.z);
        sky.material.uniforms.sunPosition.value.copy(vector);
        sun.position.copy(vector).multiplyScalar(10000);
        const day = THREE.MathUtils.smoothstep(position.elevation, -0.12, 0.2);
        ambient.intensity = 0.85 + 0.75 * day;
        sun.intensity = Math.max(0, Math.sin(position.elevation)) * 2.6;
        scene.background = new THREE.Color(day > 0.05 ? 0x9ab7ca : 0x111d30);
        draw();
    };
    const timer = window.setInterval(update, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", onVisible);
    update();
    return {
        update,
        followCamera: () => sky.position.copy(camera.position),
        dispose: () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
            scene.remove(sky, sun, ambient);
            sky.geometry.dispose(); sky.material.dispose();
        },
    };
}
