module.exports = {
    apps: [
        {
            name: "MC-Server-Manager",
            script: "./src/index.js",

            time: true,

            autorestart: true,
            watch: false,
            max_memory_restart: "500M",
        }
    ]
}