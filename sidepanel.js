// ==========================================
// JARVIS - GITHUB PAGES VERSION
// ==========================================

const MODEL = "gemini-3.6-flash";

const $ = (id) => document.getElementById(id);

let busy = false;
let history = [];
let recognition = null;
let listening = false;
let wakeMode = true;


// ==========================================
// STATUS
// ==========================================

function state(text, mode = "") {
    const stateEl = $("state");
    const reactor = $("reactor");

    if (stateEl) {
        stateEl.textContent = text;
    }

    if (reactor) {
        reactor.className = "reactor " + mode;
    }
}

function setStatus(text) {
    const status = $("status");

    if (status) {
        status.textContent = text;
    }
}


// ==========================================
// CHAT
// ==========================================

function log(who, text, error = false) {

    const chat = $("chat");

    if (!chat) return;

    const div = document.createElement("div");

    div.className =
        `msg ${who === "YOU" ? "user" : "ai"}${error ? " error" : ""}`;

    const whoDiv = document.createElement("div");

    whoDiv.className = "who";
    whoDiv.textContent = who;

    const textDiv = document.createElement("div");

    textDiv.textContent = text;

    div.appendChild(whoDiv);
    div.appendChild(textDiv);

    chat.appendChild(div);

    chat.scrollTop = chat.scrollHeight;
}


// ==========================================
// API KEY
// ==========================================

function getApiKey() {

    return localStorage.getItem("jarvis_api_key") || "";
}


// ==========================================
// SETTINGS
// ==========================================

function getSettings() {

    try {

        return JSON.parse(
            localStorage.getItem("jarvis_settings") || "{}"
        );

    } catch {

        return {};
    }
}


// ==========================================
// SAVE CHAT HISTORY
// ==========================================

function saveHistory() {

    try {

        localStorage.setItem(
            "jarvis_history",
            JSON.stringify(history)
        );

    } catch (error) {

        console.error(
            "Could not save history:",
            error
        );
    }
}


// ==========================================
// VOICE OUTPUT
// ==========================================

function speak(text) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    const settings = getSettings();

    if (settings.speak === false) {
        return;
    }

    speechSynthesis.cancel();

    const voice = new SpeechSynthesisUtterance(text);

    voice.rate =
        Number(settings.voiceRate || 1.05);

    voice.pitch = 0.9;

    voice.lang = "en-GB";

    speechSynthesis.speak(voice);
}


// ==========================================
// STOP VOICE
// ==========================================

function stopVoice() {

    if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
    }

    state("READY");

    setStatus("Ready.");
}


// ==========================================
// GEMINI AI
// ==========================================

async function ask(question) {

    if (busy) {
        return;
    }

    const apiKey = getApiKey();

    if (!apiKey) {

        state("SETUP NEEDED");

        setStatus(
            "Add your Gemini API key in Settings."
        );

        log(
            "JARVIS",
            "I need your Gemini API key. Open Settings and save your key first.",
            true
        );

        return;
    }

    busy = true;

    state("THINKING", "thinking");

    setStatus("JARVIS is thinking...");

    try {

        const recentHistory =
            history.slice(-10);

        const contents = [];

        for (const item of recentHistory) {

            contents.push({
                role: item.role,
                parts: [
                    {
                        text: item.text
                    }
                ]
            });
        }

        contents.push({
            role: "user",
            parts: [
                {
                    text:
                        `You are JARVIS, a personal AI assistant running on a Chromebook.

Be helpful, natural and concise.

The user is speaking to you, so answers should sound natural when spoken aloud.

Do not claim that you performed an action unless you actually performed it.

User request:

${question}`
                }
            ]
        });

        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

        const response =
            await fetch(
                url,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-goog-api-key":
                            apiKey
                    },

                    body:
                        JSON.stringify({
                            contents,

                            generationConfig: {
                                maxOutputTokens: 400,
                                temperature: 0.7
                            }
                        })
                }
            );

        let data = {};

        try {

            data =
                await response.json();

        } catch {

            throw new Error(
                "Gemini returned an invalid response."
            );
        }

        if (!response.ok) {

            throw new Error(
                data?.error?.message ||
                `Gemini error HTTP ${response.status}`
            );
        }

        const answer =
            data
                ?.candidates?.[0]
                ?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim();

        if (!answer) {

            throw new Error(
                "Gemini did not return an answer."
            );
        }

        history.push(
            {
                role: "user",
                text: question
            },
            {
                role: "model",
                text: answer
            }
        );

        if (history.length > 20) {

            history =
                history.slice(-20);
        }

        saveHistory();

        log(
            "JARVIS",
            answer
        );

        state(
            "SPEAKING",
            "speaking"
        );

        setStatus(
            "Response ready."
        );

        speak(answer);

    } catch (error) {

        console.error(
            "JARVIS AI ERROR:",
            error
        );

        log(
            "JARVIS ERROR",
            error.message,
            true
        );

        state(
            "AI ERROR"
        );

        setStatus(
            error.message
        );

    } finally {

        busy = false;
    }
}


// ==========================================
// COMMAND HANDLER
// ==========================================

async function handle(text) {

    const command =
        text.toLowerCase().trim();


    // TIME
    if (
        command.includes("what time") ||
        command === "time"
    ) {

        const now =
            new Date();

        const time =
            now.toLocaleTimeString(
                "en-GB",
                {
                    hour: "numeric",
                    minute: "2-digit"
                }
            );

        const response =
            `It is ${time}.`;

        log(
            "JARVIS",
            response
        );

        speak(response);

        return;
    }


    // DATE
    if (
        command.includes("what date") ||
        command.includes("what day is it") ||
        command === "date"
    ) {

        const date =
            new Date();

        const response =
            `Today is ${date.toLocaleDateString(
                "en-GB",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            )}.`;

        log(
            "JARVIS",
            response
        );

        speak(response);

        return;
    }


    // GOOGLE SEARCH
    if (
        command.startsWith(
            "search google for"
        )
    ) {

        const query =
            text.replace(
                /search google for/i,
                ""
            ).trim();

        if (query) {

            window.open(
                "https://www.google.com/search?q=" +
                encodeURIComponent(query),
                "_blank"
            );

            speak(
                `Searching Google for ${query}.`
            );
        }

        return;
    }


    // YOUTUBE SEARCH
    if (
        command.startsWith(
            "search youtube for"
        )
    ) {

        const query =
            text.replace(
                /search youtube for/i,
                ""
            ).trim();

        if (query) {

            window.open(
                "https://www.youtube.com/results?search_query=" +
                encodeURIComponent(query),
                "_blank"
            );

            speak(
                `Searching YouTube for ${query}.`
            );
        }

        return;
    }


    // OPEN GOOGLE
    if (
        command === "open google"
    ) {

        window.open(
            "https://www.google.com",
            "_blank"
        );

        speak("Opening Google.");

        return;
    }


    // OPEN YOUTUBE
    if (
        command === "open youtube"
    ) {

        window.open(
            "https://www.youtube.com",
            "_blank"
        );

        speak("Opening YouTube.");

        return;
    }


    // OPEN GMAIL
    if (
        command === "open gmail"
    ) {

        window.open(
            "https://mail.google.com",
            "_blank"
        );

        speak("Opening Gmail.");

        return;
    }


    // WEATHER
    if (
        command.includes("weather")
    ) {

        window.open(
            "https://www.google.com/search?q=weather",
            "_blank"
        );

        speak(
            "Opening the weather."
        );

        return;
    }


    // REMINDER
    const reminder =
        text.match(
            /remind me in\s+(\d+(?:\.\d+)?)\s*(minute|minutes|hour|hours)\s*(?:to\s*)?(.*)/i
        );

    if (reminder) {

        const amount =
            Number(reminder[1]);

        const unit =
            reminder[2]
                .toLowerCase();

        const message =
            reminder[3] ||
            "Your reminder";

        let milliseconds =
            amount * 60 * 1000;

        if (
            unit.startsWith("hour")
        ) {

            milliseconds =
                amount *
                60 *
                60 *
                1000;
        }

        setTimeout(
            () => {

                log(
                    "JARVIS",
                    `Reminder: ${message}`
                );

                speak(
                    `Reminder. ${message}`
                );

                alert(
                    `JARVIS Reminder:\n\n${message}`
                );

            },
            milliseconds
        );

        speak(
            `Okay. I'll remind you in ${amount} ${unit}.`
        );

        return;
    }


    // OTHERWISE USE GEMINI
    await ask(text);
}


// ==========================================
// SEND BUTTON
// ==========================================

function sendMessage() {

    const input =
        $("input");

    if (!input) {
        return;
    }

    const text =
        input.value.trim();

    if (!text) {
        return;
    }

    input.value = "";

    log(
        "YOU",
        text
    );

    handle(text);
}


// ==========================================
// SPEECH RECOGNITION
// ==========================================

function initRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        setStatus(
            "Voice input unavailable. Type instead."
        );

        return;
    }

    recognition =
        new SpeechRecognition();

    recognition.lang =
        "en-GB";

    recognition.continuous =
        true;

    recognition.interimResults =
        false;

    recognition.maxAlternatives =
        1;


    recognition.onstart =
        () => {

            listening = true;

            const button =
                $("micBtn");

            if (button) {

                button.textContent =
                    "⏹ Stop listening";

                button.classList.add(
                    "active"
                );
            }

            setStatus(
                "Listening..."
            );

            state(
                wakeMode
                    ? "LISTENING FOR JARVIS"
                    : "LISTENING",
                "listening"
            );
        };


    recognition.onend =
        () => {

            if (listening) {

                try {

                    recognition.start();

                } catch {

                    // Already starting
                }
            }
        };


    recognition.onerror =
        (event) => {

            console.error(
                "Speech recognition:",
                event.error
            );

            if (
                event.error ===
                "not-allowed"
            ) {

                listening = false;

                setStatus(
                    "Microphone permission denied."
                );
            }
        };


    recognition.onresult =
        (event) => {

            let finalText = "";

            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                if (
                    event.results[i].isFinal
                ) {

                    finalText +=
                        event.results[i][0]
                            .transcript;
                }
            }

            finalText =
                finalText.trim();

            if (!finalText) {
                return;
            }


            // WAKE WORD
            if (wakeMode) {

                if (
                    /\bjarvis\b/i.test(
                        finalText
                    )
                ) {

                    wakeMode = false;

                    state(
                        "LISTENING FOR COMMAND",
                        "listening"
                    );

                    setStatus(
                        "Go ahead."
                    );

                    speak(
                        "Yes?"
                    );
                }

                return;
            }


            // COMMAND
            wakeMode = true;

            log(
                "YOU",
                finalText
            );

            handle(
                finalText
            );
        };
}


// ==========================================
// MICROPHONE BUTTON
// ==========================================

function toggleMic() {

    if (!recognition) {

        initRecognition();
    }

    if (!recognition) {
        return;
    }


    if (listening) {

        listening = false;

        try {

            recognition.stop();

        } catch {}

        const button =
            $("micBtn");

        if (button) {

            button.textContent =
                "🎙 Start listening";

            button.classList.remove(
                "active"
            );
        }

        state(
            "READY"
        );

        setStatus(
            "Say Jarvis or type a message."
        );

        return;
    }


    try {

        recognition.start();

    } catch {}
}


// ==========================================
// LOAD SAVED DATA
// ==========================================

function loadData() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    "jarvis_history"
                ) || "[]"
            );

        history =
            Array.isArray(saved)
                ? saved
                : [];

    } catch {

        history = [];
    }


    const key =
        getApiKey();

    const keyStatus =
        $("keyStatus");

    if (keyStatus) {

        keyStatus.textContent =
            key
                ? "KEY: SET"
                : "KEY: NOT SET";
    }


    if (history.length) {

        history
            .slice(-6)
            .forEach(item => {

                log(
                    item.role === "user"
                        ? "YOU"
                        : "JARVIS",
                    item.text
                );
            });

    } else {

        log(
            "JARVIS",
            "System ready. Say “Jarvis” or type a command."
        );
    }
}


// ==========================================
// BUTTONS
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if ($("sendBtn")) {

            $("sendBtn").onclick =
                sendMessage;
        }


        if ($("input")) {

            $("input").addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        sendMessage();
                    }
                }
            );
        }


        if ($("micBtn")) {

            $("micBtn").onclick =
                toggleMic;
        }


        if ($("stopBtn")) {

            $("stopBtn").onclick =
                stopVoice;
        }


        if ($("clearBtn")) {

            $("clearBtn").onclick =
                () => {

                    const chat =
                        $("chat");

                    if (chat) {
                        chat.innerHTML = "";
                    }

                    history = [];

                    localStorage.removeItem(
                        "jarvis_history"
                    );

                    log(
                        "JARVIS",
                        "Chat cleared."
                    );
                };
        }


        if ($("settingsBtn")) {

            $("settingsBtn").onclick =
                () => {

                    window.location.href =
                        "settings.html";
                };
        }


        document
            .querySelectorAll(
                ".quick button"
            )
            .forEach(button => {

                button.onclick =
                    async () => {

                        const command =
                            button.dataset.cmd;

                        if (
                            command ===
                            "time"
                        ) {

                            handle(
                                "what time is it"
                            );
                        }

                        if (
                            command ===
                            "weather"
                        ) {

                            handle(
                                "weather"
                            );
                        }

                        if (
                            command ===
                            "search"
                        ) {

                            const query =
                                prompt(
                                    "Search Google for:"
                                );

                            if (query) {

                                handle(
                                    "search Google for " +
                                    query
                                );
                            }
                        }

                        if (
                            command ===
                            "youtube"
                        ) {

                            const query =
                                prompt(
                                    "Search YouTube for:"
                                );

                            if (query) {

                                handle(
                                    "search YouTube for " +
                                    query
                                );
                            }
                        }

                        if (
                            command ===
                            "reminder"
                        ) {

                            const minutes =
                                prompt(
                                    "Minutes from now:"
                                );

                            const reminderText =
                                prompt(
                                    "Reminder:"
                                );

                            if (
                                minutes &&
                                reminderText
                            ) {

                                handle(
                                    `remind me in ${minutes} minutes to ${reminderText}`
                                );
                            }
                        }
                    };
            });


        loadData();

        initRecognition();
    }
);
