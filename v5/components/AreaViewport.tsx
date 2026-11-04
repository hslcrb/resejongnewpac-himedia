"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { gridCellPosition, isDetailedArea, SEJONG_IN_SEOUL } from "../src/area/coordinates";

export type AreaMode = "local" | "seoul";
export type AreaStatus = { state: "loading" | "ready" | "error"; message: string };
type CityData = { version: number; cells: [number, number, number, number][] };
type SceneController = { setMode: (mode: AreaMode) => void; reset: () => void; zoom: (factor: number) => void; rotate: (angle: number) => void };

// [3D 장면과 자원 수명 / 3D scene and resource lifecycle]
// 상세 회관은 공유하고 서울 격자는 처음 선택할 때만 불러옵니다.
// Share the detailed model and load the Seoul grid only on first selection.
export default function AreaViewport({ mode, resetCount, zoom, rotation, onStatus }: {
    mode: AreaMode;
    resetCount: number;
    zoom: { serial: number; factor: number };
    rotation: { serial: number; angle: number };
    onStatus: (status: AreaStatus) => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const controller = useRef<SceneController | null>(null);
    const desiredMode = useRef(mode);
    desiredMode.current = mode;

    useEffect(() => {
        const host = container.current;
        if (!host) return;
        let disposed = false;
        let sequence = 0;
        let cityPromise: Promise<THREE.Group> | null = null;
        const abort = new AbortController();
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        } catch {
            onStatus({ state: "error", message: "3D 화면을 표시할 수 없습니다. 브라우저의 WebGL 사용 가능 여부를 확인해 주세요." });
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0xd9dedb);
        renderer.domElement.setAttribute("aria-hidden", "true");
        host.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xd9dedb);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x77756e, 2));
        const sunlight = new THREE.DirectionalLight(0xffffff, 2);
        sunlight.position.set(5000, 10000, 7000);
        scene.add(sunlight);
        const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 160000);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;
        controls.maxPolarAngle = Math.PI * 0.49;
        const detail = new THREE.Group();
        scene.add(detail);
        let city: THREE.Group | null = null;
        let detailLoaded = false;
        let detailFailed = false;
        let currentMode: AreaMode = desiredMode.current;
        let frame = 0;
        const draw = () => {
            if (disposed || frame) return;
            frame = window.requestAnimationFrame(() => { frame = 0; if (!disposed) renderer.render(scene, camera); });
        };
        controls.addEventListener("change", draw);
        const resize = () => {
            const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            draw();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);

        const reset = () => {
            if (currentMode === "local") {
                controls.target.set(0, 9, -30);
                camera.near = 0.5;
                camera.position.set(250, 190, 300);
                camera.position.sub(controls.target).multiplyScalar(Math.max(1, 1.05 / camera.aspect)).add(controls.target);
                controls.minDistance = 25;
                controls.maxDistance = 1000;
            } else {
                controls.target.set(-450, 0, -1700);
                camera.near = 30;
                camera.position.set(18000, 42000, 25000);
                camera.position.sub(controls.target).multiplyScalar(Math.max(1, 1.05 / camera.aspect)).add(controls.target);
                controls.minDistance = 400;
                controls.maxDistance = 140000;
            }
            camera.updateProjectionMatrix();
            controls.update();
            draw();
        };
        const disposeObject = (object: THREE.Object3D) => {
            object.traverse((child) => {
                if (!(child instanceof THREE.Mesh)) return;
                child.geometry.dispose();
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                for (const material of materials) {
                    for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
                    material.dispose();
                }
            });
        };
        const loadCity = async () => {
            if (!cityPromise) {
                cityPromise = fetch("/v5/area/seoul-grid.json", { signal: abort.signal }).then(async (response) => {
                    if (!response.ok) throw new Error("서울 데이터를 불러오지 못했습니다.");
                    const data = await response.json() as CityData;
                    if (data.version !== 1 || data.cells.length !== 123626) throw new Error("서울 데이터 형식이 올바르지 않습니다.");
                    const buckets: [number, number, number, number][][] = [[], [], []];
                    for (const row of data.cells) {
                        const pos = gridCellPosition(row[0], row[1], row[2]);
                        if (!isDetailedArea(pos.x, pos.z) && row[3] >= 0 && row[3] <= 2) buckets[row[3]].push(row);
                    }
                    const group = new THREE.Group();
                    group.name = "서울 50m 격자";
                    const colors = [0xe2e9e6, 0xd2c6ae, 0xc89473];
                    for (let index = 0; index < buckets.length; index++) {
                        const geometry = new THREE.BoxGeometry(47, 1, 47);
                        const material = new THREE.MeshStandardMaterial({ color: colors[index], roughness: 0.9 });
                        const mesh = new THREE.InstancedMesh(geometry, material, buckets[index].length);
                        const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), position = new THREE.Vector3();
                        const rotation = new THREE.Quaternion();
                        buckets[index].forEach((row, i) => {
                            const pos = gridCellPosition(row[0], row[1], row[2]);
                            position.set(pos.x, pos.y, pos.z); scale.set(1, row[2], 1);
                            matrix.compose(position, rotation, scale); mesh.setMatrixAt(i, matrix);
                        });
                        mesh.instanceMatrix.needsUpdate = true;
                        mesh.computeBoundingSphere();
                        group.add(mesh);
                    }
                    const base = new THREE.Mesh(new THREE.PlaneGeometry(44000, 34000), new THREE.MeshStandardMaterial({ color: 0x4c6470, roughness: 1 }));
                    base.rotation.x = -Math.PI / 2; base.position.set(0, -1, -2000); group.add(base);
                    const marker = new THREE.Mesh(new THREE.RingGeometry(250, 350, 48), new THREE.MeshBasicMaterial({ color: 0xf7d549, side: THREE.DoubleSide }));
                    marker.rotation.x = -Math.PI / 2; marker.position.set(SEJONG_IN_SEOUL.x, 100, SEJONG_IN_SEOUL.z); group.add(marker);
                    if (disposed) { disposeObject(group); throw new Error("viewer disposed"); }
                    return group;
                }).catch((error) => { cityPromise = null; throw error; });
            }
            return cityPromise;
        };
        const setMode = async (next: AreaMode) => {
            currentMode = next;
            const token = ++sequence;
            onStatus({ state: "loading", message: next === "local" ? "세종문화회관 주변을 불러오고 있습니다." : "서울 전역을 불러오고 있습니다." });
            if (city) city.visible = next === "seoul";
            detail.rotation.y = next === "seoul" ? SEJONG_IN_SEOUL.rotationY : 0;
            detail.position.set(next === "seoul" ? SEJONG_IN_SEOUL.x : 0, 0, next === "seoul" ? SEJONG_IN_SEOUL.z : 0);
            reset();
            if (detailFailed) {
                onStatus({ state: "error", message: "세종문화회관 모형을 불러오지 못했습니다. 다시 시도해 주세요." });
                return;
            }
            try {
                if (next === "seoul") {
                    const loaded = await loadCity();
                    if (disposed) return;
                    if (!city) { city = loaded; scene.add(city); }
                    city.visible = currentMode === "seoul";
                    if (token !== sequence) return;
                }
                if (disposed || token !== sequence) return;
                if (detailLoaded) onStatus({ state: "ready", message: next === "local" ? "세종문화회관과 광화문 주변" : "서울 전역과 광화문 주변" });
                draw();
            } catch {
                if (!disposed && token === sequence) onStatus({ state: "error", message: "서울 전역을 불러오지 못했습니다. 다시 시도해 주세요." });
            }
        };
        controller.current = { setMode: (value) => void setMode(value), reset, zoom: (factor) => {
            const offset = camera.position.clone().sub(controls.target);
            const distance = Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() * factor));
            camera.position.copy(controls.target).add(offset.setLength(distance)); controls.update(); draw();
        }, rotate: (angle) => {
            const offset = camera.position.clone().sub(controls.target);
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            camera.position.copy(controls.target).add(offset); controls.update(); draw();
        } };
        resize();
        void setMode(currentMode);
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        loader.load("/v5/area/sejong-area.glb", (gltf) => {
            if (disposed) { disposeObject(gltf.scene); return; }
            detail.add(gltf.scene);
            detailLoaded = true;
            if (currentMode === "local" || city) onStatus({ state: "ready", message: currentMode === "local" ? "세종문화회관과 광화문 주변" : "서울 전역과 광화문 주변" });
            draw();
        }, undefined, () => {
            detailFailed = true;
            if (!disposed) onStatus({ state: "error", message: "세종문화회관 모형을 불러오지 못했습니다. 다시 시도해 주세요." });
        });
        return () => {
            disposed = true; sequence++; abort.abort(); controller.current = null;
            observer.disconnect(); controls.removeEventListener("change", draw); controls.dispose();
            if (frame) window.cancelAnimationFrame(frame);
            disposeObject(scene); renderer.dispose(); renderer.domElement.remove();
        };
    }, [onStatus]);

    useEffect(() => { controller.current?.setMode(mode); }, [mode]);
    useEffect(() => { if (resetCount) controller.current?.reset(); }, [resetCount]);
    useEffect(() => { if (zoom.serial) controller.current?.zoom(zoom.factor); }, [zoom]);
    useEffect(() => { if (rotation.serial) controller.current?.rotate(rotation.angle); }, [rotation]);
    return <div ref={container} className="area-viewport-canvas" data-component-part="area-viewport" data-component-owner="area-experience" aria-hidden="true" />;
}
