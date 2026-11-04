import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BuildingStore, buildingAddress } from "./building-store";
import { geoToWorld, nearbyBuildings, worldToGeo } from "./buildings";
import type { AreaMode, Building, BuildingHit } from "./buildings";

export type Inspection = { hits: BuildingHit[]; easting: number; northing: number; kind: "click" | "view"; visibleCount?: number };
export type InspectionState = { state: "idle" | "loading" | "ready" | "error"; message: string; kind?: "click" | "view" };

// [돋보기와 전시천리안 투사 / Magnifier and all-seeing projection]
// 원본 폴리곤을 공간 타일에서 읽고, 화면에 보이는 점과 읽을 수 있는 레이블을 투사합니다.
// Query source footprints by spatial tile and project visible points with readable labels.
export function createBuildingExplorer(options: {
    host: HTMLElement; element: HTMLCanvasElement; camera: THREE.Camera; controls: OrbitControls;
    detail: THREE.Group; city: () => THREE.Group | null; mode: () => AreaMode; draw: () => void;
    onStart: (kind: "click" | "view") => number; onInspection: (result: Inspection, token: number) => void; onState: (state: InspectionState, token?: number) => void;
    onProjection: (message: string) => void;
}) {
    const { host, element, camera, controls, detail, city, mode, draw, onStart, onInspection, onState, onProjection } = options;
    const abort = new AbortController();
    const store = new BuildingStore(abort.signal);
    const overlay = document.createElement("canvas");
    overlay.className = "area-projection";
    overlay.setAttribute("aria-hidden", "true");
    host.appendChild(overlay);
    const context = overlay.getContext("2d")!;
    let sight = false, magnifier = false, destroyed = false, sequence = 0;
    let features: Building[] = [];
    let points: THREE.Points | null = null;
    let localPoints: THREE.Points | null = null;
    let pointPromise: Promise<void> | null = null;
    let timer = 0;
    let down: { x: number; y: number } | null = null;
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const reportProjection = () => onProjection(mode() === "local" ? "건물 위치 695,753건 중 광화문 범위를 투사 중 · 좌표 이상치 2건은 서울 범위 밖" : "건물 위치 695,753건 투사 중 · 좌표 이상치 2건은 서울 범위 밖");
    const loadPoints = () => {
        if (points) { points.visible = sight && mode() === "seoul"; if (localPoints) localPoints.visible = sight && mode() === "local"; return; }
        if (pointPromise) return;
        onProjection("전시천리안 위치를 불러오고 있습니다.");
        pointPromise = fetch("/v5/area/building-points.bin", { signal: abort.signal }).then(async response => {
            if (!response.ok) throw new Error("point download failed");
            const buffer = await response.arrayBuffer();
            const header = new DataView(buffer);
            if (buffer.byteLength < 8 || String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== "GSP1") throw new Error("invalid point header");
            const count = header.getUint32(4, true);
            if (count !== 695753 || buffer.byteLength !== 8 + count * 12) throw new Error("invalid point count");
            if (destroyed) return;
            const positions = new Float32Array(buffer, 8);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            const material = new THREE.PointsMaterial({ color: 0xf7d549, size: 1.5, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.5 });
            points = new THREE.Points(geometry, material);
            points.name = "전시천리안 서울 건물 위치";
            points.frustumCulled = false; points.renderOrder = 1000; points.visible = sight && mode() === "seoul";
            detail.add(points);
            const local: number[] = [];
            for (let i = 0; i < positions.length; i += 3) {
                if (positions[i] >= -210 && positions[i] <= 240 && positions[i + 2] >= -200 && positions[i + 2] <= 260) local.push(positions[i], positions[i + 1], positions[i + 2]);
            }
            const localGeometry = new THREE.BufferGeometry();
            localGeometry.setAttribute("position", new THREE.Float32BufferAttribute(local, 3));
            localPoints = new THREE.Points(localGeometry, material.clone());
            localPoints.name = "전시천리안 광화문 건물 위치";
            localPoints.frustumCulled = false; localPoints.renderOrder = 1000; localPoints.visible = sight && mode() === "local";
            detail.add(localPoints);
            if (sight) reportProjection();
            draw();
        }).catch(() => { if (!destroyed && sight) onProjection("건물 위치 투사에 실패했습니다. 전시천리안을 다시 켜 주세요."); }).finally(() => { pointPromise = null; });
    };
    const inspect = async (easting: number, northing: number, kind: "click" | "view") => {
        const token = ++sequence;
        const selectionToken = onStart(kind);
        onState({ state: "loading", message: "건물 정보를 불러오고 있습니다.", kind }, selectionToken);
        try {
            const data = await store.around(easting, northing);
            if (destroyed || token !== sequence) return;
            const radius = kind === "click" ? (mode() === "seoul" ? 150 : 75) : 600;
            const hits = nearbyBuildings(data, easting, northing, radius);
            if (kind === "view") features = hits.map(hit => hit.building);
            onInspection({ hits, easting, northing, kind }, selectionToken);
            onState({ state: "ready", message: kind === "click" ? `선택 지점 주변 건물 ${hits.length}건` : `중심 주변 건물 ${hits.length}건`, kind }, selectionToken);
            draw();
        } catch {
            if (!destroyed && token === sequence) onState({ state: "error", message: "건물 정보를 불러오지 못했습니다. 다시 선택해 주세요.", kind }, selectionToken);
        }
    };
    const atCenter = () => {
        const point = worldToGeo(mode(), controls.target.x, controls.target.z);
        void inspect(point.easting, point.northing, "view");
    };
    const schedule = () => {
        if (!sight) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(atCenter, 450);
    };
    const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const pointerUp = (event: PointerEvent) => {
        if (!magnifier || !down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) { down = null; return; }
        down = null;
        window.clearTimeout(timer);
        const rect = element.getBoundingClientRect();
        const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera as THREE.PerspectiveCamera);
        const models = detail.children.filter(child => child.userData.inspectionModel);
        const grid = mode() === "seoul" ? city() : null;
        const candidates = [...models, ...(grid ? grid.children.filter(child => child instanceof THREE.InstancedMesh) : [])];
        let point: THREE.Vector3 | null = raycaster.intersectObjects(candidates, true)[0]?.point || null;
        if (!point) point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
        if (!point) { onState({ state: "error", message: "지면을 선택해 주세요." }); return; }
        const geo = worldToGeo(mode(), point.x, point.z);
        void inspect(geo.easting, geo.northing, "click");
    };
    element.addEventListener("pointerdown", pointerDown);
    element.addEventListener("pointerup", pointerUp);
    controls.addEventListener("end", schedule);

    return {
        configure(nextSight: boolean, nextMagnifier: boolean) {
            sight = nextSight; magnifier = nextMagnifier;
            overlay.hidden = !sight;
            element.style.cursor = magnifier ? "crosshair" : "";
            if (sight) {
                if (points) { points.visible = mode() === "seoul"; if (localPoints) localPoints.visible = mode() === "local"; reportProjection(); draw(); }
                else loadPoints();
                schedule();
            } else { sequence++; if (points) points.visible = false; if (localPoints) localPoints.visible = false; onProjection(""); window.clearTimeout(timer); features = []; draw(); }
        },
        center: atCenter,
        modeChanged() { if (points) points.visible = sight && mode() === "seoul"; if (localPoints) localPoints.visible = sight && mode() === "local"; if (points && sight) reportProjection(); schedule(); },
        paint() {
            const width = host.clientWidth, height = host.clientHeight;
            if (overlay.width !== width || overlay.height !== height) { overlay.width = width; overlay.height = height; }
            context.clearRect(0, 0, width, height);
            if (!sight || controls.getDistance() > 6000) return;
            const occupied: { left: number; top: number; right: number; bottom: number }[] = [];
            let labels = 0;
            for (const building of features) {
                const point = geoToWorld(mode(), building.easting, building.northing);
                if (mode() === "local" && (point.x < -210 || point.x > 240 || point.z < -200 || point.z > 260)) continue;
                const rawHeight = building.fields[16];
                const h = typeof rawHeight === "number" && rawHeight > 0 && rawHeight < 500 ? rawHeight : 3;
                const projected = new THREE.Vector3(point.x, h + 2, point.z).project(camera);
                if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
                const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
                context.fillStyle = "#f7d549"; context.fillRect(x - 2, y - 2, 4, 4);
                if (labels >= 25) continue;
                const address = buildingAddress(building);
                const name = String(building.fields[24] || "건물");
                const use = String(building.fields[9] || "용도 미기재");
                const floors = typeof building.fields[26] === "number" && building.fields[26] > 0 ? `${building.fields[26]}층` : "층수 미기재";
                const heightInfo = typeof rawHeight === "number" && rawHeight > 0 ? `${rawHeight}m` : "높이 미기재";
                const lines = [name, address, `${use} · ${floors} · ${heightInfo}`].map(line => line.length > 23 ? line.slice(0, 22) + "…" : line);
                context.font = "16px sans-serif";
                const textWidth = Math.min(260, Math.max(...lines.map(line => context.measureText(line).width)) + 12);
                const cardHeight = lines.length * 20 + 8;
                const left = Math.max(0, Math.min(width - textWidth, x + 4));
                const top = Math.max(0, Math.min(height - cardHeight, y - cardHeight));
                const rect = { left, top, right: left + textWidth, bottom: top + cardHeight };
                if (occupied.some(other => rect.left < other.right + 4 && rect.right + 4 > other.left && rect.top < other.bottom + 4 && rect.bottom + 4 > other.top)) continue;
                occupied.push(rect); labels++;
                context.fillStyle = "rgba(20, 22, 22, .88)"; context.fillRect(left, top, textWidth, cardHeight);
                context.fillStyle = "#ffffff";
                lines.forEach((line, index) => context.fillText(line, left + 6, top + 19 + index * 20, 248));
            }
        },
        dispose() {
            destroyed = true; sequence++; abort.abort(); window.clearTimeout(timer);
            element.removeEventListener("pointerdown", pointerDown); element.removeEventListener("pointerup", pointerUp);
            controls.removeEventListener("end", schedule); overlay.remove();
            if (points) { detail.remove(points); points.geometry.dispose(); (points.material as THREE.Material).dispose(); }
            if (localPoints) { detail.remove(localPoints); localPoints.geometry.dispose(); (localPoints.material as THREE.Material).dispose(); }
        },
    };
}
