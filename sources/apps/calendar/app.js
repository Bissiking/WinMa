const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES_FULL = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const STORAGE_KEY = "luma.calendar.events";

function toISODate(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDayLabel(date) {
    const dateObj = new Date(date + "T12:00:00");
    return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(dateObj);
}

export function mount(root) {
    let now = new Date();
    let viewYear = now.getFullYear();
    let viewMonth = now.getMonth();
    let selectedDate = toISODate(viewYear, viewMonth, now.getDate());
    let events = [];
    try { events = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { events = []; }

    const isToday = (date) => {
        const today = new Date();
        return date === toISODate(today.getFullYear(), today.getMonth(), today.getDate());
    };

    const eventsFor = (date) => events.filter((event) => event.date === date);

    root.innerHTML = `
        <div class="calendar-app">
            <header class="calendar-header">
                <div>
                    <h1>Calendrier</h1>
                    <p class="calendar-month-title" data-calendar-month-title></p>
                </div>
                <div class="calendar-nav">
                    <button type="button" class="calendar-nav-button" data-calendar-nav="prev" aria-label="Mois précédent">${icon("chevron")}</button>
                    <button type="button" class="calendar-nav-button calendar-nav-button--today" data-calendar-nav="today">Aujourd'hui</button>
                    <button type="button" class="calendar-nav-button" data-calendar-nav="next" aria-label="Mois suivant">${icon("chevron")}</button>
                </div>
            </header>

            <div class="calendar-body">
                <section class="calendar-grid-section">
                    <div class="calendar-weekdays" role="row" aria-label="Jours de la semaine">
                        ${WEEKDAYS.map((day) => `<span role="columnheader">${day}</span>`).join("")}
                    </div>
                    <div class="calendar-grid" data-calendar-grid role="grid"></div>
                </section>

                <aside class="calendar-side" aria-label="Détails du jour">
                    <div class="calendar-side-date" data-calendar-side-date></div>
                    <button type="button" class="calendar-add-button" data-calendar-add>${icon("plus")} Ajouter un événement</button>
                    <ul class="calendar-events" data-calendar-events></ul>
                </aside>
            </div>
        </div>

        <dialog class="calendar-dialog">
            <form method="dialog" data-calendar-form>
                <h2>Nouvel événement</h2>
                <label class="calendar-field">
                    <span>Date</span>
                    <input type="date" name="date" required />
                </label>
                <label class="calendar-field">
                    <span>Heure <small>(optionnel)</small></span>
                    <input type="time" name="time" />
                </label>
                <label class="calendar-field">
                    <span>Titre</span>
                    <input type="text" name="title" maxlength="80" required placeholder="Nom de l'événement" />
                </label>
                <div class="calendar-dialog-actions">
                    <button type="button" class="calendar-dialog-cancel" data-calendar-cancel>Annuler</button>
                    <button type="submit" class="calendar-dialog-submit">Ajouter</button>
                </div>
            </form>
        </dialog>`;

    const grid = root.querySelector("[data-calendar-grid]");
    const monthTitle = root.querySelector("[data-calendar-month-title]");
    const sideDate = root.querySelector("[data-calendar-side-date]");
    const eventsList = root.querySelector("[data-calendar-events]");
    const dialog = root.querySelector(".calendar-dialog");
    const form = dialog.querySelector("form");
    const titleInput = form.querySelector("[name=title]");

    function renderGrid() {
        const firstDay = new Date(viewYear, viewMonth, 1);
        const offset = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const cells = [];

        for (let i = 0; i < offset; i++) cells.push(`<button type="button" class="calendar-cell calendar-cell--empty" disabled></button>`);
        for (let day = 1; day <= daysInMonth; day++) {
            const date = toISODate(viewYear, viewMonth, day);
            const dayEvents = eventsFor(date);
            cells.push(`
                <button type="button" class="calendar-cell${date === selectedDate ? " is-selected" : ""}${isToday(date) ? " is-today" : ""}" data-calendar-date="${date}">
                    <span class="calendar-day-number">${day}</span>
                    <span class="calendar-cell-events">
                        ${dayEvents.slice(0, 3).map((event) => `<span class="calendar-dot" title="${event.title}">${event.time ? event.time : ""}</span>`).join("")}
                        ${dayEvents.length > 3 ? `<small class="calendar-more">+${dayEvents.length - 3}</small>` : ""}
                    </span>
                </button>`);
        }
        grid.innerHTML = cells.join("");
        monthTitle.textContent = `${MONTH_NAMES_FULL[viewMonth]} ${viewYear}`;
    }

    function renderSide() {
        sideDate.textContent = formatDayLabel(selectedDate);
        const dayEvents = eventsFor(selectedDate).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
        eventsList.innerHTML = dayEvents.length
            ? dayEvents.map((event) => `
                <li class="calendar-event" data-event-id="${event.id}">
                    <span class="calendar-event-time">${event.time || "—"}</span>
                    <span class="calendar-event-title">${event.title}</span>
                    <button type="button" class="calendar-event-remove" data-event-remove="${event.id}" aria-label="Supprimer l'événement">${icon("close")}</button>
                </li>`).join("")
            : `<li class="calendar-event calendar-event--empty">Aucun événement ce jour.</li>`;
    }

    function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }

    const navFor = {
        prev: () => { if (viewMonth === 0) { viewMonth = 11; viewYear--; } else viewMonth--; renderGrid(); },
        next: () => { if (viewMonth === 11) { viewMonth = 0; viewYear++; } else viewMonth++; renderGrid(); },
        today: () => {
            const today = new Date();
            viewYear = today.getFullYear(); viewMonth = today.getMonth(); selectedDate = toISODate(viewYear, viewMonth, today.getDate());
            renderGrid(); renderSide();
        },
    };

    const onClick = (event) => {
        const cell = event.target.closest("[data-calendar-date]");
        if (cell) { selectedDate = cell.dataset.calendarDate; renderGrid(); renderSide(); return; }
        const nav = event.target.closest("[data-calendar-nav]");
        if (nav) navFor[nav.dataset.calendarNav]();
        if (event.target.closest("[data-calendar-add]")) { titleInput.value = ""; form.elements.date.value = selectedDate; form.elements.time.value = ""; dialog.showModal(); titleInput.focus(); }
        const remove = event.target.closest("[data-event-remove]");
        if (remove) {
            events = events.filter((event) => event.id !== remove.dataset.eventRemove);
            persist(); renderGrid(); renderSide();
        }
    };

    const onSubmit = (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const title = String(data.get("title") || "").trim();
        const date = String(data.get("date") || "");
        const time = String(data.get("time") || "");
        if (!title || !date) return;
        events.push({ id: `e-${Date.now()}`, date, time, title });
        persist();
        selectedDate = date;
        const dateParts = date.split("-");
        viewYear = Number(dateParts[0]); viewMonth = Number(dateParts[1]) - 1;
        dialog.close();
        renderGrid(); renderSide();
    };

    root.addEventListener("click", onClick);
    form.addEventListener("submit", onSubmit);
    root.querySelector("[data-calendar-cancel]").addEventListener("click", () => dialog.close());

    renderGrid();
    renderSide();

    return () => {
        root.removeEventListener("click", onClick);
        form.removeEventListener("submit", onSubmit);
    };
}
