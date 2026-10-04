<script setup lang="ts">
import { Head } from "@inertiajs/vue3";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { decide, show } from "@/routes/crossy-chicken";
import { startCrossyChicken } from "@/lib/crossy-chicken/engine";

defineOptions({
    layout: {
        breadcrumbs: [{ title: "Crossy Chicken", href: show() }],
    },
});

const root = ref<HTMLElement | null>(null);
let stopGame: (() => void) | null = null;

onMounted(() => {
    stopGame = startCrossyChicken(root.value!, { decideUrl: decide().url });
});

onBeforeUnmount(() => stopGame?.());
</script>

<template>
    <Head title="Crossy Chicken" />

    <div ref="root" class="crossy-chicken-page">
        <div class="game">
            <div class="board-wrap">
                <div id="board" class="board"></div>

                <div id="splash" class="splash">
                    <div class="splash-card">
                        <div id="splash-emoji" class="splash-emoji">🐥</div>
                        <h2 id="splash-title" class="splash-title">
                            CROSSY CHICKEN
                        </h2>
                        <p id="splash-sub" class="splash-sub">
                            Cross the road.
                        </p>
                        <div id="splash-score" class="splash-score"></div>
                        <button
                            id="splash-btn"
                            class="splash-btn"
                            type="button"
                        >
                            Play
                        </button>
                        <p class="splash-hint">or press Space</p>
                    </div>
                </div>
            </div>

            <div class="panel">
                <h1>Cross the Road <span>🐥</span></h1>

                <div class="stats">
                    <div class="stat">
                        <span class="label">Score</span>
                        <span id="score" class="value">0</span>
                    </div>
                    <div class="stat">
                        <span class="label">Best</span>
                        <span id="best" class="value">0</span>
                    </div>
                </div>

                <div class="action"><span id="action">READY</span></div>
            </div>
        </div>
    </div>
</template>

<style>
.crossy-chicken-page {
    --cell: 50px;
    --cols: 9;
    --rows: 11;
    box-sizing: border-box;
    margin: 0;
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background:
        radial-gradient(1200px 700px at 15% 0%, #1b2a4a 0%, transparent 60%),
        radial-gradient(900px 700px at 95% 100%, #2a1b3d 0%, transparent 60%),
        #0a0a0f;
    color: #e8e8f0;
    font-family:
        ui-sans-serif,
        system-ui,
        -apple-system,
        Arial,
        sans-serif;
    -webkit-user-select: none;
    user-select: none;

    .game {
        display: flex;
        gap: 24px;
        align-items: flex-start;
    }

    /* ---------------- BOARD ---------------- */

    .board-wrap {
        position: relative;
    }

    .board {
        display: grid;
        grid-template-columns: repeat(var(--cols), var(--cell));
        grid-template-rows: repeat(var(--rows), var(--cell));
        gap: 2px;
        padding: 8px;
        background: #0d0d14;
        border-radius: 18px;
        box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.06),
            0 24px 60px rgba(0, 0, 0, 0.75),
            0 0 100px rgba(70, 150, 255, 0.12);
    }

    .cell {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 5px;
        overflow: hidden;
    }

    .safe {
        background: linear-gradient(180deg, #34343f, #292933);
    }

    .road {
        background: linear-gradient(180deg, #17171f, #101017);
    }

    .road::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 2px;
        transform: translateY(-50%);
        background: repeating-linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.13) 0 12px,
            transparent 12px 26px
        );
        pointer-events: none;
    }

    .goal {
        background: linear-gradient(180deg, #1f7040, #14512c);
        box-shadow: inset 0 0 0 1px rgba(120, 255, 170, 0.12);
    }

    .goal::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(
            circle at 50% 130%,
            rgba(120, 255, 170, 0.3),
            transparent 70%
        );
    }

    .car,
    .frog-icon {
        position: relative;
        z-index: 2;
        line-height: 1;
        will-change: transform;
    }

    .car {
        font-size: 26px;
        filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.7));
    }

    .car.flip {
        transform: scaleX(-1);
    }

    .frog-icon {
        font-size: 30px;
        filter: drop-shadow(0 0 10px rgba(120, 255, 170, 0.85));
    }

    .frog {
        box-shadow: inset 0 0 0 2px rgba(120, 255, 170, 0.45);
    }

    .hop {
        animation: hop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.4);
    }

    /* ---------------- SPLASH ---------------- */

    .splash {
        position: absolute;
        inset: 0;
        z-index: 20;
        display: grid;
        place-items: center;
        border-radius: 18px;
        background: rgba(6, 6, 14, 0.72);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.35s ease;
    }

    .splash.show {
        opacity: 1;
        pointer-events: auto;
    }

    .splash-card {
        width: 320px;
        padding: 30px 26px 24px;
        text-align: center;
        border-radius: 20px;
        background: linear-gradient(160deg, #1e1e2c, #13131d);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow:
            0 30px 70px rgba(0, 0, 0, 0.7),
            inset 0 1px 0 rgba(255, 255, 255, 0.07);
        transform: translateY(18px) scale(0.92);
        opacity: 0;
        transition:
            transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.45),
            opacity 0.3s ease;
    }

    .splash.show .splash-card {
        transform: translateY(0) scale(1);
        opacity: 1;
    }

    .splash-emoji {
        font-size: 56px;
        line-height: 1;
        margin-bottom: 8px;
        animation: bob 2.2s ease-in-out infinite;
    }

    .splash-title {
        margin: 6px 0 6px;
        font-size: 30px;
        font-weight: 800;
        letter-spacing: 0.5px;
        background: linear-gradient(90deg, #7ef0a8, #4fd6ff);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .splash.lose .splash-title {
        background: linear-gradient(90deg, #ff9a9a, #ff4d6d);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .splash-sub {
        margin: 0;
        font-size: 14px;
        color: #9a9ab0;
        line-height: 1.5;
    }

    .splash-score {
        margin-top: 14px;
        font-size: 14px;
        color: #cfd3e6;
        letter-spacing: 0.3px;
    }

    .splash-score:empty {
        display: none;
    }

    .splash-score b {
        color: #7ef0a8;
    }

    .splash-btn {
        margin-top: 20px;
        padding: 13px 30px;
        font: inherit;
        font-weight: 700;
        font-size: 16px;
        letter-spacing: 0.5px;
        color: #06210f;
        background: linear-gradient(180deg, #8dfab6, #37d67a);
        border: none;
        border-radius: 12px;
        cursor: pointer;
        box-shadow:
            0 10px 26px rgba(55, 214, 122, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.55);
        transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            filter 0.15s ease;
    }

    .splash-btn:hover {
        transform: translateY(-2px);
        filter: brightness(1.07);
        box-shadow: 0 16px 32px rgba(55, 214, 122, 0.48);
    }

    .splash-btn:active {
        transform: translateY(0) scale(0.97);
    }

    .splash-hint {
        margin: 12px 0 0;
        font-size: 11px;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: #5f5f75;
    }

    /* ---------------- PANEL ---------------- */

    .panel {
        width: 240px;
        padding: 20px;
        border-radius: 18px;
        background: linear-gradient(180deg, #191924, #12121a);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
    }

    .panel h1 {
        margin: 0 0 18px;
        font-size: 19px;
        letter-spacing: 0.4px;
    }

    .panel h1 span {
        background: linear-gradient(90deg, #7ef0a8, #4fd6ff);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .stats {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .stat {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 9px 12px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .stat .label {
        font-size: 11px;
        letter-spacing: 1.3px;
        text-transform: uppercase;
        color: #7c7c95;
    }

    .stat .value {
        font-size: 18px;
        font-weight: 700;
        color: #e8e8f0;
        font-variant-numeric: tabular-nums;
    }

    .action {
        margin-top: 12px;
        padding: 12px;
        border-radius: 10px;
        text-align: center;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #7ef0a8;
        background: rgba(120, 255, 170, 0.07);
        border: 1px solid rgba(120, 255, 170, 0.18);
        text-shadow: 0 0 14px rgba(120, 255, 170, 0.5);
    }

    .dpad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(3, 42px);
        gap: 8px;
        margin-top: 16px;
    }

    .dpad button {
        font: inherit;
        font-size: 13px;
        color: #cfd3e6;
        background: linear-gradient(180deg, #262633, #1b1b26);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        cursor: pointer;
        transition:
            transform 0.1s ease,
            background 0.15s ease,
            color 0.15s ease;
    }

    .dpad button:hover {
        background: #31314a;
        color: #fff;
    }

    .dpad button:active {
        transform: scale(0.93);
    }

    .dpad [data-dir="up"] {
        grid-column: 2;
        grid-row: 1;
    }

    .dpad [data-dir="left"] {
        grid-column: 1;
        grid-row: 2;
    }

    .dpad [data-dir="down"] {
        grid-column: 2;
        grid-row: 3;
    }

    .dpad [data-dir="right"] {
        grid-column: 3;
        grid-row: 2;
    }

    .hint {
        margin: 16px 0 0;
        font-size: 11px;
        line-height: 1.6;
        text-align: center;
        color: #5f5f75;
        letter-spacing: 0.4px;
    }

    /* ---------------- RESPONSIVE ---------------- */

    @media (max-width: 800px) {
        --cell: 34px;
        padding: 14px;

        .game {
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }

        .panel {
            width: min(100%, 420px);
        }

        .dpad {
            grid-template-rows: repeat(3, 38px);
        }

        .splash-card {
            width: min(88%, 320px);
        }
    }
}
.crossy-chicken-page *,
.crossy-chicken-page *::before,
.crossy-chicken-page *::after {
    box-sizing: border-box;
}

@keyframes hop {
    0% {
        transform: scale(0.65);
    }

    60% {
        transform: scale(1.18);
    }

    100% {
        transform: scale(1);
    }
}
@keyframes bob {
    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-9px);
    }
}
</style>
