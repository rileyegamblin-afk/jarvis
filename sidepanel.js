const $ = id => document.getElementById(id);

const MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash"
];

let history = [];
let busy = false;
let recognition = null;
let listening = false;
let wakeMode = true;


// ======================================================
// STORAGE
// ======================================================

function getApiKey() {
  return localStorage.getItem("jarvis_api_key") || "";
}

function getSettings() {
  try {
    return JSON.parse(
      localStorage.getItem("jarvis_settings") || "{}"
    );
  } catch {
    return {};
  }
}

function saveHistory() {
  localStorage.setItem(
    "jarvis_history",
    JSON.stringify(history)
  );
}


// ======================================================
// UI
// ======================================================

function log(who, text) {
  const div = document.createElement("div");

  div.className =
    `msg ${who === "YOU" ? "user" : "ai"}`;

  div.innerHTML =
    `<div class="who">${who}</div><div></div>`;

  div.querySelector("div:last-child").textContent =
    text;

  $("chat").appendChild(div);

  $("chat").scrollTop =
    $("chat").scrollHeight;
}


function state(text, mode = "") {
  $("state").textContent = text;
  $("reactor").className = "reactor " + mode;
}


// ======================================================
// SPEECH
// ======================================================

function speak(text) {
  const settings = getSettings();

  if (settings.speak === false) return;

  speechSynthesis.cancel();

  const voice = new SpeechSynthesisUtterance(text);

  voice.rate =
    Number(settings.voiceRate || 1.1);

  voice.pitch = 0.9;

  speechSynthesis.speak(voice);
}


function stopVoice() {
  speechSynthesis.cancel();

  state("READY");

  $("aiStatus").textContent =
    "AI: READY";
}


// ======================================================
// MICROPHONE
// ======================================================

function initRecognition() {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {

    $("status").textContent =
      "Voice recognition isn't supported here. Type your message instead.";

    return;
  }

  recognition =
    new SpeechRecognition();

  recognition.lang = "en-GB";

  recognition.continuous = true;

  recognition.interimResults = true;

  recognition.maxAlternatives = 1;


  recognition.onstart = () => {

    listening = true;

    $("micBtn").textContent =
      "⏹ Stop listening";

    $("micBtn").classList.add(
      "active"
    );

    $("status").textContent =
      wakeMode
        ? "Listening for Jarvis…"
        : "Listening…";

    state(
      wakeMode
        ? "LISTENING FOR JARVIS"
        : "LISTENING",
      "listening"
    );
  };


  recognition.onend = () => {

    if (listening) {

      try {
        recognition.start();
      } catch {}
    }
  };


  recognition.onerror = event => {

    console.log(
      "Speech recognition:",
      event.error
    );

    if (
      event.error === "not-allowed" ||
      event.error === "service-not-allowed"
    ) {

      listening = false;

      $("micBtn").textContent =
        "🎙 Start listening";

      $("micBtn").classList.remove(
        "active"
      );

      state("READY");

      $("status").textContent =
        "Microphone permission was blocked.";
    }
  };


  recognition.onresult = event => {

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
          event.results[i][0].transcript;
      }
    }

    finalText =
      finalText.trim();

    if (!finalText) return;


    // Wake-word mode

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

        $("status").textContent =
          "Go ahead.";

        speak("Yes?");
      }

      return;
    }


    // Command mode

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


function toggleMic() {

  if (!recognition) {
    initRecognition();
  }

  if (!recognition) return;


  if (listening) {

    listening = false;

    try {
      recognition.stop();
    } catch {}

    $("micBtn").textContent =
      "🎙 Start listening";

    $("micBtn").classList.remove(
      "active"
    );

    state("READY");

    $("status").textContent =
      "Say “Jarvis” or type a message.";

    return;
  }


  try {
    recognition.start();
  } catch {}
}


// ======================================================
// WEB ACTIONS
// ======================================================

function openTab(url) {
  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );
}


function google(query) {

  openTab(
    "https://www.google.com/search?q=" +
    encodeURIComponent(query)
  );
}


function youtube(query) {

  openTab(
    "https://www.youtube.com/results?search_query=" +
    encodeURIComponent(query)
  );
}


function tellTime() {

  const time =
    new Date().toLocaleTimeString(
      "en-GB",
      {
        hour: "numeric",
        minute: "2-digit"
      }
    );

  const answer =
    `The time is ${time}.`;

  log(
    "JARVIS",
    answer
  );

  speak(answer);
}


// ======================================================
// WEATHER
// ======================================================

async function weather(place = "") {

  try {

    state(
      "CHECKING WEATHER",
      "thinking"
    );

    $("status").textContent =
      "Getting weather information…";


    let latitude;
    let longitude;
    let locationName;


    // --------------------------------------------------
    // Specific location
    // --------------------------------------------------

    if (place) {

      const geoResponse =
        await fetch(
          "https://geocoding-api.open-meteo.com/v1/search?name=" +
          encodeURIComponent(place) +
          "&count=1&language=en&format=json"
        );


      const geo =
        await geoResponse.json();


      if (
        !geo.results ||
        !geo.results.length
      ) {

        throw new Error(
          `I couldn't find ${place}.`
        );
      }


      latitude =
        geo.results[0].latitude;

      longitude =
        geo.results[0].longitude;

      locationName =
        [
          geo.results[0].name,
          geo.results[0].country
        ]
          .filter(Boolean)
          .join(", ");
    }


    // --------------------------------------------------
    // Current location
    // --------------------------------------------------

    else {

      const position =
        await new Promise(
          (resolve, reject) => {

            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 600000
              }
            );
          }
        );


      latitude =
        position.coords.latitude;

      longitude =
        position.coords.longitude;

      locationName =
        "your current location";
    }


    // --------------------------------------------------
    // Weather request
    // --------------------------------------------------

    const weatherResponse =
      await fetch(

        "https://api.open-meteo.com/v1/forecast?" +

        "latitude=" +
        latitude +

        "&longitude=" +
        longitude +

        "&current=" +
        "temperature_2m," +
        "apparent_temperature," +
        "relative_humidity_2m," +
        "weather_code," +
        "wind_speed_10m," +
        "precipitation" +

        "&daily=" +
        "weather_code," +
        "temperature_2m_max," +
        "temperature_2m_min," +
        "precipitation_probability_max" +

        "&forecast_days=4" +

        "&timezone=auto"
      );


    if (!weatherResponse.ok) {

      throw new Error(
        "Weather service unavailable."
      );
    }


    const data =
      await weatherResponse.json();


    const current =
      data.current;

    const daily =
      data.daily;


    const condition =
      weatherCode(
        current.weather_code
      );


    let answer =

`Weather for ${locationName}

Temperature: ${Math.round(current.temperature_2m)}°C
Feels like: ${Math.round(current.apparent_temperature)}°C
Conditions: ${condition}
Humidity: ${current.relative_humidity_2m}%
Wind: ${Math.round(current.wind_speed_10m)} km/h
Rain: ${current.precipitation} mm

Forecast:
`;


    for (
      let i = 0;
      i < daily.time.length;
      i++
    ) {

      const date =
        new Date(
          daily.time[i]
        );


      const day =
        i === 0
          ? "Today"
          : date.toLocaleDateString(
              "en-GB",
              {
                weekday: "long"
              }
            );


      answer +=

`${day}: ${Math.round(
  daily.temperature_2m_min[i]
)}–${Math.round(
  daily.temperature_2m_max[i]
)}°C, ${
  weatherCode(
    daily.weather_code[i]
  )
}, ${
  daily.precipitation_probability_max[i]
}% rain chance
`;
    }


    log(
      "JARVIS",
      answer
    );


    speak(
      `In ${locationName}, it is ${Math.round(
        current.temperature_2m
      )} degrees and ${condition}. There is a ${
        daily.precipitation_probability_max[0]
      } percent chance of rain today.`
    );


    state(
      "WEATHER READY"
    );

    $("status").textContent =
      "Weather updated.";


  } catch (error) {

    console.error(error);

    log(
      "JARVIS ERROR",
      error.message
    );

    speak(
      "Sorry, I couldn't get the weather."
    );

    state(
      "WEATHER ERROR"
    );
  }
}


function weatherCode(code) {

  const codes = {

    0: "Clear sky",

    1: "Mainly clear",

    2: "Partly cloudy",

    3: "Overcast",

    45: "Foggy",

    48: "Foggy",

    51: "Light drizzle",

    53: "Drizzle",

    55: "Heavy drizzle",

    61: "Light rain",

    63: "Rain",

    65: "Heavy rain",

    71: "Light snow",

    73: "Snow",

    75: "Heavy snow",

    80: "Rain showers",

    81: "Rain showers",

    82: "Heavy rain showers",

    95: "Thunderstorm",

    96: "Thunderstorm",

    99: "Thunderstorm"
  };

  return codes[code] ||
    "Unknown conditions";
}


// ======================================================
// GEMINI
// ======================================================

async function callGemini(
  model,
  apiKey,
  question
) {

  const contents = [];


  const recent =
    history.slice(-8);


  for (
    const item
    of recent
  ) {

    contents.push({

      role:
        item.role,

      parts: [
        {
          text:
            item.text
        }
      ]
    });
  }


  contents.push({

    role: "user",

    parts: [
      {
        text:
`You are JARVIS, a personal AI assistant.

Be fast, concise and natural.

You are running on a Chromebook.

Keep normal answers fairly short because they may be spoken aloud.

Do not claim that you performed an action unless the application actually performed it.

User request:
${question}`
      }
    ]
  });


  const response =
    await fetch(

      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,

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

              maxOutputTokens:
                250,

              thinkingConfig: {

                thinkingLevel:
                  "low"
              }
            }
          })
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    const error =
      new Error(
        data?.error?.message ||
        `HTTP ${response.status}`
      );

    error.status =
      response.status;

    throw error;
  }


  const text =
    data?.candidates?.[0]
      ?.content
      ?.parts
      ?.map(
        part =>
          part.text || ""
      )
      ?.join("")
      ?.trim();


  if (!text) {

    const error =
      new Error(
        "Gemini returned no text."
      );

    error.status = 503;

    throw error;
  }


  return text;
}


function temporaryError(error) {

  const status =
    Number(
      error.status || 0
    );

  const message =
    String(
      error.message || ""
    ).toLowerCase();


  return (

    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||

    message.includes(
      "high demand"
    ) ||

    message.includes(
      "overloaded"
    ) ||

    message.includes(
      "temporarily unavailable"
    ) ||

    message.includes(
      "resource exhausted"
    )
  );
}


async function askGemini(
  question
) {

  const apiKey =
    getApiKey();


  if (!apiKey) {

    throw new Error(
      "No API key saved. Open Settings and add your Gemini API key."
    );
  }


  let lastError;


  for (
    const model
    of MODELS
  ) {

    try {

      return {

        answer:
          await callGemini(
            model,
            apiKey,
            question
          ),

        model
      };

    } catch (error) {

      lastError =
        error;

      console.warn(
        model,
        error
      );


      if (
        !temporaryError(
          error
        )
      ) {

        throw error;
      }
    }
  }


  throw (
    lastError ||
    new Error(
      "All Gemini models are currently unavailable."
    )
  );
}


// ======================================================
// MAIN COMMAND SYSTEM
// ======================================================

async function handle(text) {

  const lower =
    text.toLowerCase().trim();


  // TIME

  if (
    lower === "time" ||
    lower.includes("what time") ||
    lower.includes("what's the time")
  ) {

    tellTime();

    return;
  }


  // WEATHER

  if (
    lower === "weather" ||
    lower.includes("weather today") ||
    lower.includes("what's the weather") ||
    lower.includes("what is the weather") ||
    lower.includes("weather like")
  ) {

    const match =
      text.match(
        /weather(?:\s+today)?\s+(?:in|for|at)\s+(.+)/i
      );


    await weather(
      match
        ? match[1].trim()
        : ""
    );

    return;
  }


  // OPEN YOUTUBE

  if (
    lower.includes(
      "open youtube"
    )
  ) {

    openTab(
      "https://www.youtube.com"
    );

    speak(
      "Opening YouTube."
    );

    return;
  }


  // OPEN GOOGLE

  if (
    lower.includes(
      "open google"
    )
  ) {

    openTab(
      "https://www.google.com"
    );

    speak(
      "Opening Google."
    );

    return;
  }


  // OPEN GMAIL

  if (
    lower.includes(
      "open gmail"
    )
  ) {

    openTab(
      "https://mail.google.com"
    );

    speak(
      "Opening Gmail."
    );

    return;
  }


  // GOOGLE SEARCH

  const googleMatch =
    text.match(
      /^search google for\s+(.+)/i
    );


  if (googleMatch) {

    google(
      googleMatch[1]
    );

    speak(
      "Searching Google."
    );

    return;
  }


  // YOUTUBE SEARCH

  const youtubeMatch =
    text.match(
      /^search youtube for\s+(.+)/i
    );


  if (youtubeMatch) {

    youtube(
      youtubeMatch[1]
    );

    speak(
      "Searching YouTube."
    );

    return;
  }


  // OTHER WEBSITES

  const sites = {

    "open netflix":
      [
        "https://www.netflix.com",
        "Netflix"
      ],

    "open spotify":
      [
        "https://open.spotify.com",
        "Spotify"
      ],

    "open amazon":
      [
        "https://www.amazon.co.uk",
        "Amazon"
      ],

    "open github":
      [
        "https://github.com",
        "GitHub"
      ],

    "open outlook":
      [
        "https://outlook.live.com",
        "Outlook"
      ]

  };


  for (
    const command
    in sites
  ) {

    if (
      lower.includes(
        command
      )
    ) {

      openTab(
        sites[command][0]
      );

      speak(
        "Opening " +
        sites[command][1] +
        "."
      );

      return;
    }
  }


  // EVERYTHING ELSE → GEMINI

  await ask(
    text
  );
}


// ======================================================
// ASK GEMINI
// ======================================================

async function ask(
  question
) {

  if (busy) return;

  busy = true;


  state(
    "THINKING",
    "thinking"
  );


  $("aiStatus").textContent =
    "AI: THINKING";


  $("status").textContent =
    "Working…";


  try {

    const response =
      await askGemini(
        question
      );


    const answer =
      response.answer;


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


    if (
      history.length > 16
    ) {

      history =
        history.slice(-16);
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


    $("aiStatus").textContent =
      "AI: SPEAKING";


    $("status").textContent =
      "Response ready.";


    speak(
      answer
    );


  } catch (error) {

    console.error(
      "JARVIS:",
      error
    );


    log(
      "JARVIS ERROR",
      error.message
    );


    state(
      "AI ERROR"
    );


    $("aiStatus").textContent =
      "AI: ERROR";


    $("status").textContent =
      error.message;

  } finally {

    busy = false;
  }
}


// ======================================================
// BUTTONS
// ======================================================

$("micBtn").addEventListener(
  "click",
  toggleMic
);


$("stopBtn").addEventListener(
  "click",
  stopVoice
);


$("sendBtn").addEventListener(
  "click",
  () => {

    const text =
      $("input")
        .value
        .trim();


    if (!text) return;


    $("input").value =
      "";


    log(
      "YOU",
      text
    );


    handle(
      text
    );
  }
);


$("input").addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      $("sendBtn").click();
    }
  }
);


// ======================================================
// CLEAR CHAT
// ======================================================

$("clearBtn").addEventListener(
  "click",
  () => {

    $("chat").innerHTML =
      "";

    history = [];

    localStorage.removeItem(
      "jarvis_history"
    );

    log(
      "JARVIS",
      "Conversation cleared."
    );
  }
);


// ======================================================
// SETTINGS
// ======================================================

$("settingsBtn").addEventListener(
  "click",
  () => {

    window.location.href =
      "settings.html";
  }
);


// ======================================================
// QUICK BUTTONS
// ======================================================

document
  .querySelectorAll(
    ".quick button"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        async () => {

          const command =
            button.dataset.cmd;


          if (
            command === "time"
          ) {

            tellTime();

          }


          else if (
            command === "search"
          ) {

            const q =
              prompt(
                "Search Google for:"
              );

            if (q) {
              google(q);
            }

          }


          else if (
            command === "youtube"
          ) {

            const q =
              prompt(
                "Search YouTube for:"
              );

            if (q) {
              youtube(q);
            }

          }


          else if (
            command === "weather"
          ) {

            await weather();

          }


          else if (
            command === "reminder"
          ) {

            const minutes =
              prompt(
                "How many minutes from now?"
              );

            const message =
              prompt(
                "What should I remind you about?"
              );


            if (
              minutes &&
              message
            ) {

              setTimeout(

                () => {

                  log(
                    "JARVIS",
                    "⏰ Reminder: " +
                    message
                  );

                  speak(
                    "Reminder. " +
                    message
                  );

                },

                Number(minutes) *
                60 *
                1000
              );


              speak(
                "Reminder set."
              );
            }

          }


          else if (
            command === "page"
          ) {

            speak(
              "Page summaries aren't available in GitHub Pages mode yet."
            );

          }

        }
      );
    }
  );


// ======================================================
// START JARVIS
// ======================================================

function startJarvis() {

  try {

    history =
      JSON.parse(
        localStorage.getItem(
          "jarvis_history"
        ) || "[]"
      );

  } catch {

    history = [];
  }


  const apiKey =
    getApiKey();


  $("keyStatus").textContent =
    apiKey
      ? "KEY: SET"
      : "KEY: NOT SET";


  if (
    history.length === 0
  ) {

    log(
      "JARVIS",
      "System ready. Say “Jarvis” or type a message."
    );

  } else {

    history
      .slice(-6)
      .forEach(
        item => {

          log(
            item.role === "user"
              ? "YOU"
              : "JARVIS",
            item.text
          );

        }
      );
  }


  initRecognition();
}


startJarvis();
