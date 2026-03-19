require("dotenv").config();

const Groq = require("groq-sdk");
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const groq = new Groq({
    apiKey: "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"
});

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// 🔴 KEYS
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH;
const murfApiKey = process.env.MURF_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;
const client = twilio(accountSid, authToken);

// 👉 Start call
app.post("/call", async (req, res) => {
    const phone = req.body.phone;

    try {
        await client.calls.create({
            to: phone,
            from: twilioNumber,
            url: "https://avowed-anthony-unyielded.ngrok-free.dev/voice"
        });

        res.send("Calling you now 🚀");
    } catch (err) {
        res.send(err.message);
    }
});

// 👉 Initial voice
app.all("/voice", (req, res) => {
    res.type("text/xml");

    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" action="/ai">
        <Say>Hello! Welcome to my AI powered calling system. Tell me how I can help you.</Say>
    </Gather>
</Response>`);
});

// 👉 AI processing (Groq)
app.all("/ai", async (req, res) => {
    const userSpeech = req.body?.SpeechResult || "Hello";

    console.log("USER SAID:", userSpeech);

    let aiText = "";

    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: "You are a professional AI voice assistant. Speak short, natural responses."
                },
                {
                    role: "user",
                    content: userSpeech
                }
            ]
        });

        aiText = completion.choices[0].message.content;

    } catch (err) {
        console.log("GROQ ERROR:", err.message);
        aiText = `You said ${userSpeech}. I am here to help you`;
    }

    res.type("text/xml");

    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Redirect>/murf?text=${encodeURIComponent(aiText)}</Redirect>
</Response>`);
});

// 👉 Murf + Download + Local Play
app.all("/murf", async (req, res) => {

    let text = req.query.text || "Hello";

    // 🔥 CLEAN TEXT
    text = text
        .replace(/[^a-zA-Z0-9 .,?!]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 150);

    console.log("FINAL TEXT:", text);

    try {
        // 1️⃣ Generate audio from Murf
        const response = await axios.post(
            "https://api.murf.ai/v1/speech/generate",
            {
                text: text,
                voiceId: "en-US-natalie"
            },
            {
                headers: {
                    "api-key": murfApiKey,
                    "Content-Type": "application/json"
                }
            }
        );

        const audioUrl = response.data.audioFile;

        console.log("MURF AUDIO URL:", audioUrl);

        // 2️⃣ Download audio
        const audioResp = await axios.get(audioUrl, { responseType: "arraybuffer" });

        const filePath = path.join(__dirname, "voice.wav");
        fs.writeFileSync(filePath, audioResp.data);

        // 3️⃣ Serve from your server
        const localAudioUrl = `${req.protocol}://${req.get("host")}/voice.wav`;

        res.type("text/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${localAudioUrl}</Play>
    <Gather input="speech" action="/ai">
        <Say>You can continue speaking</Say>
    </Gather>
</Response>`);

    } catch (err) {
        console.log("MURF ERROR:", err.response?.data || err.message);

        res.type("text/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Voice system fallback working</Say>
    <Gather input="speech" action="/ai">
        <Say>Please continue</Say>
    </Gather>
</Response>`);
    }
});

// 👉 Serve local audio
app.get("/voice.wav", (req, res) => {
    const filePath = path.join(__dirname, "voice.wav");
    res.sendFile(filePath);
});

app.listen(3000, () => console.log("Server running on port 3000"));