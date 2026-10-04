"use strict";

/*
    DEVICE PANEL
    -------------------------
    Interfaz + navegación + conexión WebSocket
    + preparación para compartir pantalla autorizado.
*/

const state = {
    currentPage: "screens",
    socket: null,

    devices: JSON.parse(
        localStorage.getItem("cp_devices") || "[]"
    ),

    activity: JSON.parse(
        localStorage.getItem("cp_activity") || "[]"
    ),

    pairCode: null,

    selectedDevice: null,

    screenTimer: null
};


/* ================= ELEMENTOS ================= */

const $ = id => document.getElementById(id);

const sidebar = $("sidebar");
const overlay = $("overlay");

const menuButton = $("menuButton");
const closeMenu = $("closeMenu");

const pageTitle = $("pageTitle");
const pageSubtitle = $("pageSubtitle");

const connectionDot = $("connectionDot");
const connectionText = $("connectionText");

const deviceList = $("deviceList");

const screenModal = $("screenModal");
const remoteScreen = $("remoteScreen");
const screenPlaceholder = $("screenPlaceholder");


/* ================= TOAST ================= */

function toast(message) {

    const box = document.createElement("div");

    box.className = "toast";
    box.textContent = message;

    $("toastContainer").appendChild(box);

    setTimeout(() => {
        box.remove();
    }, 3000);
}


/* ================= ACTIVIDAD ================= */

function saveActivity() {

    localStorage.setItem(
        "cp_activity",
        JSON.stringify(state.activity)
    );
}


function addActivity(title, description = "") {

    state.activity.unshift({
        title,
        description,
        time: new Date().toLocaleString()
    });

    state.activity =
        state.activity.slice(0, 100);

    saveActivity();

    renderActivity();
}


function renderActivity() {

    const container = $("activityList");

    if (!state.activity.length) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">◷</div>
                <h3>Sin actividad</h3>
                <p>Aquí aparecerán las conexiones y eventos.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = state.activity.map(event => `

        <div class="activity-item">

            <strong>${escapeHTML(event.title)}</strong>

            <span>
                ${escapeHTML(event.description)}
                ${event.time ? " · " + escapeHTML(event.time) : ""}
            </span>

        </div>

    `).join("");
}


/* ================= SEGURIDAD HTML ================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ================= MENU ================= */

function openMenu() {

    sidebar.classList.add("open");
    overlay.classList.add("show");
}


function closeSidebar() {

    sidebar.classList.remove("open");
    overlay.classList.remove("show");
}


menuButton.addEventListener("click", openMenu);
closeMenu.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);


/* ================= CAMBIO DE PESTAÑAS ================= */

const menuItems =
    document.querySelectorAll(".menu-item");


menuItems.forEach(button => {

    button.addEventListener("click", () => {

        const page =
            button.dataset.page;

        changePage(page);

        closeSidebar();
    });

});


function changePage(page) {

    state.currentPage = page;

    document
        .querySelectorAll(".page")
        .forEach(section => {

            section.classList.remove("active");

        });

    const target =
        document.getElementById(
            "page-" + page
        );

    if (target) {
        target.classList.add("active");
    }


    menuItems.forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.page === page
        );

    });


    const titles = {

        screens: [
            "Pantallas",
            "Dispositivos conectados"
        ],

        connect: [
            "Conectar",
            "Vincular un dispositivo"
        ],

        activity: [
            "Actividad",
            "Eventos recientes"
        ],

        settings: [
            "Configuración",
            "Opciones del panel"
        ]

    };


    if (titles[page]) {

        pageTitle.textContent =
            titles[page][0];

        pageSubtitle.textContent =
            titles[page][1];
    }
}


/* ================= CÓDIGO ================= */

$("generateCode").addEventListener(
    "click",
    generatePairCode
);


function generatePairCode() {

    const code =
        String(
            Math.floor(
                100000 +
                Math.random() * 900000
            )
        );

    state.pairCode = code;

    $("codeValue").textContent = code;

    $("generatedCode")
        .classList.remove("hidden");

    addActivity(
        "Código generado",
        "Código de vinculación creado."
    );

    toast("Código generado");
}


/* ================= COPIAR ================= */

$("copyCode").addEventListener(
    "click",
    async () => {

        if (!state.pairCode) {

            toast("Primero genera un código");

            return;
        }

        try {

            await navigator.clipboard.writeText(
                state.pairCode
            );

            toast("Código copiado");

        } catch {

            toast("No se pudo copiar");
        }
    }
);


/* ================= CONECTAR ================= */

$("connectDevice").addEventListener(
    "click",
    connectDevice
);


function connectDevice() {

    const code =
        $("pairCodeInput")
            .value
            .trim();

    const name =
        $("deviceNameInput")
            .value
            .trim() ||
        "Teléfono";


    if (!/^\d{6}$/.test(code)) {

        showConnectMessage(
            "Escribe un código válido de 6 números."
        );

        return;
    }


    /*
        Si existe servidor WebSocket,
        mandamos la solicitud real.
    */

    if (
        state.socket &&
        state.socket.readyState === WebSocket.OPEN
    ) {

        sendSocket({
            type: "pair_device",
            code,
            name,
            deviceType: "phone"
        });

        showConnectMessage(
            "Solicitando conexión..."
        );

        return;
    }


    /*
        Modo local para que la interfaz
        siga funcionando aunque todavía
        no exista el servidor.
    */

    const device = {

        id:
            "local-" +
            Date.now(),

        name,

        deviceType: "phone",

        status: "offline",

        screenSharing: false,

        lastSeen:
            new Date().toISOString()

    };


    state.devices.push(device);

    saveDevices();

    renderDevices();

    addActivity(
        "Dispositivo agregado",
        name
    );

    showConnectMessage(
        "Dispositivo agregado localmente. Para conexión real necesitas el servidor."
    );

    toast("Dispositivo agregado");
}


/* ================= MENSAJE ================= */

function showConnectMessage(message) {

    $("connectMessage").textContent =
        message;

}


/* ================= DEVICES ================= */

function saveDevices() {

    localStorage.setItem(
        "cp_devices",
        JSON.stringify(state.devices)
    );
}


function renderDevices() {

    if (!state.devices.length) {

        deviceList.innerHTML = `

            <div id="emptyDevices" class="empty">

                <div class="empty-icon">▣</div>

                <h3>No hay dispositivos</h3>

                <p>
                    Conecta un teléfono para verlo aquí.
                </p>

                <button
                    id="goConnect"
                    class="white-btn">
                    Conectar dispositivo
                </button>

            </div>

        `;

        $("goConnect").onclick = () =>
            changePage("connect");

        return;
    }


    deviceList.innerHTML =
        state.devices.map(device => {

            const online =
                device.status === "online";


            return `

                <div
                    class="device-card"
                    data-device-id="${escapeHTML(device.id)}">

                    <div class="device-head">

                        <div class="device-icon">
                            ${device.deviceType === "tablet"
                                ? "▣"
                                : "▯"}
                        </div>

                        <div>

                            <div class="device-name">
                                ${escapeHTML(device.name)}
                            </div>

                            <div class="device-type">
                                ${escapeHTML(device.deviceType)}
                            </div>

                        </div>

                    </div>


                    <div class="status">

                        <span
                            class="status-dot ${
                                online ? "online" : ""
                            }">
                        </span>

                        ${online
                            ? "En línea"
                            : "Desconectado"}

                    </div>


                    <div class="device-actions">

                        <button
                            class="white-btn"
                            data-action="screen"
                            data-id="${escapeHTML(device.id)}">
                            Pantalla
                        </button>

                        <button
                            class="dark-btn"
                            data-action="stop"
                            data-id="${escapeHTML(device.id)}">
                            Detener
                        </button>

                        <button
                            class="dark-btn"
                            data-action="timer"
                            data-id="${escapeHTML(device.id)}">
                            Temporizador
                        </button>

                        <button
                            class="dark-btn"
                            data-action="remove"
                            data-id="${escapeHTML(device.id)}">
                            Quitar
                        </button>

                    </div>

                </div>

            `;

        }).join("");


    deviceList
        .querySelectorAll("[data-action]")
        .forEach(button => {

            button.addEventListener(
                "click",
                handleDeviceAction
            );

        });
}


/* ================= ACCIONES ================= */

function handleDeviceAction(event) {

    const button =
        event.currentTarget;

    const id =
        button.dataset.id;

    const action =
        button.dataset.action;


    const device =
        state.devices.find(
            item => item.id === id
        );


    if (!device) return;


    if (action === "screen") {

        openScreen(device);

        return;
    }


    if (action === "stop") {

        stopRemoteScreen(device);

        return;
    }


    if (action === "timer") {

        openScreen(device);

        $("timerBox")
            .classList.remove("hidden");

        return;
    }


    if (action === "remove") {

        state.devices =
            state.devices.filter(
                item => item.id !== id
            );

        saveDevices();

        renderDevices();

        addActivity(
            "Dispositivo eliminado",
            device.name
        );

        toast("Dispositivo eliminado");
    }
}


/* ================= PANTALLA ================= */

function openScreen(device) {

    state.selectedDevice =
        device;

    $("screenModalTitle").textContent =
        device.name;


    screenModal
        .classList.remove("hidden");


    $("timerBox")
        .classList.add("hidden");


    if (device.screenSharing) {

        remoteScreen.style.display =
            "block";

        screenPlaceholder.style.display =
            "none";

    } else {

        remoteScreen.style.display =
            "none";

        screenPlaceholder.style.display =
            "grid";
    }


    /*
        Solicitar pantalla al dispositivo
        conectado.
    */

    sendSocket({

        type: "request_screen",

        deviceId: device.id

    });


    toast(
        "Solicitando pantalla..."
    );
}


/* ================= DETENER ================= */

$("stopRemoteScreen").addEventListener(
    "click",
    () => {

        if (!state.selectedDevice)
            return;

        stopRemoteScreen(
            state.selectedDevice
        );
    }
);


function stopRemoteScreen(device) {

    sendSocket({

        type: "stop_screen",

        deviceId: device.id

    });


    device.screenSharing = false;

    saveDevices();

    renderDevices();

    remoteScreen.srcObject = null;

    remoteScreen.style.display =
        "none";

    screenPlaceholder.style.display =
        "grid";


    addActivity(
        "Pantalla detenida",
        device.name
    );

    toast("Pantalla detenida");
}


/* ================= TEMPORIZADOR ================= */

$("timerRemoteScreen")
    .addEventListener(
        "click",
        () => {

            $("timerBox")
                .classList.toggle(
                    "hidden"
                );

        }
    );


document
    .querySelectorAll(
        "#timerBox button"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const seconds =
                    Number(
                        button.dataset.time
                    );


                if (!state.selectedDevice)
                    return;


                startTimer(
                    state.selectedDevice,
                    seconds
                );

            }
        );

    });


function startTimer(device, seconds) {

    clearTimeout(
        state.screenTimer
    );


    sendSocket({

        type: "screen_timer",

        deviceId: device.id,

        seconds

    });


    toast(
        `Temporizador: ${seconds} segundos`
    );


    state.screenTimer =
        setTimeout(() => {

            stopRemoteScreen(
                device
            );

        }, seconds * 1000);


    $("timerBox")
        .classList.add("hidden");
}


/* ================= CERRAR MODAL ================= */

$("closeScreenModal")
    .addEventListener(
        "click",
        closeScreenModal
    );


screenModal.addEventListener(
    "click",
    event => {

        if (
            event.target === screenModal
        ) {
            closeScreenModal();
        }

    }
);


function closeScreenModal() {

    screenModal
        .classList.add("hidden");

    clearTimeout(
        state.screenTimer
    );

    state.screenTimer = null;
}


/* ================= ACTUALIZAR ================= */

$("refreshDevices")
    .addEventListener(
        "click",
        () => {

            renderDevices();

            sendSocket({
                type: "request_devices"
            });

            toast("Actualizado");

        }
    );


$("goConnect")?.addEventListener(
    "click",
    () => changePage("connect")
);


/* ================= ACTIVIDAD ================= */

$("clearActivity")
    .addEventListener(
        "click",
        () => {

            state.activity = [];

            saveActivity();

            renderActivity();

            toast("Actividad limpiada");

        }
    );


/* ================= SETTINGS ================= */

$("animationsToggle")
    .addEventListener(
        "change",
        event => {

            document.body.dataset.animations =
                event.target.checked
                    ? "on"
                    : "off";

        }
    );


$("notificationsToggle")
    .addEventListener(
        "change",
        event => {

            localStorage.setItem(
                "cp_notifications",
                event.target.checked
            );

        }
    );


/* ================= WEBSOCKET ================= */

function connectSocket() {

    /*
        En local:

        ws://localhost:3000

        En HTTPS:

        wss://tu-dominio.com
    */

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";


    const url =
        `${protocol}//${location.host}`;


    try {

        state.socket =
            new WebSocket(url);

    } catch {

        setConnection(false);

        return;
    }


    state.socket.addEventListener(
        "open",
        () => {

            setConnection(true);

            addActivity(
                "Servidor conectado"
            );


            sendSocket({
                type: "panel_register"
            });

        }
    );


    state.socket.addEventListener(
        "close",
        () => {

            setConnection(false);

            setTimeout(
                connectSocket,
                3000
            );

        }
    );


    state.socket.addEventListener(
        "error",
        () => {

            setConnection(false);

        }
    );


    state.socket.addEventListener(
        "message",
        event => {

            try {

                const message =
                    JSON.parse(
                        event.data
                    );

                handleServerMessage(
                    message
                );

            } catch {

                console.warn(
                    "Mensaje inválido"
                );

            }

        }
    );
}


function sendSocket(data) {

    if (
        !state.socket ||
        state.socket.readyState !==
        WebSocket.OPEN
    ) {
        return false;
    }


    state.socket.send(
        JSON.stringify(data)
    );

    return true;
}


/* ================= SERVER EVENTS ================= */

function handleServerMessage(message) {

    switch (message.type) {


        case "connected":

            setConnection(true);

            break;


        case "device_connected":

            updateDevice(
                message.device
            );

            addActivity(
                "Dispositivo conectado",
                message.device.name
            );

            break;


        case "device_disconnected":

            updateDeviceStatus(
                message.deviceId,
                "offline"
            );

            break;


        case "device_event":

            addActivity(
                message.title ||
                "Evento del dispositivo",

                message.description ||
                ""
            );

            break;


        case "screen_started":

            updateDeviceScreen(
                message.deviceId,
                true
            );

            if (
                state.selectedDevice &&
                state.selectedDevice.id ===
                message.deviceId
            ) {

                screenPlaceholder.style.display =
                    "none";

                remoteScreen.style.display =
                    "block";
            }

            break;


        case "screen_stopped":

            updateDeviceScreen(
                message.deviceId,
                false
            );

            if (
                state.selectedDevice &&
                state.selectedDevice.id ===
                message.deviceId
            ) {

                remoteScreen.srcObject =
                    null;

                remoteScreen.style.display =
                    "none";

                screenPlaceholder.style.display =
                    "grid";
            }

            break;


        /*
            WebRTC offer/answer/candidates
            serán manejados cuando el servidor
            WebSocket esté instalado.
        */

        case "webrtc_offer":

            handleWebRTCOffer(
                message
            );

            break;


        case "webrtc_candidate":

            handleWebRTCCandidate(
                message
            );

            break;


        case "pair_result":

            if (message.ok) {

                showConnectMessage(
                    "Dispositivo conectado correctamente."
                );

                toast(
                    "Conexión realizada"
                );

            } else {

                showConnectMessage(
                    message.error ||
                    "No se pudo conectar."
                );
            }

            break;
    }
}


/* ================= DEVICE DATA ================= */

function updateDevice(device) {

    const index =
        state.devices.findIndex(
            item =>
                item.id === device.id
        );


    if (index === -1) {

        state.devices.push(
            device
        );

    } else {

        state.devices[index] = {
            ...state.devices[index],
            ...device
        };

    }


    saveDevices();
    renderDevices();
}


function updateDeviceStatus(
    id,
    status
) {

    const device =
        state.devices.find(
            item => item.id === id
        );


    if (!device) return;


    device.status = status;

    saveDevices();

    renderDevices();
}


function updateDeviceScreen(
    id,
    sharing
) {

    const device =
        state.devices.find(
            item => item.id === id
        );


    if (!device) return;


    device.screenSharing =
        sharing;


    saveDevices();

    renderDevices();
}


/* ================= WEBRTC ================= */

const peers =
    new Map();


async function handleWebRTCOffer(
    message
) {

    /*
        Esta parte necesita que el servidor
        enrute correctamente la señalización.

        Solo se acepta una transmisión
        que haya sido iniciada/autorizada
        por el dispositivo.
    */

    const deviceId =
        message.deviceId;


    let peer =
        peers.get(deviceId);


    if (!peer) {

        peer =
            new RTCPeerConnection({

                iceServers: [

                    {
                        urls:
                            "stun:stun.l.google.com:19302"
                    }

                ]

            });


        peers.set(
            deviceId,
            peer
        );


        peer.ontrack =
            event => {

                if (
                    state.selectedDevice &&
                    state.selectedDevice.id ===
                    deviceId
                ) {

                    remoteScreen.srcObject =
                        event.streams[0];

                    remoteScreen.style.display =
                        "block";

                    screenPlaceholder.style.display =
                        "none";

                }

            };


        peer.onicecandidate =
            event => {

                if (
                    event.candidate
                ) {

                    sendSocket({

                        type:
                            "webrtc_candidate",

                        deviceId,

                        candidate:
                            event.candidate

                    });

                }

            };

    }


    await peer.setRemoteDescription(
        new RTCSessionDescription(
            message.offer
        )
    );


    const answer =
        await peer.createAnswer();


    await peer.setLocalDescription(
        answer
    );


    sendSocket({

        type: "webrtc_answer",

        deviceId,

        answer

    });
}


async function handleWebRTCCandidate(
    message
) {

    const peer =
        peers.get(
            message.deviceId
        );


    if (!peer)
        return;


    try {

        await peer.addIceCandidate(
            message.candidate
        );

    } catch {

        console.warn(
            "No se pudo agregar ICE candidate"
        );

    }
}


/* ================= CONNECTION UI ================= */

function setConnection(online) {

    if (online) {

        connectionDot.classList.add(
            "online"
        );

        connectionText.textContent =
            "Conectado";

    } else {

        connectionDot.classList.remove(
            "online"
        );

        connectionText.textContent =
            "Desconectado";
    }
}


/* ================= INIT ================= */

renderDevices();
renderActivity();
changePage("screens");

/*
    Intentamos conectar al servidor.
    Si todavía no existe, la interfaz
    continúa funcionando localmente.
*/

connectSocket();