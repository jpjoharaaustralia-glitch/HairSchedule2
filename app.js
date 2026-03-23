(function () {
    const STORAGE_KEY = "dawn-salon-scheduler-v1";
    const SUPABASE_URL = "https://dkvoxbqxwxcfgmtfrrme.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_7l8XECUJ9mS5jIa-PEp2uQ_bDBixBmY";
    const WORKING_DAY_SET = new Set([3, 5, 6]);
    const HOUR_START = 7;
    const HOUR_END = 19;
    const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;
    const MINUTE_HEIGHT = 1.2;
    let supabaseClient = null;
    let authSubscription = null;
    let remoteSaveTimer = null;

    const DEFAULT_DATA = {
        appointments: [],
        customers: [],
        services: [
            { id: "svc-cut-finish", name: "Cut & Finish", duration: 45 },
            { id: "svc-wash-cut-finish", name: "Wash, Cut & Finish", duration: 60 },
            { id: "svc-blow-dry", name: "Blow Dry", duration: 30 },
            { id: "svc-colour-refresh", name: "Colour Refresh", duration: 90 },
            { id: "svc-full-colour", name: "Full Colour", duration: 120 }
        ],
        colourCharts: []
    };

    const refs = {
        body: document.body,
        menuToggle: document.getElementById("menuToggle"),
        drawer: document.getElementById("drawer"),
        drawerBackdrop: document.getElementById("drawerBackdrop"),
        drawerLinks: Array.from(document.querySelectorAll(".drawer-link")),
        saveStatus: document.getElementById("saveStatus"),
        views: Array.from(document.querySelectorAll(".view")),
        datePickerBtn: document.getElementById("datePickerBtn"),
        addAppointmentBtn: document.getElementById("addAppointmentBtn"),
        toggleUpdateModeBtn: document.getElementById("toggleUpdateModeBtn"),
        updateModeBanner: document.getElementById("updateModeBanner"),
        scheduleDateLabel: document.getElementById("scheduleDateLabel"),
        scheduleSummary: document.getElementById("scheduleSummary"),
        scheduleScroll: document.getElementById("scheduleScroll"),
        nextWorkingDayBtn: document.getElementById("nextWorkingDayBtn"),
        timeGrid: document.getElementById("timeGrid"),
        customerSearchInput: document.getElementById("customerSearchInput"),
        addCustomerBtn: document.getElementById("addCustomerBtn"),
        customersList: document.getElementById("customersList"),
        librarySegmentButtons: Array.from(document.querySelectorAll(".segment-button")),
        libraryAddBtn: document.getElementById("libraryAddBtn"),
        libraryList: document.getElementById("libraryList"),
        exportDataBtn: document.getElementById("exportDataBtn"),
        importDataInput: document.getElementById("importDataInput"),
        authStatusText: document.getElementById("authStatusText"),
        openAuthBtn: document.getElementById("openAuthBtn"),
        syncNowBtn: document.getElementById("syncNowBtn"),
        logoutBtn: document.getElementById("logoutBtn"),
        sheetBackdrop: document.getElementById("sheetBackdrop"),
        appointmentSheet: document.getElementById("appointmentSheet"),
        customerSheet: document.getElementById("customerSheet"),
        serviceSheet: document.getElementById("serviceSheet"),
        colourSheet: document.getElementById("colourSheet"),
        datePickerSheet: document.getElementById("datePickerSheet"),
        authSheet: document.getElementById("authSheet"),
        closeSheetButtons: Array.from(document.querySelectorAll("[data-close-sheet]")),
        appointmentSheetTitle: document.getElementById("appointmentSheetTitle"),
        appointmentForm: document.getElementById("appointmentForm"),
        appointmentCustomerName: document.getElementById("appointmentCustomerName"),
        appointmentServiceName: document.getElementById("appointmentServiceName"),
        appointmentCustomerMeta: document.getElementById("appointmentCustomerMeta"),
        appointmentServiceMeta: document.getElementById("appointmentServiceMeta"),
        appointmentDateTrigger: document.getElementById("appointmentDateTrigger"),
        appointmentDateValue: document.getElementById("appointmentDateValue"),
        appointmentTime: document.getElementById("appointmentTime"),
        appointmentDuration: document.getElementById("appointmentDuration"),
        customerSuggestions: document.getElementById("customerSuggestions"),
        serviceSuggestions: document.getElementById("serviceSuggestions"),
        appointmentFormError: document.getElementById("appointmentFormError"),
        deleteAppointmentBtn: document.getElementById("deleteAppointmentBtn"),
        customerSheetTitle: document.getElementById("customerSheetTitle"),
        customerForm: document.getElementById("customerForm"),
        customerColourInput: document.getElementById("customerColourInput"),
        customerColourSuggestions: document.getElementById("customerColourSuggestions"),
        customerFormError: document.getElementById("customerFormError"),
        deleteCustomerBtn: document.getElementById("deleteCustomerBtn"),
        serviceSheetTitle: document.getElementById("serviceSheetTitle"),
        serviceForm: document.getElementById("serviceForm"),
        serviceFormError: document.getElementById("serviceFormError"),
        deleteServiceBtn: document.getElementById("deleteServiceBtn"),
        colourSheetTitle: document.getElementById("colourSheetTitle"),
        colourForm: document.getElementById("colourForm"),
        colourFormError: document.getElementById("colourFormError"),
        deleteColourBtn: document.getElementById("deleteColourBtn"),
        authForm: document.getElementById("authForm"),
        authEmail: document.getElementById("authEmail"),
        authPassword: document.getElementById("authPassword"),
        authFormError: document.getElementById("authFormError"),
        calendarPrevBtn: document.getElementById("calendarPrevBtn"),
        calendarNextBtn: document.getElementById("calendarNextBtn"),
        calendarMonthLabel: document.getElementById("calendarMonthLabel"),
        calendarGrid: document.getElementById("calendarGrid")
    };

    const initialDate = getNextWorkingDate(new Date());
    const state = {
        section: "appointments",
        libraryMode: "services",
        updateMode: false,
        selectedDate: initialDate,
        data: loadData(),
        activeSheet: null,
        datePickerTarget: null,
        datePickerReturnSheet: null,
        calendarMonth: startOfMonth(parseLocalDate(initialDate)),
        session: null,
        syncStatus: "offline",
        lastSyncedUserId: "",
        isHydratingRemote: false
    };

    initialize();

    function initialize() {
        bindEvents();
        renderApp();
        renderSyncUi();
        void initializeOnlineSync();
    }

    function bindEvents() {
        refs.menuToggle.addEventListener("click", toggleDrawer);
        refs.drawerBackdrop.addEventListener("click", closeDrawer);
        refs.drawerLinks.forEach((button) => {
            button.addEventListener("click", () => {
                state.section = button.dataset.section;
                closeDrawer();
                renderSections();
            });
        });

        refs.datePickerBtn.addEventListener("click", () => openDatePicker("schedule", state.selectedDate));
        refs.nextWorkingDayBtn.addEventListener("click", () => {
            state.selectedDate = getNextWorkingDate(addDays(parseLocalDate(state.selectedDate), 1));
            renderSchedule();
        });
        refs.addAppointmentBtn.addEventListener("click", () => openAppointmentSheet());
        refs.toggleUpdateModeBtn.addEventListener("click", () => {
            state.updateMode = !state.updateMode;
            renderSchedule();
        });

        refs.customerSearchInput.addEventListener("input", renderCustomers);
        refs.addCustomerBtn.addEventListener("click", () => openCustomerSheet());

        refs.librarySegmentButtons.forEach((button) => {
            button.addEventListener("click", () => {
                state.libraryMode = button.dataset.library;
                renderLibrary();
            });
        });
        refs.libraryAddBtn.addEventListener("click", () => {
            if (state.libraryMode === "services") {
                openServiceSheet();
            } else {
                openColourSheet();
            }
        });

        refs.exportDataBtn.addEventListener("click", exportData);
        refs.importDataInput.addEventListener("change", importData);
        refs.openAuthBtn.addEventListener("click", openAuthSheet);
        refs.syncNowBtn.addEventListener("click", () => void saveRemoteData());
        refs.logoutBtn.addEventListener("click", () => void signOutSalon());

        refs.closeSheetButtons.forEach((button) => {
            button.addEventListener("click", () => closeSheet(button.dataset.closeSheet));
        });
        refs.sheetBackdrop.addEventListener("click", () => closeSheet(state.activeSheet));

        document.addEventListener("click", (event) => {
            if (!event.target.closest(".suggest-input")) {
                hideAllSuggestions();
            }
        });

        refs.appointmentCustomerName.addEventListener("input", handleAppointmentCustomerInput);
        refs.appointmentCustomerName.addEventListener("blur", () => window.setTimeout(syncAppointmentCustomerFromInput, 120));
        refs.appointmentServiceName.addEventListener("input", handleAppointmentServiceInput);
        refs.appointmentServiceName.addEventListener("blur", () => window.setTimeout(syncAppointmentServiceFromInput, 120));
        refs.appointmentDateTrigger.addEventListener("click", () => openDatePicker("appointment", refs.appointmentDateValue.value || state.selectedDate));
        refs.appointmentDuration.addEventListener("input", syncAppointmentTimeBounds);
        refs.appointmentTime.addEventListener("input", clearAppointmentError);
        refs.appointmentForm.addEventListener("submit", saveAppointment);
        refs.deleteAppointmentBtn.addEventListener("click", deleteAppointment);

        refs.customerColourInput.addEventListener("input", handleCustomerColourInput);
        refs.customerColourInput.addEventListener("blur", () => window.setTimeout(syncCustomerColourFromInput, 120));
        refs.customerForm.addEventListener("submit", saveCustomer);
        refs.deleteCustomerBtn.addEventListener("click", deleteCustomer);

        refs.serviceForm.addEventListener("submit", saveService);
        refs.deleteServiceBtn.addEventListener("click", deleteService);

        refs.colourForm.addEventListener("submit", saveColour);
        refs.deleteColourBtn.addEventListener("click", deleteColour);

        refs.authForm.addEventListener("submit", signInToSalon);

        refs.calendarPrevBtn.addEventListener("click", () => {
            state.calendarMonth = startOfMonth(addMonths(state.calendarMonth, -1));
            renderCalendar();
        });
        refs.calendarNextBtn.addEventListener("click", () => {
            state.calendarMonth = startOfMonth(addMonths(state.calendarMonth, 1));
            renderCalendar();
        });
    }

    function renderApp() {
        renderSections();
        renderSchedule();
        renderCustomers();
        renderLibrary();
    }

    function renderSections() {
        refs.views.forEach((view) => {
            view.classList.toggle("is-active", view.dataset.view === state.section);
        });
        refs.drawerLinks.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.section === state.section);
        });
    }

    async function initializeOnlineSync() {
        if (!hasSupabaseConfigured()) {
            state.syncStatus = "offline";
            renderSyncUi("Online save is not configured.");
            return;
        }

        const client = getSupabaseClient();
        authSubscription = client.auth.onAuthStateChange((_event, session) => {
            void handleSessionChange(session);
        });

        const { data, error } = await client.auth.getSession();
        if (error) {
            state.syncStatus = "error";
            renderSyncUi("Could not check online login.");
            return;
        }

        await handleSessionChange(data.session);
    }

    function renderSyncUi(detailText) {
        const connected = Boolean(state.session?.user?.id);
        const buttonText = connected ? "Switch login" : "Salon login";
        refs.openAuthBtn.textContent = buttonText;
        refs.syncNowBtn.classList.toggle("is-hidden", !connected);
        refs.logoutBtn.classList.toggle("is-hidden", !connected);

        if (state.syncStatus === "syncing") {
            setSaveStatus("Online syncing");
        } else if (state.syncStatus === "online") {
            setSaveStatus("Online save connected");
        } else if (state.syncStatus === "error") {
            setSaveStatus("Online save error");
        } else {
            setSaveStatus("Online save not connected");
        }

        if (detailText) {
            refs.authStatusText.textContent = detailText;
            return;
        }

        if (connected) {
            refs.authStatusText.textContent = `Connected as ${state.session.user.email}. Use this same login on every phone.`;
            return;
        }

        refs.authStatusText.textContent = "Not connected yet. Sign in once on each phone to share the same planner.";
    }

    function renderSchedule() {
        refs.datePickerBtn.textContent = formatDateForButton(state.selectedDate);
        refs.toggleUpdateModeBtn.classList.toggle("is-active", state.updateMode);
        refs.toggleUpdateModeBtn.textContent = state.updateMode ? "Finish updating" : "Update appointment";
        refs.addAppointmentBtn.classList.toggle("is-hidden", state.updateMode);
        refs.updateModeBanner.classList.toggle("is-hidden", !state.updateMode);

        const items = getAppointmentsForDate(state.selectedDate);
        const totalReserved = items.reduce((sum, appointment) => sum + appointment.duration, 0);
        refs.scheduleDateLabel.textContent = formatDateForHeading(state.selectedDate);
        refs.scheduleSummary.textContent = items.length
            ? `${items.length} booking${items.length === 1 ? "" : "s"} - ${formatDuration(totalReserved)} reserved`
            : "No appointments yet.";

        refs.timeGrid.innerHTML = "";
        refs.timeGrid.style.height = `${TOTAL_MINUTES * MINUTE_HEIGHT}px`;

        for (let hour = HOUR_START; hour <= HOUR_END; hour += 1) {
            const marker = document.createElement("div");
            marker.className = "time-marker";
            marker.style.top = `${(hour - HOUR_START) * 60 * MINUTE_HEIGHT}px`;

            const label = document.createElement("div");
            label.className = "time-marker-label";
            label.textContent = formatHourLabel(hour);

            const line = document.createElement("div");
            line.className = "time-marker-line";

            marker.appendChild(label);
            marker.appendChild(line);
            refs.timeGrid.appendChild(marker);
        }

        const layer = document.createElement("div");
        layer.className = "appointments-layer";

        if (!items.length) {
            const empty = document.createElement("div");
            empty.className = "empty-card";
            empty.style.position = "absolute";
            empty.style.top = "24px";
            empty.style.left = "72px";
            empty.style.right = "10px";
            empty.textContent = "This day is free at the moment.";
            layer.appendChild(empty);
        } else {
            items.forEach((appointment) => {
                const customer = getLinkedCustomer(appointment);
                const top = (minutesFromTime(appointment.time) - HOUR_START * 60) * MINUTE_HEIGHT;
                const height = Math.max(appointment.duration * MINUTE_HEIGHT, 72);
                const phone = customer ? customer.phone : "";
                const colour = customer ? resolveCustomerColourLabel(customer) : "";

                const card = document.createElement("button");
                card.type = "button";
                card.className = "appointment-card";
                if (state.updateMode) {
                    card.classList.add("is-updateable");
                }
                card.style.top = `${top}px`;
                card.style.height = `${height}px`;
                card.innerHTML = `
                    <div class="appointment-time">${escapeHtml(`${formatTimeLabel(appointment.time)} - ${appointment.duration} mins`)}</div>
                    <div class="appointment-title">${escapeHtml(getAppointmentDisplayName(appointment, customer))}</div>
                    <div class="appointment-service">${escapeHtml(appointment.serviceName || "Appointment")}</div>
                    <div class="appointment-meta">${escapeHtml(phone ? `Phone: ${phone}` : "")}${phone && colour ? "<br>" : ""}${escapeHtml(colour ? `Colour: ${colour}` : (!phone ? "No phone or colour chart saved." : ""))}</div>
                `;
                card.addEventListener("click", () => {
                    if (!state.updateMode) {
                        return;
                    }
                    openAppointmentSheet(appointment.id);
                });
                layer.appendChild(card);
            });
        }

        refs.timeGrid.appendChild(layer);
    }

    function renderCustomers() {
        const query = normalize(refs.customerSearchInput.value);
        const items = [...state.data.customers]
            .sort((left, right) => left.name.localeCompare(right.name))
            .filter((customer) => {
                if (!query) {
                    return true;
                }
                const haystack = [customer.name, customer.address, customer.phone, resolveCustomerColourLabel(customer)].join(" ");
                return normalize(haystack).includes(query);
            });

        refs.customersList.innerHTML = "";
        if (!items.length) {
            refs.customersList.innerHTML = `<div class="empty-card">${query ? "No customers match that search." : "No customers saved yet."}</div>`;
            return;
        }

        items.forEach((customer) => {
            const card = document.createElement("article");
            card.className = "list-card";
            card.innerHTML = `
                <div class="list-card-header">
                    <div>
                        <h3 class="list-card-title">${escapeHtml(customer.name)}</h3>
                        <p class="list-card-subtitle">${escapeHtml(customer.phone || "No phone number saved")}</p>
                    </div>
                </div>
                <div class="detail-stack">
                    <div class="detail-row">
                        <div class="detail-label">Address</div>
                        <div class="detail-value">${escapeHtml(customer.address || "No address saved")}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Colour chart</div>
                        <div class="detail-value">${escapeHtml(resolveCustomerColourLabel(customer) || "No colour chart saved")}</div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="secondary-ghost" type="button" data-action="edit">Edit</button>
                    <button class="danger-ghost" type="button" data-action="delete">Delete</button>
                </div>
            `;
            card.querySelector('[data-action="edit"]').addEventListener("click", () => openCustomerSheet(customer.id));
            card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteCustomerById(customer.id));
            refs.customersList.appendChild(card);
        });
    }

    function renderLibrary() {
        refs.librarySegmentButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.library === state.libraryMode);
        });

        refs.libraryAddBtn.textContent = state.libraryMode === "services" ? "Add haircut type" : "Add colour chart entry";
        refs.libraryList.innerHTML = "";

        if (state.libraryMode === "services") {
            const services = [...state.data.services].sort((left, right) => left.name.localeCompare(right.name));
            if (!services.length) {
                refs.libraryList.innerHTML = `<div class="empty-card">No haircut types saved yet.</div>`;
                return;
            }

            services.forEach((service) => {
                const card = document.createElement("article");
                card.className = "list-card";
                card.innerHTML = `
                    <div class="list-card-header">
                        <div>
                            <h3 class="list-card-title">${escapeHtml(service.name)}</h3>
                            <p class="list-card-subtitle">${service.duration} minutes</p>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="secondary-ghost" type="button" data-action="edit">Edit</button>
                        <button class="danger-ghost" type="button" data-action="delete">Delete</button>
                    </div>
                `;
                card.querySelector('[data-action="edit"]').addEventListener("click", () => openServiceSheet(service.id));
                card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteServiceById(service.id));
                refs.libraryList.appendChild(card);
            });
            return;
        }

        const colours = [...state.data.colourCharts].sort((left, right) => left.name.localeCompare(right.name));
        if (!colours.length) {
            refs.libraryList.innerHTML = `<div class="empty-card">No colour chart entries saved yet.</div>`;
            return;
        }

        colours.forEach((colour) => {
            const card = document.createElement("article");
            card.className = "list-card";
            card.innerHTML = `
                <div class="list-card-header">
                    <div>
                        <h3 class="list-card-title">${escapeHtml(colour.name)}</h3>
                        <p class="list-card-subtitle">${escapeHtml(colour.number)}</p>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="secondary-ghost" type="button" data-action="edit">Edit</button>
                    <button class="danger-ghost" type="button" data-action="delete">Delete</button>
                </div>
            `;
            card.querySelector('[data-action="edit"]').addEventListener("click", () => openColourSheet(colour.id));
            card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteColourById(colour.id));
            refs.libraryList.appendChild(card);
        });
    }

    function renderCalendar() {
        refs.calendarMonthLabel.textContent = state.calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
        refs.calendarGrid.innerHTML = "";

        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((label) => {
            const heading = document.createElement("div");
            heading.className = "calendar-day-heading";
            heading.textContent = label;
            refs.calendarGrid.appendChild(heading);
        });

        const firstVisible = addDays(state.calendarMonth, -state.calendarMonth.getDay());
        for (let index = 0; index < 42; index += 1) {
            const current = addDays(firstVisible, index);
            const iso = toIsoDate(current);
            const isThisMonth = current.getMonth() === state.calendarMonth.getMonth();
            const isAllowed = WORKING_DAY_SET.has(current.getDay());

            const button = document.createElement("button");
            button.type = "button";
            button.className = "calendar-day";
            button.textContent = String(current.getDate());

            if (!isThisMonth || !isAllowed) {
                button.classList.add("is-disabled");
                button.disabled = true;
            } else {
                button.classList.add("is-available");
                button.addEventListener("click", () => selectDateFromPicker(iso));
            }

            if (iso === getCurrentDatePickerSelection()) {
                button.classList.add("is-selected");
            }
            refs.calendarGrid.appendChild(button);
        }
    }

    function openDatePicker(target, selectedDate) {
        closeDrawer();
        state.datePickerTarget = target;
        state.datePickerReturnSheet = target === "appointment" ? (state.activeSheet || "appointmentSheet") : null;
        state.calendarMonth = startOfMonth(parseLocalDate(selectedDate || state.selectedDate));
        renderCalendar();
        openSheet("datePickerSheet");
    }

    function selectDateFromPicker(isoDate) {
        if (state.datePickerTarget === "schedule") {
            state.selectedDate = isoDate;
            renderSchedule();
        } else if (state.datePickerTarget === "appointment") {
            refs.appointmentDateValue.value = isoDate;
            refs.appointmentDateTrigger.textContent = formatDateForHeading(isoDate);
            openSheet(state.datePickerReturnSheet || "appointmentSheet");
            state.datePickerReturnSheet = null;
            return;
        }
        closeSheet("datePickerSheet");
    }

    function getCurrentDatePickerSelection() {
        return state.datePickerTarget === "appointment" ? (refs.appointmentDateValue.value || state.selectedDate) : state.selectedDate;
    }

    function hasSupabaseConfigured() {
        return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase?.createClient);
    }

    function getSupabaseClient() {
        if (!hasSupabaseConfigured()) {
            return null;
        }
        if (!supabaseClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { persistSession: true, autoRefreshToken: true }
            });
        }
        return supabaseClient;
    }

    async function handleSessionChange(session) {
        state.session = session || null;
        state.lastSyncedUserId = "";
        renderSyncUi();

        if (!state.session?.user?.id) {
            state.syncStatus = "offline";
            renderSyncUi();
            return;
        }

        await loadRemoteData();
    }

    async function loadRemoteData() {
        if (!state.session?.user?.id || state.isHydratingRemote) {
            return;
        }

        const client = getSupabaseClient();
        if (!client) {
            return;
        }

        state.isHydratingRemote = true;
        state.syncStatus = "syncing";
        renderSyncUi("Loading the shared planner...");

        const { data, error } = await client
            .from("salon_planner_state")
            .select("owner_user_id, payload, updated_at")
            .eq("owner_user_id", state.session.user.id)
            .maybeSingle();

        state.isHydratingRemote = false;

        if (error) {
            state.syncStatus = "error";
            renderSyncUi(getFriendlySyncError(error));
            return;
        }

        if (data?.payload) {
            state.data = sanitizeData(data.payload);
            saveData({ skipRemote: true });
            renderApp();
            state.syncStatus = "online";
            state.lastSyncedUserId = state.session.user.id;
            renderSyncUi("Shared planner loaded and ready.");
            return;
        }

        await saveRemoteData(true);
    }

    async function saveRemoteData(isFirstSave) {
        if (!state.session?.user?.id) {
            state.syncStatus = "offline";
            renderSyncUi();
            return;
        }

        const client = getSupabaseClient();
        if (!client) {
            return;
        }

        window.clearTimeout(remoteSaveTimer);
        remoteSaveTimer = null;
        state.syncStatus = "syncing";
        renderSyncUi(isFirstSave ? "Creating the shared planner..." : "Saving to the shared planner...");

        const { error } = await client
            .from("salon_planner_state")
            .upsert(
                {
                    owner_user_id: state.session.user.id,
                    payload: state.data
                },
                { onConflict: "owner_user_id" }
            );

        if (error) {
            state.syncStatus = "error";
            renderSyncUi(getFriendlySyncError(error));
            return;
        }

        state.syncStatus = "online";
        state.lastSyncedUserId = state.session.user.id;
        renderSyncUi(isFirstSave ? "Shared planner created." : "Shared planner saved.");
    }

    function queueRemoteSave() {
        if (!state.session?.user?.id || state.isHydratingRemote) {
            return;
        }

        state.syncStatus = "syncing";
        renderSyncUi("Saving to the shared planner...");
        window.clearTimeout(remoteSaveTimer);
        remoteSaveTimer = window.setTimeout(() => {
            void saveRemoteData();
        }, 500);
    }

    function openAuthSheet() {
        closeDrawer();
        clearFormError(refs.authFormError);
        refs.authPassword.value = "";
        if (state.session?.user?.email) {
            refs.authEmail.value = state.session.user.email;
        }
        openSheet("authSheet");
    }

    async function signInToSalon(event) {
        event.preventDefault();
        clearFormError(refs.authFormError);

        const client = getSupabaseClient();
        if (!client) {
            showFormError(refs.authFormError, "Online save is not configured.");
            return;
        }

        const email = refs.authEmail.value.trim();
        const password = refs.authPassword.value;
        if (!email || !password) {
            showFormError(refs.authFormError, "Please enter the salon email and password.");
            return;
        }

        state.syncStatus = "syncing";
        renderSyncUi("Signing in...");

        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
            state.syncStatus = "error";
            renderSyncUi("Sign in did not work.");
            showFormError(refs.authFormError, error.message || "Sign in did not work.");
            return;
        }

        refs.authPassword.value = "";
        closeSheet();
    }

    async function signOutSalon() {
        const client = getSupabaseClient();
        if (!client) {
            return;
        }

        await client.auth.signOut();
        state.syncStatus = "offline";
        renderSyncUi("Signed out. Local backup still stays on this phone.");
    }

    function getFriendlySyncError(error) {
        const message = String(error?.message || "");
        if (message.includes("relation") && message.includes("salon_planner_state")) {
            return "The online save table is not set up yet. Follow the setup steps below.";
        }
        return message || "Online save did not work.";
    }

    function openAppointmentSheet(appointmentId) {
        closeDrawer();
        refs.appointmentForm.reset();
        refs.appointmentForm.elements.appointmentId.value = "";
        refs.appointmentForm.elements.customerId.value = "";
        refs.appointmentForm.elements.serviceId.value = "";
        refs.appointmentDateValue.value = state.selectedDate;
        refs.appointmentDateTrigger.textContent = formatDateForHeading(state.selectedDate);
        refs.deleteAppointmentBtn.classList.add("is-hidden");
        clearAppointmentError();
        hideAllSuggestions();

        if (appointmentId) {
            const appointment = state.data.appointments.find((item) => item.id === appointmentId);
            if (!appointment) {
                return;
            }
            refs.appointmentSheetTitle.textContent = "Update appointment";
            refs.appointmentForm.elements.appointmentId.value = appointment.id;
            refs.appointmentForm.elements.customerId.value = appointment.customerId || "";
            refs.appointmentForm.elements.serviceId.value = appointment.serviceId || "";
            refs.appointmentCustomerName.value = appointment.customerName || "";
            refs.appointmentServiceName.value = appointment.serviceName || "";
            refs.appointmentDateValue.value = appointment.date;
            refs.appointmentDateTrigger.textContent = formatDateForHeading(appointment.date);
            refs.appointmentTime.value = appointment.time;
            refs.appointmentDuration.value = appointment.duration || "";
            refs.deleteAppointmentBtn.classList.remove("is-hidden");
        } else {
            refs.appointmentSheetTitle.textContent = "Add appointment";
            refs.appointmentTime.value = getSuggestedTimeForDate(state.selectedDate);
        }

        syncAppointmentCustomerFromInput();
        syncAppointmentServiceFromInput();
        syncAppointmentTimeBounds();
        openSheet("appointmentSheet");
    }

    function openCustomerSheet(customerId) {
        closeDrawer();
        refs.customerForm.reset();
        refs.customerForm.elements.customerId.value = "";
        refs.customerForm.elements.colourChartId.value = "";
        refs.deleteCustomerBtn.classList.add("is-hidden");
        clearFormError(refs.customerFormError);
        hideAllSuggestions();

        if (customerId) {
            const customer = state.data.customers.find((item) => item.id === customerId);
            if (!customer) {
                return;
            }
            refs.customerSheetTitle.textContent = "Update customer";
            refs.customerForm.elements.customerId.value = customer.id;
            refs.customerForm.elements.name.value = customer.name;
            refs.customerForm.elements.address.value = customer.address || "";
            refs.customerForm.elements.phone.value = customer.phone || "";
            refs.customerForm.elements.colourChartId.value = customer.colourChartId || "";
            refs.customerColourInput.value = resolveCustomerColourLabel(customer) || customer.colourLabel || "";
            refs.deleteCustomerBtn.classList.remove("is-hidden");
        } else {
            refs.customerSheetTitle.textContent = "Add customer";
        }

        openSheet("customerSheet");
    }

    function openServiceSheet(serviceId) {
        closeDrawer();
        refs.serviceForm.reset();
        refs.serviceForm.elements.serviceId.value = "";
        refs.deleteServiceBtn.classList.add("is-hidden");
        clearFormError(refs.serviceFormError);

        if (serviceId) {
            const service = state.data.services.find((item) => item.id === serviceId);
            if (!service) {
                return;
            }
            refs.serviceSheetTitle.textContent = "Update haircut type";
            refs.serviceForm.elements.serviceId.value = service.id;
            refs.serviceForm.elements.name.value = service.name;
            refs.serviceForm.elements.duration.value = service.duration;
            refs.deleteServiceBtn.classList.remove("is-hidden");
        } else {
            refs.serviceSheetTitle.textContent = "Add haircut type";
        }

        openSheet("serviceSheet");
    }

    function openColourSheet(colourId) {
        closeDrawer();
        refs.colourForm.reset();
        refs.colourForm.elements.colourId.value = "";
        refs.deleteColourBtn.classList.add("is-hidden");
        clearFormError(refs.colourFormError);

        if (colourId) {
            const colour = state.data.colourCharts.find((item) => item.id === colourId);
            if (!colour) {
                return;
            }
            refs.colourSheetTitle.textContent = "Update colour chart entry";
            refs.colourForm.elements.colourId.value = colour.id;
            refs.colourForm.elements.name.value = colour.name;
            refs.colourForm.elements.number.value = colour.number;
            refs.deleteColourBtn.classList.remove("is-hidden");
        } else {
            refs.colourSheetTitle.textContent = "Add colour chart entry";
        }

        openSheet("colourSheet");
    }

    function openSheet(id) {
        closeDrawer();
        state.activeSheet = id;
        refs.body.classList.add("is-locked");
        refs.sheetBackdrop.classList.remove("is-hidden");
        [refs.appointmentSheet, refs.customerSheet, refs.serviceSheet, refs.colourSheet, refs.datePickerSheet, refs.authSheet].forEach((sheet) => {
            sheet.classList.toggle("is-hidden", sheet.id !== id);
        });
    }

    function closeSheet() {
        state.activeSheet = null;
        state.datePickerReturnSheet = null;
        refs.sheetBackdrop.classList.add("is-hidden");
        [refs.appointmentSheet, refs.customerSheet, refs.serviceSheet, refs.colourSheet, refs.datePickerSheet, refs.authSheet].forEach((sheet) => {
            sheet.classList.add("is-hidden");
        });
        if (!refs.drawer.classList.contains("is-open")) {
            refs.body.classList.remove("is-locked");
        }
    }

    function toggleDrawer() {
        if (refs.drawer.classList.contains("is-open")) {
            closeDrawer();
            return;
        }
        refs.drawer.classList.add("is-open");
        refs.drawerBackdrop.classList.remove("is-hidden");
        refs.menuToggle.setAttribute("aria-expanded", "true");
        refs.body.classList.add("is-locked");
    }

    function closeDrawer() {
        refs.drawer.classList.remove("is-open");
        refs.drawerBackdrop.classList.add("is-hidden");
        refs.menuToggle.setAttribute("aria-expanded", "false");
        if (!state.activeSheet) {
            refs.body.classList.remove("is-locked");
        }
    }

    function handleAppointmentCustomerInput() {
        refs.appointmentForm.elements.customerId.value = "";
        const query = normalize(refs.appointmentCustomerName.value);
        if (!query) {
            hideSuggestions(refs.customerSuggestions);
            syncAppointmentCustomerFromInput();
            return;
        }

        const matches = state.data.customers
            .filter((customer) => normalize(customer.name).includes(query))
            .sort((left, right) => left.name.localeCompare(right.name))
            .slice(0, 5);

        renderSuggestions(
            refs.customerSuggestions,
            matches,
            (customer) => {
                refs.appointmentCustomerName.value = customer.name;
                refs.appointmentForm.elements.customerId.value = customer.id;
                hideSuggestions(refs.customerSuggestions);
                syncAppointmentCustomerFromInput();
            },
            (customer) => ({
                title: customer.name,
                meta: [customer.phone, resolveCustomerColourLabel(customer)].filter(Boolean).join(" - ")
            })
        );

        syncAppointmentCustomerFromInput();
    }

    function handleAppointmentServiceInput() {
        refs.appointmentForm.elements.serviceId.value = "";
        const query = normalize(refs.appointmentServiceName.value);
        if (!query) {
            hideSuggestions(refs.serviceSuggestions);
            syncAppointmentServiceFromInput();
            return;
        }

        const matches = state.data.services
            .filter((service) => normalize(service.name).includes(query))
            .sort((left, right) => left.name.localeCompare(right.name))
            .slice(0, 5);

        renderSuggestions(
            refs.serviceSuggestions,
            matches,
            (service) => {
                refs.appointmentServiceName.value = service.name;
                refs.appointmentForm.elements.serviceId.value = service.id;
                refs.appointmentDuration.value = service.duration;
                hideSuggestions(refs.serviceSuggestions);
                syncAppointmentServiceFromInput();
                syncAppointmentTimeBounds();
            },
            (service) => ({
                title: service.name,
                meta: `${service.duration} minutes`
            })
        );

        syncAppointmentServiceFromInput();
        syncAppointmentTimeBounds();
    }

    function handleCustomerColourInput() {
        refs.customerForm.elements.colourChartId.value = "";
        const query = normalize(refs.customerColourInput.value);
        if (!query) {
            hideSuggestions(refs.customerColourSuggestions);
            return;
        }

        const matches = state.data.colourCharts
            .filter((colour) => normalize(`${colour.name} ${colour.number}`).includes(query))
            .sort((left, right) => left.name.localeCompare(right.name))
            .slice(0, 5);

        renderSuggestions(
            refs.customerColourSuggestions,
            matches,
            (colour) => {
                refs.customerColourInput.value = formatColourChart(colour);
                refs.customerForm.elements.colourChartId.value = colour.id;
                hideSuggestions(refs.customerColourSuggestions);
            },
            (colour) => ({
                title: colour.name,
                meta: colour.number
            })
        );
    }

    function syncAppointmentCustomerFromInput() {
        const exactMatch = resolveCustomerFromInput(refs.appointmentForm.elements.customerId.value, refs.appointmentCustomerName.value);
        if (exactMatch) {
            refs.appointmentForm.elements.customerId.value = exactMatch.id;
            const details = [
                exactMatch.phone ? `Phone: ${exactMatch.phone}` : "",
                resolveCustomerColourLabel(exactMatch) ? `Colour: ${resolveCustomerColourLabel(exactMatch)}` : "",
                exactMatch.address ? `Address: ${exactMatch.address}` : ""
            ].filter(Boolean).join(" - ");
            refs.appointmentCustomerMeta.textContent = details || "Saved customer selected.";
            return;
        }
        refs.appointmentCustomerMeta.textContent = refs.appointmentCustomerName.value.trim() ? "This will save as a typed name only." : "No saved customer selected yet.";
    }

    function syncAppointmentServiceFromInput() {
        const exactMatch = resolveServiceFromInput(refs.appointmentForm.elements.serviceId.value, refs.appointmentServiceName.value);
        if (exactMatch) {
            refs.appointmentForm.elements.serviceId.value = exactMatch.id;
            refs.appointmentServiceMeta.textContent = `${exactMatch.duration} minutes will be used by default.`;
            if (!refs.appointmentDuration.value) {
                refs.appointmentDuration.value = exactMatch.duration;
            }
            return;
        }
        refs.appointmentServiceMeta.textContent = refs.appointmentServiceName.value.trim()
            ? "No saved haircut type matched. Leave duration blank to use 30 minutes."
            : "If this is left blank, the app will use 30 minutes by default.";
    }

    function syncCustomerColourFromInput() {
        const exactMatch = resolveColourFromInput(refs.customerForm.elements.colourChartId.value, refs.customerColourInput.value);
        refs.customerForm.elements.colourChartId.value = exactMatch ? exactMatch.id : "";
        if (exactMatch) {
            refs.customerColourInput.value = formatColourChart(exactMatch);
        }
    }

    function syncAppointmentTimeBounds() {
        const selectedService = resolveServiceFromInput(refs.appointmentForm.elements.serviceId.value, refs.appointmentServiceName.value);
        const duration = Math.max(Number(refs.appointmentDuration.value) || (selectedService ? selectedService.duration : 30), 15);
        const latestStart = HOUR_END * 60 - duration;
        refs.appointmentTime.min = "07:00";
        refs.appointmentTime.max = timeFromMinutes(Math.max(latestStart, HOUR_START * 60));
        if (refs.appointmentTime.value && minutesFromTime(refs.appointmentTime.value) > latestStart) {
            refs.appointmentTime.value = timeFromMinutes(Math.max(latestStart, HOUR_START * 60));
        }
    }

    function saveAppointment(event) {
        event.preventDefault();
        clearAppointmentError();
        hideAllSuggestions();

        const form = refs.appointmentForm.elements;
        const customerName = form.customerName.value.trim();
        const serviceName = form.serviceName.value.trim();
        const date = form.date.value;
        const time = form.time.value;
        const selectedCustomer = resolveCustomerFromInput(form.customerId.value, customerName);
        const selectedService = resolveServiceFromInput(form.serviceId.value, serviceName);
        const duration = Number(form.duration.value) || (selectedService ? selectedService.duration : 30);

        if (!customerName && !serviceName) {
            showAppointmentError("Please add a customer name, a haircut type, or both.");
            return;
        }
        if (!date || !isWorkingDate(date)) {
            showAppointmentError("Please choose a Wednesday, Friday, or Saturday.");
            return;
        }
        if (!time) {
            showAppointmentError("Please choose a start time.");
            return;
        }

        const startMinutes = minutesFromTime(time);
        const endMinutes = startMinutes + duration;
        if (startMinutes < HOUR_START * 60 || endMinutes > HOUR_END * 60) {
            showAppointmentError("Appointments must stay within 7am to 7pm.");
            return;
        }

        const appointment = {
            id: form.appointmentId.value || createId("appt"),
            customerId: selectedCustomer ? selectedCustomer.id : "",
            customerName: selectedCustomer ? selectedCustomer.name : customerName,
            serviceId: selectedService ? selectedService.id : "",
            serviceName: selectedService ? selectedService.name : serviceName,
            date,
            time,
            duration
        };

        upsertItem(state.data.appointments, appointment);
        persistAndRender();
        closeSheet();
    }

    function saveCustomer(event) {
        event.preventDefault();
        clearFormError(refs.customerFormError);
        hideAllSuggestions();

        const form = refs.customerForm.elements;
        const name = form.name.value.trim();
        const colour = resolveColourFromInput(form.colourChartId.value, form.colourLabel.value);
        const colourLabel = colour ? formatColourChart(colour) : form.colourLabel.value.trim();

        if (!name) {
            showFormError(refs.customerFormError, "Customer name is required.");
            return;
        }

        upsertItem(state.data.customers, {
            id: form.customerId.value || createId("cust"),
            name,
            address: form.address.value.trim(),
            phone: form.phone.value.trim(),
            colourChartId: colour ? colour.id : "",
            colourLabel
        });
        persistAndRender();
        closeSheet();
    }

    function saveService(event) {
        event.preventDefault();
        clearFormError(refs.serviceFormError);

        const form = refs.serviceForm.elements;
        const name = form.name.value.trim();
        const duration = Number(form.duration.value);

        if (!name || !duration || duration < 15) {
            showFormError(refs.serviceFormError, "Please enter a name and a valid length in minutes.");
            return;
        }

        upsertItem(state.data.services, {
            id: form.serviceId.value || createId("svc"),
            name,
            duration
        });
        persistAndRender();
        closeSheet();
    }

    function saveColour(event) {
        event.preventDefault();
        clearFormError(refs.colourFormError);

        const form = refs.colourForm.elements;
        const name = form.name.value.trim();
        const number = form.number.value.trim();

        if (!name || !number) {
            showFormError(refs.colourFormError, "Please add both a colour name and number.");
            return;
        }

        upsertItem(state.data.colourCharts, {
            id: form.colourId.value || createId("colour"),
            name,
            number
        });
        persistAndRender();
        closeSheet();
    }

    function deleteAppointment() {
        const id = refs.appointmentForm.elements.appointmentId.value;
        if (!id || !window.confirm("Delete this appointment?")) {
            return;
        }
        state.data.appointments = state.data.appointments.filter((item) => item.id !== id);
        persistAndRender();
        closeSheet();
    }

    function deleteCustomer() {
        const id = refs.customerForm.elements.customerId.value;
        if (!id) {
            return;
        }
        deleteCustomerById(id);
        closeSheet();
    }

    function deleteService() {
        const id = refs.serviceForm.elements.serviceId.value;
        if (!id) {
            return;
        }
        deleteServiceById(id);
        closeSheet();
    }

    function deleteColour() {
        const id = refs.colourForm.elements.colourId.value;
        if (!id) {
            return;
        }
        deleteColourById(id);
        closeSheet();
    }

    function deleteCustomerById(id) {
        if (!window.confirm("Delete this customer?")) {
            return;
        }
        state.data.customers = state.data.customers.filter((item) => item.id !== id);
        persistAndRender();
    }

    function deleteServiceById(id) {
        if (!window.confirm("Delete this haircut type?")) {
            return;
        }
        state.data.services = state.data.services.filter((item) => item.id !== id);
        persistAndRender();
    }

    function deleteColourById(id) {
        if (!window.confirm("Delete this colour chart entry?")) {
            return;
        }
        state.data.colourCharts = state.data.colourCharts.filter((item) => item.id !== id);
        persistAndRender();
    }

    function exportData() {
        const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `trimmers-hair-salon-backup-${state.selectedDate}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function importData(event) {
        const [file] = event.target.files || [];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                state.data = sanitizeData(JSON.parse(String(reader.result)));
                saveData();
                renderApp();
                renderSyncUi("Backup loaded on this phone.");
            } catch (error) {
                window.alert("That backup file could not be loaded.");
            }
            refs.importDataInput.value = "";
        };
        reader.readAsText(file);
    }

    function persistAndRender() {
        saveData();
        renderApp();
    }

    function saveData(options = {}) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
        if (!options.skipRemote) {
            queueRemoteSave();
        }
        renderSyncUi();
    }

    function loadData() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            return raw ? sanitizeData(JSON.parse(raw)) : sanitizeData(DEFAULT_DATA);
        } catch (error) {
            return sanitizeData(DEFAULT_DATA);
        }
    }

    function sanitizeData(input) {
        const source = input && typeof input === "object" ? input : {};
        return {
            appointments: Array.isArray(source.appointments) ? source.appointments.map(sanitizeAppointment).filter(Boolean) : [],
            customers: Array.isArray(source.customers) ? source.customers.map(sanitizeCustomer).filter(Boolean) : [],
            services: Array.isArray(source.services) ? source.services.map(sanitizeService).filter(Boolean) : DEFAULT_DATA.services.map((item) => ({ ...item })),
            colourCharts: Array.isArray(source.colourCharts) ? source.colourCharts.map(sanitizeColour).filter(Boolean) : []
        };
    }

    function sanitizeAppointment(item) {
        if (!item || typeof item !== "object" || !item.date || !item.time) {
            return null;
        }
        return {
            id: String(item.id || createId("appt")),
            customerId: String(item.customerId || ""),
            customerName: String(item.customerName || ""),
            serviceId: String(item.serviceId || ""),
            serviceName: String(item.serviceName || ""),
            date: String(item.date),
            time: String(item.time),
            duration: Math.max(Number(item.duration) || 30, 15)
        };
    }

    function sanitizeCustomer(item) {
        if (!item || typeof item !== "object" || !item.name) {
            return null;
        }
        return {
            id: String(item.id || createId("cust")),
            name: String(item.name),
            address: String(item.address || ""),
            phone: String(item.phone || ""),
            colourChartId: String(item.colourChartId || ""),
            colourLabel: String(item.colourLabel || "")
        };
    }

    function sanitizeService(item) {
        if (!item || typeof item !== "object" || !item.name || !item.duration) {
            return null;
        }
        return {
            id: String(item.id || createId("svc")),
            name: String(item.name),
            duration: Math.max(Number(item.duration) || 30, 15)
        };
    }

    function sanitizeColour(item) {
        if (!item || typeof item !== "object" || !item.name || !item.number) {
            return null;
        }
        return {
            id: String(item.id || createId("colour")),
            name: String(item.name),
            number: String(item.number)
        };
    }

    function getAppointmentsForDate(date) {
        return state.data.appointments
            .filter((appointment) => appointment.date === date)
            .sort((left, right) => left.time.localeCompare(right.time) || left.duration - right.duration);
    }

    function getLinkedCustomer(appointment) {
        if (appointment.customerId) {
            const linked = state.data.customers.find((customer) => customer.id === appointment.customerId);
            if (linked) {
                return linked;
            }
        }
        if (appointment.customerName) {
            return state.data.customers.find((customer) => normalize(customer.name) === normalize(appointment.customerName)) || null;
        }
        return null;
    }

    function getAppointmentDisplayName(appointment, customer) {
        if (customer) {
            return customer.name;
        }
        return appointment.customerName || appointment.serviceName || "Appointment";
    }

    function resolveCustomerFromInput(customerId, typedName) {
        if (customerId) {
            const linked = state.data.customers.find((customer) => customer.id === customerId);
            if (linked) {
                return linked;
            }
        }
        if (!typedName.trim()) {
            return null;
        }
        return state.data.customers.find((customer) => normalize(customer.name) === normalize(typedName)) || null;
    }

    function resolveServiceFromInput(serviceId, typedName) {
        if (serviceId) {
            const linked = state.data.services.find((service) => service.id === serviceId);
            if (linked) {
                return linked;
            }
        }
        if (!typedName.trim()) {
            return null;
        }
        return state.data.services.find((service) => normalize(service.name) === normalize(typedName)) || null;
    }

    function resolveColourFromInput(colourId, typedText) {
        if (colourId) {
            const linked = state.data.colourCharts.find((colour) => colour.id === colourId);
            if (linked) {
                return linked;
            }
        }
        if (!typedText.trim()) {
            return null;
        }
        return state.data.colourCharts.find((colour) => normalize(formatColourChart(colour)) === normalize(typedText)) || null;
    }

    function resolveCustomerColourLabel(customer) {
        if (!customer) {
            return "";
        }
        if (customer.colourChartId) {
            const linked = state.data.colourCharts.find((colour) => colour.id === customer.colourChartId);
            if (linked) {
                return formatColourChart(linked);
            }
        }
        return customer.colourLabel || "";
    }

    function renderSuggestions(container, items, onSelect, mapper) {
        if (!items.length) {
            hideSuggestions(container);
            return;
        }
        container.innerHTML = "";
        items.forEach((item) => {
            const parts = mapper(item);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "suggestion-item";
            button.innerHTML = `<strong>${escapeHtml(parts.title)}</strong>${parts.meta ? `<span>${escapeHtml(parts.meta)}</span>` : ""}`;
            button.addEventListener("click", () => onSelect(item));
            container.appendChild(button);
        });
        container.classList.remove("is-hidden");
    }

    function hideAllSuggestions() {
        hideSuggestions(refs.customerSuggestions);
        hideSuggestions(refs.serviceSuggestions);
        hideSuggestions(refs.customerColourSuggestions);
    }

    function hideSuggestions(container) {
        container.classList.add("is-hidden");
        container.innerHTML = "";
    }

    function upsertItem(collection, nextItem) {
        const index = collection.findIndex((item) => item.id === nextItem.id);
        if (index >= 0) {
            collection.splice(index, 1, nextItem);
        } else {
            collection.push(nextItem);
        }
    }

    function clearAppointmentError() {
        clearFormError(refs.appointmentFormError);
    }

    function showAppointmentError(message) {
        showFormError(refs.appointmentFormError, message);
    }

    function showFormError(element, message) {
        element.textContent = message;
        element.classList.remove("is-hidden");
    }

    function clearFormError(element) {
        element.textContent = "";
        element.classList.add("is-hidden");
    }

    function setSaveStatus(text) {
        refs.saveStatus.textContent = text;
    }

    function getSuggestedTimeForDate(date) {
        const items = getAppointmentsForDate(date);
        if (!items.length) {
            return "09:00";
        }
        const latest = items[items.length - 1];
        const nextStart = Math.min(minutesFromTime(latest.time) + latest.duration, HOUR_END * 60 - 30);
        return timeFromMinutes(Math.max(nextStart, HOUR_START * 60));
    }

    function getNextWorkingDate(date) {
        let current = parseDateInput(date);
        while (!WORKING_DAY_SET.has(current.getDay())) {
            current = addDays(current, 1);
        }
        return toIsoDate(current);
    }

    function isWorkingDate(dateString) {
        return WORKING_DAY_SET.has(parseLocalDate(dateString).getDay());
    }

    function formatDateForButton(dateString) {
        return parseLocalDate(dateString).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short"
        });
    }

    function formatDateForHeading(dateString) {
        return parseLocalDate(dateString).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    function formatHourLabel(hour) {
        const suffix = hour >= 12 ? "pm" : "am";
        const hour12 = hour % 12 || 12;
        return `${hour12}${suffix}`;
    }

    function formatTimeLabel(time) {
        const [hours, minutes] = time.split(":").map(Number);
        const suffix = hours >= 12 ? "pm" : "am";
        const hour12 = hours % 12 || 12;
        return `${hour12}:${String(minutes).padStart(2, "0")}${suffix}`;
    }

    function formatDuration(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (!hours) {
            return `${minutes} mins`;
        }
        if (!minutes) {
            return `${hours}h`;
        }
        return `${hours}h ${minutes}m`;
    }

    function formatColourChart(colour) {
        return `${colour.name} (${colour.number})`;
    }

    function normalize(value) {
        return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    }

    function minutesFromTime(time) {
        const [hours, minutes] = time.split(":").map(Number);
        return hours * 60 + minutes;
    }

    function timeFromMinutes(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    function createId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function addDays(date, amount) {
        const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        next.setDate(next.getDate() + amount);
        return next;
    }

    function addMonths(date, amount) {
        return new Date(date.getFullYear(), date.getMonth() + amount, 1);
    }

    function startOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function parseLocalDate(dateString) {
        const [year, month, day] = dateString.split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    function parseDateInput(value) {
        if (value instanceof Date) {
            return new Date(value.getFullYear(), value.getMonth(), value.getDate());
        }
        if (typeof value === "string") {
            return parseLocalDate(value);
        }
        return new Date();
    }

    function toIsoDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
})();
