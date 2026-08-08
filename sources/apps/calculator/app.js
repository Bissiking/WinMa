const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

const MAX_ENTRY_LENGTH = 16;

function roundResult(value) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return "Erreur";
    const rounded = Number(normalized.toPrecision(12));
    return String(rounded);
}

function formatEntry(value) {
    if (!Number.isFinite(Number(value))) return value;
    const number = Number(value);
    const [integer, decimals = ""] = String(value).split(".");
    const grouped = new Intl.NumberFormat("fr-FR", { useGrouping: true }).format(Number(integer));
    return decimals ? `${grouped},${decimals}` : grouped;
}

export function mount(root) {
    let entry = "0";
    let accumulator = null;
    let pendingOperator = null;
    let waitingForOperand = false;
    let expression = "";

    root.innerHTML = `
        <div class="calculator-app">
            <header class="calculator-header">
                <div><h1>Calculatrice</h1><p>Mode standard</p></div>
            </header>
            <div class="calculator-display" aria-live="polite">
                <span class="calculator-expression" data-calc-expression>&nbsp;</span>
                <output class="calculator-result" data-calc-result>0</output>
            </div>
            <div class="calculator-pad" role="group" aria-label="Clavier de la calculatrice">
                <button class="calc-key calc-key--function" type="button" data-calc-key="clear">C</button>
                <button class="calc-key calc-key--function" type="button" data-calc-key="backspace" aria-label="Effacer le dernier chiffre">⌫</button>
                <button class="calc-key calc-key--function" type="button" data-calc-key="percent">%</button>
                <button class="calc-key calc-key--operator" type="button" data-calc-key="divide" aria-label="Diviser">÷</button>

                <button class="calc-key" type="button" data-calc-key="7">7</button>
                <button class="calc-key" type="button" data-calc-key="8">8</button>
                <button class="calc-key" type="button" data-calc-key="9">9</button>
                <button class="calc-key calc-key--operator" type="button" data-calc-key="multiply" aria-label="Multiplier">×</button>

                <button class="calc-key" type="button" data-calc-key="4">4</button>
                <button class="calc-key" type="button" data-calc-key="5">5</button>
                <button class="calc-key" type="button" data-calc-key="6">6</button>
                <button class="calc-key calc-key--operator" type="button" data-calc-key="subtract" aria-label="Soustraire">−</button>

                <button class="calc-key" type="button" data-calc-key="1">1</button>
                <button class="calc-key" type="button" data-calc-key="2">2</button>
                <button class="calc-key" type="button" data-calc-key="3">3</button>
                <button class="calc-key calc-key--operator" type="button" data-calc-key="add" aria-label="Additionner">+</button>

                <button class="calc-key calc-key--function" type="button" data-calc-key="negate" aria-label="Inverser le signe">±</button>
                <button class="calc-key" type="button" data-calc-key="0">0</button>
                <button class="calc-key" type="button" data-calc-key="dot">,</button>
                <button class="calc-key calc-key--equals" type="button" data-calc-key="equals">=</button>
            </div>
        </div>`;

    const result = root.querySelector("[data-calc-result]");
    const expressionElement = root.querySelector("[data-calc-expression]");

    const symbolFor = { add: "+", subtract: "−", multiply: "×", divide: "÷" };

    function evaluate(left, right, operator) {
        const a = Number(left);
        const b = Number(right);
        if (operator === "add") return a + b;
        if (operator === "subtract") return a - b;
        if (operator === "multiply") return a * b;
        if (operator === "divide") return b === 0 ? "Erreur" : a / b;
        return right;
    }

    function render() {
        result.textContent = formatEntry(entry);
        expressionElement.textContent = expression || "\u00a0";
    }

    function inputDigit(digit) {
        if (waitingForOperand) { entry = digit; waitingForOperand = false; }
        else entry = entry === "0" || entry === "Erreur" ? digit : entry.length < MAX_ENTRY_LENGTH ? entry + digit : entry;
        render();
    }

    function inputDot() {
        if (entry === "Erreur") entry = "0";
        if (waitingForOperand) { entry = "0,"; waitingForOperand = false; }
        else if (!String(entry).includes(".")) entry = `${entry}.`;
        render();
    }

    function inputOperator(operator) {
        if (entry === "Erreur") return;
        if (pendingOperator && !waitingForOperand) {
            const computed = evaluate(accumulator, entry, pendingOperator);
            if (computed === "Erreur") { entry = "Erreur"; accumulator = null; pendingOperator = null; expression = ""; render(); return; }
            entry = roundResult(computed);
        }
        accumulator = Number(entry);
        pendingOperator = operator;
        expression = `${formatEntry(roundResult(accumulator))} ${symbolFor[operator]}`;
        waitingForOperand = true;
        render();
    }

    function inputEquals() {
        if (entry === "Erreur" || !pendingOperator) return;
        const computed = evaluate(accumulator, entry, pendingOperator);
        expression = `${formatEntry(roundResult(accumulator))} ${symbolFor[pendingOperator]} ${formatEntry(entry)} =`;
        if (computed === "Erreur") { entry = "Erreur"; }
        else { entry = roundResult(computed); }
        accumulator = null;
        pendingOperator = null;
        waitingForOperand = true;
        render();
    }

    function clear() {
        entry = "0";
        accumulator = null;
        pendingOperator = null;
        waitingForOperand = false;
        expression = "";
        render();
    }

    function backspace() {
        if (waitingForOperand || entry === "Erreur") { entry = "0"; }
        else entry = String(entry).length > 1 ? String(entry).slice(0, -1) : "0";
        render();
    }

    function negate() {
        if (entry === "Erreur") return;
        entry = entry.startsWith("-") ? entry.slice(1) : `-${entry}`;
        if (entry === "-0") entry = "0";
        render();
    }

    function percent() {
        if (entry === "Erreur") return;
        entry = roundResult(Number(entry) / 100);
        render();
    }

    const actions = { clear, backspace, percent, negate };
    const digits = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    const operators = { add: "add", subtract: "subtract", multiply: "multiply", divide: "divide" };

    const onClick = (event) => {
        const key = event.target.closest("[data-calc-key]")?.dataset.calcKey;
        if (!key) return;
        if (key === "equals") inputEquals();
        else if (key === "dot") inputDot();
        else if (key === "negate") negate();
        else if (key === "clear") clear();
        else if (key === "backspace") backspace();
        else if (key === "percent") percent();
        else if (digits.has(key)) inputDigit(key);
        else if (operators[key]) inputOperator(key);
    };

    const onKeyDown = (event) => {
        const k = event.key;
        if (k === "Enter" || k === "=") { event.preventDefault(); inputEquals(); }
        else if (k === "Backspace") { event.preventDefault(); backspace(); }
        else if (k === "Escape") { event.preventDefault(); clear(); }
        else if (k === "." || k === ",") { event.preventDefault(); inputDot(); }
        else if (k === "+") { event.preventDefault(); inputOperator("add"); }
        else if (k === "-") { event.preventDefault(); inputOperator("subtract"); }
        else if (k === "*") { event.preventDefault(); inputOperator("multiply"); }
        else if (k === "/") { event.preventDefault(); inputOperator("divide"); }
        else if (/^[0-9]$/.test(k)) inputDigit(k);
    };

    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeyDown);
    render();
    return () => {
        root.removeEventListener("click", onClick);
        root.removeEventListener("keydown", onKeyDown);
    };
}
