// @ts-nocheck
/* Crossy Chicken engine — Kai decides every move. Ported from the standalone project. */

function csrfToken() {
    return decodeURIComponent(
        document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? "",
    );
}

export function startCrossyChicken(root, config = {}) {
    const CFG = Object.assign(
        {
            decideUrl: "/api/decision",
            timeoutMs: 8000,
            retryDelayMs: 60,
            doubleMoveMs: 100,
            carBaseMs: 420,
        },
        config,
    );

    const ROWS = 11;
    const COLS = 9;

    /* ---------------- board ---------------- */

    function pickRoadRows() {
        const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const count = 3 + Math.floor(Math.random() * 2);
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const rows = [];
        for (const r of shuffled) {
            if (rows.length >= count) break;
            if (rows.some((x) => Math.abs(x - r) < 2)) continue;
            rows.push(r);
        }
        return rows.sort((a, b) => a - b);
    }

    function generateCars() {
        const cars = [];
        for (const row of pickRoadRows()) {
            const direction = Math.random() < 0.5 ? 1 : -1;
            const interval = 320 + Math.floor(Math.random() * 380);
            const count = 2 + Math.floor(Math.random() * 3);

            const occupied = new Set();
            while (occupied.size < count)
                occupied.add(Math.floor(Math.random() * COLS));
            for (const column of occupied)
                cars.push({ row, column, direction, interval });

            if (Math.random() < 0.5) {
                cars.push({
                    row,
                    column: direction === 1 ? -1 : COLS,
                    direction,
                    interval,
                });
            }
        }
        return cars;
    }

    const CAR_SETUP = generateCars();

    function getRowInterval(row) {
        const car = cars.find((c) => c.row === row);
        return car?.interval ?? CFG.carBaseMs;
    }

    /* ---------------- DOM ---------------- */

    const board = root.querySelector("#board");
    const action = root.querySelector("#action");
    const scoreEl = root.querySelector("#score");
    const bestEl = root.querySelector("#best");
    const splash = root.querySelector("#splash");
    const splashEmoji = root.querySelector("#splash-emoji");
    const splashTitle = root.querySelector("#splash-title");
    const splashSub = root.querySelector("#splash-sub");
    const splashScore = root.querySelector("#splash-score");
    const splashBtn = root.querySelector("#splash-btn");

    /* ---------------- state ---------------- */

    let frog, cars, state, score, best, furthest, justMoved;
    let carTimer, aiTimer;
    let deathMemory = null;

    let lastCarMoveAt = 0;

    /* ---------------- persistence ---------------- */

    function loadBest() {
        try {
            return Number(localStorage.getItem("kai-best")) || 0;
        } catch {
            return 0;
        }
    }
    function saveBest(v) {
        try {
            localStorage.setItem("kai-best", String(v));
        } catch {}
    }

    /* ---------------- splash ---------------- */

    function showSplash({ emoji, title, sub, scoreLine, button, variant }) {
        splashEmoji.textContent = emoji;
        splashTitle.textContent = title;
        splashSub.textContent = sub;
        splashScore.innerHTML = scoreLine || "";
        splashBtn.textContent = button;
        splash.className = "splash show" + (variant ? " " + variant : "");
    }
    function hideSplash() {
        splash.className = "splash";
    }
    function updateStats() {
        scoreEl.textContent = score;
        bestEl.textContent = best;
    }

    /* ---------------- core rules ---------------- */

    function checkCollision(frogState = frog, carState = cars) {
        return carState.some(
            (car) =>
                car.row === frogState.row && car.column === frogState.column,
        );
    }

    function moveFrogState(frogState, move) {
        const dirs = {
            UP: [-1, 0],
            DOWN: [1, 0],
            LEFT: [0, -1],
            RIGHT: [0, 1],
            WAIT: [0, 0],
        };
        const dir = dirs[move];
        if (!dir) return null;
        const [dr, dc] = dir;
        const row = frogState.row + dr;
        const column = frogState.column + dc;
        if (row < 0 || row >= ROWS || column < 0 || column >= COLS) return null;
        return { row, column };
    }

    /* ---------------- time model ---------------- */

    function getCarPositionAt(car, milliseconds) {
        const interval = car.interval ?? CFG.carBaseMs;
        const ticks = Math.floor(milliseconds / interval);
        let column = car.column;
        for (let i = 0; i < ticks; i++) {
            column += car.direction;
            if (column >= COLS) column = -1;
            if (column < -1) column = COLS;
        }
        return column;
    }

    function getCarsAtTime(ms) {
        return cars.map((car) => ({
            ...car,
            column: getCarPositionAt(car, ms),
        }));
    }

    function evaluatePositionAtTime(frogPosition, ms) {
        const futureCars = getCarsAtTime(ms);
        return {
            collision: futureCars.some(
                (car) =>
                    car.row === frogPosition.row &&
                    car.column === frogPosition.column,
            ),
        };
    }

    /* ---------------- simulation ---------------- */

    function simulateSequence(sequence) {
        let simulatedFrog = { ...frog };
        let elapsed = 0;

        if (evaluatePositionAtTime(simulatedFrog, 0).collision) {
            return { safe: false, reason: "frog already on a car" };
        }

        for (let i = 0; i < sequence.length; i++) {
            simulatedFrog = moveFrogState(simulatedFrog, sequence[i]);
            if (!simulatedFrog)
                return { safe: false, reason: "move leaves board" };

            if (evaluatePositionAtTime(simulatedFrog, elapsed).collision) {
                return { safe: false, reason: "immediate collision" };
            }
            if (i < sequence.length - 1) elapsed += CFG.doubleMoveMs;
        }

        const fastestInterval = Math.min(
            ...cars.map((c) => c.interval ?? CFG.carBaseMs),
        );
        const safetyHorizon =
            elapsed + CFG.retryDelayMs + fastestInterval * 1.5;
        const step = Math.max(40, Math.floor(fastestInterval / 3));
        const dangers = [];

        for (let t = 0; t <= safetyHorizon; t += step) {
            if (evaluatePositionAtTime(simulatedFrog, t).collision)
                dangers.push(t);
        }

        return {
            safe: dangers.length === 0,
            reason: dangers.length ? `collision in ${dangers[0]}ms` : "safe",
            frog: simulatedFrog,
            elapsed,
            dangers,
        };
    }

    /* ---------------- scoring ---------------- */

    function getCandidateActions() {
        return [
            ["UP"],
            ["LEFT"],
            ["RIGHT"],
            ["WAIT"],
            ["UP", "UP"],
            ["LEFT", "UP"],
            ["RIGHT", "UP"],
        ].map((sequence) => ({ sequence, result: simulateSequence(sequence) }));
    }

    function getActionValue(candidate) {
        const seq = candidate.sequence;
        const final = candidate.result.frog;
        if (!final) return -Infinity;

        let value = 0;
        value += (frog.row - final.row) * 1000;
        if (seq.length === 2) value += 400;
        if (seq[0] === "WAIT") value -= 2000;
        if (seq[0] === "LEFT" || seq[0] === "RIGHT") value -= 30;
        if (final.column === 0 || final.column === COLS - 1) value -= 200;

        if (final.row > 0) {
            const rowAboveCars = cars.filter(
                (c) => c.row === final.row - 1,
            ).length;
            value += (COLS - rowAboveCars) * 8;
        }
        if (final.row === 0) value += 100000;
        return value;
    }

    function getSafePool() {
        let safe = getCandidateActions().filter((c) => c.result.safe);

        if (
            deathMemory &&
            deathMemory.row === frog.row &&
            deathMemory.column === frog.column
        ) {
            const filtered = safe.filter(
                (c) => c.sequence.join("_") !== deathMemory.move,
            );
            if (filtered.length) safe = filtered;
        }

        safe.sort((a, b) => getActionValue(b) - getActionValue(a));
        return safe;
    }

    /* ---------------- prompt ---------------- */

    function buildGameState(pool) {
        const lines = pool.map((c) => {
            const name = c.sequence.join("_");
            const f = c.result.frog;
            const v = getActionValue(c);
            const tag =
                name === "WAIT"
                    ? "stall — last resort"
                    : f.row < frog.row - 1
                      ? "big forward"
                      : f.row < frog.row
                        ? "forward"
                        : f.column !== frog.column
                          ? "lane change"
                          : "hold";
            return `- ${name} → row ${f.row}, col ${f.column} (value ${v}, ${tag})`;
        });

        const roadRows = [...new Set(cars.map((c) => c.row))].sort(
            (a, b) => a - b,
        );
        const rowSpeeds = roadRows
            .map((r) => `row ${r}: ${getRowInterval(r)}ms`)
            .join(", ");

        return `Crossy Chicken. Reach row 0. Cars kill on contact.

Frog: row ${frog.row}, col ${frog.column}. Rows to goal: ${frog.row}.
Traffic: ${rowSpeeds || "none"}.

Safe moves (highest value first):
${lines.join("\n")}

Pick the highest-value move. Reply with the action name only.`;
    }

    /* ---------------- end of game ---------------- */

    function finish(win) {
        state = "over";
        clearTimeout(carTimer);
        clearTimeout(aiTimer);

        action.textContent = win ? "🏆 WIN" : "💥 CRASH";

        const newBest = score > best;
        if (newBest) {
            best = score;
            saveBest(best);
        }
        updateStats();
        draw();

        const scoreLine =
            score > 0
                ? `Score <b>${score}</b>${newBest ? " &nbsp;·&nbsp; 🎉 New best!" : ` &nbsp;·&nbsp; Best ${best}`}`
                : "";

        setTimeout(() => {
            showSplash(
                win
                    ? {
                          emoji: "🏆",
                          title: "YOU WIN!",
                          sub: "You made it across the road.",
                          scoreLine,
                          button: "Play Again",
                          variant: "win",
                      }
                    : {
                          emoji: "💥",
                          title: "GAME OVER",
                          sub: "Squashed by traffic. Ouch.",
                          scoreLine,
                          button: "Try Again",
                          variant: "lose",
                      },
            );
        }, 340);
    }

    /* ---------------- car loop ---------------- */

    const rowNextTick = {};

    function initRowTicks() {
        const now = performance.now();
        for (const row of [...new Set(cars.map((c) => c.row))]) {
            rowNextTick[row] = now + getRowInterval(row);
        }
    }

    function heartbeat() {
        if (state !== "playing") return;
        const now = performance.now();
        let moved = false;

        for (const row of Object.keys(rowNextTick)) {
            const r = Number(row);
            if (now >= rowNextTick[row]) {
                cars = cars.map((car) => {
                    if (car.row !== r) return car;
                    let column = car.column + car.direction;
                    if (column >= COLS) column = -1;
                    if (column < -1) column = COLS;
                    return { ...car, column };
                });
                rowNextTick[row] = now + getRowInterval(r);
                moved = true;
            }
        }

        if (moved) {
            lastCarMoveAt = now;
            if (checkCollision()) {
                finish(false);
                return;
            }
            draw();
        }
        carTimer = setTimeout(heartbeat, 30);
    }

    function startCarLoop() {
        clearTimeout(carTimer);
        initRowTicks();
        carTimer = setTimeout(heartbeat, 30);
    }

    /* ---------------- frog movement ---------------- */

    function moveFrog(rowDelta, columnDelta, name) {
        if (state !== "playing") return false;

        const newRow = frog.row + rowDelta;
        const newColumn = frog.column + columnDelta;

        if (
            newRow < 0 ||
            newRow >= ROWS ||
            newColumn < 0 ||
            newColumn >= COLS
        ) {
            action.textContent = "BLOCKED";
            return false;
        }

        frog.row = newRow;
        frog.column = newColumn;
        justMoved = true;
        action.textContent = name;

        if (frog.row < furthest) {
            furthest = frog.row;
            score = (ROWS - 1 - frog.row) * 10;
            updateStats();
        }

        if (checkCollision()) {
            deathMemory = {
                row: frog.row,
                column: frog.column,
                move: name.replace("KAI ", "").trim(),
            };
            finish(false);
            return false;
        }

        if (frog.row === 0) {
            finish(true);
            return false;
        }

        draw();
        return true;
    }

    /* ---------------- render ---------------- */

    function draw() {
        const frag = document.createDocumentFragment();

        for (let row = 0; row < ROWS; row++) {
            for (let column = 0; column < COLS; column++) {
                const cell = document.createElement("div");
                const isRoad = cars.some((c) => c.row === row);

                cell.className =
                    "cell " + (row === 0 ? "goal" : isRoad ? "road" : "safe");

                const car = cars.find(
                    (c) => c.row === row && c.column === column,
                );
                if (car) {
                    const span = document.createElement("span");
                    span.className = "car";
                    span.textContent = car.direction === 1 ? "🚗" : "🚙";
                    cell.appendChild(span);
                }

                if (row === frog.row && column === frog.column) {
                    cell.classList.add("frog");
                    const f = document.createElement("span");
                    f.className = "frog-icon" + (justMoved ? " hop" : "");
                    f.textContent = "🐥";
                    cell.appendChild(f);
                }

                frag.appendChild(cell);
            }
        }

        board.innerHTML = "";
        board.appendChild(frag);
        justMoved = false;
    }

    /* ---------------- Kai ---------------- */

    async function askKai(pool) {
        const criteria = {};
        for (const c of pool) {
            const name = c.sequence.join("_");
            const f = c.result.frog;
            const v = getActionValue(c);
            const rowsGained = frog.row - f.row;

            const progress =
                rowsGained > 1
                    ? `reach row ${f.row} (${rowsGained} rows forward)`
                    : rowsGained === 1
                      ? `reach row ${f.row} (1 row forward)`
                      : name === "WAIT"
                        ? "do nothing — stall"
                        : `reach col ${f.column} (no forward progress)`;

            criteria[name] = `value=${v} · ${progress}`;
        }

        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), CFG.timeoutMs);

        let res;
        try {
            res = await fetch(CFG.decideUrl, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "X-XSRF-TOKEN": csrfToken(),
                },
                body: JSON.stringify({
                    state: buildGameState(pool),
                    questions: {
                        move: {
                            type: "choice",
                            instructions:
                                "You are playing Crossy Chicken. Reach row 0. " +
                                "Every option is ALREADY safe. Pick the HIGHEST value. " +
                                "Forward moves (UP, UP_UP) are always preferred. " +
                                "WAIT is a stall and should only be chosen if it is the ONLY safe move. " +
                                "Reply with the action name only.",
                            criteria,
                        },
                    },
                }),
                signal: controller.signal,
            });
        } catch (e) {
            clearTimeout(t);
            throw new Error(`[KAI] fetch failed: ${e.message}`);
        }
        clearTimeout(t);

        const raw = await res.text();
        if (!res.ok)
            throw new Error(`[KAI] HTTP ${res.status} — ${raw.slice(0, 200)}`);
        if (!raw.trim()) throw new Error("[KAI] empty body");

        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            throw new Error(`[KAI] bad JSON: ${raw.slice(0, 200)}`);
        }

        const rawChoice =
            data?.move?.choice ??
            data?.answers?.move?.choice ??
            data?.choice ??
            (typeof data === "string" ? data : null);

        const clean = String(rawChoice || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z_]/g, "")
            .replace(/\s+/g, "_");

        const valid = pool.map((c) => c.sequence.join("_"));
        if (!valid.includes(clean)) {
            throw new Error(
                `[KAI] "${rawChoice}" → "${clean}" not in [${valid.join(", ")}]`,
            );
        }

        return clean;
    }

    async function kaiMove() {
        if (state !== "playing") return;
        action.textContent = "🧠 KAI";

        const safePool = getSafePool();

        if (!safePool.length) {
            action.textContent = "⏳ HOLD";
            aiTimer = setTimeout(kaiMove, CFG.retryDelayMs);
            return;
        }

        /*  WAIT stays in the pool ONLY when no non-WAIT move is safe.
        If any forward or sideways move exists, WAIT is stripped so
        Kai can't stall. */
        const nonWait = safePool.filter((c) => c.sequence[0] !== "WAIT");
        const poolToSend = nonWait.length ? nonWait : safePool;

        // Order: forward first, then sideways, WAIT last (if present).
        const rank = {
            UP_UP: 0,
            LEFT_UP: 0,
            RIGHT_UP: 0,
            UP: 1,
            LEFT: 2,
            RIGHT: 2,
            WAIT: 9,
        };
        poolToSend.sort((a, b) => {
            const an = a.sequence.join("_"),
                bn = b.sequence.join("_");
            return (rank[an] ?? 5) - (rank[bn] ?? 5);
        });

        let decision;
        try {
            decision = await askKai(poolToSend);
        } catch (err) {
            console.error(err);
            state = "over";
            clearTimeout(carTimer);
            clearTimeout(aiTimer);
            action.textContent = "❌ KAI FAILED";
            draw();
            showSplash({
                emoji: "🛑",
                title: "KAI FAILED",
                sub: String(err.message || err).slice(0, 220),
                scoreLine: "Is the Kai service running? Then Play Again.",
                button: "Try Again",
                variant: "lose",
            });
            return;
        }

        if (state !== "playing") return;

        // If Kai picked WAIT but a non-WAIT option was available, override.
        if (decision === "WAIT" && nonWait.length) {
            const forced = nonWait[0].sequence.join("_");
            console.warn(`[KAI] chose WAIT — overriding to ${forced}`);
            decision = forced;
        }

        // Re-verify against current car positions.
        const recheck = getSafePool().map((c) => c.sequence.join("_"));
        if (!recheck.includes(decision)) {
            action.textContent = "⏳ RECHECK";
            aiTimer = setTimeout(kaiMove, CFG.retryDelayMs);
            return;
        }

        console.log("[KAI] →", decision);
        action.textContent = `🤖 ${decision}`;

        const sequence = decision.split("_");
        for (let i = 0; i < sequence.length; i++) {
            if (state !== "playing") return;
            const move = sequence[i];

            if (move === "UP") {
                if (!moveFrog(-1, 0, "KAI UP")) return;
            }
            if (move === "LEFT") {
                if (!moveFrog(0, -1, "KAI LEFT")) return;
            }
            if (move === "RIGHT") {
                if (!moveFrog(0, 1, "KAI RIGHT")) return;
            }
            if (move === "WAIT") {
                action.textContent = "KAI WAIT";
            }

            if (state !== "playing") return;
            if (i < sequence.length - 1) {
                await new Promise((r) => setTimeout(r, CFG.doubleMoveMs));
            }
        }

        if (state !== "playing") return;
        aiTimer = setTimeout(kaiMove, CFG.retryDelayMs);
    }

    /* ---------------- lifecycle ---------------- */

    function resetGame() {
        clearTimeout(carTimer);
        clearTimeout(aiTimer);

        const fresh = generateCars();
        cars.length = 0;
        for (const c of fresh) cars.push(c);

        frog = { row: 10, column: 4 };
        state = "playing";
        score = 0;
        furthest = 10;
        justMoved = false;
        deathMemory = null;
        lastCarMoveAt = performance.now();

        action.textContent = "GO!";
        updateStats();
        hideSplash();
        draw();

        startCarLoop();
        kaiMove();
    }

    /* ---------------- input ---------------- */

    function handleKeydown(event) {
        const key = event.key;
        if (key === " " || key === "Enter") {
            event.preventDefault();
            if (state !== "playing") resetGame();
            return;
        }
        if (state !== "playing") return;

        switch (key) {
            case "ArrowUp":
            case "w":
            case "W":
                event.preventDefault();
                moveFrog(-1, 0, "UP");
                break;
            case "ArrowDown":
            case "s":
            case "S":
                event.preventDefault();
                moveFrog(1, 0, "DOWN");
                break;
            case "ArrowLeft":
            case "a":
            case "A":
                event.preventDefault();
                moveFrog(0, -1, "LEFT");
                break;
            case "ArrowRight":
            case "d":
            case "D":
                event.preventDefault();
                moveFrog(0, 1, "RIGHT");
                break;
        }
    }

    document.addEventListener("keydown", handleKeydown);

    splashBtn.addEventListener("click", () => {
        splashBtn.blur();
        resetGame();
    });

    root.querySelectorAll(".dpad button").forEach((button) => {
        button.addEventListener("click", () => {
            if (state !== "playing") return;
            switch (button.dataset.dir) {
                case "up":
                    moveFrog(-1, 0, "UP");
                    break;
                case "down":
                    moveFrog(1, 0, "DOWN");
                    break;
                case "left":
                    moveFrog(0, -1, "LEFT");
                    break;
                case "right":
                    moveFrog(0, 1, "RIGHT");
                    break;
            }
            button.blur();
        });
    });

    /* ---------------- boot ---------------- */

    frog = { row: 10, column: 4 };
    cars = CAR_SETUP.map((c) => ({ ...c }));
    state = "start";
    score = 0;
    furthest = 10;
    justMoved = false;
    best = loadBest();

    updateStats();
    draw();

    showSplash({
        emoji: "🐥",
        title: "Cross the Road 🐥",
        sub: "Kai decides every move.",
        scoreLine: "",
        button: "Play",
        variant: "start",
    });

    return () => {
        state = "destroyed";
        clearTimeout(carTimer);
        clearTimeout(aiTimer);
        document.removeEventListener("keydown", handleKeydown);
    };
}
